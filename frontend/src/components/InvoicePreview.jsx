import clsx from 'clsx'

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'USD',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0))

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '—'

const InvoicePreview = ({ className, company, client, invoice }) => {
  const items = invoice.items ?? []
  const calculatedSubtotal = items.reduce(
    (acc, item) => acc + Math.round((Number(item.quantity || 0) * Number(item.unitPrice || 0) + Number.EPSILON) * 100) / 100,
    0
  )

  const isIssued = invoice.status && invoice.status !== 'draft'
  const subtotal = isIssued && invoice.subtotal_amount != null ? Number(invoice.subtotal_amount) : calculatedSubtotal
  const taxRate = Number(invoice.tax_rate || 0)
  const roundedRate = Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100 ? Math.round(taxRate * 100) : 0
  const subtotalCents = Math.round(subtotal * 100)
  const calculatedTax = Number.isSafeInteger(subtotalCents) && subtotalCents >= 0
    ? Number((BigInt(subtotalCents) * BigInt(roundedRate) + 5000n) / 10000n) / 100
    : 0
  const taxAmount = isIssued && invoice.tax_amount != null ? Number(invoice.tax_amount) : calculatedTax
  const total = isIssued && invoice.total_amount != null ? Number(invoice.total_amount) : subtotal + taxAmount
  const currency = invoice.currency === '$' ? 'USD' : invoice.currency || 'USD'

  const companyLocation = [company?.city, company?.state].filter(Boolean).join(', ')
  const status = {
    draft: ['Brouillon', 'bg-amber-50 text-amber-800'],
    sent: ['Émise', 'bg-blue-50 text-blue-700'],
    overdue: ['Échue', 'bg-red-50 text-red-700'],
    paid: ['Payée', 'bg-emerald-50 text-emerald-700']
  }[invoice.status || 'draft']

  return (
    <aside
      className={clsx(
        'flex min-w-0 flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5',
        className
      )}
      aria-label='Aperçu de la facture'
    >
      <header className='mb-5 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]'>
        <p className='font-semibold'>Aperçu de la facture</p>
        <p>Mise à jour en temps réel</p>
      </header>

      <div className='grid grid-cols-2 gap-5 border-t-2 border-blue-600 pt-5 text-xs'>
        <div>
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt='Logo entreprise'
              className='mb-4 h-12 w-28 max-w-full object-contain object-left'
            />
          ) : null}
          <p className='break-words text-base font-semibold text-slate-800'>{company?.company || 'Votre entreprise'}</p>
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
          <h3 className='text-xl font-semibold tracking-wide text-slate-800'>FACTURE</h3>
          <span className={clsx('mt-2 inline-block rounded px-2.5 py-1 text-[10px] font-semibold', status?.[1])}>
            {status?.[0] || invoice.status}
          </span>
          <p className='mt-4 text-[9px] font-semibold uppercase tracking-wider text-slate-500'>Référence</p>
          <p className='mt-1 break-words text-[11px] font-semibold text-slate-800'>{invoice.invoice_number || 'Attribuée à l’enregistrement'}</p>
          <dl className='mt-4 space-y-2 text-[10px]'>
            <div><dt className='text-slate-500'>Émise le</dt><dd className='mt-0.5 text-slate-800'>{formatDate(invoice.issue_date)}</dd></div>
            <div><dt className='text-slate-500'>Échéance</dt><dd className='mt-0.5 text-slate-800'>{formatDate(invoice.due_date)}</dd></div>
          </dl>
        </div>
      </div>

      <div className='mt-6 space-y-1 break-words border-l-2 border-blue-600 bg-slate-50 px-4 py-3 text-[11px] text-slate-600'>
        <p className='mb-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500'>Facturé à</p>
        <p className='text-sm font-semibold text-slate-800'>{client?.company_name || 'Client non défini'}</p>
        {client?.contact_name ? <p>{client.contact_name}</p> : null}
        {client?.address ? <p className='whitespace-pre-line'>{client.address}</p> : null}
        {client?.email ? <p>{client.email}</p> : null}
        {client?.phone ? <p>{client.phone}</p> : null}
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
              <thead className='bg-slate-50 text-slate-800'>
                <tr>
                  <th scope='col' className='w-[40%] px-2 py-2.5 text-left font-semibold'>Description</th>
                  <th scope='col' className='w-[10%] px-1 py-2.5 text-right font-semibold'>Qté</th>
                  <th scope='col' className='w-[25%] px-2 py-2.5 text-right font-semibold'>Prix unitaire</th>
                  <th scope='col' className='w-[25%] px-2 py-2.5 text-right font-semibold'>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 4).map((item, index) => (
                  <tr key={index} className='border-b border-slate-200 align-top'>
                    <td className='break-words px-2 py-3 text-slate-800'>{item.description || 'Article sans titre'}</td>
                    <td className='break-words px-1 py-3 text-right'>{Number(item.quantity || 0).toLocaleString('fr-FR')}</td>
                    <td className='break-words px-2 py-3 text-right'>{formatCurrency(Number(item.unitPrice || 0), currency)}</td>
                    <td className='break-words px-2 py-3 text-right font-semibold text-slate-800'>
                      {formatCurrency(Math.round((Number(item.quantity || 0) * Number(item.unitPrice || 0) + Number.EPSILON) * 100) / 100, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {items.length > 4 ? <p className='mt-2 text-[10px] text-slate-500'>+ {items.length - 4} ligne(s) supplémentaire(s) dans le PDF</p> : null}
      </div>

      <div className='ml-auto mt-5 w-full max-w-[260px] rounded-md bg-blue-50 px-4 py-4 text-xs text-slate-800'>
        {taxAmount !== 0 ? (
          <div className='mb-3 space-y-2 border-b border-blue-100 pb-3'>
            <div className='flex justify-between gap-3'><span>Sous-total</span><span>{formatCurrency(subtotal, currency)}</span></div>
            <div className='flex justify-between gap-3'><span>Taxe ({taxRate} %)</span><span>{formatCurrency(taxAmount, currency)}</span></div>
          </div>
        ) : null}
        <p className='text-[10px] font-semibold text-slate-500'>Total</p>
        <p className='mt-1 break-words text-right text-xl font-semibold'>{formatCurrency(total, currency)}</p>
      </div>

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
