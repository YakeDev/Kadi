import { execFileSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = 'android-artifacts'
const packageId = 'com.ericaystudio.kadi.pilot'
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 30000 }).trim()
await mkdir(output, { recursive: true })
adb('install', '-r', `${output}/Kadi-Android-pilote.apk`)
adb('shell', 'am', 'start', '-n', `${packageId}/com.ericaystudio.kadi.MainActivity`)
let targets
for (let i = 0; i < 60; i++) {
  try {
    const pid = adb('shell', 'pidof', packageId).split(' ')[0]
    if (pid) {
      adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`)
      targets = await fetch('http://127.0.0.1:9222/json').then(response => response.json())
      if (targets.some(target => target.webSocketDebuggerUrl)) break
    }
  } catch { /* WebView is starting. */ }
  await pause(1000)
}
assert.ok(targets?.length, 'Android WebView must start')
const target = targets.find(item => item.webSocketDebuggerUrl)
const endpoint = new URL(target.webSocketDebuggerUrl)
endpoint.host = '127.0.0.1:9222'
const socket = new WebSocket(endpoint)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let sequence = 0
const pending = new Map()
socket.addEventListener('message', event => {
  const message = JSON.parse(String(event.data))
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id); clearTimeout(request.timer)
  if (message.error) request.reject(new Error(JSON.stringify(message.error)))
  else request.resolve(message.result)
})
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 120000)
  pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
try {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`document.querySelector('input[type="password"]') !== null`)) break
    await pause(1000)
  }
  const initial = await evaluate(`({origin:location.origin,path:location.pathname,native:window.Capacitor.isNativePlatform(),platform:window.Capacitor.getPlatform(),safe:document.documentElement.dataset.nativePlatform,password:!!document.querySelector('input[type="password"]'),overflow:document.documentElement.scrollWidth>innerWidth})`)
  assert.equal(initial.origin, 'https://localhost'); assert.equal(initial.platform, 'android')
  assert.equal(initial.safe, 'android'); assert.equal(initial.password, true); assert.equal(initial.overflow, false)
  const loginScreenshot = await cdp('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${output}/android-login.png`, Buffer.from(loginScreenshot.data, 'base64'))
  // Real HTTPS requests from the packaged app origin, no identity or business data.
  const network = await evaluate(`(async()=>{const base='https://kadi-facture.onrender.com/api';const health=await fetch(base+'/health');const privateRoute=await fetch(base+'/auth/profile');return {health:health.status,privateRoute:privateRoute.status}})()`)
  assert.equal(network.health, 200); assert.equal(network.privateRoute, 401)
  const share = await evaluate(`window.Capacitor.nativePromise('Share','canShare',{})`)
  assert.equal(share.value, true)
  const file = await evaluate(`window.Capacitor.nativePromise('Filesystem','writeFile',{path:'kadi-pdf/smoke/devis-test.pdf',directory:'CACHE',data:btoa('%PDF-1.4\\nKadi Android smoke test'),recursive:true})`)
  assert.ok(file.uri.startsWith('file:'))
  await evaluate(`window.__kadiSmokeShare=window.Capacitor.nativePromise('Share','share',{files:[${JSON.stringify(file.uri)}],title:'devis-test.pdf',dialogTitle:'Partager le PDF'}).catch(()=>null);true`)
  await pause(1500)
  const activity = adb('shell', 'dumpsys', 'activity', 'activities')
  assert.match(activity, /ChooserActivity/, 'Android share chooser must open')
  await writeFile(`${output}/android-share.png`, execFileSync('adb', ['exec-out', 'screencap', '-p']))
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  await pause(500)
  adb('shell', 'am', 'start', '-n', `${packageId}/com.ericaystudio.kadi.MainActivity`)
  const stored = await evaluate(`localStorage.setItem('kadi-smoke-persistence','1');localStorage.getItem('kadi-smoke-persistence')`)
  assert.equal(stored, '1')
  await cdp('Page.reload'); await pause(1200)
  assert.equal(await evaluate(`localStorage.getItem('kadi-smoke-persistence')`), '1')
  await evaluate(`localStorage.removeItem('kadi-smoke-persistence')`)
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
  await pause(500)
  const minimized = !/mResumedActivity:.*com\.ericaystudio\.kadi/.test(adb('shell', 'dumpsys', 'activity', 'activities'))
  assert.equal(minimized, true, 'Back at login must minimize the app')
  await writeFile(`${output}/verification.json`, JSON.stringify({ initial, network, shareAvailable: true, pdfChooser: true, localPersistence: true, backMinimizes: minimized, testedAt: new Date().toISOString() }, null, 2))
  console.log('Android emulator: native login, safe layout, HTTPS API, private route denial, PDF share, persistence and system back passed.')
} finally { socket.close() }
