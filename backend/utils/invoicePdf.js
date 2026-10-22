import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import { fileURLToPath } from 'node:url'
import { lineTotalCents } from './money.js'

export const createInvoicePdf = (invoice, issuer = {}, logo = null) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true })
  doc.registerFont('Inter', fileURLToPath(import.meta.resolve('@fontsource/inter/files/inter-latin-400-normal.woff')))
  doc.registerFont('Inter-Semibold', fileURLToPath(import.meta.resolve('@fontsource/inter/files/inter-latin-600-normal.woff')))
  const left = 48
  const width = doc.page.width - 96
  const bottom = doc.page.height - 88
  const money = (value) => `${Number(value || 0).toFixed(2)} ${invoice.currency || 'USD'}`
  const text = (value, x, y, w = width, size = 10, bold = false, align = 'left') => {
    doc.font(bold ? 'Inter-Semibold' : 'Inter').fontSize(size).fillColor('#0f172a')
      .text(String(value ?? ''), x, y, { width: w, align, lineGap: 2 })
    return doc.y
  }
  const rule = (y) => doc.moveTo(left, y).lineTo(left + width, y).strokeColor('#e2e8f0').stroke()
  const date = (value) => value ? dayjs(value).format('DD/MM/YYYY') : '—'
  let y = 48
  const wrap = (value, lineWidth, size = 10, bold = false) => {
    doc.font(bold ? 'Inter-Semibold' : 'Inter').fontSize(size)
    const result = []
    for (const paragraph of String(value).split('\n')) {
      let line = ''
      for (const char of paragraph) {
        if (line && doc.widthOfString(line + char) > lineWidth) {
          result.push(line); line = char
        } else line += char
      }
      result.push(line || ' ')
    }
    return result
  }
  const flow = (value, x = left, lineWidth = width, size = 10, bold = false) => {
    for (const line of wrap(value, lineWidth, size, bold)) {
      const height = size * 1.5
      if (y + height > bottom) { doc.addPage(); y = 48 }
      text(line, x, y, lineWidth, size, bold)
      y += height
    }
  }
  if (logo) doc.image(logo, left, y, { fit: [72, 72] })
  const companyX = logo ? left + 88 : left
  flow(issuer.company || 'Kadi', companyX, width - (companyX - left), 20, true)
  y += 6
  const lines = [issuer.tagline, issuer.manager_name && `Responsable : ${issuer.manager_name}`,
    issuer.address, [issuer.city, issuer.state].filter(Boolean).join(', '),
    issuer.phone, issuer.website, issuer.national_id && `ID. Nat. : ${issuer.national_id}`,
    issuer.rccm && `RCCM : ${issuer.rccm}`, issuer.nif && `NIF : ${issuer.nif}`].filter(Boolean)
  for (const line of lines) { flow(line, companyX, width - (companyX - left)); y += 3 }
  y = Math.max(y + 16, logo ? 136 : 100)
  if (y > bottom - 180) { doc.addPage(); y = 48 }
  rule(y)
  y += 16
  flow(`${invoice.status === 'draft' ? 'BROUILLON — ' : ''}Facture ${invoice.invoice_number}`, left, width, 17, true)
  y += 8
  flow(`Émise le ${date(invoice.issue_date)}  |  Échéance : ${date(invoice.due_date)}`)
  y += 16
  flow('Facturé à', left, width, 11, true)
  y += 5
  const client = invoice.client || {}
  for (const line of [client.company_name || 'Client non défini', client.contact_name, client.address, client.email, client.phone].filter(Boolean)) {
    flow(line); y += 3
  }
  y += 20
  const descWidth = 220
  const qtyX = left + 228
  const unitX = left + 284
  const totalX = left + 390
  const header = () => {
    text('Description', left, y, descWidth, 10, true)
    text('Qté', qtyX, y, 50, 10, true, 'right')
    text('Prix unitaire', unitX, y, 100, 10, true, 'right')
    text('Total', totalX, y, width - 390, 10, true, 'right')
    rule(y + 20)
    y += 28
  }
  const nextPage = () => {
    doc.addPage()
    y = text(`Facture ${invoice.invoice_number} — suite`, left, 48, width, 11, true) + 16
    header()
  }
  if (y + 60 > bottom) nextPage()
  else header()
  for (const item of invoice.items || []) {
    doc.font('Inter').fontSize(10)
    const rowHeight = Math.max(32, doc.heightOfString(item.description || '—', { width: descWidth, lineGap: 2 }) + 14)
    if (y + rowHeight > bottom) nextPage()
    text(item.description || '—', left, y + 5, descWidth)
    text(item.quantity, qtyX, y + 5, 50, 10, false, 'right')
    text(money(item.unitPrice), unitX, y + 5, 100, 10, false, 'right')
    text(money(lineTotalCents(item) / 100), totalX, y + 5, width - 390, 10, false, 'right')
    y += rowHeight
    rule(y)
  }
  if (y + 80 > bottom) { doc.addPage(); y = 48 }
  y += 22
  y = text(`Total : ${money(invoice.total_amount)}`, left, y, width, 16, true, 'right') + 24
  if (invoice.notes) {
    if (y + 40 > bottom) { doc.addPage(); y = 48 }
    flow('Notes', left, width, 11, true)
    y += 6
    flow(invoice.notes)
  }
  const pages = doc.bufferedPageRange()
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index)
    rule(bottom + 16)
    text(`Kadi — Page ${index + 1}/${pages.count}`, left, bottom + 26, width, 9, false, 'center')
  }
  return doc
}
