import { describe, expect, test } from 'vitest'
import { computeTotals, allocateNetLineCents } from '../utils/money.js'
import { computeTotals as browserTotals } from '../../frontend/src/utils/invoiceMath.js'
import { sanitizeInvoicePayload, validateInvoiceState } from '../utils/validation.js'

const items = [
  { description: 'Conception', quantity: 2, unitPrice: 100, discountType: 'percent', discountValue: 10 },
  { description: 'Conseil', quantity: 1, unitPrice: 50, discountType: 'fixed', discountValue: 5 }
]

describe('Invoice discounts', () => {
  test('line discounts precede the document discount, then the optional tax', () => {
    const totals = computeTotals(items, 16, { discount_type: 'fixed', discount_value: 25 })
    expect(totals).toMatchObject({ subtotal: 250, lineDiscountAmount: 25, globalDiscountAmount: 25,
      discountAmount: 50, netSubtotal: 200, taxAmount: 32, total: 232 })
    expect(browserTotals(items, 16, { discount_type: 'fixed', discount_value: 25 })).toEqual(totals)
  })
  test('document percentage uses the sum remaining after line discounts', () => {
    expect(computeTotals(items, 0, { discount_type: 'percent', discount_value: 10 }))
      .toMatchObject({ subtotal: 250, lineDiscountAmount: 25, globalDiscountAmount: 22.5, total: 202.5 })
  })
  test('fractional quantities, percentage discounts and tax all round half up in cents', () => {
    expect(computeTotals([{ quantity: 1, unitPrice: 0.05, discountType: 'percent', discountValue: 10 }], 16))
      .toMatchObject({ subtotal: 0.05, lineDiscountAmount: 0.01, netSubtotal: 0.04, taxAmount: 0.01, total: 0.05 })
    expect(computeTotals([{ quantity: 0.125, unitPrice: 0.2, discountType: 'percent', discountValue: 50 }], 16,
      { discount_type: 'percent', discount_value: 50 })).toMatchObject({ subtotal: 0.03, discountAmount: 0.03, total: 0 })
  })
  test.each(['USD', 'CDF'])('API accepts discounts in %s without trusting calculated amounts', (currency) => {
    const payload = sanitizeInvoicePayload({ currency, items, tax_rate: 16, discount_type: 'fixed', discount_value: 25 })
    expect(payload.items[0].discountValue).toBe(10)
    expect(payload.discount_value).toBe(25)
    validateInvoiceState(payload)
    expect(() => sanitizeInvoicePayload({ discount_amount: 1 })).toThrow('protégés')
    expect(() => sanitizeInvoicePayload({ line_discount_amount: 1 })).toThrow('protégés')
  })
  test.each([
    ['percent', 100.01], ['percent', -1], ['fixed', 250.01], ['fixed', 1.001],
    ['none', 1], ['fixed', true], ['fixed', NaN], ['unsupported', 0]
  ])('rejects an invalid document discount %s %s', (type, value) => {
    expect(() => computeTotals(items, 0, { discount_type: type, discount_value: value })).toThrow('remise')
  })
  test('rejects excessive line discounts and accepts a full discount without negative totals', () => {
    expect(() => computeTotals([{ quantity: 1, unitPrice: 10, discountType: 'fixed', discountValue: 10.01 }])).toThrow('dépasser')
    expect(computeTotals(items, 16, { discount_type: 'percent', discount_value: 100 }))
      .toMatchObject({ discountAmount: 250, netSubtotal: 0, taxAmount: 0, total: 0 })
  })
  test('product ranking allocates document discounts without losing or inventing cents', () => {
    const net = allocateNetLineCents(items, 25)
    expect(net).toEqual([16000, 4000])
    const small = allocateNetLineCents(Array.from({ length: 3 }, () => ({ quantity: 1, unitPrice: 0.01 })), 0.01)
    expect(small.reduce((sum, amount) => sum + amount, 0)).toBe(2)
    expect(small.every((amount) => amount >= 0 && amount <= 1)).toBe(true)
  })
})
