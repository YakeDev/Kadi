// Generate *real KADI PDFKit output* using fictitious business data for manual
// A4 visual checks. No Supabase credentials, accounts or network requests needed.
import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { finished } from 'node:stream/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInvoicePdf } from '../utils/invoicePdf.js'
import { normalizeLogoImage } from '../utils/logoImage.js'

const output = fileURLToPath(new URL('../artifacts/pdf-qa/', import.meta.url))
await mkdir(output, { recursive: true })
const issuer = {
  company: 'ATELIER DE DÉMONSTRATION SARL',
  tagline: 'Identité visuelle et solutions numériques',
  address: '12, avenue de la Démonstration',
  city: 'Lubumbashi',
  state: 'Haut-Katanga',
  manager_name: 'Responsable commercial',
  phone: '+243 000 000 001',
  nif: 'NIF-DEMO',
  national_id: 'ID-DEMO',
  rccm: 'RCCM-DEMO',
}
const sample = {
  issue_date: '2026-11-01',
  due_date: '2026-12-01',
  valid_until: '2026-11-30',
  status: 'sent',
  client: {
    company_name: 'CLIENT FICTIF SARL',
    address: '48, avenue des Clients, Lubumbashi',
    contact_name: 'Service achats',
    email: 'test@example.invalid',
    nif: 'NIF-CLIENT-DEMO',
  },
  items: [
    {
      title: 'LOT 01 — Identité de marque',
      description: 'Recherche et direction artistique (2 pistes), conception du logo et variantes, palette de couleurs, typographies, mini-charte graphique de 8 à 12 pages et fichiers livrables PNG, SVG et PDF.',
      quantity: 1, unitPrice: 420,
    },
    {
      title: 'LOT 02 — Présentation du programme',
      description: 'Conception éditoriale, mise en page et préparation d’une présentation professionnelle du programme en français, avec deux séries de corrections.',
      quantity: 1, unitPrice: 180,
    },
  ],
  subtotal_amount: 600,
  tax_rate: 0, tax_amount: 0,
  total_amount: 600,
  notes: 'Validité : 30 jours. Conditions : 50 % à la commande, solde à la livraison. Aucun compte ni client réel utilisé.',
}
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="92" viewBox="0 0 240 92">' +
  '<rect width="240" height="92" rx="4" fill="#15324c"/>' +
  '<text x="18" y="55" font-family="sans-serif" font-size="29" font-weight="bold" fill="white">ATELIER QA</text>' +
  '</svg>',
  'utf-8',
)
const logo = await normalizeLogoImage(svg)
const exported = []
for (const kind of ['invoice', 'quote']) {
  for (const pdf_template of ['classic', 'sober', 'minimal']) {
    for (const hasLogo of [true, false]) {
      const currency = kind === 'invoice' ? 'USD' : 'CDF'
      const label = `${kind}-${pdf_template}-${currency.toLowerCase()}-${hasLogo ? 'avec-logo' : 'sans-logo'}.pdf`
      const payload = {
        ...sample,
        pdf_template,
        currency,
        invoice_number: kind === 'invoice' ? 'FAC-QA-001' : 'DEV-QA-001',
        status: kind === 'invoice' ? 'partially_paid' : 'sent',
        paid_amount: kind === 'invoice' ? 200 : 0,
        payments: kind === 'invoice' ? [{ paid_on: '2026-11-01', amount: 200, method: 'bank_transfer', reference: 'QA-TEST' }] : [],
      }
      const out = createWriteStream(join(output, label))
      const doc = createInvoicePdf(payload, issuer, hasLogo ? logo : null, { kind })
      doc.pipe(out)
      doc.end()
      await finished(out)
      exported.push(label)
    }
  }
}
await writeFile(join(output, 'README.txt'), [
  'KADI — Vérification VISUELLE des véritables PDF générés par le moteur backend',
  'Données entièrement fictives ; cette archive ne contient aucune information client.',
  '',
  '12 PDF A4 : 3 modèles × facture/devis × logo présent/absent.',
  'Factures en USD (avec paiement partiel) ; devis en CDF.',
  'À contrôler : espaces, contrastes, débordements, lisibilité,',
  'prestations titre/détails, montants, numéros, mentions légales,',
  'sauts de page si contenu long, et différences entre modèles.',
  'Ces fichiers ne remplacent pas une recette authentifiée de bout en bout.',
  ...exported.map(filename => '- ' + filename),
  '',
].join('\n'), 'utf-8')
console.log(`Generated ${exported.length} authentic KADI PDFs in ${output}`)
