import { describe, test, expect } from 'vitest'
import { sanitizeInvoicePayload, sanitizeProductPayload, validateInvoiceState } from '../utils/validation.js'
import { computeTotals } from '../utils/money.js'

describe('Exact bounded invoice calculations', () => {
  test('rounds lines half up before adding them', () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }]).subtotal).toBe(0.3)
    expect(computeTotals([{ quantity: 0.5, unitPrice: 0.01 }]).subtotal).toBe(0.01)
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
