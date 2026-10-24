export const getInvoiceTotals = (invoice) => {
  const items = invoice.items ?? []
  const calculatedSubtotal = items.reduce(
    (acc, item) =>
      acc +
      Math.round(
        (Number(item.quantity || 0) * Number(item.unitPrice || 0) +
          Number.EPSILON) *
          100
      ) /
        100,
    0
  )

  const isIssued = invoice.status && invoice.status !== 'draft'
  const subtotal =
    isIssued && invoice.subtotal_amount != null
      ? Number(invoice.subtotal_amount)
      : calculatedSubtotal
  const taxRate = Number(invoice.tax_rate || 0)
  const roundedRate =
    Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100
      ? Math.round(taxRate * 100)
      : 0
  const subtotalCents = Math.round(subtotal * 100)
  const calculatedTax =
    Number.isSafeInteger(subtotalCents) && subtotalCents >= 0
      ? Number((BigInt(subtotalCents) * BigInt(roundedRate) + 5000n) / 10000n) /
        100
      : 0
  const taxAmount =
    isIssued && invoice.tax_amount != null
      ? Number(invoice.tax_amount)
      : calculatedTax
  const total =
    isIssued && invoice.total_amount != null
      ? Number(invoice.total_amount)
      : subtotal + taxAmount
  const currency = invoice.currency === '$' ? 'USD' : invoice.currency || 'USD'

  return { subtotal, taxRate, taxAmount, total, currency }
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
