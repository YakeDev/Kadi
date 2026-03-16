import { randomBytes } from 'crypto'

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
  'currency'
]
const INVOICE_BLOCKED_FIELDS = [
  'id',
  'tenant_id',
  'invoice_number',
  'subtotal_amount',
  'total_amount',
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
  'currency'
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
  if (Number.isNaN(parsed.getTime())) {
    throw createValidationError(`Le champ ${field} doit être une date valide.`)
  }

  return normalized
}

const normalizeCurrency = (value, defaultValue = 'USD') => {
  if (value == null || value === '') return defaultValue

  const normalized = String(value).trim().toUpperCase()
  if (!/^[A-Z0-9$€£¥._-]{1,10}$/.test(normalized)) {
    throw createValidationError('Le champ currency est invalide.')
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
    min: 1,
    allowZero: false
  })
  const unitPrice = normalizeNumber(
    payload.unitPrice ?? payload.unit_price ?? 0,
    `items[${index}].unitPrice`,
    { min: 0, allowZero: true }
  )
  const currency = payload.currency == null ? undefined : normalizeCurrency(payload.currency)
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

  if (partial && Object.keys(sanitized).length === 0) {
    throw createValidationError('Aucune donnée valide à mettre à jour.')
  }

  return sanitized
}

export const generateInvoiceNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = randomBytes(4).toString('hex').toUpperCase()
  return `FAC-${datePart}-${randomPart}`
}
