import { vi as jest, test, expect, beforeEach } from 'vitest'
let database
let controller
let existing
let updatePayload
let writes
let reads
let rows
let stale
const clientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const draft = () => ({ id: 'invoice-1', tenant_id: 'tenant-1', client_id: clientId, version: 0,
  status: 'draft', currency: 'USD', issue_date: '2026-10-22', due_date: '2026-11-22',
  items: [{ description: 'Audit', quantity: 1, unitPrice: 10 }], total_amount: 10,
  client: { id: clientId, tenant_id: 'tenant-1', company_name: 'Original client' } })
beforeEach(async () => {
  jest.resetModules()
  existing = draft(); updatePayload = null; writes = []; reads = []; rows = []; stale = false
  database = { from: jest.fn((table) => {
    let operation = 'read'
    const filters = []
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn((key, value) => { filters.push([key, value]); return query }),
      gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      update: jest.fn((payload) => { operation = 'update'; updatePayload = payload; writes.push({ table, operation }); return query }),
      insert: jest.fn((payload) => { operation = 'insert'; updatePayload = payload; writes.push({ table, operation }); return query }),
      delete: jest.fn(() => { operation = 'delete'; writes.push({ table, operation }); return query }),
      range: jest.fn(async (from, to) => { reads.push({ table, filters, from, to }); return { data: rows.filter((row) => filters.every(([key, value]) => row[key] === value)).slice(from, to + 1), error: null } }),
      maybeSingle: jest.fn(async () => {
        reads.push({ table, filters, operation })
        if (table === 'clients') return { data: draft().client, error: null }
        return { data: operation === 'update' ? (stale ? null : { ...existing, ...updatePayload }) : existing, error: null }
      }),
      single: jest.fn(async () => ({ data: { ...existing, ...updatePayload }, error: null }))
    }
    return query
  }), storage: { from: jest.fn() } }
  await jest.doMock('../models/supabaseClient.js', () => ({ supabase: database }))
  controller = await import('../controllers/invoiceController.js')
})
const invoke = async (name, body = {}) => {
  const req = { tenantId: 'tenant-1', user: { id: 'user-1' }, profile: { company: 'Issuer original' }, params: { id: 'invoice-1' }, query: {}, body }
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() }
  const next = jest.fn()
  await controller[name](req, res, next)
  return { req, res, next }
}
test.each(['updateInvoice', 'deleteInvoice'])('rejects changing or deleting a paid invoice through %s', async (name) => {
  existing.status = 'paid'
  const { next } = await invoke(name, { notes: 'rewrite history' })
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }))
  expect(writes).toEqual([])
})
test('checks PATCH dates against stored dates', async () => {
  const { next } = await invoke('updateInvoice', { due_date: '2026-10-21' })
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }))
  expect(writes).toEqual([])
})
test('checks a currency-only PATCH against stored items', async () => {
  existing.items[0].currency = 'USD'
  const { next } = await invoke('updateInvoice', { currency: 'CDF' })
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }))
  expect(writes).toEqual([])
})
test('issuing captures immutable issuer/client details and guards against concurrent updates', async () => {
  const { next, res } = await invoke('updateInvoice', { status: 'sent' })
  expect(next).not.toHaveBeenCalled()
  expect(updatePayload.client_snapshot.company_name).toBe('Original client')
  expect(updatePayload.issuer_snapshot.company).toBe('Issuer original')
  expect(updatePayload.issued_at).toBeTruthy()
  expect(reads.at(-1).filters).toContainEqual(['version', 0])
  expect(res.json).toHaveBeenCalled()
})
test('stale update returns a conflict instead of overwriting an issued document', async () => {
  stale = true
  const { next } = await invoke('updateInvoice', { notes: 'edit' })
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }))
})
test('service-role joins never expose a foreign tenant’s client', async () => {
  existing.client.tenant_id = 'tenant-2'
  const { res } = await invoke('getInvoice')
  expect(res.json.mock.calls[0][0].client).toBeNull()
})
test('summary filters currency before aggregation and reads beyond the first server page', async () => {
  rows = [...Array.from({ length: 501 }, (_, i) => ({ ...draft(), id: String(i), status: 'paid', paid_at: '2026-10-24', total_amount: 1 })),
    { ...draft(), id: 'cdf', currency: 'CDF', total_amount: 100000 }]
  const { res, next } = await invoke('getSummary')
  expect(next).not.toHaveBeenCalled()
  expect(res.json.mock.calls[0][0].totals.revenue).toBe(501)
  expect(res.json.mock.calls[0][0].totals.averagePaymentDelay).toBe(2)
  expect(res.json.mock.calls[0][0].meta.currency).toBe('USD')
  expect(reads).toHaveLength(2)
})
test('issued invoices without historical snapshots cannot be re-created from today’s profile', async () => {
  existing.status = 'sent'
  const { next } = await invoke('streamInvoicePdf')
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 422 }))
})
