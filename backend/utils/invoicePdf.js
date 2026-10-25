import PDFDocument from 'pdfkit'
import dayjs from 'dayjs'
import { fileURLToPath } from 'node:url'
import { lineAmounts } from './money.js'
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

export const createInvoicePdf = (invoice, issuer = {}, logo = null, { kind = 'invoice' } = {}) => {
  const isQuote = kind === 'quote'
  const title = isQuote ? 'DEVIS' : 'FACTURE'
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
    text(`${title} - SUITE`, left, 48, 140, 10, true, colors.accent)
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

  if (isQuote) {
    // A compact document header, followed by two aligned, independently paginated parties.
    const metaWidth = 220
    const metaX = right - metaWidth
    const brandWidth = width - metaWidth - 28
    doc.rect(left, 32, width, 3).fill(colors.accent)
    if (logo) {
      doc.image(logo, left, y, { fit: [120, 48], align: 'left', valign: 'center' })
      y += 61
    }
    flow(issuer.company || 'Kadi', left, brandWidth, 18, true)
    if (issuer.tagline) { y += 7; flow(issuer.tagline, left, brandWidth, 8.5, false, colors.muted) }
    const brandBottom = y
    const brandPage = currentPage
    if (brandPage > 0) doc.switchToPage(0)
    const reference = wrap(invoice.invoice_number || '-', metaWidth - 32, 9, true)
    const datesY = 96 + reference.length * 13.5 + 12
    const metaBottom = datesY + 38
    doc.roundedRect(metaX, 48, metaWidth, metaBottom - 48, 8).fill(colors.pale)
    text('DEVIS', metaX + 16, 61, 100, 24, true)
    const status = invoice.status === 'draft' ? 'Brouillon' : 'Envoyé'
    font(8, true)
    const badgeWidth = doc.widthOfString(status) + 18
    doc.roundedRect(right - badgeWidth - 16, 67, badgeWidth, 22, 5).fill(colors.blue)
    text(status, right - badgeWidth - 16, 73, badgeWidth, 8, true, colors.accent, 'center')
    reference.forEach((line, index) => text(line, metaX + 16, 96 + index * 13.5, metaWidth - 32, 9, true))
    const dateWidth = (metaWidth - 46) / 2
    text('ÉMIS LE', metaX + 16, datesY, dateWidth, 7, true, colors.muted)
    text(date(invoice.issue_date), metaX + 16, datesY + 14, dateWidth, 9)
    text('VALABLE JUSQU’AU', metaX + dateWidth + 30, datesY, dateWidth, 7, true, colors.muted)
    text(date(invoice.due_date), metaX + dateWidth + 30, datesY + 14, dateWidth, 9)
    // Extreme names/taglines can span pages; metadata remains on the first page.
    if (brandPage > 0) doc.switchToPage(brandPage)
    y = Math.max(brandBottom, currentPage === 0 ? metaBottom : 88) + 22
    const client = invoice.client || {}
    const partyWidth = (width - 20) / 2
    const makeLines = (company, details) => [
      { value: company, size: 11, bold: true, gap: 7 },
      ...details.filter(Boolean).map(value => ({ value, size: 8.5, gap: 1.5, color: colors.muted }))
    ].flatMap(({ value, ...style }) => wrap(value, partyWidth - 28, style.size, style.bold)
      .map((line, index, lines) => ({ ...style, value: line, gap: index === lines.length - 1 ? style.gap : 0 })))
    const parties = [
      { title: 'ÉMETTEUR', x: left, fill: '#ffffff', index: 0, lines: makeLines(issuer.company || 'Kadi', [
        issuer.manager_name && `Contact : ${issuer.manager_name}`, issuer.address,
        [issuer.city, issuer.state].filter(Boolean).join(', '), issuer.phone, issuer.website,
        issuer.nif && `NIF : ${issuer.nif}`, issuer.national_id && `ID. Nat. : ${issuer.national_id}`, issuer.rccm && `RCCM : ${issuer.rccm}`
      ]) },
      { title: 'PROPOSÉ À', x: left + partyWidth + 20, fill: colors.pale, index: 0, lines: makeLines(client.company_name || 'Client non défini', [
        client.contact_name, client.address, client.email, client.phone,
        client.nif && `NIF : ${client.nif}`, client.national_id && `ID. Nat. : ${client.national_id}`, client.rccm && `RCCM : ${client.rccm}`
      ]) }
    ]
    while (parties.some(party => party.index < party.lines.length)) {
      if (y + 82 > bottom) nextPage()
      const fragments = parties.map(party => {
        let height = 40
        let end = party.index
        while (end < party.lines.length) {
          const line = party.lines[end]
          const lineHeight = line.size * 1.5 + line.gap
          if (y + height + lineHeight > bottom) break
          height += lineHeight
          end += 1
        }
        return { party, end, height }
      })
      const blockHeight = Math.max(...fragments.map(fragment => fragment.height))
      for (const { party, end } of fragments) {
        if (party.index >= party.lines.length) continue
        doc.roundedRect(party.x, y, partyWidth, blockHeight, 6).lineWidth(0.6).fillAndStroke(party.fill, colors.line)
        text(party.title, party.x + 14, y + 13, partyWidth - 28, 7, true, colors.accent)
        let lineY = y + 31
        for (const line of party.lines.slice(party.index, end)) {
          text(line.value, party.x + 14, lineY, partyWidth - 28, line.size, line.bold, line.color)
          lineY += line.size * 1.5 + line.gap
        }
        party.index = end
      }
      y += blockHeight + 24
    }
  } else {
    // The reference and dates have their own column instead of enlarging the title.
    const metaWidth = 206
    const metaX = right - metaWidth
    const issuerWidth = width - metaWidth - 32
    doc.rect(left, 32, width, 2).fill(colors.accent)
    text(title, metaX, 48, metaWidth, 27, true, colors.ink, 'right')
    const [status, statusBackground, statusColor] = isQuote
      ? [invoice.status === 'draft' ? 'Brouillon' : 'Envoyé', '#eff6ff', '#1d4ed8']
      : statuses[invoice.status] || statuses.sent
    font(8, true)
    const badgeWidth = doc.widthOfString(status) + 22
    doc.roundedRect(right - badgeWidth, 87, badgeWidth, 22, 5).fill(statusBackground)
    text(status, right - badgeWidth, 93, badgeWidth, 8, true, statusColor, 'center')
    text('RÉFÉRENCE', metaX, 125, metaWidth, 7.5, true, colors.muted, 'right')
    const reference = wrap(invoice.invoice_number || '-', metaWidth, 9, true)
    reference.forEach((line, index) => text(line, metaX, 139 + index * 13.5, metaWidth, 9, true, colors.ink, 'right'))
    const datesY = 139 + reference.length * 13.5 + 15
    const dateWidth = (metaWidth - 14) / 2
    text(isQuote ? 'ÉMIS LE' : 'ÉMISE LE', metaX, datesY, dateWidth, 7.5, true, colors.muted)
    text(date(invoice.issue_date), metaX, datesY + 14, dateWidth, 9)
    text(isQuote ? 'VALABLE JUSQU’AU' : 'ÉCHÉANCE', metaX + dateWidth + 14, datesY, dateWidth, 7.5, true, colors.muted, 'right')
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
      { value: isQuote ? 'PROPOSÉ À' : 'FACTURÉ À', size: 7.5, bold: true, color: colors.muted, gap: 7 },
      { value: client.company_name || 'Client non défini', size: 12, bold: true, gap: 4 },
      ...[client.contact_name, client.address, client.email, client.phone,
        client.nif && `NIF : ${client.nif}`, client.national_id && `ID. Nat. : ${client.national_id}`, client.rccm && `RCCM : ${client.rccm}`].filter(Boolean)
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
  }

  const columns = {
    description: { x: left + 12, width: 206 },
    quantity: { x: left + 226, width: 38 },
    unit: { x: left + 276, width: 97 },
    total: { x: left + 385, width: width - 397 }
  }
  const tableHeader = () => {
    doc.rect(left, y, width, 30).fill(isQuote ? colors.ink : colors.pale)
    text('Description', columns.description.x, y + 9, columns.description.width, 8.5, true, isQuote ? '#ffffff' : colors.ink)
    for (const [key, label] of [['quantity', 'Qté'], ['unit', 'Prix unitaire'], ['total', 'Total']]) {
      const column = columns[key]
      text(label, column.x, y + 9, column.width, 8.5, true, isQuote ? '#ffffff' : colors.ink, 'right')
    }
    rule(y + 30)
    y += 30
  }
  if (y + 70 > bottom) nextPage(true)
  else tableHeader()
  for (const [index, item] of (invoice.items || []).entries()) {
    const amounts = lineAmounts(item)
    const discountNote = amounts.discountCents > 0
      ? `\nRemise${item.discountType === 'percent' ? ` (${item.discountValue} %)` : ''} : ${money(amounts.discountCents / 100)}` : ''
    const lines = wrap(`${item.description || '-'}${discountNote}`, columns.description.width, 9)
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
        fitText(money(amounts.netCents / 100), columns.total.x, y + 10, columns.total.width, 9, true)
      }
      y += height
      rule(y)
      offset += count
      if (offset < lines.length) nextPage(true)
    }
  }

  const hasTax = Number(invoice.tax_amount || 0) !== 0
  const discountAmount = Number(invoice.discount_amount || 0)
  const lineDiscountAmount = Number(invoice.line_discount_amount || 0)
  const globalDiscountAmount = Math.round((discountAmount - lineDiscountAmount) * 100) / 100
  const summaryRows = []
  if (hasTax || discountAmount > 0) summaryRows.push(['Sous-total', invoice.subtotal_amount])
  if (lineDiscountAmount > 0) summaryRows.push(['Remises sur lignes', -lineDiscountAmount])
  if (globalDiscountAmount > 0) summaryRows.push([`Remise globale${invoice.discount_type === 'percent' ? ` (${Number(invoice.discount_value)} %)` : ''}`, -globalDiscountAmount])
  if (hasTax && discountAmount > 0) summaryRows.push(['Net avant taxe', Number(invoice.subtotal_amount) - discountAmount])
  if (hasTax) summaryRows.push([`Taxe (${Number(invoice.tax_rate || 0)} %)`, invoice.tax_amount])
  const showPayments = !isQuote && invoice.status !== 'draft'
  const settlement = invoicePaymentSummary(invoice)
  const summaryRowGap = isQuote ? 18 : 21
  const summaryHeight = (isQuote ? 68 : 78) + (summaryRows.length ? summaryRows.length * summaryRowGap + (isQuote ? 10 : 15) : 0) + (showPayments ? 74 : 0)
  if (y + 22 + summaryHeight > bottom) nextPage()
  y += 22
  const summaryTop = y
  const summaryWidth = discountAmount > 0 ? 286 : 240
  const summaryX = right - summaryWidth
  doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 6).fill(isQuote ? colors.pale : colors.blue)
  if (isQuote) doc.rect(summaryX + 16, y, summaryWidth - 32, 2).fill(colors.accent)
  let summaryY = y + 15
  if (summaryRows.length) {
    for (const [label, value] of summaryRows) {
      text(label, summaryX + 16, summaryY, summaryWidth - 160, 8, false, colors.muted)
      fitText(money(value), right - 132, summaryY, 116, 9)
      summaryY += summaryRowGap
    }
    rule(summaryY + 1, summaryX + 16, summaryWidth - 32)
    summaryY += 15
  }
  text('Total', summaryX + 16, summaryY, summaryWidth - 32, 8.5, true, colors.muted)
  fitText(money(invoice.total_amount), summaryX + 16, summaryY + 18, summaryWidth - 32, 22, true, isQuote ? colors.accent : colors.ink)
  if (showPayments) {
    summaryY += 54
    rule(summaryY, summaryX + 16, summaryWidth - 32)
    for (const [label, value] of [['Déjà reçu', settlement.paid_amount], ['Reste à payer', settlement.balance_due]]) {
      summaryY += 20
      text(label, summaryX + 16, summaryY, 96, 8.5, true)
      fitText(money(value), summaryX + 118, summaryY, summaryWidth - 134, 10, true)
    }
  }
  // Keep a short payment statement and terms beside the totals rather than orphaning them.
  const summaryEnd = summaryTop + summaryHeight + 28
  const sideWidth = width - summaryWidth - 24
  y = summaryTop + 4
  if (showPayments) {
    flow(`Situation des versements déclarés au ${date(paymentBusinessDate())}.`, left, sideWidth, 7.5, false, colors.muted)
    y += 10
  }
  const notesBeside = invoice.notes && y - summaryTop + 28 + wrap(invoice.notes, sideWidth, 9).length * 13.5 <= summaryHeight
  if (notesBeside) {
    flow('NOTES ET MODALITÉS', left, sideWidth, 8, true, colors.muted)
    y += 8
    flow(invoice.notes, left, sideWidth, 9, false, colors.muted)
  }
  y = summaryEnd

  if (invoice.notes && !notesBeside) {
    if (y + 48 > bottom) nextPage()
    flow('NOTES ET MODALITÉS', left, width, 8, true, colors.muted)
    y += 8
    flow(invoice.notes, left, width, 9, false, colors.muted)
  }
  if (!isQuote && (invoice.quote_number || invoice.po_reference)) {
    if (y + 60 > bottom) nextPage()
    if (invoice.quote_number) flow(`Devis d’origine : ${invoice.quote_number}`, left, width, 9, true)
    if (invoice.po_reference) flow(`Référence PO : ${invoice.po_reference}`, left, width, 9, true)
    y += 14
  }
  if (showPayments && invoice.payments?.length) {
    if (y + 55 > bottom) nextPage()
    flow('VERSEMENTS REÇUS', left, width, 9, true, colors.accent)
    y += 8
    const methods = { cash: 'Espèces', bank_transfer: 'Virement', mobile_money: 'Mobile Money', other: 'Autre', legacy: 'Reprise historique' }
    for (const payment of invoice.payments) {
      flow(`${date(payment.paid_on)} · ${money(payment.amount)} · ${methods[payment.method] || payment.method}${payment.reference ? ` · ${payment.reference}` : ''}`, left, width, 8.5)
      y += 5
    }
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
