export const MAX_INVOICE_AMOUNT = 1_000_000_000_000
const invalid = () => Object.assign(new Error('Montant ou quantité hors limites.'), { status: 400 })

// USD and CDF: prices have two decimals, quantities at most three decimals.
// Round each line half up using integer arithmetic, then sum the rounded lines.
export const lineTotalCents = ({ quantity, unitPrice }) => {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || qty > 1_000_000 ||
      price < 0 || price > 1_000_000_000 ||
      Math.abs(qty * 1000 - Math.round(qty * 1000)) > 0.000001 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.000001) throw invalid()
  const cents = (BigInt(Math.round(qty * 1000)) * BigInt(Math.round(price * 100)) + 500n) / 1000n
  if (cents > BigInt(MAX_INVOICE_AMOUNT * 100)) throw invalid()
  return Number(cents)
}

export const computeTotals = (items = []) => {
  const cents = items.reduce((sum, item) => sum + lineTotalCents(item), 0)
  if (!Number.isSafeInteger(cents) || cents > MAX_INVOICE_AMOUNT * 100) throw invalid()
  return { subtotal: cents / 100 }
}
