import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createInvoicePdf } from '../utils/invoicePdf.js'
import { normalizeLogoImage } from '../utils/logoImage.js'

const invoice = (count, description = '') => ({
  invoice_number: 'FAC-TEST', issue_date: '2026-10-22', due_date: '2026-11-22', currency: 'USD',
  status: 'draft', total_amount: count * 10, client: { company_name: 'Client original' },
  items: Array.from({ length: count }, (_, index) => ({ description: `LIGNE-${String(index + 1).padStart(3, '0')} ${description}`, quantity: 1, unitPrice: 10 }))
})
const render = async (data, issuer = { company: 'Entreprise originale' }, logo = null) => {
  const doc = createInvoicePdf(data, issuer, logo)
  const chunks = []
  const ready = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
    doc.on('error', reject)
  })
  doc.end()
  return getDocument({ data: await ready, useSystemFonts: true }).promise
}
test('taxed PDF shows the recorded subtotal, tax and total without rewriting historical values', async () => {
  const pdf = await render({ ...invoice(1), subtotal_amount: 100, tax_rate: 16, tax_amount: 15, total_amount: 115 })
  try {
    const content = await (await pdf.getPage(1)).getTextContent()
    const text = content.items.map((item) => item.str).join(' ')
    assert.ok(text.includes('Sous-total : 100.00 USD'))
    assert.ok(text.includes('Taxe (16 %) : 15.00 USD'))
    assert.ok(text.includes('Total : 115.00 USD'))
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
      assert.ok(allText.includes(`Total : ${(count * 10).toFixed(2)} USD`))
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
        if (!item.str.trim() || item.str.includes('Kadi — Page')) continue
        assert.ok(item.transform[5] >= 80, `content runs into footer on page ${i}: ${item.str.slice(0, 40)}`)
      }
    }
  } finally { await pdf.loadingTask.destroy() }
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
