import { execFileSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { _android as android } from '../frontend/node_modules/playwright-core/index.mjs'

const output = 'android-artifacts'
const packageId = 'com.ericaystudio.kadi.pilot'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 }).trim()
const screenshot = name => writeFile(output + '/' + name + '.png', execFileSync('adb', ['exec-out', 'screencap', '-p']))
await mkdir(output, { recursive: true })
adb('install', '-r', 'frontend/android/smoke-recipient/build/outputs/apk/debug/smoke-recipient-debug.apk')
adb('install', '-r', output + '/Kadi-Android-pilote.apk')
adb('shell', 'am', 'start', '-n', packageId + '/com.ericaystudio.kadi.MainActivity')
await pause(2000)
await screenshot('android-start')
let device
try {
  const devices = await android.devices({ omitDriverInstall: true })
  device = devices[0]
  assert.ok(device, 'An Android emulator must be attached')
  device.setDefaultTimeout(60000)
  console.log('Connecting to the installed Android WebView')
  const webview = await device.webView({ pkg: packageId })
  const page = await webview.page()
  const errors = []
  const failedRequests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => failedRequests.push({ url: request.url().split('?')[0], error: request.failure()?.errorText }))
  await page.locator('input[type="password"]').waitFor({ state: 'visible' })
  // A newly booted emulator can render bundled assets before Android has
  // finished configuring its network. Wait for validated connectivity.
  await page.waitForFunction(async () => (await window.Capacitor.nativePromise('Network', 'getStatus', {})).connected, null, { polling: 1000, timeout: 60000 })
  const initial = await page.evaluate(() => ({
    origin: location.origin, path: location.pathname,
    native: window.Capacitor.isNativePlatform(), platform: window.Capacitor.getPlatform(),
    safe: document.documentElement.dataset.nativePlatform,
    password: !!document.querySelector('input[type="password"]'),
    overflow: document.documentElement.scrollWidth > innerWidth
  }))
  assert.equal(initial.origin, 'https://localhost'); assert.equal(initial.platform, 'android')
  assert.equal(initial.safe, 'android'); assert.equal(initial.password, true); assert.equal(initial.overflow, false)
  await screenshot('android-login')
  console.log('Native login screen and safe layout passed; checking HTTPS API')
  // Real HTTPS requests from the packaged app origin; no identity or business writes.
  const network = await page.evaluate(async () => {
    const base = 'https://kadi-facture.onrender.com/api'
    const get = async path => {
      let failure
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await fetch(base + path, { signal: AbortSignal.timeout(90000) }) } catch (error) {
          failure = error
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      throw failure
    }
    const health = await get('/health')
    const privateRoute = await get('/auth/profile')
    return { health: health.status, privateRoute: privateRoute.status }
  })
  await writeFile(output + '/network.json', JSON.stringify({ network, failedRequests }, null, 2))
  assert.equal(network.health, 200); assert.equal(network.privateRoute, 401)
  console.log('HTTPS API and private route denial passed; checking native PDF sharing')
  const share = await page.evaluate(() => window.Capacitor.nativePromise('Share', 'canShare', {}))
  assert.equal(share.value, true)
  const file = await page.evaluate(() => window.Capacitor.nativePromise('Filesystem', 'writeFile', {
    path: 'kadi-pdf/smoke/devis-test.pdf', directory: 'CACHE',
    data: btoa('%PDF-1.4\nKadi Android smoke test'), recursive: true
  }))
  assert.ok(file.uri.startsWith('file:'))
  await page.evaluate(uri => {
    window.Capacitor.nativePromise('Share', 'share', { files: [uri], title: 'devis-test.pdf', dialogTitle: 'Partager le PDF' }).catch(() => {})
  }, file.uri)
  await pause(1500)
  // Android initially shows only its suggested targets. Expand the sheet so
  // the separate PDF receiver is visible alongside the other installed apps.
  await screenshot('android-share-collapsed')
  const screenSize = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/)
  assert.ok(screenSize, 'Emulator screen dimensions must be available')
  const screenWidth = Number(screenSize[1]), screenHeight = Number(screenSize[2])
  adb('shell', 'input', 'swipe', String(Math.round(screenWidth / 2)), String(Math.round(screenHeight * 0.61)), String(Math.round(screenWidth / 2)), String(Math.round(screenHeight * 0.2)), '500')
  await pause(500)
  adb('shell', 'uiautomator', 'dump', '/sdcard/kadi-share.xml')
  const chooser = adb('shell', 'cat', '/sdcard/kadi-share.xml')
  await writeFile(output + '/android-share.xml', chooser)
  const receiver = (chooser.match(/<node\b[^>]*>/g) || []).find(node => /(?:text|content-desc)="[^"]*Kadi PDF[^"]*"/.test(node))
  assert.ok(receiver, 'PDF recipient must be visible in the active Android chooser')
  await screenshot('android-share')
  const bounds = receiver.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  assert.ok(bounds, 'PDF recipient must have tappable bounds')
  adb('shell', 'input', 'tap', String(Math.round((Number(bounds[1]) + Number(bounds[3])) / 2)), String(Math.round((Number(bounds[2]) + Number(bounds[4])) / 2)))
  let receipt = ''
  for (let i = 0; i < 20; i++) {
    receipt = adb('logcat', '-d', '-s', 'KadiPdfTest:I', '*:S')
    if (receipt.includes('PDF_READ_OK')) break
    await pause(250)
  }
  assert.match(receipt, /PDF_READ_OK/, 'Recipient must read the granted PDF content URI')
  await screenshot('android-pdf-received')
  adb('shell', 'am', 'start', '-n', packageId + '/com.ericaystudio.kadi.MainActivity')
  assert.equal(await page.evaluate(() => {
    localStorage.setItem('kadi-smoke-persistence', '1'); return localStorage.getItem('kadi-smoke-persistence')
  }), '1')
  await page.reload()
  await page.locator('input[type="password"]').waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => localStorage.getItem('kadi-smoke-persistence')), '1')
  await page.evaluate(() => localStorage.removeItem('kadi-smoke-persistence'))
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  await pause(500)
  const minimized = !/mResumedActivity:.*com\.ericaystudio\.kadi/.test(adb('shell', 'dumpsys', 'activity', 'activities'))
  assert.equal(minimized, true, 'Back at login must minimize the app')
  assert.deepEqual(errors, [])
  await writeFile(output + '/verification.json', JSON.stringify({ initial, network, shareAvailable: true, pdfChooser: true, recipientReadPdf: true, localPersistence: true, backMinimizes: minimized, testedAt: new Date().toISOString() }, null, 2))
  console.log('Android emulator: native login, safe layout, HTTPS API, private route denial, PDF share, persistence and system back passed.')
} catch (error) {
  await screenshot('android-failure').catch(() => {})
  await writeFile(output + '/android-logcat.txt', adb('logcat', '-d', '-t', '800')).catch(() => {})
  await writeFile(output + '/failure.txt', String(error.stack || error))
  throw error
} finally { if (device) await device.close() }
