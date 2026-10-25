import { beforeEach, describe, expect, test, vi } from 'vitest'
import { sanitizePaymentPayload, sanitizePaymentVoid } from '../utils/validation.js'
import { invoicePaymentSummary, paymentBusinessDate } from '../utils/payments.js'

const database = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../models/supabaseClient.js', () => ({ supabase: database }))
import { recordPayment, voidPayment } from '../controllers/paymentController.js'

const key = '11111111-1111-4111-8111-111111111111'
const payload = () => ({ idempotency_key: key, amount: '150.25', paid_on: '2026-01-05', method: 'cash', reference: ' Reçu 001 ' })
beforeEach(() => { vi.clearAllMocks(); database.rpc.mockResolvedValue({ data: key, error: null }) })

describe('payment validation', () => {
  test('normalizes exact cents and the optional reference', () => {
    expect(sanitizePaymentPayload(payload())).toEqual({ ...payload(), amount: 150.25, reference: 'Reçu 001' })
  })
  test.each([0, -1, 1.005, NaN, Infinity, true, null, {}, [], '1e2', '150,25', '', '1000000000001'])('rejects invalid amount %j', (amount) => {
    expect(() => sanitizePaymentPayload({ ...payload(), amount })).toThrow()
  })
  test.each([{ tenant_id: 'foreign' }, { currency: 'CDF' }, { status: 'paid' }, { paid_amount: 350 }, { paid_on: '2026-02-30' },
    { paid_on: '2099-01-01' }, { idempotency_key: 'bad' }, { method: 'unknown' }])('rejects unsafe or invalid fields %j', (patch) => {
    expect(() => sanitizePaymentPayload({ ...payload(), ...patch })).toThrow()
  })
  test('requires an explicit correction reason', () => {
    expect(sanitizePaymentVoid({ reason: '  Double saisie  ' })).toBe('Double saisie')
    expect(() => sanitizePaymentVoid({ reason: '  ' })).toThrow()
    expect(() => sanitizePaymentVoid({ reason: 'ok' })).toThrow()
    expect(() => sanitizePaymentVoid({ reason: 'Erreur', amount: 50 })).toThrow()
  })
  test('uses the Lubumbashi calendar day and exact remaining cents', () => {
    expect(paymentBusinessDate(new Date('2026-10-24T23:00:00Z'))).toBe('2026-10-25')
    expect(invoicePaymentSummary({ status: 'partially_paid', total_amount: 0.3, paid_amount: 0.1 }).balance_due).toBe(0.2)
    expect(invoicePaymentSummary({ status: 'partially_paid', total_amount: 350, paid_amount: 150, due_date: '2020-01-01' })).toMatchObject({ paid_amount: 150, balance_due: 200, is_overdue: true })
  })
})

const invoke = async (handler, body) => {
  const req = { body, tenantId: 'tenant-from-session', params: { id: 'invoice-id', paymentId: key }, user: { id: 'actor-from-session' } }
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
  const next = vi.fn()
  await handler(req, res, next)
  return { res, next }
}
test('recording is a single atomic RPC using only the authenticated tenant and actor', async () => {
  const { res, next } = await invoke(recordPayment, payload())
  expect(next).not.toHaveBeenCalled()
  expect(res.status).toHaveBeenCalledWith(201)
  expect(database.rpc).toHaveBeenCalledExactlyOnceWith('record_kadi_payment', {
    p_tenant_id: 'tenant-from-session', p_invoice_id: 'invoice-id', p_payment_id: key,
    p_amount: 150.25, p_paid_on: '2026-01-05', p_method: 'cash', p_reference: 'Reçu 001', p_actor_id: 'actor-from-session'
  })
  expect(database.from).not.toHaveBeenCalled()
})
test('database conflicts propagate instead of being reported as successful receipts', async () => {
  database.rpc.mockResolvedValue({ data: null, error: { code: 'PT409', message: 'Solde dépassé' } })
  const { res, next } = await invoke(recordPayment, payload())
  expect(res.json).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith({ code: 'PT409', message: 'Solde dépassé' })
})
test('voiding preserves invoice, payment and authenticated identity in the atomic operation', async () => {
  const { next } = await invoke(voidPayment, { reason: 'Double saisie' })
  expect(next).not.toHaveBeenCalled()
  expect(database.rpc).toHaveBeenCalledExactlyOnceWith('void_kadi_payment', {
    p_tenant_id: 'tenant-from-session', p_invoice_id: 'invoice-id', p_payment_id: key,
    p_reason: 'Double saisie', p_actor_id: 'actor-from-session'
  })
})
