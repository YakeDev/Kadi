import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import { supabase } from '../models/supabaseClient.js'

const computeTotals = (items = []) =>
  items.reduce(
    (acc, item) => {
      const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0)
      acc.subtotal += lineTotal
      return acc
    },
    { subtotal: 0 }
  )

export const listInvoices = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const { data, error } = await supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .eq('tenant_id', tenantId)
      .order('issue_date', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const getInvoice = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const { data, error } = await supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return res.status(404).json({ message: 'Facture introuvable.' })
    }
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const createInvoice = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const payload = req.body
    const items = payload.items || []
    const totals = computeTotals(items)
    const invoiceNumber = `FAC-${Date.now().toString().slice(-6)}`

    if (payload.client_id) {
      const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', payload.client_id)
        .eq('tenant_id', tenantId)
        .single()
      if (clientError) {
        clientError.status = 400
        clientError.message = "Client introuvable pour ce compte."
        throw clientError
      }
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        client_id: payload.client_id,
        invoice_number: invoiceNumber,
        issue_date: payload.issue_date,
        due_date: payload.due_date,
        status: payload.status || 'draft',
        notes: payload.notes,
        items,
        subtotal_amount: totals.subtotal,
        total_amount: totals.subtotal,
        currency: payload.currency || 'USD',
        tenant_id: tenantId
      })
      .select('*, client:clients(*)')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    let updates = { ...req.body }

    if (updates.client_id) {
      const { error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', updates.client_id)
        .eq('tenant_id', tenantId)
        .single()
      if (clientError) {
        clientError.status = 400
        clientError.message = "Client introuvable pour ce compte."
        throw clientError
      }
    }

    if (updates.items) {
      const totals = computeTotals(updates.items)
      updates = {
        ...updates,
        subtotal_amount: totals.subtotal,
        total_amount: totals.subtotal
      }
    }

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, client:clients(*)')
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const { error } = await supabase.from('invoices').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export const getSummary = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD')
    const { data: monthly, error: monthlyError } = await supabase
      .from('invoices')
      .select('total_amount')
      .gte('issue_date', startOfMonth)
      .eq('status', 'paid')
      .eq('tenant_id', tenantId)

    if (monthlyError) throw monthlyError

    const { data: outstanding, error: outstandingError } = await supabase
      .from('invoices')
      .select('total_amount, status')
      .eq('tenant_id', tenantId)

    if (outstandingError) throw outstandingError

    const summary = {
      monthlyRevenue: monthly.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      outstanding: outstanding
        .filter((inv) => inv.status === 'overdue' || inv.status === 'sent')
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0),
      paid: outstanding.filter((inv) => inv.status === 'paid').length
    }

    res.json(summary)
  } catch (error) {
    next(error)
  }
}

export const streamInvoicePdf = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(
        `*,
        client:clients(*)
      `
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw error
    if (!invoice) {
      return res.status(404).json({ message: 'Facture introuvable.' })
    }

    const doc = new PDFDocument({ margin: 50 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=facture-${invoice.invoice_number}.pdf`)

    doc.pipe(res)

    doc
      .fontSize(20)
      .fillColor('#0f172a')
      .text('Kadi Facturation', { align: 'right' })
      .moveDown(0.5)
    doc.fontSize(12).fillColor('#1e293b').text(dayjs(invoice.issue_date).format('DD MMM YYYY'), { align: 'right' })

    doc
      .moveDown()
      .fontSize(16)
      .fillColor('#0f172a')
      .text(`Facture ${invoice.invoice_number}`)
      .moveDown()

    doc
      .fontSize(12)
      .fillColor('#475569')
      .text('Facturer à :')
      .moveDown(0.3)
    doc.fillColor('#0f172a').text(invoice.client?.company_name || '')
    if (invoice.client?.contact_name) doc.text(invoice.client.contact_name)
    if (invoice.client?.email) doc.text(invoice.client.email)
    if (invoice.client?.phone) doc.text(invoice.client.phone)
    if (invoice.client?.address) doc.text(invoice.client.address)

    doc.moveDown()

    const tableTop = doc.y

    doc
      .fontSize(10)
      .fillColor('#64748b')
      .text('Description', 50, tableTop)
      .text('Quantité', 260, tableTop)
      .text('Prix unitaire', 330, tableTop)
      .text('Total', 430, tableTop)

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke('#e2e8f0')

    invoice.items?.forEach((item, index) => {
      const y = tableTop + 25 + index * 25
      doc
        .fontSize(10)
        .fillColor('#0f172a')
        .text(item.description, 50, y)
        .text(item.quantity, 260, y)
        .text(`${Number(item.unitPrice).toFixed(2)} ${invoice.currency}`, 330, y)
        .text(`${(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)} ${invoice.currency}`, 430, y)
    })

    doc
      .moveDown(2)
      .fontSize(12)
      .fillColor('#0f172a')
      .text(`Total : ${Number(invoice.total_amount).toFixed(2)} ${invoice.currency}`, { align: 'right' })

    if (invoice.notes) {
      doc
        .moveDown()
        .fontSize(10)
        .fillColor('#64748b')
        .text('Notes', { underline: true })
        .moveDown(0.3)
      doc.fillColor('#0f172a').text(invoice.notes)
    }

    doc.end()
  } catch (error) {
    next(error)
  }
}
