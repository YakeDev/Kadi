export const paymentDateToday = () => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Lubumbashi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type).value)
    .join('-')
}

export const paymentBalance = (invoice) => {
  const totalCents = Math.round(Number(invoice.total_amount || 0) * 100)
  const paidCents = Math.round(
    Number(
      invoice.paid_amount ??
        (invoice.status === 'paid' ? invoice.total_amount : 0)
    ) * 100
  )
  return {
    paid: paidCents / 100,
    remaining: Math.max(0, totalCents - paidCents) / 100
  }
}

export const paymentMethods = {
  cash: 'Espèces',
  bank_transfer: 'Virement bancaire',
  mobile_money: 'Mobile Money',
  other: 'Autre',
  legacy: 'Ancien statut payé'
}
