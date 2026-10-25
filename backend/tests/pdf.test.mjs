import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createInvoicePdf } from '../utils/invoicePdf.js'
import { normalizeLogoImage } from '../utils/logoImage.js'
import { computeTotals } from '../utils/money.js'

const invoice = (count, description = '') => ({
  invoice_number: 'FAC-TEST', issue_date: '2026-10-22', due_date: '2026-11-22', currency: 'USD',
  status: 'draft', total_amount: count * 10, client: { company_name: 'Client original' },
  items: Array.from({ length: count }, (_, index) => ({ description: `LIGNE-${String(index + 1).padStart(3, '0')} ${description}`, quantity: 1, unitPrice: 10 }))
})
const render = async (data, issuer = { company: 'Entreprise originale' }, logo = null, options = {}) => {
  const doc = createInvoicePdf(data, issuer, logo, options)
  const chunks = []
  const ready = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    doc.on('error', reject)
  })
  doc.end()
  return getDocument({ data: await ready, useSystemFonts: true }).promise
}

for (const currency of ['USD', 'CDF']) {
  test(`discounted ${currency} PDF shows line/global discounts, net tax and the actual remaining balance`, async () => {
    const items = [{ description: 'Conception', quantity: 1, unitPrice: 350, discountType: 'percent', discountValue: 15 }]
    const totals = computeTotals(items, 16, { discount_type: 'percent', discount_value: 10 })
    const pdf = await render({ ...invoice(1), items, currency, status: 'partially_paid', subtotal_amount: totals.subtotal,
      discount_type: 'percent', discount_value: 10, line_discount_amount: totals.lineDiscountAmount,
      discount_amount: totals.discountAmount, tax_rate: 16, tax_amount: totals.taxAmount, total_amount: totals.total, paid_amount: 150 })
    try {
      assert.equal(pdf.numPages, 1, 'a short discounted invoice fits on one page')
      let text = ''
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const content = await (await pdf.getPage(i)).getTextContent()
        text += content.items.map((item) => item.str).join(' ') + ' '
        for (const item of content.items) {
          if (!item.str.trim() || item.str.includes('Document généré avec Kadi') || /^Page \d+\/\d+$/u.test(item.str)) continue
          assert.ok(item.transform[5] >= 80, 'discount summary overlaps footer')
          assert.ok(item.transform[4] + item.width <= 548, 'discount summary overflows right margin')
        }
      }
      assert.match(text, /Remise \(15 %\)/u)
      assert.match(text, /Remises sur lignes/u)
      assert.match(text, /Remise globale \(10 %\)/u)
      text = text.replace(/(\d)\s+,/gu, '$1,')
      assert.match(text, new RegExp(`Net avant taxe\\s+267,75 ${currency}`, 'u'))
      assert.match(text, new RegExp(`Total\\s+310,59 ${currency}`, 'u'))
      assert.match(text, new RegExp(`Reste à payer\\s+160,59 ${currency}`, 'u'))
    } finally { await pdf.loadingTask.destroy() }
  })
}
for (const currency of ['USD', 'CDF']) {
  test(`partially paid ${currency} PDF retains invoice total and shows receipts, balance and statement date`, async () => {
    const pdf = await render({ ...invoice(1), status: 'partially_paid', currency, subtotal_amount: 350, total_amount: 350, paid_amount: 150,
      items: [{ description: 'Service', quantity: 1, unitPrice: 350 }] })
    try {
      let text = ''
      for (let i = 1; i <= pdf.numPages; i += 1) {
        const content = await (await pdf.getPage(i)).getTextContent()
        text += content.items.map((item) => item.str).join(' ') + ' '
        for (const item of content.items) {
          if (!item.str.trim() || item.str.includes('Document généré avec Kadi') || /^Page \d+\/\d+$/u.test(item.str)) continue
          assert.ok(item.transform[5] >= 80, 'payment summary overlaps footer')
          assert.ok(item.transform[4] + item.width <= 548, 'payment summary overflows right margin')
        }
      }
      assert.match(text, /Partiellement payée/u)
      assert.match(text, new RegExp(`Total\\s+350,00 ${currency}`, 'u'))
      assert.match(text, new RegExp(`Déjà reçu\\s+150,00 ${currency}`, 'u'))
      assert.match(text, new RegExp(`Reste à payer\\s+200,00 ${currency}`, 'u'))
      assert.match(text, /Situation des versements déclarés au/u)
    } finally { await pdf.loadingTask.destroy() }
  })
}
test('taxed PDF shows the recorded subtotal, tax and total without rewriting historical values', async () => {
  const pdf = await render({ ...invoice(1), subtotal_amount: 100, tax_rate: 16, tax_amount: 15, total_amount: 115 })
  try {
    const content = await (await pdf.getPage(1)).getTextContent()
    const text = content.items.map((item) => item.str).join(' ')
    assert.match(text, /Sous-total\s+100,00 USD/u)
    assert.match(text, /Taxe \(16 %\)\s+15,00 USD/u)
    assert.match(text, /Total\s+115,00 USD/u)
  } finally { await pdf.loadingTask.destroy() }
})
for (const count of [1, 15, 30, 100]) {
  test(`${count} invoice rows remain readable and paginated`, async () => {
    const pdf = await render(invoice(count))
    try {
      assert.ok(pdf.numPages <= Math.ceil(count / 10) + 1, `unexpected ${pdf.numPages} pages`)
      let allText = ''
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const content = await page.getTextContent()
        const pageText = content.items.map((item) => item.str).join(' ')
        assert.ok(pageText.includes(`Page ${pageNumber}/${pdf.numPages}`))
        if (pageText.includes('LIGNE-')) assert.ok(pageText.includes('Description'), 'table header repeats')
        allText += pageText + ' '
      }
      for (let index = 1; index <= count; index += 1) {
        assert.equal(allText.split(`LIGNE-${String(index).padStart(3, '0')}`).length - 1, 1)
      }
      const amount = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(count * 10).replace(/\s/gu, ' ')
      assert.ok(allText.replace(/\s+/gu, ' ').includes(`Total ${amount} USD`))
    } finally { await pdf.loadingTask.destroy() }
  })
}
test('large descriptions, company fields and unbroken notes respect the footer space', async () => {
  const data = invoice(20, 'W'.repeat(480))
  data.notes = 'X'.repeat(5000)
  const pdf = await render(data, { company: 'Entreprise', address: 'W'.repeat(500), tagline: 'W'.repeat(500) })
  try {
    assert.ok(pdf.numPages < 35)
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (!item.str.trim() || item.str.includes('Document généré avec Kadi') || /^Page \d+\/\d+$/u.test(item.str)) continue
        assert.ok(item.transform[5] >= 80, `content runs into footer on page ${i}: ${item.str.slice(0, 40)}`)
      }
    }
  } finally { await pdf.loadingTask.destroy() }
})
test('one description can span multiple pages without losing text or repeating amounts', async () => {
  const pdf = await render(invoice(1, 'SEGMENT '.repeat(600)))
  try {
    assert.ok(pdf.numPages > 1)
    let allText = ''
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const content = await (await pdf.getPage(index)).getTextContent()
      allText += content.items.map((item) => item.str).join(' ') + ' '
      for (const item of content.items) {
        if (!item.str.trim() || item.str.includes('Document généré avec Kadi') || /^Page \d+\/\d+$/u.test(item.str)) continue
        assert.ok(item.transform[5] >= 80, `text overlaps footer on page ${index}`)
      }
    }
    assert.equal((allText.match(/SEGMENT/gu) || []).length, 600)
    assert.equal((allText.match(/LIGNE-001/gu) || []).length, 1)
    // Unit price, line total and invoice total, including on split rows.
    assert.equal((allText.match(/10,00 USD/gu) || []).length, 3)
  } finally { await pdf.loadingTask.destroy() }
})
test('large CDF amounts and fractional quantities fit their columns', async () => {
  const pdf = await render({ ...invoice(1), currency: 'CDF', total_amount: 1_000_000_000_000,
    items: [{ description: 'Montant maximal', quantity: 1000, unitPrice: 1_000_000_000 }] })
  try {
    const content = await (await pdf.getPage(1)).getTextContent()
    const amounts = content.items.filter((item) => item.str.includes('CDF'))
    assert.equal(amounts.length, 3)
    for (const item of amounts) {
      assert.ok(item.transform[4] >= 320, 'amount leaves its numeric column')
      assert.ok(item.transform[4] + item.width <= 548, 'amount leaves the page content area')
    }
    assert.ok(amounts.some((item) => item.str === '1 000 000 000 000,00 CDF'))
  } finally { await pdf.loadingTask.destroy() }
  const fractional = await render({ ...invoice(1), total_amount: 0.01,
    items: [{ description: 'Arrondi', quantity: 0.001, unitPrice: 5 }] })
  try {
    const content = await (await fractional.getPage(1)).getTextContent()
    const text = content.items.map((item) => item.str).join(' ')
    assert.ok(text.includes('0,001'))
    assert.match(text, /Total\s+0,01 USD/u)
  } finally { await fractional.loadingTask.destroy() }
})
for (const format of ['png', 'jpeg', 'webp', 'svg']) {
  test(`a ${format} logo is embedded in the PDF`, async () => {
    const input = format === 'svg'
      ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="orange"/></svg>')
      : await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ff8800' } }).toFormat(format).toBuffer()
    const logo = await normalizeLogoImage(input)
    const pdf = await render(invoice(1), { company: 'Entreprise' }, logo)
    try {
      const ops = await (await pdf.getPage(1)).getOperatorList()
      assert.ok(ops.fnArray.includes(OPS.paintImageXObject))
    } finally { await pdf.loadingTask.destroy() }
  })
}
test('corrupt images and oversized dimensions are rejected', async () => {
  await assert.rejects(normalizeLogoImage(Buffer.from('not an image')), /Logo illisible/)
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"/>')
  await assert.rejects(normalizeLogoImage(svg), /Logo illisible/)
})


test('quote PDF has its own title and validity and never displays invoice receipts', async () => {
  const pdf = await render({ ...invoice(2), invoice_number: 'DEV-TEST', status: 'sent' }, undefined, null, { kind: 'quote' })
  try {
    let text = ''
    for (let index=1; index<=pdf.numPages; index++) text += (await (await pdf.getPage(index)).getTextContent()).items.map(item=>item.str).join(' ')
    assert.match(text,/DEVIS/u)
    assert.match(text,/VALABLE JUSQU/u)
    assert.doesNotMatch(text,/FACTURE|Déjà reçu|Reste à payer/u)
  } finally { await pdf.loadingTask.destroy() }
})

test('current invoice PDF includes PO, source quote and every active receipt without losing pagination', async () => {
  const payments = Array.from({length:40},(_,index)=>({paid_on:'2026-01-05',amount:1,method:'cash',reference:`Versement-${index+1}`}))
  const pdf=await render({...invoice(1),status:'partially_paid',total_amount:100,subtotal_amount:100,paid_amount:40,
    quote_number:'DEV-ORIGINE',po_reference:'PO-CLIENT-123',payments})
  try {
    let text=''
    for(let index=1;index<=pdf.numPages;index++){
      const page=await pdf.getPage(index),content=await page.getTextContent()
      text+=content.items.map(item=>item.str).join(' ')+' '
      for(const item of content.items){
        if(!item.str.trim()||item.str.includes('Document généré')||/^Page \d+\/\d+$/u.test(item.str))continue
        assert.ok(item.transform[5]>=80,'receipt history overlaps footer')
        assert.ok(item.transform[4]+item.width<=548,'receipt history overflows margin')
      }
    }
    assert.match(text,/DEV-ORIGINE/u);assert.match(text,/PO-CLIENT-123/u);assert.match(text,/Versement-40/u)
    assert.match(text,/60,00 USD/u);assert.match(text,/VERSEMENTS REÇUS/u)
  }finally{await pdf.loadingTask.destroy()}
})
