import { supabase } from '../models/supabaseClient.js'
import { sanitizePaymentPayload, sanitizePaymentVoid } from '../utils/validation.js'
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js'

const columns = 'id,invoice_id,amount,currency,paid_on,method,reference,created_at,is_legacy,voided_at,void_reason'

export const listPayments = async (req, res, next) => {
  try {
    const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('id')
      .eq('id', req.params.id).eq('tenant_id', req.tenantId).maybeSingle()
    if (invoiceError) throw invoiceError
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable.' })
    const { page, pageSize, from, to } = getPaginationParams(req.query)
    const { data, error, count } = await supabase.from('invoice_payments').select(columns, { count: 'exact' })
      .eq('tenant_id', req.tenantId).eq('invoice_id', req.params.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)
    if (error) throw error
    res.json({ data: data ?? [], pagination: buildPaginationMeta(count ?? 0, page, pageSize) })
  } catch (error) { next(error) }
}

export const recordPayment = async (req, res, next) => {
  try {
    const payment = sanitizePaymentPayload(req.body)
    const { data, error } = await supabase.rpc('record_kadi_payment', {
      p_tenant_id: req.tenantId, p_invoice_id: req.params.id, p_payment_id: payment.idempotency_key,
      p_amount: payment.amount, p_paid_on: payment.paid_on, p_method: payment.method,
      p_reference: payment.reference, p_actor_id: req.user.id
    })
    if (error) throw error
    res.status(201).json({ id: data })
  } catch (error) { next(error) }
}

export const voidPayment = async (req, res, next) => {
  try {
    const reason = sanitizePaymentVoid(req.body)
    const { data, error } = await supabase.rpc('void_kadi_payment', {
      p_tenant_id: req.tenantId, p_invoice_id: req.params.id, p_payment_id: req.params.paymentId,
      p_reason: reason, p_actor_id: req.user.id
    })
    if (error) throw error
    res.json({ id: data })
  } catch (error) { next(error) }
}
