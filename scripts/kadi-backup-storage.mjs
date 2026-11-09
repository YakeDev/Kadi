// Invoked only by the manual, main-branch, encrypted backup workflow.
// Never print service keys, signed URLs, invoice data, or Storage object names.
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const projectRef = 'giksqprkorjbgikprksb'
const bucket = 'company-logos'
const baseURL = `https://${projectRef}.supabase.co`
const token = process.env.KADI_BACKUP_SERVICE_ROLE_KEY
const output = process.env.KADI_BACKUP_OUTPUT
const expected = Number(process.env.KADI_EXPECTED_OBJECTS)
if (!token || !output || !Number.isSafeInteger(expected) || expected < 0) {
  throw new Error('Missing or invalid backup configuration')
}
if (!path.isAbsolute(output)) throw new Error('Backup output must be absolute')

const headers = { apikey: token, Authorization: `Bearer ${token}` }
const files = []
let totalBytes = 0
const maxFiles = 20000
const maxFileBytes = 20 * 1024 * 1024
const maxTotalBytes = 512 * 1024 * 1024

function validateSegment(segment) {
  if (!segment || segment === '.' || segment === '..' || /[\\/\x00-\x1f]/.test(segment)) {
    throw new Error('Invalid Storage path segment')
  }
  return segment
}

async function storageRequest(route, options = {}) {
  const response = await fetch(`${baseURL}/storage/v1${route}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: AbortSignal.timeout(60000)
  })
  if (!response.ok) throw new Error(`Storage request failed (HTTP ${response.status})`)
  return response
}

async function walk(prefix = '') {
  let offset = 0
  const limit = 100
  while (true) {
    const response = await storageRequest(`/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } })
    })
    const entries = await response.json()
    if (!Array.isArray(entries)) throw new Error('Unexpected Storage listing format')
    for (const entry of entries) {
      const name = validateSegment(entry.name)
      const objectPath = prefix ? `${prefix}/${name}` : name
      if (entry.id == null) {
        await walk(objectPath)
        continue
      }
      if (++files.length > maxFiles) throw new Error('Excessive number of Storage files')
      const objectURLPath = objectPath.split('/').map(encodeURIComponent).join('/')
      const download = await storageRequest(`/object/authenticated/${bucket}/${objectURLPath}`)
      const content = Buffer.from(await download.arrayBuffer())
      if (content.length > maxFileBytes) throw new Error('Storage object exceeds backup file limit')
      totalBytes += content.length
      if (totalBytes > maxTotalBytes) throw new Error('Storage backup exceeds size limit')
      const local = path.join(output, 'storage', ...objectPath.split('/'))
      await mkdir(path.dirname(local), { recursive: true, mode: 0o700 })
      await writeFile(local, content, { mode: 0o600, flag: 'wx' })
      files[files.length - 1] = {
        objectPath,
        bytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex')
      }
    }
    if (entries.length < limit) break
    offset += limit
  }
}

await walk()
if (files.length !== expected) {
  throw new Error(`Storage object count mismatch (expected ${expected}, got ${files.length})`)
}
await writeFile(path.join(output, 'storage-manifest.json'), JSON.stringify({
  projectRef,
  bucket,
  capturedAt: new Date().toISOString(),
  objectCount: files.length,
  totalBytes,
  files
}, null, 2), { mode: 0o600, flag: 'wx' })
console.log(`Storage backed up: ${files.length} objects; ${totalBytes} bytes`)
