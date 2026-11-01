import clsx from 'clsx'
import { getInvoiceTotals, getInvoiceLineTotals } from '../utils/invoiceTotals.js'
import { paymentBalance } from '../utils/payments.js'

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'USD',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0)).replace(/\u00a0/gu, ' ')

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '—'

const InvoicePreview = ({ id, className, company, client, invoice, maxItems = 4, documentType = 'invoice' }) => {
  const isQuote = documentType === 'quote'
  const previewLabel = isQuote ? 'Aperçu du devis' : 'Aperçu de la facture'
  const items = invoice.items ?? []
  const template = ['classic', 'sober', 'minimal'].includes(invoice.pdf_template) ? invoice.pdf_template : 'classic'
  const isClassic = template === 'classic'
  const { subtotal, lineDiscountAmount, globalDiscountAmount, discountAmount, netSubtotal, taxRate, taxAmount, total, currency, calculationError } = getInvoiceTotals(invoice)
  const { paid, remaining } = paymentBalance({ ...invoice, total_amount: total })

  const companyLocation = [company?.city, company?.state].filter(Boolean).join(', ')
  const status = {
    draft: ['Brouillon', 'bg-amber-50 text-amber-800'],
    sent: [isQuote ? 'Envoyé' : 'Émise', 'bg-blue-50 text-blue-700'],
    overdue: ['Échue', 'bg-red-50 text-red-700'],
    paid: ['Payée', 'bg-emerald-50 text-emerald-700'],
    converted: ['Converti', 'bg-slate-100 text-slate-700'],
    partially_paid: ['Partiellement payée', 'bg-amber-50 text-amber-800']
  }[invoice.status || 'draft']

  return (
    <aside
      id={id}
      tabIndex={-1}
      className={clsx(
        'flex min-w-0 flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5',
        className
      )}
      aria-label={previewLabel}
    >
      <header className='mb-5 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]'>
        <p className='font-semibold'>{previewLabel}</p>
        <p>Mise à jour en temps réel</p>
      </header>

      <div className={clsx('grid grid-cols-2 gap-5 pt-5 text-xs', isClassic && 'border-t-2 border-blue-600', template === 'sober' && 'border-t border-slate-300')}>
        <div>
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt='Logo entreprise'
              className='mb-4 h-12 w-28 max-w-full object-contain object-left'
            />
          ) : null}
          {!company?.logo_url ? <p className='break-words text-base font-semibold text-slate-800'>{company?.company || 'Votre entreprise'}</p> : null}
          <div className='mt-2 space-y-1 break-words text-[11px] text-slate-500'>
            {company?.tagline ? <p>{company.tagline}</p> : null}
            {company?.manager_name ? <p>Responsable : {company.manager_name}</p> : null}
            {company?.address ? <p>{company.address}</p> : null}
            {companyLocation ? <p>{companyLocation}</p> : null}
            {company?.phone ? <p>{company.phone}</p> : null}
            {company?.website ? <p>{company.website}</p> : null}
            {company?.national_id ? <p>ID. Nat. : {company.national_id}</p> : null}
            {company?.rccm ? <p>RCCM : {company.rccm}</p> : null}
            {company?.nif ? <p>NIF : {company.nif}</p> : null}
          </div>
        </div>
        <div className='min-w-0 text-right'>
          <h3 className='text-xl font-semibold tracking-wide text-slate-800'>{isQuote ? 'DEVIS' : 'FACTURE'}</h3>
          <span className={clsx('mt-2 inline-block rounded px-2.5 py-1 text-[10px] font-semibold', status?.[1])}>
            {status?.[0] || invoice.status}
          </span>
          <p className='mt-4 text-[9px] font-semibold uppercase tracking-wider text-slate-500'>Référence</p>
          <p className='mt-1 break-words text-[11px] font-semibold text-slate-800'>{(isQuote ? invoice.quote_number : invoice.invoice_number) || 'Attribuée à l’enregistrement'}</p>
          <dl className='mt-4 space-y-2 text-[10px]'>
            <div><dt className='text-slate-500'>{isQuote ? 'Émis le' : 'Émise le'}</dt><dd className='mt-0.5 text-slate-800'>{formatDate(invoice.issue_date)}</dd></div>
            <div><dt className='text-slate-500'>{isQuote ? 'Valable jusqu’au' : 'Échéance'}</dt><dd className='mt-0.5 text-slate-800'>{formatDate(isQuote ? (invoice.valid_until ?? invoice.due_date) : invoice.due_date)}</dd></div>
          </dl>
        </div>
      </div>

      <div className={clsx('mt-6 space-y-1 break-words px-4 py-3 text-[11px] text-slate-600', isClassic ? 'border-l-2 border-blue-600 bg-slate-50' : template === 'sober' ? 'bg-slate-50' : 'bg-white')}>
        <p className='mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500'>{isQuote ? 'Proposé à' : 'Facturé à'}</p>
        <p className='text-sm font-semibold text-slate-800'>{client?.company_name || 'Client non défini'}</p>
        {client?.contact_name ? <p>{client.contact_name}</p> : null}
        {client?.address ? <p className='whitespace-pre-line'>{client.address}</p> : null}
        {client?.email ? <p>{client.email}</p> : null}
        {client?.phone ? <p>{client.phone}</p> : null}
        {client?.nif ? <p>NIF : {client.nif}</p> : null}
        {client?.national_id ? <p>ID. Nat. : {client.national_id}</p> : null}
        {client?.rccm ? <p>RCCM : {client.rccm}</p> : null}
      </div>

      <div className='mt-6'>
        {items.length === 0 ? (
          <p className='py-4 text-xs text-[var(--text-muted)]'>
            Ajoutez vos lignes de facturation pour voir un aperçu détaillé.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[280px] table-fixed border-collapse text-[10px] text-slate-600'>
              <caption className='sr-only'>Lignes de facturation</caption>
              <thead className={clsx('text-slate-800', template !== 'minimal' && 'bg-slate-50')} >
                <tr>
                  <th scope='col' className='w-[40%] px-2 py-2.5 text-left font-semibold'>Prestation / périmètre</th>
                  <th scope='col' className='w-[10%] px-1 py-2.5 text-right font-semibold'>Qté</th>
                  <th scope='col' className='w-[25%] px-2 py-2.5 text-right font-semibold'>Prix unitaire</th>
                  <th scope='col' className='w-[25%] px-2 py-2.5 text-right font-semibold'>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, maxItems).map((item, index) => {
                  const line = getInvoiceLineTotals(item)
                  return (
                  <tr key={index} className='border-b border-slate-200 align-top'>
                    <td className='break-words px-2 py-3 text-slate-800'>
                      <p className='font-semibold'>{item.title || item.description || 'Prestation sans titre'}</p>
                      {item.title && item.description ? <p className='mt-1 whitespace-pre-line text-[9px] leading-relaxed text-slate-500'>{item.description}</p> : null}
                      {line.discount > 0 ? <p className='mt-1 text-[9px] text-slate-500'>Remise : {item.discountType === 'percent' ? `${item.discountValue} % · ` : ''}{formatCurrency(line.discount, currency)}</p> : null}
                    </td>
                    <td className='break-words px-1 py-3 text-right'>{Number(item.quantity || 0).toLocaleString('fr-FR')}</td>
                    <td className='break-words px-2 py-3 text-right'>{formatCurrency(Number(item.unitPrice || 0), currency)}</td>
                    <td className='break-words px-2 py-3 text-right font-semibold text-slate-800'>
                      {line.calculationError ? '—' : formatCurrency(line.net, currency)}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {items.length > maxItems ? <p className='mt-2 text-[10px] text-slate-500'>+ {items.length - maxItems} ligne(s) supplémentaire(s) dans le PDF</p> : null}
      </div>

      {calculationError ? <p className='mt-5 text-sm text-red-800'>Total à vérifier : {calculationError}</p> : <div className={clsx('ml-auto mt-5 w-full max-w-[260px] px-4 py-4 text-xs text-slate-800', isClassic ? 'rounded-md bg-blue-50' : template === 'sober' ? 'rounded-md bg-slate-50' : 'border-t border-b border-slate-300 bg-white')}>
        {taxAmount !== 0 || discountAmount > 0 ? (
          <div className='mb-3 space-y-2 border-b border-blue-100 pb-3'>
            <div className='flex justify-between gap-3'><span>Sous-total</span><span>{formatCurrency(subtotal, currency)}</span></div>
            {lineDiscountAmount > 0 ? <div className='flex justify-between gap-3'><span>Remises sur lignes</span><span>−{formatCurrency(lineDiscountAmount, currency)}</span></div> : null}
            {globalDiscountAmount > 0 ? <div className='flex justify-between gap-3'><span>Remise globale{invoice.discount_type === 'percent' ? ` (${invoice.discount_value} %)` : ''}</span><span>−{formatCurrency(globalDiscountAmount, currency)}</span></div> : null}
            {discountAmount > 0 && taxAmount !== 0 ? <div className='flex justify-between gap-3'><span>Net avant taxe</span><span>{formatCurrency(netSubtotal, currency)}</span></div> : null}
            {taxAmount !== 0 ? <div className='flex justify-between gap-3'><span>Taxe ({taxRate} %)</span><span>{formatCurrency(taxAmount, currency)}</span></div> : null}
          </div>
        ) : null}
        <p className='text-[10px] font-semibold text-slate-600'>Total</p>
        <p className='mt-1 break-words text-right text-xl font-semibold'>{formatCurrency(total, currency)}</p>
        {!isQuote && invoice.status && invoice.status !== 'draft' ? <dl className='mt-3 space-y-2 border-t border-blue-100 pt-3'><div className='flex justify-between gap-3'><dt>Déjà reçu</dt><dd>{formatCurrency(paid, currency)}</dd></div><div className='flex justify-between gap-3 font-semibold'><dt>Reste à payer</dt><dd>{formatCurrency(remaining, currency)}</dd></div></dl> : null}
      </div>}

      {invoice.notes ? (
        <div className='mt-6 text-[11px] text-slate-500'>
          <p className='mb-2 text-[9px] font-semibold uppercase tracking-wider'>Notes et modalités</p>
          <p className='whitespace-pre-wrap break-words'>{invoice.notes}</p>
        </div>
      ) : null}
    </aside>
  )
}

export default InvoicePreview
