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
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('input[type="password"]').waitFor({ state: 'visible' })
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
    const health = await fetch(base + '/health', { signal: AbortSignal.timeout(90000) })
    const privateRoute = await fetch(base + '/auth/profile', { signal: AbortSignal.timeout(90000) })
    return { health: health.status, privateRoute: privateRoute.status }
  })
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
  adb('shell', 'uiautomator', 'dump', '/sdcard/kadi-share.xml')
  const chooser = adb('shell', 'cat', '/sdcard/kadi-share.xml')
  const receiver = (chooser.match(/<node\b[^>]*>/g) || []).find(node => /(?:text|content-desc)="[^"]*Kadi PDF[^"]*"/.test(node))
  assert.ok(receiver, 'PDF recipient must be visible in the active Android chooser')
  await screenshot('android-share')
  const bounds = receiver.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  assert.ok(bounds, 'PDF recipient must have tappable bounds')
  adb('shell', 'input', 'tap', String(Math.round((Number(bounds[1]) + Number(bounds[3])) / 2)), String(Math.round((Number(bounds[2]) + Number(bounds[4])) / 2)))
  await pause(500)
  assert.match(adb('logcat', '-d', '-s', 'KadiPdfTest:I', '*:S'), /PDF_READ_OK/, 'Recipient must read the granted PDF content URI')
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
