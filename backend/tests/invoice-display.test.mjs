import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeInvoicePayload } from '../utils/validation.js'
import { sanitizeQuote } from '../utils/quotes.js'

const item = { title: 'LOT 01 - Identite de marque', description: 'Recherche ; 2 pistes ; logo final ; mini-charte.', quantity: 1, unitPrice: 420 }
test('validates separated service heading and optional scope without changing amounts', () => {
  const result = sanitizeInvoicePayload({ items: [item], currency: 'USD', pdf_template: 'sober' })
  assert.equal(result.items[0].title, item.title)
  assert.equal(result.items[0].description, item.description)
  assert.equal(result.pdf_template, 'sober')
  const withoutDetail = sanitizeInvoicePayload({ items: [{ ...item, description: '' }], pdf_template: 'minimal' })
  assert.equal(withoutDetail.items[0].description, '')
})
test('legacy description-only documents remain valid and default to classic template', () => {
  const result = sanitizeInvoicePayload({ items: [{ description: 'Consulting', quantity: 1, unitPrice: 30 }] })
  assert.equal(result.items[0].description, 'Consulting')
  assert.equal(result.items[0].title, undefined)
  assert.equal(result.pdf_template, 'classic')
})
test('unknown templates and missing service names are rejected', () => {
  assert.throws(() => sanitizeInvoicePayload({ items: [item], pdf_template: '<script>' }), /Modèle de PDF invalide/)
  assert.throws(() => sanitizeInvoicePayload({ items: [{ title: '', description: '', quantity: 1, unitPrice: 10 }] }), /description/)
})
test('quotes accept the same PDF template and detailed lines', () => {
  const { quote } = sanitizeQuote({ items: [item], pdf_template: 'minimal', currency: 'CDF' })
  assert.equal(quote.pdf_template, 'minimal')
  assert.equal(quote.items[0].title, item.title)
})
