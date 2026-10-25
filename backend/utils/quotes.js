import { randomBytes } from 'node:crypto'
import { sanitizeInvoicePayload, sanitizePaymentPayload, assertInvoiceCurrency } from './validation.js'
import { computeTotals } from './money.js'

const invalid = (message) => Object.assign(new Error(message), { status: 400 })
const object = (body, fields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Requête invalide.')
  if (Object.keys(body).some((field) => !fields.includes(field))) throw invalid('Certains champs ne sont pas autorisés.')
  return body
}
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const date = (value, name, required = false) => {
  if (!value && !required) return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw invalid(`${name} invalide.`)
  return value
}
export const sanitizeQuote = (body, { partial = false } = {}) => {
  const payload = object(body, ['client_id','issue_date','valid_until','status','currency','notes','items','tax_rate','discount_type','discount_value','version'])
  if (payload.status != null && !['draft','sent'].includes(payload.status)) throw invalid('Le devis doit être brouillon ou envoyé.')
  const { valid_until, version, ...fields } = payload
  const invoice = sanitizeInvoicePayload({ ...fields, ...(Object.hasOwn(payload,'valid_until') ? { due_date: valid_until } : {}) }, { partial })
  const { due_date, ...quote } = invoice
  if (!partial || Object.hasOwn(payload,'valid_until')) quote.valid_until = due_date ?? null
  if (partial) {
    if (!Number.isInteger(version) || version < 0) throw invalid('La version du devis est obligatoire.')
    if (!Object.keys(quote).length) throw invalid('Aucune donnée à mettre à jour.')
  }
  return { quote, version }
}
export const validateQuote = (quote) => {
  assertInvoiceCurrency(quote)
  if (!quote.client_id || !quote.issue_date || !quote.items?.length) throw invalid('Un client, une date et une prestation sont requis pour enregistrer un devis.')
  if (quote.valid_until && quote.valid_until < quote.issue_date) throw invalid('La validité doit être postérieure ou égale à la date du devis.')
  return computeTotals(quote.items,quote.tax_rate,quote)
}
export const sanitizeConversion = (body) => {
  const payload = object(body,['idempotency_key','version','issue_date','due_date','po_reference','payment'])
  if (!uuid(payload.idempotency_key)) throw invalid('Clé de conversion invalide.')
  if (!Number.isInteger(payload.version) || payload.version < 0) throw invalid('Version du devis invalide.')
  const issueDate = date(payload.issue_date,'Date de facture',true)
  const dueDate = date(payload.due_date,'Échéance')
  if (dueDate && dueDate < issueDate) throw invalid('L’échéance doit être postérieure ou égale à la date de facture.')
  if (payload.po_reference != null && typeof payload.po_reference !== 'string') throw invalid('Référence PO invalide.')
  const poReference = payload.po_reference?.trim() || null
  if (poReference && poReference.length > 160) throw invalid('La référence PO est limitée à 160 caractères.')
  const payment = payload.payment == null ? null : sanitizePaymentPayload(payload.payment)
  if (!poReference && !payment) throw invalid('Un acompte reçu ou une référence PO est obligatoire.')
  return { idempotency_key: payload.idempotency_key, version: payload.version, issue_date: issueDate, due_date: dueDate, po_reference: poReference, payment }
}
export const generateQuoteNumber = () => `DEV-${new Date().toISOString().slice(0,10).replace(/-/gu,'')}-${randomBytes(4).toString('hex').toUpperCase()}`
export const quoteTotals = (totals) => ({ subtotal_amount: totals.subtotal, tax_rate: totals.taxRate, tax_amount: totals.taxAmount,
  total_amount: totals.total, discount_type: totals.discountType, discount_value: totals.discountValue,
  line_discount_amount: totals.lineDiscountAmount, discount_amount: totals.discountAmount })
