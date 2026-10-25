export const paymentBusinessDate = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Lubumbashi', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value)
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type).value).join('-')
}

export const invoicePaymentSummary = (invoice) => {
  const totalCents = Math.round(Number(invoice.total_amount || 0) * 100)
  // Compatibility for historical fixtures/older API records; the migration sets every row.
  const paidCents = Math.round(Number(invoice.paid_amount ?? (invoice.status === 'paid' ? invoice.total_amount : 0)) * 100)
  return {
    paid_amount: paidCents / 100,
    balance_due: Math.max(0, totalCents - paidCents) / 100,
    is_overdue: invoice.status !== 'draft' && invoice.status !== 'paid' &&
      totalCents > paidCents && Boolean(invoice.due_date && invoice.due_date < paymentBusinessDate())
  }
}
