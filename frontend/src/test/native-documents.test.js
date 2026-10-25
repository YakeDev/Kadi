import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  native: false, get: vi.fn(), writeFile: vi.fn(), readdir: vi.fn(), rmdir: vi.fn(), deleteFile: vi.fn(), share: vi.fn(), canShare: vi.fn()
}))
vi.mock('../services/api.js', () => ({ api: { get: mocks.get } }))
vi.mock('../native/platform.js', () => ({ isNativeAndroid: () => mocks.native }))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: mocks.writeFile, readdir: mocks.readdir, rmdir: mocks.rmdir, deleteFile: mocks.deleteFile } }))
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share, canShare: mocks.canShare } }))
import { downloadDocument } from '../utils/documentDownload.js'
import { clearNativeDocuments } from '../native/documents.js'
beforeEach(() => {
  vi.clearAllMocks(); mocks.native = true
  mocks.get.mockResolvedValue({ data: '%PDF-1.4\nKadi test' })
  mocks.canShare.mockResolvedValue({ value: true })
  mocks.readdir.mockResolvedValue({ files: [] })
  mocks.writeFile.mockResolvedValue({ uri: 'file:///private/cache/kadi-pdf/test/facture.pdf' })
  mocks.share.mockResolvedValue({ activityType: 'recipient.app' })
  mocks.rmdir.mockResolvedValue(); mocks.deleteFile.mockResolvedValue()
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
test('native PDF export authenticates via the existing API and shares only a private cache file', async () => {
  expect(await downloadDocument('/invoices/pdf/1', '../facture 1.pdf')).toEqual({ action: 'shared' })
  expect(mocks.get).toHaveBeenCalledWith('/invoices/pdf/1', { responseType: 'blob' })
  expect(mocks.writeFile).toHaveBeenCalledWith(expect.objectContaining({ directory: 'CACHE', recursive: true, path: expect.stringMatching(/^kadi-pdf\/[a-f0-9-]+\/..-facture-1.pdf$/), data: expect.stringMatching(/^JVBERi0/) }))
  expect(mocks.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///private/cache/kadi-pdf/test/facture.pdf'] }))
})
test('cancelled sharing is silent and removes its temporary PDF', async () => {
  mocks.share.mockRejectedValueOnce(new Error('Share canceled'))
  expect(await downloadDocument('/quotes/pdf/1', 'devis.pdf')).toEqual({ action: 'cancelled' })
  expect(mocks.deleteFile).toHaveBeenCalledOnce()
})
test('failed authorization and unsupported sharing never write a PDF', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Accès refusé'))
  await expect(downloadDocument('/quotes/pdf/converted', 'devis.pdf')).rejects.toThrow('Accès refusé')
  expect(mocks.writeFile).not.toHaveBeenCalled()
  mocks.canShare.mockResolvedValue({ value: false })
  await expect(downloadDocument('/invoices/pdf/1', 'facture.pdf')).rejects.toThrow('indisponible')
  expect(mocks.writeFile).not.toHaveBeenCalled()
})
test('old export directories are removed, recent shared versions are retained', async () => {
  mocks.readdir.mockResolvedValue({ files: [{ name: 'old', type: 'directory', mtime: Date.now() - 48 * 3600000 }, { name: 'recent', type: 'directory', mtime: Date.now() }] })
  await downloadDocument('/invoices/pdf/1', 'facture.pdf')
  expect(mocks.rmdir).toHaveBeenCalledExactlyOnceWith({ directory: 'CACHE', path: 'kadi-pdf/old', recursive: true })
})
test('session cleanup targets only the native PDF cache', async () => {
  await clearNativeDocuments()
  expect(mocks.rmdir).toHaveBeenCalledWith({ directory: 'CACHE', path: 'kadi-pdf', recursive: true })
})
test('web PDF downloads keep the browser path and do not load native file sharing', async () => {
  mocks.native = false
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:test'); static revokeObjectURL = vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const result = await downloadDocument('/invoices/pdf/1', 'facture.pdf')
  expect(result.action).toBe('downloaded'); expect(click).toHaveBeenCalledOnce()
  expect(mocks.writeFile).not.toHaveBeenCalled(); expect(mocks.share).not.toHaveBeenCalled()
})
