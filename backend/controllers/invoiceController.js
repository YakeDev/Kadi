import dayjs from 'dayjs'
import { supabase } from '../models/supabaseClient.js'
import {
	getPaginationParams,
	buildPaginationMeta,
} from '../utils/pagination.js'
import {
	generateInvoiceNumber,
	sanitizeInvoicePayload,
} from '../utils/validation.js'
import { downloadStoredLogoBuffer } from '../utils/logoStorage.js'
import { normalizeLogoImage } from '../utils/logoImage.js'
import { computeTotals, allocateNetLineCents } from '../utils/money.js'
import { validateInvoiceState, normalizeCurrency } from '../utils/validation.js'
import { createInvoicePdf } from '../utils/invoicePdf.js'
import { invoicePaymentSummary, paymentBusinessDate } from '../utils/payments.js'



const conflict = (message) => Object.assign(new Error(message), { status: 409 })
const hasIssuedArchive = (invoice) =>
  Boolean(invoice.client_snapshot && invoice.issuer_snapshot)

const presentInvoice = (invoice, tenantId) => {
  // Immutable PDF snapshots may contain a full base64 logo. Keep those bytes on
  // the server: they are not needed by the invoice listing or editor.
  const issuer = invoice.issuer_snapshot
  const { logo_base64: _embeddedLogo, ...publicIssuer } = issuer || {}
  const pdfAvailable = invoice.status === 'draft' || hasIssuedArchive(invoice)
  return {
    ...invoice,
    ...invoicePaymentSummary(invoice),
    ...(issuer && { issuer_snapshot: publicIssuer }),
    pdf_available: pdfAvailable,
    pdf_unavailable_reason: pdfAvailable ? null : 'historical_snapshot_missing',
    client: invoice.client_snapshot ||
      (invoice.client?.tenant_id === tenantId ? invoice.client : null)
  }
}
const readInvoice = async (id, tenantId) => {
  const { data, error } = await supabase.from('invoices').select('*, client:clients(*)')
    .eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw error
  return data
}
const getClient = async (clientId, tenantId) => {
  if (!clientId) return null
  const { data, error } = await supabase.from('clients').select('*')
    .eq('id', clientId).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw error
  if (!data) throw Object.assign(new Error('Client introuvable pour ce compte.'), { status: 400 })
  return data
}
const logoForPdf = async (profile, userId) => {
  if (!profile?.logo_url) return null
  const bytes = await downloadStoredLogoBuffer(supabase, profile.logo_url, { userId })
  if (!bytes) throw Object.assign(new Error('Le logo configuré est indisponible. Vérifiez le bucket et réimportez votre logo dans Entreprise.'), { status: 422 })
  return normalizeLogoImage(bytes)
}
const issueSnapshot = async (invoice, req, client) => {
  if (invoice.status === 'draft') return {}
  const logo = await logoForPdf(req.profile, req.user.id)
  const { logo_url, ...issuer } = req.profile || {}
  return {
    client_snapshot: client,
    issuer_snapshot: { ...issuer, logo_base64: logo?.toString('base64') ?? null },
    issued_at: new Date().toISOString(),
    paid_at: invoice.status === 'paid' ? new Date().toISOString() : null
  }
}

export const listInvoices = async (req, res, next) => {
	try {
		const tenantId = req.tenantId
		const { page, pageSize, from, to } = getPaginationParams(req.query)
		const searchTerm = req.query.search?.trim()
		const statusFilter = req.query.status?.trim()?.toLowerCase()

		let query = supabase
			.from('invoices')
			.select('*, client:clients(*)', { count: 'exact' })
			.eq('tenant_id', tenantId)

    if (statusFilter === 'overdue') {
      query = query.or(`status.eq.overdue,and(status.in.(sent,partially_paid),due_date.lt.${paymentBusinessDate()})`)
    } else if (statusFilter && statusFilter !== 'all') {
			query = query.eq('status', statusFilter)
		}

    if (searchTerm) {
      if (searchTerm.length > 160) throw Object.assign(new Error('Recherche trop longue.'), { status: 400 })
      query = query.ilike('invoice_search', `%${searchTerm}%`)
    }

		const { data, error, count } = await query
			.order('issue_date', { ascending: false })
			.range(from, to)

		if (error) throw error
		res.json({
			data: (data ?? []).map((invoice) => presentInvoice(invoice, tenantId)),
			pagination: buildPaginationMeta(count ?? 0, page, pageSize),
		})
	} catch (error) {
		next(error)
	}
}

export const getTodoItems = async (req, res, next) => {
  try {
    const now = paymentBusinessDate()
    const upcoming = dayjs(now).add(7, 'day').format('YYYY-MM-DD')
    const base = () => supabase.from('invoices')
      .select('id, invoice_number, status, due_date, issue_date, total_amount, paid_amount, currency, client_snapshot, client:clients(company_name, tenant_id)')
      .eq('tenant_id', req.tenantId)
    const queries = [
      base().in('status', ['sent', 'overdue', 'partially_paid']).lt('due_date', now).order('due_date', { ascending: true }).limit(5),
      base().in('status', ['sent', 'overdue', 'partially_paid']).gte('due_date', now).lte('due_date', upcoming).order('due_date', { ascending: true }).limit(5),
      base().eq('status', 'draft').order('created_at', { ascending: false }).limit(5)
    ]
    const responses = await Promise.all(queries)
    for (const response of responses) if (response.error) throw response.error
    res.json(Object.fromEntries(['overdue', 'dueSoon', 'drafts'].map((key, index) =>
      [key, (responses[index].data ?? []).map((invoice) => presentInvoice(invoice, req.tenantId))])))
  } catch (error) { next(error) }
}

export const getInvoice = async (req, res, next) => {
  try {
    const data = await readInvoice(req.params.id, req.tenantId)
    if (!data) return res.status(404).json({ message: 'Facture introuvable.' })
    res.json(presentInvoice(data, req.tenantId))
  } catch (error) { next(error) }
}

export const createInvoice = async (req, res, next) => {
  try {
    const payload = sanitizeInvoicePayload(req.body)
    validateInvoiceState(payload)
    const client = await getClient(payload.client_id, req.tenantId)
    const totals = computeTotals(payload.items, payload.tax_rate, payload)
    const snapshots = await issueSnapshot(payload, req, client)
    const { data, error } = await supabase.from('invoices').insert({
      ...payload, ...snapshots, tenant_id: req.tenantId,
      invoice_number: generateInvoiceNumber(), subtotal_amount: totals.subtotal,
      tax_rate: totals.taxRate, tax_amount: totals.taxAmount, total_amount: totals.total, version: 0,
      discount_type: totals.discountType, discount_value: totals.discountValue,
      discount_amount: totals.discountAmount, line_discount_amount: totals.lineDiscountAmount
    }).select('*, client:clients(*)').single()
    if (error) throw error
    const saved = data.status === 'paid' ? await readInvoice(data.id, req.tenantId) : data
    res.status(201).json(presentInvoice(saved, req.tenantId))
  } catch (error) { next(error) }
}

export const updateInvoice = async (req, res, next) => {
  try {
    let updates = sanitizeInvoicePayload(req.body, { partial: true })
    const existing = await readInvoice(req.params.id, req.tenantId)
    if (!existing) return res.status(404).json({ message: 'Facture introuvable.' })
    if (!Number.isInteger(existing.version)) throw Object.assign(new Error('Mise à jour de la base de données requise.'), { status: 503 })
    if (existing.status !== 'draft') {
      if (Object.keys(updates).some((field) => field !== 'status')) {
        throw conflict('Une facture émise ne peut plus être modifiée. Créez un document correctif séparé.')
      }
      const allowed = { sent: ['sent', 'overdue', 'paid'], overdue: ['overdue', 'sent', 'paid'], partially_paid: ['partially_paid', 'paid'], paid: ['paid'] }
      if (!allowed[existing.status]?.includes(updates.status)) throw conflict('Transition de statut interdite pour une facture émise.')
      if (updates.status === 'paid' && existing.status !== 'paid') updates.paid_at = new Date().toISOString()
    } else {
      // Validate the complete resulting state, including the date/currency left out of a PATCH.
      const merged = { ...existing, ...updates }
      validateInvoiceState(merged)
      const client = await getClient(merged.client_id, req.tenantId)
      const totals = computeTotals(merged.items, merged.tax_rate, merged)
      updates = { ...updates, subtotal_amount: totals.subtotal, tax_rate: totals.taxRate,
        tax_amount: totals.taxAmount, total_amount: totals.total,
        discount_type: totals.discountType, discount_value: totals.discountValue,
        discount_amount: totals.discountAmount, line_discount_amount: totals.lineDiscountAmount,
        ...await issueSnapshot(merged, req, client) }
    }
    const { data, error } = await supabase.from('invoices').update(updates)
      .eq('id', req.params.id).eq('tenant_id', req.tenantId).eq('version', existing.version)
      .select('*, client:clients(*)').maybeSingle()
    if (error) throw error
    if (!data) throw conflict('Cette facture a été modifiée entre-temps. Rechargez la page.')
    const saved = data.status === 'paid' ? await readInvoice(data.id, req.tenantId) : data
    res.json(presentInvoice(saved, req.tenantId))
  } catch (error) { next(error) }
}

export const deleteInvoice = async (req, res, next) => {
  try {
    const existing = await readInvoice(req.params.id, req.tenantId)
    if (!existing) return res.status(404).json({ message: 'Facture introuvable.' })
    if (existing.status !== 'draft') throw conflict('Seuls les brouillons peuvent être supprimés.')
    if (!Number.isInteger(existing.version)) throw Object.assign(new Error('Mise à jour de la base de données requise.'), { status: 503 })
    const { data, error } = await supabase.from('invoices').delete().eq('id', req.params.id)
      .eq('tenant_id', req.tenantId).eq('status', 'draft').eq('version', existing.version).select('id').maybeSingle()
    if (error) throw error
    if (!data) throw conflict('Cette facture a été modifiée entre-temps. Rechargez la page.')
    res.status(204).send()
  } catch (error) { next(error) }
}

const PERIOD_UNITS = new Set(['day', 'month', 'year'])

const parsePeriodRange = ({ period = 'month', start, end }) => {
	const safePeriod = PERIOD_UNITS.has(period) ? period : 'month'

	let startDate = start ? dayjs(start) : null
	let endDate = end ? dayjs(end) : null

	if (!startDate || !startDate.isValid()) {
		startDate = dayjs().startOf(safePeriod)
	}

	if (!endDate || !endDate.isValid()) {
		endDate = dayjs().endOf(safePeriod)
	}

	if (endDate.isBefore(startDate)) {
		;[startDate, endDate] = [endDate, startDate]
	}

	return {
		period: safePeriod,
		startDate: startDate.startOf('day'),
		endDate: endDate.endOf('day'),
	}
}

const groupPaymentsByUnit = (payments, unit) => {
	const buckets = new Map()

	payments.forEach((payment) => {
		const date = dayjs(payment.paid_on)
		if (!date.isValid()) return

		const label =
			unit === 'year'
				? date.format('YYYY')
				: unit === 'month'
					? date.format('YYYY-MM')
					: date.format('YYYY-MM-DD')

		const prev = buckets.get(label) || { label, cents: 0n }
		prev.cents += BigInt(Math.round(Number(payment.amount || 0) * 100))
		buckets.set(label, prev)
	})

	return Array.from(buckets.values(), ({ label, cents }) => ({ label, total: Number(cents) / 100 })).sort((a, b) =>
		a.label.localeCompare(b.label)
	)
}

const rankClients = (invoices) => {
	const totals = new Map()

	invoices.forEach((invoice) => {
		const amount = Number(invoice.total_amount || 0)
		const key = invoice.client_id || invoice.client?.company_name || 'inconnu'
		if (!totals.has(key)) {
			totals.set(key, {
				clientId: invoice.client_id,
				company: invoice.client?.company_name || 'Client inconnu',
				total: 0,
			})
		}
		totals.get(key).total += amount
	})

	return Array.from(totals.values())
		.sort((a, b) => b.total - a.total)
		.slice(0, 5)
}

const rankProducts = (invoices) => {
	const products = new Map()

	invoices.forEach((invoice) => {
		const items = Array.isArray(invoice.items) ? invoice.items : []
		const netAmounts = Number(invoice.discount_amount || 0) > 0
      ? allocateNetLineCents(items, Number(invoice.discount_amount || 0) - Number(invoice.line_discount_amount || 0)) : null
		items.forEach((item, index) => {
			const quantity = Number(item.quantity || 0)
			const unitPrice = Number(item.unitPrice || item.unit_price || 0)
			const total = netAmounts ? netAmounts[index] / 100 : quantity * unitPrice
			const label = item.description || item.name || 'Article sans nom'

			if (!products.has(label)) {
				products.set(label, {
					label,
					total: 0,
					quantity: 0,
				})
			}

			const bucket = products.get(label)
			bucket.total += total
			bucket.quantity += quantity
		})
	})

	return Array.from(products.values())
		.sort((a, b) => b.total - a.total)
		.slice(0, 5)
}

export const getSummary = async (req, res, next) => {
	try {
		const tenantId = req.tenantId
		const { period, startDate, endDate } = parsePeriodRange(req.query || {})

    const currency = normalizeCurrency(req.query?.currency || 'USD')
    const records = []
    let offset = 0
    while (true) {
      const { data, error } = await supabase.from('invoices')
		.select('id, total_amount, paid_amount, discount_amount, line_discount_amount, status, issue_date, paid_at, currency, items, client_id, client_snapshot, client:clients(company_name, tenant_id)')
        .eq('tenant_id', tenantId).eq('currency', currency)
        .gte('issue_date', startDate.format('YYYY-MM-DD')).lte('issue_date', endDate.format('YYYY-MM-DD'))
        .order('id', { ascending: true }).range(offset, offset + 499)
      if (error) throw error
      records.push(...(data ?? []).map((invoice) => presentInvoice(invoice, tenantId)))
      if (!data || data.length < 500) break
      offset += 500
    }

    // Cash received is selected by receipt date, including invoices issued in a previous period.
    const payments = []
    offset = 0
    while (true) {
      const { data, error } = await supabase.from('invoice_payments')
        .select('id, amount, paid_on, is_legacy').eq('tenant_id', tenantId).eq('currency', currency)
        .is('voided_at', null).gte('paid_on', startDate.format('YYYY-MM-DD')).lte('paid_on', endDate.format('YYYY-MM-DD'))
        .order('id', { ascending: true }).range(offset, offset + 499)
      if (error) throw error
      payments.push(...(data ?? []))
      if (!data || data.length < 500) break
      offset += 500
    }

		const totals = records.reduce(
			(acc, invoice) => {
				const amount = Number(invoice.total_amount || 0)
				if (invoice.status !== 'draft') {
          acc.totalInvoices += 1
          acc.totalAmount += amount
        }

				switch (invoice.status) {
					case 'paid':
						break
					case 'sent':
					case 'overdue':
					case 'partially_paid':
						acc.outstandingCents += BigInt(Math.round(invoice.balance_due * 100))
						break
					case 'draft':
						acc.drafts += 1
						break
					default:
						break
				}

				if (invoice.status === 'paid' && invoice.paid_at) {
					const issue = dayjs(invoice.issue_date)
					if (issue.isValid()) {
						const days = dayjs(invoice.paid_at).diff(issue, 'day')
						acc.paymentDelays.push(Math.max(days, 0))
					}
				}

				return acc
			},
			{
				outstandingCents: 0n,
				totalAmount: 0,
				totalInvoices: 0,
				drafts: 0,
				paymentDelays: [],
			}
		)

		const averageDelay = totals.paymentDelays.length
			? totals.paymentDelays.reduce((sum, value) => sum + value, 0) /
				totals.paymentDelays.length
			: null

		const summary = {
			totals: {
				revenue: Number(payments.reduce((sum, payment) => sum + BigInt(Math.round(Number(payment.amount) * 100)), 0n)) / 100,
				outstanding: Number(totals.outstandingCents) / 100,
				totalAmount: totals.totalAmount,
				invoiceCount: totals.totalInvoices,
				draftCount: totals.drafts,
				averagePaymentDelay: averageDelay == null ? null : Number(averageDelay.toFixed(1)),
			},
			charts: {
				revenue: groupPaymentsByUnit(payments, period),
				topClients: rankClients(records.filter((invoice) => invoice.status !== 'draft')),
				topProducts: rankProducts(records.filter((invoice) => invoice.status !== 'draft')),
			},
			meta: {
        currency,
        legacyPaymentCount: payments.filter((payment) => payment.is_legacy).length,
        revenueDateBasis: 'paid_on',
				period,
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
			},
		}

		res.json(summary)
	} catch (error) {
		next(error)
	}
}

export const streamInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await readInvoice(req.params.id, req.tenantId)
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable.' })
    if (invoice.status !== 'draft' && !hasIssuedArchive(invoice)) {
      throw Object.assign(new Error('Cette ancienne facture ne possède pas d’archive à l’émission. Faites vérifier son original avant de la réexporter.'), { status: 422 })
    }
    const issuer = invoice.issuer_snapshot || req.profile
    const logoBuffer = invoice.issuer_snapshot
      ? (issuer.logo_base64 ? Buffer.from(issuer.logo_base64, 'base64') : null)
      : await logoForPdf(issuer, req.user.id)
    const doc = createInvoicePdf(presentInvoice(invoice, req.tenantId), issuer, logoBuffer)
    res.setHeader('Content-Type', 'application/pdf')
    const safeName = invoice.invoice_number.replace(/[^a-z0-9_-]/gi, '-')
    res.setHeader('Content-Disposition', `attachment; filename="facture-${safeName}.pdf"`)
    res.setHeader('Cache-Control', 'private, no-store')
    doc.on('error', next)
    doc.pipe(res)
    doc.end()
  } catch (error) { next(error) }
}
