import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import { fileURLToPath } from 'node:url'
import { lineTotalCents } from './money.js'
import { invoicePaymentSummary, paymentBusinessDate } from './payments.js'

const colors = {
  ink: '#172b3a', muted: '#64748b', accent: '#2563eb',
  line: '#e2e8f0', pale: '#f5f8fc', blue: '#eff6ff'
}
const statuses = {
  draft: ['Brouillon', '#fff4db', '#92400e'],
  sent: ['Émise', '#eff6ff', '#1d4ed8'],
  overdue: ['Échue', '#fef2f2', '#b91c1c'],
  paid: ['Payée', '#ecfdf5', '#047857'],
  partially_paid: ['Partiellement payée', '#fff4db', '#92400e']
}

export const createInvoicePdf = (invoice, issuer = {}, logo = null) => {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true })
  doc.registerFont('Inter', fileURLToPath(import.meta.resolve('@fontsource/inter/files/inter-latin-400-normal.woff')))
  doc.registerFont('Inter-Semibold', fileURLToPath(import.meta.resolve('@fontsource/inter/files/inter-latin-600-normal.woff')))
  const left = 48
  const width = doc.page.width - left * 2
  const right = left + width
  const bottom = doc.page.height - 96
  const currency = invoice.currency === '$' ? 'USD' : invoice.currency || 'USD'
  const number = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const quantity = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })
  const money = (value) => `${number.format(Number(value || 0)).replace(/\s/gu, ' ')} ${currency}`
  const date = (value) => value ? dayjs(value).format('DD/MM/YYYY') : '-'
  const font = (size, bold = false) => doc.font(bold ? 'Inter-Semibold' : 'Inter').fontSize(size)
  const text = (value, x, y, w, size = 9, bold = false, color = colors.ink, align = 'left') => {
    font(size, bold).fillColor(color).text(String(value ?? ''), x, y, { width: w, align, lineBreak: false })
  }
  const fitText = (value, x, y, w, size = 9, bold = false, color = colors.ink, align = 'right') => {
    font(size, bold)
    const fitted = Math.min(size, size * w / Math.max(w, doc.widthOfString(String(value))))
    text(value, x, y, w, fitted, bold, color, align)
  }
  const rule = (y, x = left, w = width) => {
    doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.6).strokeColor(colors.line).stroke()
  }
  // Wrap on words, with a character fallback for long URLs and uninterrupted text.
  // Drawing one measured line at a time keeps PDFKit from adding untracked pages.
  const wrap = (value, lineWidth, size = 9, bold = false) => {
    font(size, bold)
    const lines = []
    for (const paragraph of String(value).split(/\r?\n/u)) {
      let line = ''
      for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word
        if (doc.widthOfString(candidate) <= lineWidth) { line = candidate; continue }
        if (line) { lines.push(line); line = '' }
        for (const char of word) {
          if (line && doc.widthOfString(line + char) > lineWidth) { lines.push(line); line = '' }
          line += char
        }
      }
      lines.push(line || ' ')
    }
    return lines
  }
  let y = 48
  let currentPage = 0
  const nextPage = (withTable = false) => {
    doc.addPage()
    currentPage += 1
    text('FACTURE - SUITE', left, 48, 140, 10, true, colors.accent)
    fitText(invoice.invoice_number || '-', left + 150, 49, width - 150, 9)
    rule(72)
    y = 88
    if (withTable) tableHeader()
  }
  const flow = (value, x = left, w = width, size = 9, bold = false, color = colors.ink) => {
    for (const line of wrap(value, w, size, bold)) {
      if (y + size * 1.5 > bottom) nextPage()
      text(line, x, y, w, size, bold, color)
      y += size * 1.5
    }
  }

  // The reference and dates have their own column instead of enlarging the title.
  const metaWidth = 206
  const metaX = right - metaWidth
  const issuerWidth = width - metaWidth - 32
  doc.rect(left, 32, width, 2).fill(colors.accent)
  text('FACTURE', metaX, 48, metaWidth, 27, true, colors.ink, 'right')
  const [status, statusBackground, statusColor] = statuses[invoice.status] || statuses.sent
  font(8, true)
  const badgeWidth = doc.widthOfString(status) + 22
  doc.roundedRect(right - badgeWidth, 87, badgeWidth, 22, 5).fill(statusBackground)
  text(status, right - badgeWidth, 93, badgeWidth, 8, true, statusColor, 'center')
  text('RÉFÉRENCE', metaX, 125, metaWidth, 7.5, true, colors.muted, 'right')
  const reference = wrap(invoice.invoice_number || '-', metaWidth, 9, true)
  reference.forEach((line, index) => text(line, metaX, 139 + index * 13.5, metaWidth, 9, true, colors.ink, 'right'))
  const datesY = 139 + reference.length * 13.5 + 15
  const dateWidth = (metaWidth - 14) / 2
  text('ÉMISE LE', metaX, datesY, dateWidth, 7.5, true, colors.muted)
  text(date(invoice.issue_date), metaX, datesY + 14, dateWidth, 9)
  text('ÉCHÉANCE', metaX + dateWidth + 14, datesY, dateWidth, 7.5, true, colors.muted, 'right')
  text(date(invoice.due_date), metaX + dateWidth + 14, datesY + 14, dateWidth, 9, false, colors.ink, 'right')
  const metadataBottom = datesY + 30

  if (logo) {
    doc.image(logo, left, y, { fit: [116, 46], align: 'left', valign: 'center' })
    y += 61
  }
  flow(issuer.company || 'Kadi', left, issuerWidth, 16, true)
  y += 7
  const issuerLines = [issuer.tagline, issuer.manager_name && `Responsable : ${issuer.manager_name}`,
    issuer.address, [issuer.city, issuer.state].filter(Boolean).join(', '), issuer.phone, issuer.website,
    issuer.national_id && `ID. Nat. : ${issuer.national_id}`,
    issuer.rccm && `RCCM : ${issuer.rccm}`, issuer.nif && `NIF : ${issuer.nif}`].filter(Boolean)
  for (const line of issuerLines) { flow(line, left, issuerWidth, 8.5, false, colors.muted); y += 3 }
  y = Math.max(y, currentPage === 0 ? metadataBottom : 0) + 26

  const client = invoice.client || {}
  const clientLines = [
    { value: 'FACTURÉ À', size: 7.5, bold: true, color: colors.muted, gap: 7 },
    { value: client.company_name || 'Client non défini', size: 12, bold: true, gap: 4 },
    ...[client.contact_name, client.address, client.email, client.phone].filter(Boolean)
      .map((value) => ({ value, size: 9, gap: 2 }))
  ].flatMap(({ value, ...style }) => wrap(value, width - 32, style.size, style.bold)
    .map((line, index, lines) => ({ ...style, value: line, gap: index === lines.length - 1 ? style.gap : 0 })))
  // Shade the client block in page-sized fragments, so long addresses also paginate.
  let clientIndex = 0
  while (clientIndex < clientLines.length) {
    if (y + 70 > bottom) nextPage()
    let blockHeight = 28
    let end = clientIndex
    while (end < clientLines.length) {
      const line = clientLines[end]
      const lineHeight = line.size * 1.5 + line.gap
      if (y + blockHeight + lineHeight > bottom) break
      blockHeight += lineHeight
      end += 1
    }
    doc.rect(left, y, width, blockHeight).fill(colors.pale)
    doc.rect(left, y, 2, blockHeight).fill(colors.accent)
    let lineY = y + 14
    for (const line of clientLines.slice(clientIndex, end)) {
      text(line.value, left + 16, lineY, width - 32, line.size, line.bold, line.color)
      lineY += line.size * 1.5 + line.gap
    }
    y += blockHeight + 24
    clientIndex = end
  }

  const columns = {
    description: { x: left + 12, width: 206 },
    quantity: { x: left + 226, width: 38 },
    unit: { x: left + 276, width: 97 },
    total: { x: left + 385, width: width - 397 }
  }
  const tableHeader = () => {
    doc.rect(left, y, width, 30).fill(colors.pale)
    text('Description', columns.description.x, y + 9, columns.description.width, 8.5, true)
    for (const [key, label] of [['quantity', 'Qté'], ['unit', 'Prix unitaire'], ['total', 'Total']]) {
      const column = columns[key]
      text(label, column.x, y + 9, column.width, 8.5, true, colors.ink, 'right')
    }
    rule(y + 30)
    y += 30
  }
  if (y + 70 > bottom) nextPage(true)
  else tableHeader()
  for (const [index, item] of (invoice.items || []).entries()) {
    const lines = wrap(item.description || '-', columns.description.width, 9)
    const rowHeight = Math.max(40, lines.length * 13.5 + 20)
    // Keep ordinary rows intact; split unusually tall descriptions across pages.
    if (y + rowHeight > bottom && rowHeight <= bottom - 118) nextPage(true)
    let offset = 0
    while (offset < lines.length) {
      if (y + 40 > bottom) nextPage(true)
      const count = Math.min(lines.length - offset, Math.floor((bottom - y - 20) / 13.5))
      const height = Math.max(40, count * 13.5 + 20)
      if (index % 2 === 1) doc.rect(left, y, width, height).fill('#fbfcfe')
      lines.slice(offset, offset + count).forEach((line, lineIndex) => {
        text(line, columns.description.x, y + 10 + lineIndex * 13.5, columns.description.width)
      })
      if (offset === 0) {
        fitText(quantity.format(Number(item.quantity || 0)).replace(/\s/gu, ' '), columns.quantity.x, y + 10, columns.quantity.width)
        fitText(money(item.unitPrice), columns.unit.x, y + 10, columns.unit.width)
        fitText(money(lineTotalCents(item) / 100), columns.total.x, y + 10, columns.total.width, 9, true)
      }
      y += height
      rule(y)
      offset += count
      if (offset < lines.length) nextPage(true)
    }
  }

  const hasTax = Number(invoice.tax_amount || 0) !== 0
  const showPayments = invoice.status !== 'draft'
  const settlement = invoicePaymentSummary(invoice)
  const summaryHeight = (hasTax ? 128 : 78) + (showPayments ? 74 : 0)
  if (y + 22 + summaryHeight > bottom) nextPage()
  y += 22
  const summaryWidth = 240
  const summaryX = right - summaryWidth
  doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 6).fill(colors.blue)
  let summaryY = y + 15
  if (hasTax) {
    for (const [label, value] of [['Sous-total', invoice.subtotal_amount], [`Taxe (${Number(invoice.tax_rate || 0)} %)`, invoice.tax_amount]]) {
      text(label, summaryX + 16, summaryY, 96, 8.5, false, colors.muted)
      fitText(money(value), summaryX + 118, summaryY, summaryWidth - 134, 9)
      summaryY += 21
    }
    rule(summaryY + 1, summaryX + 16, summaryWidth - 32)
    summaryY += 15
  }
  text('Total', summaryX + 16, summaryY, summaryWidth - 32, 8.5, true, colors.muted)
  fitText(money(invoice.total_amount), summaryX + 16, summaryY + 18, summaryWidth - 32, 22, true, colors.ink)
  if (showPayments) {
    summaryY += 54
    rule(summaryY, summaryX + 16, summaryWidth - 32)
    for (const [label, value] of [['Déjà reçu', settlement.paid_amount], ['Reste à payer', settlement.balance_due]]) {
      summaryY += 20
      text(label, summaryX + 16, summaryY, 96, 8.5, true)
      fitText(money(value), summaryX + 118, summaryY, summaryWidth - 134, 10, true)
    }
  }
  y += summaryHeight + 28
  if (showPayments) {
    flow(`Situation des versements déclarés au ${date(paymentBusinessDate())}.`, left, width, 7.5, false, colors.muted)
    y += 10
  }

  if (invoice.notes) {
    if (y + 48 > bottom) nextPage()
    flow('NOTES ET MODALITÉS', left, width, 8, true, colors.muted)
    y += 8
    flow(invoice.notes, left, width, 9, false, colors.muted)
  }
  const pages = doc.bufferedPageRange()
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index)
    rule(bottom + 22)
    text('Document généré avec Kadi', left, bottom + 34, width - 100, 7.5, false, colors.muted)
    text(`Page ${index + 1}/${pages.count}`, right - 90, bottom + 34, 90, 7.5, false, colors.muted, 'right')
  }
  return doc
}
