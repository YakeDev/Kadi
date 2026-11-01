import { beforeEach, expect, test, vi } from 'vitest'

let controller, database, authClient, mail
const chain = result => {
  const q = {}
  for (const method of ['select', 'eq', 'not', 'order', 'limit', 'in', 'gt', 'update', 'insert', 'range']) q[method] = vi.fn(() => q)
  q.maybeSingle = vi.fn(async () => result)
  q.single = vi.fn(async () => result)
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  return q
}
const reply = () => {
  const res = { setHeader: vi.fn(), json: vi.fn(), status: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}
const principal = { user: { id: '11111111-1111-4111-8111-111111111111', email: 'owner@example.invalid', email_confirmed_at: '2026-01-01' }, tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }

beforeEach(async () => {
  vi.resetModules()
  mail = vi.fn()
  authClient = { auth: { signInWithPassword: vi.fn() } }
  database = { from: vi.fn(), rpc: vi.fn(), auth: { admin: { deleteUser: vi.fn() } },
    storage: { from: vi.fn(() => ({ list: vi.fn(async () => ({ data: [], error: null })), remove: vi.fn() })) } }
  vi.doMock('../models/supabaseClient.js', () => ({ supabase: database, createAuthClient: () => authClient }))
  vi.doMock('../utils/mailer.js', () => ({ isMailConfigured: () => true, sendMail: mail }))
  controller = await import('../controllers/accountLifecycleController.js')
})

test('a logged-in deletion request requires a verified identity and current password', async () => {
  const res = reply(), next = vi.fn()
  authClient.auth.signInWithPassword.mockResolvedValue({ error: { message: 'wrong' } })
  await controller.requestDeletion({ ...principal, body: { password: 'wrong', exportAcknowledged: true } }, res, next)
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400, message: 'Mot de passe invalide.' }))
  expect(database.from).not.toHaveBeenCalled()

  next.mockClear()
  const lookup = chain({ data: null, error: null })
  const inserted = chain({ data: { id: 'request-1', status: 'pending_review' }, error: null })
  database.from.mockReturnValueOnce(lookup).mockReturnValueOnce(inserted)
  authClient.auth.signInWithPassword.mockResolvedValue({ error: null })
  await controller.requestDeletion({ ...principal, body: { password: 'valid', exportAcknowledged: true } }, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: principal.user.id, tenant_id: principal.tenantId, status: 'pending_review', verified_at: expect.any(String)
  }))
  expect(res.status).toHaveBeenCalledWith(201)
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store')
})

test('public requests do not reveal whether an address has an account', async () => {
  database.rpc.mockResolvedValue({ data: [], error: null })
  const res = reply(), next = vi.fn()
  await controller.requestDeletionPublic({ body: { email: 'unknown@example.invalid' } }, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(res.status).toHaveBeenCalledWith(202)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Si cette adresse') }))
  expect(mail).not.toHaveBeenCalled()
})

test('an email provider failure also returns the generic public response', async () => {
  database.rpc.mockResolvedValue({ data: [{ id: principal.user.id, tenant_id: principal.tenantId, email: principal.user.email }], error: null })
  const lookup = chain({ data: null, error: null })
  const created = chain({ error: null })
  const cancelled = chain({ error: null })
  database.from.mockReturnValueOnce(lookup).mockReturnValueOnce(created).mockReturnValueOnce(cancelled)
  mail.mockResolvedValue({ sent: false })
  const res = reply(), next = vi.fn()
  await controller.requestDeletionPublic({ body: { email: principal.user.email } }, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(res.status).toHaveBeenCalledWith(202)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Si cette adresse') }))
  expect(cancelled.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled', email: null }))
})

test('the public path sends a single-use token and confirms it before admin review', async () => {
  database.rpc.mockResolvedValue({ data: [{ id: principal.user.id, tenant_id: principal.tenantId, email: principal.user.email }], error: null })
  const lookup = chain({ data: null, error: null }), inserted = chain({ error: null }), verified = chain({ data: { id: 'request-1' }, error: null })
  database.from.mockReturnValueOnce(lookup).mockReturnValueOnce(inserted).mockReturnValueOnce(verified)
  mail.mockResolvedValue({ sent: true })
  const res = reply(), next = vi.fn()
  await controller.requestDeletionPublic({ body: { email: principal.user.email } }, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(inserted.insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_verification', verification_hash: expect.stringMatching(/^[0-9a-f]{64}$/) }))
  const token = new URL(mail.mock.calls[0][0].text.match(/https:\/\/\S+/)[0]).searchParams.get('token')
  await controller.verifyDeletionRequest({ body: { token } }, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(verified.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_review', verification_hash: null }))
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Demande vérifiée') }))
})

test('processing checks SQL authorization before Storage and Auth, then anonymizes the request', async () => {
  const item = { id: 'request-1', user_id: '22222222-2222-4222-8222-222222222222', tenant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    status: 'pending_review', verified_at: '2026-01-01', email: 'other@example.invalid' }
  const read = chain({ data: item, error: null })
  const completed = chain({ data: { id: item.id }, error: null })
  database.from.mockReturnValueOnce(read).mockReturnValueOnce(completed)
  const operations = []
  database.rpc.mockImplementation(async () => { operations.push('sql'); return { data: { user_id: item.user_id, stage: 'data_erased' }, error: null } })
  database.storage.from.mockImplementation(() => ({ list: async () => { operations.push('storage'); return { data: [], error: null } } }))
  database.auth.admin.deleteUser.mockImplementation(async () => { operations.push('auth'); return { error: null } })
  const res = reply(), next = vi.fn()
  await controller.processDeletionRequest({ ...principal, params: { id: item.id } }, res, next)
  expect(next).not.toHaveBeenCalled()
  expect(operations).toEqual(['sql', 'storage', 'auth'])
  expect(database.rpc).toHaveBeenCalledWith('kadi_erase_requested_account', { p_request_id: item.id, p_actor_id: principal.user.id })
  expect(completed.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', email: null, user_id: expect.not.stringMatching(item.user_id) }))
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('supprimés') }))
})

test('a failed SQL check cannot remove any logo or Auth identity', async () => {
  const item = { id: 'request-2', user_id: '22222222-2222-4222-8222-222222222222', status: 'pending_review', verified_at: '2026-01-01' }
  database.from.mockReturnValue(chain({ data: item, error: null }))
  database.rpc.mockResolvedValue({ data: null, error: { message: 'Compte partagé' } })
  const next = vi.fn()
  await controller.processDeletionRequest({ ...principal, params: { id: item.id } }, reply(), next)
  expect(next).toHaveBeenCalled()
  expect(database.storage.from).not.toHaveBeenCalled()
  expect(database.auth.admin.deleteUser).not.toHaveBeenCalled()
})
