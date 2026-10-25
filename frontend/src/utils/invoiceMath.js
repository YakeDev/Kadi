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

export const normalizeDiscount = (type = 'none', value = 0) => {
  if (!['none', 'percent', 'fixed'].includes(type)) {
    throw Object.assign(new Error('Type de remise invalide.'), { status: 400 })
  }
  const amount = Number(value)
  if (!['number', 'string'].includes(typeof value) || !Number.isFinite(amount) ||
      amount < 0 || amount > MAX_INVOICE_AMOUNT ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
      (type === 'percent' && amount > 100) || (type === 'none' && amount !== 0)) {
    throw Object.assign(new Error('La remise doit être positive ou nulle, avec deux décimales maximum et un pourcentage limité à 100 %.'), { status: 400 })
  }
  return { type, value: amount }
}

const discountForBase = (baseCents, discount) => {
  const cents = discount.type === 'percent'
    ? Number((BigInt(baseCents) * BigInt(Math.round(discount.value * 100)) + 5000n) / 10000n)
    : discount.type === 'fixed' ? Math.round(discount.value * 100) : 0
  if (cents > baseCents) {
    throw Object.assign(new Error('La remise ne peut pas dépasser le montant auquel elle s’applique.'), { status: 400 })
  }
  return cents
}

export const lineAmounts = (item) => {
  const grossCents = lineTotalCents(item)
  const discount = normalizeDiscount(item.discountType ?? 'none', item.discountValue ?? 0)
  const discountCents = discountForBase(grossCents, discount)
  return { grossCents, discountCents, netCents: grossCents - discountCents }
}

export const computeTotals = (items = [], taxRate = 0, document = {}) => {
  const rate = Number(taxRate ?? 0)
  if ((taxRate != null && !['number', 'string'].includes(typeof taxRate)) ||
      !Number.isFinite(rate) || rate < 0 || rate > 100 ||
      Math.abs(rate * 100 - Math.round(rate * 100)) > 0.000001) {
    throw Object.assign(new Error('Le taux de taxe doit être compris entre 0 et 100, avec deux décimales maximum.'), { status: 400 })
  }
  const lines = items.map(lineAmounts)
  const cents = lines.reduce((sum, line) => sum + line.grossCents, 0)
  if (!Number.isSafeInteger(cents) || cents > MAX_INVOICE_AMOUNT * 100) throw invalid()
  const lineDiscountCents = lines.reduce((sum, line) => sum + line.discountCents, 0)
  const discount = normalizeDiscount(document.discount_type ?? 'none', document.discount_value ?? 0)
  const globalDiscountCents = discountForBase(cents - lineDiscountCents, discount)
  const discountCents = lineDiscountCents + globalDiscountCents
  const netCents = cents - discountCents
  const taxCents = Number((BigInt(netCents) * BigInt(Math.round(rate * 100)) + 5000n) / 10000n)
  const totalCents = netCents + taxCents
  if (!Number.isSafeInteger(totalCents) || totalCents > MAX_INVOICE_AMOUNT * 100) throw invalid()
  return { subtotal: cents / 100, lineDiscountAmount: lineDiscountCents / 100,
    globalDiscountAmount: globalDiscountCents / 100, discountAmount: discountCents / 100,
    discountType: discount.type, discountValue: discount.value, netSubtotal: netCents / 100,
    taxRate: rate, taxAmount: taxCents / 100, total: totalCents / 100 }
}

// Attribute document discounts proportionally to products, with exact cent totals.
export const allocateNetLineCents = (items, globalDiscountAmount = 0) => {
  const lines = items.map(lineAmounts)
  const base = lines.reduce((sum, line) => sum + line.netCents, 0)
  const discount = Math.round(Number(globalDiscountAmount) * 100)
  if (!Number.isSafeInteger(base) || !Number.isSafeInteger(discount) || discount < 0 || discount > base) throw invalid()
  if (!base) return lines.map(() => 0)
  let cumulative = 0n
  let allocated = 0n
  return lines.map((line) => {
    cumulative += BigInt(line.netCents)
    const next = (BigInt(discount) * cumulative + BigInt(base) / 2n) / BigInt(base)
    const net = line.netCents - Number(next - allocated)
    allocated = next
    return net
  })
}
