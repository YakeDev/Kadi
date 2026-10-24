import { test, expect, vi, beforeEach } from 'vitest'
const mocks = vi.hoisted(() => ({ signed: vi.fn(), upload: vi.fn(), remove: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { from: () => ({ createSignedUrl: mocks.signed, upload: mocks.upload, remove: mocks.remove }) } }) }))
import { resolveCompanyLogo, uploadCompanyLogo, deleteCompanyLogo } from '../services/supabase.js'

beforeEach(() => { mocks.signed.mockReset(); mocks.upload.mockReset(); mocks.remove.mockReset() })
test('keeps the complete signed URL from the backend', async () => {
  const url = 'https://test-project.supabase.co/storage/v1/object/sign/logos/user-1/logo.png?token=secret-signature'
  expect(await resolveCompanyLogo(url)).toBe(url)
  expect(mocks.signed).not.toHaveBeenCalled()
})
test('upload previews use signed URLs for a private bucket', async () => {
  mocks.upload.mockResolvedValue({ error: null })
  mocks.signed.mockResolvedValue({ data: { signedUrl: 'https://signed.example/preview' }, error: null })
  const result = await uploadCompanyLogo(new File(['png'], 'logo.png', { type: 'image/png' }), 'user-1')
  expect(result.previewUrl).toBe('https://signed.example/preview')
  expect(mocks.signed).toHaveBeenCalledWith(result.storagePath, 3600)
})
test('rejects external references and refuses to delete another user’s logo', async () => {
  expect(await resolveCompanyLogo('https://evil.example/logo.png')).toBeNull()
  await deleteCompanyLogo('user-2/logo.png', 'user-1')
  expect(mocks.remove).not.toHaveBeenCalled()
})

test('rejects SVG uploads because the private bucket only permits PNG, JPEG and WebP', async () => {
  const malicious = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'logo.svg', { type: 'image/svg+xml' })
  await expect(uploadCompanyLogo(malicious, 'user-1')).rejects.toThrow(/PNG, JPEG ou WebP/)
  expect(mocks.upload).not.toHaveBeenCalled()
})
test('rejects logos larger than the 1 MiB application cap before any network upload', async () => {
  const huge = new File([new Uint8Array(1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })
  await expect(uploadCompanyLogo(huge, 'user-1')).rejects.toThrow(/1 Mo/)
  expect(mocks.upload).not.toHaveBeenCalled()
})
