import { paymentBusinessDate } from './payments.js'

const invalid = () => Object.assign(new Error('Choisissez une période valide de 366 jours au maximum, sans date future.'), { status: 400 })
const isoDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number(value.slice(0, 4)) < 1) throw invalid()
  const parsed = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw invalid()
  return value
}
export const adminPeriod = (query = {}, today = paymentBusinessDate()) => {
  if (Object.keys(query).some(key => !['from', 'to'].includes(key))) throw invalid()
  const to = query.to === undefined ? today : isoDate(query.to)
  const defaultFrom = new Date(`${to}T12:00:00Z`)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
  const from = query.from === undefined ? isoDate(defaultFrom.toISOString().slice(0, 10)) : isoDate(query.from)
  if (from > to || to > today || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 365) throw invalid()
  return { from, to }
}
