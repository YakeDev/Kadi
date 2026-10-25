import { describe, test, expect } from 'vitest'
import { sanitizeInvoicePayload, sanitizeProductPayload, validateInvoiceState } from '../utils/validation.js'
import { computeTotals } from '../utils/money.js'

describe('Exact bounded invoice calculations', () => {
  test('rounds lines half up before adding them', () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }]).subtotal).toBe(0.3)
    expect(computeTotals([{ quantity: 0.5, unitPrice: 0.01 }]).subtotal).toBe(0.01)
  })
  test('computes optional tax in cents and includes it in the invoice limit', () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 100 }], 16)).toMatchObject({ subtotal: 100, taxRate: 16, taxAmount: 16, total: 116 })
    expect(computeTotals([{ quantity: 1, unitPrice: 0.01 }], 50).taxAmount).toBe(0.01)
    expect(() => computeTotals([{ quantity: 1000, unitPrice: 1_000_000_000 }], 16)).toThrow('hors limites')
    for (const rate of [-1, 101, 1.001, true, {}, NaN]) expect(() => computeTotals([], rate)).toThrow('taux de taxe')
  })
  test('new invoices accept only canonical USD/CDF and cannot supply their own calculated tax', () => {
    for (const currency of ['USD', 'CDF']) expect(sanitizeInvoicePayload({ currency }).currency).toBe(currency)
    for (const currency of ['$', 'EUR', 'GBP']) expect(() => sanitizeInvoicePayload({ currency })).toThrow('USD et CDF')
    expect(() => sanitizeInvoicePayload({ tax_amount: 999 })).toThrow('protégés')
  })
  test('rejects finite inputs whose product overflows and prices with excessive precision', () => {
    expect(() => computeTotals([{ quantity: 1e200, unitPrice: 1e200 }])).toThrow()
    expect(() => sanitizeInvoicePayload({ items: [{ description: 'x', quantity: 1, unitPrice: 1.001 }] })).toThrow()
  })
  test('rejects rolled-over dates and mixed currency lines', () => {
    expect(() => sanitizeInvoicePayload({ issue_date: '2026-02-31' })).toThrow('date valide')
    expect(() => sanitizeInvoicePayload({ currency: 'USD', items: [{ description: 'x', quantity: 1, unitPrice: 2, currency: 'CDF' }] })).toThrow('Toutes les lignes')
    expect(() => validateInvoiceState({ status: 'draft', currency: 'USD', items: [], issue_date: '2026-04-02', due_date: '2026-04-01' })).toThrow('échéance')
  })
  test.each([{ unit_price: -1 }, { unit_price: 'bad' }, { is_active: 'false' }, { item_type: 'invalid' }, { name: 'x'.repeat(161) }])('rejects invalid catalogue data %j', (partial) => {
    expect(() => sanitizeProductPayload({ name: 'Article', ...partial })).toThrow()
  })
})
