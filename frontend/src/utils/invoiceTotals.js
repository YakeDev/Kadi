import { computeTotals, lineAmounts } from './invoiceMath.js'

export const getInvoiceLineTotals = (item) => {
  try {
    const line = lineAmounts(item)
    return { gross: line.grossCents / 100, discount: line.discountCents / 100, net: line.netCents / 100, calculationError: null }
  } catch (error) {
    return { gross: 0, discount: 0, net: 0, calculationError: error.message }
  }
}

export const getInvoiceTotals = (invoice) => {
  const currency = invoice.currency === '$' ? 'USD' : invoice.currency || 'USD'
  const isIssued = invoice.status && invoice.status !== 'draft'
  if (isIssued && invoice.subtotal_amount != null && invoice.total_amount != null) {
    const subtotal = Number(invoice.subtotal_amount)
    const discountAmount = Number(invoice.discount_amount || 0)
    const lineDiscountAmount = Number(invoice.line_discount_amount || 0)
    return { subtotal, discountAmount, lineDiscountAmount,
      globalDiscountAmount: discountAmount - lineDiscountAmount, netSubtotal: subtotal - discountAmount,
      discountType: invoice.discount_type || 'none', discountValue: Number(invoice.discount_value || 0),
      taxRate: Number(invoice.tax_rate || 0), taxAmount: Number(invoice.tax_amount || 0),
      total: Number(invoice.total_amount), currency, calculationError: null }
  }
  try {
    return { ...computeTotals(invoice.items ?? [], invoice.tax_rate, invoice), currency, calculationError: null }
  } catch (error) {
    return { subtotal: 0, discountAmount: 0, lineDiscountAmount: 0, globalDiscountAmount: 0,
      netSubtotal: 0, taxRate: 0, taxAmount: 0, total: 0, currency, calculationError: error.message }
  }
}

export const formatInvoiceMoney = (value, currency) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
    .format(Number(value || 0))
    .replace(/\u00a0/gu, ' ')
