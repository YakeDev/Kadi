import { randomBytes } from 'crypto'
import { computeTotals, lineTotalCents, normalizeDiscount, MAX_INVOICE_AMOUNT } from './money.js'
import { paymentBusinessDate } from './payments.js'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const CLIENT_ALLOWED_FIELDS = ['company_name', 'contact_name', 'email', 'phone', 'address']
const CLIENT_BLOCKED_FIELDS = ['id', 'tenant_id', 'created_at', 'updated_at']

const INVOICE_ALLOWED_FIELDS = [
  'client_id',
  'issue_date',
  'due_date',
  'status',
  'notes',
  'items',
  'currency',
  'tax_rate',
  'discount_type',
  'discount_value'
]
const INVOICE_BLOCKED_FIELDS = [
  'id',
  'tenant_id',
  'invoice_number',
  'subtotal_amount',
  'total_amount',
  'tax_amount',
  'discount_amount',
  'line_discount_amount',
  'created_at',
  'updated_at'
]
const INVOICE_ITEM_ALLOWED_FIELDS = [
  'catalogItemId',
  'catalog_item_id',
  'description',
  'name',
  'quantity',
  'qty',
  'unitPrice',
  'unit_price',
  'currency',
  'discountType',
  'discountValue'
]
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue']

const createValidationError = (message) =>
  Object.assign(new Error(message), {
    status: 400
  })

const assertPlainObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createValidationError('Le corps de la requête doit être un objet JSON valide.')
  }
  return value
}

const rejectUnexpectedFields = (payload, allowedFields, blockedFields = []) => {
  const unexpectedFields = Object.keys(payload).filter((field) => !allowedFields.includes(field))
  if (unexpectedFields.length === 0) return

  const protectedFields = unexpectedFields.filter((field) => blockedFields.includes(field))
  if (protectedFields.length > 0) {
    throw createValidationError(
      `Les champs suivants sont protégés et ne peuvent pas être modifiés : ${protectedFields.join(', ')}.`
    )
  }

  throw createValidationError(
    `Les champs suivants ne sont pas autorisés : ${unexpectedFields.join(', ')}.`
  )
}

const normalizeString = (
  value,
  { field, required = false, maxLength = 255, allowNull = true } = {}
) => {
  if (value == null) {
    if (required) {
      throw createValidationError(`Le champ ${field} est obligatoire.`)
    }
    return allowNull ? null : ''
  }

  const normalized = String(value).trim()
  if (!normalized) {
    if (required) {
      throw createValidationError(`Le champ ${field} est obligatoire.`)
    }
    return allowNull ? null : ''
  }

  if (normalized.length > maxLength) {
    throw createValidationError(`Le champ ${field} dépasse la longueur autorisée.`)
  }

  return normalized
}

const normalizeEmail = (value, { field = 'email', required = false } = {}) => {
  const normalized = normalizeString(value, {
    field,
    required,
    maxLength: 254,
    allowNull: true
  })

  if (normalized == null) return null

  const email = normalized.toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    throw createValidationError(`Le champ ${field} doit contenir une adresse email valide.`)
  }

  return email
}

const normalizePhone = (value, { field = 'phone' } = {}) =>
  normalizeString(value, {
    field,
    maxLength: 40,
    allowNull: true
  })

const normalizeUuid = (value, field, { allowNull = true } = {}) => {
  if (value == null || value === '') {
    if (allowNull) return null
    throw createValidationError(`Le champ ${field} est obligatoire.`)
  }

  const normalized = String(value).trim()
  if (!UUID_REGEX.test(normalized)) {
    throw createValidationError(`Le champ ${field} doit être un identifiant valide.`)
  }

  return normalized
}

const normalizeDate = (value, field) => {
  if (value == null || value === '') return null

  const normalized = String(value).trim()
  if (!ISO_DATE_REGEX.test(normalized)) {
    throw createValidationError(`Le champ ${field} doit être une date ISO au format YYYY-MM-DD.`)
  }

  const parsed = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw createValidationError(`Le champ ${field} doit être une date valide.`)
  }

  return normalized
}

export const normalizeCurrency = (value, defaultValue = 'USD') => {
  if (value == null || value === '') return defaultValue

  const normalized = String(value).trim().toUpperCase()
  if (!['USD', 'CDF'].includes(normalized)) {
    throw createValidationError('Les devises prises en charge sont USD et CDF.')
  }

  return normalized
}

const normalizeNumber = (value, field, { min = 0, allowZero = true } = {}) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw createValidationError(`Le champ ${field} doit être un nombre valide.`)
  }

  if (parsed < min || (!allowZero && parsed === 0)) {
    const comparator = allowZero ? `supérieur ou égal à ${min}` : `strictement supérieur à ${min}`
    throw createValidationError(`Le champ ${field} doit être ${comparator}.`)
  }

  return parsed
}

const sanitizeInvoiceItem = (value, index) => {
  const payload = assertPlainObject(value)
  rejectUnexpectedFields(payload, INVOICE_ITEM_ALLOWED_FIELDS)

  const description = normalizeString(payload.description ?? payload.name, {
    field: `items[${index}].description`,
    required: true,
    maxLength: 500,
    allowNull: false
  })
  const quantity = normalizeNumber(payload.quantity ?? payload.qty ?? 0, `items[${index}].quantity`, {
    min: 0.001,
    allowZero: false
  })
  const unitPrice = normalizeNumber(
    payload.unitPrice ?? payload.unit_price ?? 0,
    `items[${index}].unitPrice`,
    { min: 0, allowZero: true }
  )
  const currency = payload.currency == null ? undefined : normalizeCurrency(payload.currency)
  lineTotalCents({ quantity, unitPrice })
  const catalogItemId = normalizeUuid(
    payload.catalogItemId ?? payload.catalog_item_id ?? null,
    `items[${index}].catalogItemId`,
    { allowNull: true }
  )

  const sanitized = {
    description,
    quantity,
    unitPrice
  }

  if (hasOwn(payload, 'discountType') || hasOwn(payload, 'discountValue')) {
    const discount = normalizeDiscount(payload.discountType ?? 'none', payload.discountValue ?? 0)
    sanitized.discountType = discount.type
    sanitized.discountValue = discount.value
  }

  if (currency) {
    sanitized.currency = currency
  }

  if (catalogItemId) {
    sanitized.catalogItemId = catalogItemId
  }

  return sanitized
}

export const sanitizeClientPayload = (body = {}, { partial = false } = {}) => {
  const payload = assertPlainObject(body)
  rejectUnexpectedFields(payload, CLIENT_ALLOWED_FIELDS, CLIENT_BLOCKED_FIELDS)

  const sanitized = {}

  if (!partial || hasOwn(payload, 'company_name')) {
    sanitized.company_name = normalizeString(payload.company_name, {
      field: 'company_name',
      required: true,
      maxLength: 160,
      allowNull: false
    })
  }

  if (hasOwn(payload, 'contact_name')) {
    sanitized.contact_name = normalizeString(payload.contact_name, {
      field: 'contact_name',
      maxLength: 160
    })
  }

  if (hasOwn(payload, 'email')) {
    sanitized.email = normalizeEmail(payload.email)
  }

  if (hasOwn(payload, 'phone')) {
    sanitized.phone = normalizePhone(payload.phone)
  }

  if (hasOwn(payload, 'address')) {
    sanitized.address = normalizeString(payload.address, {
      field: 'address',
      maxLength: 500
    })
  }

  if (partial && Object.keys(sanitized).length === 0) {
    throw createValidationError('Aucune donnée valide à mettre à jour.')
  }

  return sanitized
}

export const sanitizeInvoicePayload = (body = {}, { partial = false } = {}) => {
  const payload = assertPlainObject(body)
  rejectUnexpectedFields(payload, INVOICE_ALLOWED_FIELDS, INVOICE_BLOCKED_FIELDS)

  const sanitized = {}

  if (!partial || hasOwn(payload, 'client_id')) {
    sanitized.client_id = normalizeUuid(payload.client_id, 'client_id', { allowNull: true })
  }

  if (!partial || hasOwn(payload, 'issue_date')) {
    sanitized.issue_date = normalizeDate(payload.issue_date, 'issue_date')
  }

  if (!partial || hasOwn(payload, 'due_date')) {
    sanitized.due_date = normalizeDate(payload.due_date, 'due_date')
  }

  if (!partial || hasOwn(payload, 'status')) {
    const status = payload.status == null || payload.status === '' ? 'draft' : String(payload.status).trim().toLowerCase()
    if (!INVOICE_STATUSES.includes(status)) {
      throw createValidationError(
        `Le champ status doit être l'une des valeurs suivantes : ${INVOICE_STATUSES.join(', ')}.`
      )
    }
    sanitized.status = status
  }

  if (!partial || hasOwn(payload, 'notes')) {
    sanitized.notes = normalizeString(payload.notes, {
      field: 'notes',
      maxLength: 5000
    })
  }

  if (!partial || hasOwn(payload, 'currency')) {
    sanitized.currency = normalizeCurrency(payload.currency, 'USD')
  }

  if (!partial || hasOwn(payload, 'tax_rate')) {
    sanitized.tax_rate = computeTotals([], payload.tax_rate ?? 0).taxRate
  }

  if (hasOwn(payload, 'discount_type')) {
    sanitized.discount_type = normalizeDiscount(payload.discount_type, 0).type
  }
  if (hasOwn(payload, 'discount_value')) {
    sanitized.discount_value = normalizeDiscount('fixed', payload.discount_value).value
  }

  if (!partial || hasOwn(payload, 'items')) {
    const rawItems = payload.items ?? []
    if (!Array.isArray(rawItems)) {
      throw createValidationError('Le champ items doit être une liste.')
    }

    if (rawItems.length > 100) {
      throw createValidationError('Le nombre de lignes de facture dépasse la limite autorisée.')
    }

    sanitized.items = rawItems.map((item, index) => sanitizeInvoiceItem(item, index))
  }

  const issueDate = sanitized.issue_date
  const dueDate = sanitized.due_date
  if (issueDate && dueDate && dueDate < issueDate) {
    throw createValidationError("La date d'échéance doit être postérieure ou égale à la date d'émission.")
  }
  if (sanitized.items) computeTotals(sanitized.items, sanitized.tax_rate, sanitized)
  if (sanitized.items && sanitized.currency) assertInvoiceCurrency(sanitized)

  if (partial && Object.keys(sanitized).length === 0) {
    throw createValidationError('Aucune donnée valide à mettre à jour.')
  }

  return sanitized
}

export const assertInvoiceCurrency = ({ items = [], currency }) => {
  const selected = normalizeCurrency(currency)
  if (items.some((item) => item.currency && normalizeCurrency(item.currency) !== selected)) {
    throw createValidationError('Toutes les lignes doivent utiliser la devise de la facture. Aucune conversion automatique n’est effectuée.')
  }
}

export const validateInvoiceState = (invoice) => {
  assertInvoiceCurrency(invoice)
  computeTotals(invoice.items, invoice.tax_rate, invoice)
  const issueDate = normalizeDate(invoice.issue_date, 'issue_date')
  const dueDate = normalizeDate(invoice.due_date, 'due_date')
  if (issueDate && dueDate && dueDate < issueDate) {
    throw createValidationError("La date d'échéance doit être postérieure ou égale à la date d'émission.")
  }
  if (invoice.status !== 'draft' && (!invoice.client_id || !issueDate || !invoice.items?.length)) {
    throw createValidationError('Un client, une date d’émission et au moins une ligne sont requis pour émettre une facture.')
  }
}

export const sanitizeProductPayload = (body = {}, { partial = false } = {}) => {
  const payload = assertPlainObject(body)
  rejectUnexpectedFields(payload, ['name', 'description', 'item_type', 'unit_price', 'currency', 'sku', 'is_active'], ['id', 'tenant_id', 'created_at', 'updated_at'])
  const result = {}
  if (!partial || hasOwn(payload, 'name')) result.name = normalizeString(payload.name, { field: 'name', required: true, maxLength: 160 })
  for (const field of ['description', 'sku']) {
    if (hasOwn(payload, field)) result[field] = normalizeString(payload[field], { field, maxLength: field === 'sku' ? 80 : 500 })
  }
  if (!partial || hasOwn(payload, 'item_type')) {
    result.item_type = payload.item_type ?? 'product'
    if (!['product', 'service'].includes(result.item_type)) throw createValidationError('Type d’article invalide.')
  }
  if (!partial || hasOwn(payload, 'unit_price')) {
    result.unit_price = normalizeNumber(payload.unit_price ?? 0, 'unit_price')
    lineTotalCents({ quantity: 1, unitPrice: result.unit_price })
  }
  if (!partial || hasOwn(payload, 'currency')) result.currency = normalizeCurrency(payload.currency)
  if (hasOwn(payload, 'is_active')) {
    if (typeof payload.is_active !== 'boolean') throw createValidationError('is_active doit être un booléen.')
    result.is_active = payload.is_active
  }
  if (partial && !Object.keys(result).length) throw createValidationError('Aucune donnée à mettre à jour.')
  return { ...result, updated_at: new Date().toISOString() }
}

export const generateInvoiceNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = randomBytes(4).toString('hex').toUpperCase()
  return `FAC-${datePart}-${randomPart}`
}

export const sanitizePaymentPayload = (body) => {
  const payload = assertPlainObject(body)
  rejectUnexpectedFields(payload, ['idempotency_key', 'amount', 'paid_on', 'method', 'reference'])
  if (!['number', 'string'].includes(typeof payload.amount) ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(payload.amount).trim())) {
    throw createValidationError('Indiquez un montant positif avec deux décimales maximum.')
  }
  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_INVOICE_AMOUNT) {
    throw createValidationError('Le montant du versement est hors limites.')
  }
  const paidOn = normalizeDate(payload.paid_on, 'paid_on')
  if (!paidOn || paidOn > paymentBusinessDate()) {
    throw createValidationError('Indiquez une date de réception valide, au plus tard aujourd’hui.')
  }
  const method = payload.method ?? 'other'
  if (!['cash', 'bank_transfer', 'mobile_money', 'other'].includes(method)) {
    throw createValidationError('Mode de paiement invalide.')
  }
  return {
    idempotency_key: normalizeUuid(payload.idempotency_key, 'idempotency_key', { allowNull: false }),
    amount, paid_on: paidOn, method,
    reference: normalizeString(payload.reference, { field: 'reference', maxLength: 160 })
  }
}

export const sanitizePaymentVoid = (body) => {
  const payload = assertPlainObject(body)
  rejectUnexpectedFields(payload, ['reason'])
  const reason = normalizeString(payload.reason, { field: 'reason', required: true, maxLength: 500 })
  if (reason.length < 3) throw createValidationError('Le motif doit contenir au moins 3 caractères.')
  return reason
}
