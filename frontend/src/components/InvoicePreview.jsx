import clsx from 'clsx'

const formatCurrency = (value, currency = 'USD') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0))

const PreviewRow = ({ label, value }) => (
  <div className='flex items-center justify-between text-xs text-[var(--text-muted)]'>
    <span>{label}</span>
    <span className='font-semibold text-[var(--text-dark)]'>{value}</span>
  </div>
)

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—'

const InvoicePreview = ({ className, company, client, invoice }) => {
  const items = invoice.items ?? []
  const subtotal = items.reduce(
    (acc, item) => acc + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  )

  const currency = items[0]?.currency || invoice.currency || 'USD'

  const companyLocation = [company?.city, company?.state].filter(Boolean).join(', ')

  return (
    <aside
      className={clsx(
        'flex flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5',
        className
      )}
      aria-label='Aperçu de la facture'
    >
      <header className='flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]'>
            Aperçu
          </p>
          <h3 className='text-lg font-semibold text-[var(--text-dark)]'>Facture</h3>
          <p className='text-xs text-[var(--text-muted)]'>Mise à jour en temps réel</p>
        </div>
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt='Logo entreprise'
            className='h-10 w-10 rounded-full object-cover'
          />
        ) : null}
      </header>

      <div className='mt-4 space-y-4 text-xs text-[var(--text-muted)]'>
        <div>
          <p className='font-semibold text-[var(--text-dark)]'>{company?.company}</p>
          {company?.address ? <p>{company.address}</p> : null}
          {companyLocation ? <p>{companyLocation}</p> : null}
          {company?.phone ? <p>Tél : {company.phone}</p> : null}
        </div>
        <div>
          <p className='font-semibold text-[var(--text-dark)]'>Facturé à</p>
          <p>{client?.company_name || 'Client non défini'}</p>
          {client?.contact_name ? <p>{client.contact_name}</p> : null}
          {client?.email ? <p>{client.email}</p> : null}
          {client?.phone ? <p>{client.phone}</p> : null}
        </div>
        <div className='grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] bg-[rgba(15,23,42,0.03)] p-3'>
          <PreviewRow label='Émise le' value={formatDate(invoice.issue_date)} />
          <PreviewRow label='Échéance' value={formatDate(invoice.due_date)} />
          <PreviewRow label='Statut' value={invoice.status === 'draft' ? 'Brouillon' : invoice.status ?? '—'} />
          <PreviewRow label='Nombre de lignes' value={items.length} />
        </div>
      </div>

      <div className='mt-4 space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4'>
        {items.length === 0 ? (
          <p className='text-xs text-[var(--text-muted)]'>
            Ajoutez vos lignes de facturation pour voir un aperçu détaillé.
          </p>
        ) : (
          <ul className='space-y-3'>
            {items.slice(0, 4).map((item, index) => (
              <li key={index} className='flex flex-col gap-1 border-b border-dashed border-[var(--border)] pb-2 last:border-b-0'>
                <div className='flex items-start justify-between gap-2'>
                  <span className='text-sm font-semibold text-[var(--text-dark)]'>
                    {item.description || 'Article sans titre'}
                  </span>
                  <span className='text-xs text-[var(--text-muted)]'>
                    {formatCurrency(Number(item.unitPrice || 0), currency)}
                  </span>
                </div>
                <div className='flex items-center justify-between text-[11px] text-[var(--text-muted)]'>
                  <span>
                    Quantité : <strong>{Number(item.quantity || 0)}</strong>
                  </span>
                  <span>
                    Total ligne :{' '}
                    <strong>
                      {formatCurrency(
                        Number(item.quantity || 0) * Number(item.unitPrice || 0),
                        currency
                      )}
                    </strong>
                  </span>
                </div>
              </li>
            ))}
            {items.length > 4 ? (
              <li className='text-[11px] text-[var(--text-muted)]'>
                + {items.length - 4} ligne(s) supplémentaire(s) non affichée(s)
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div className='mt-4 space-y-2 rounded-[var(--radius-lg)] bg-[rgba(10,132,255,0.08)] px-4 py-3 text-sm text-[var(--text-dark)]'>
        <div className='flex items-center justify-between'>
          <span>Sous-total</span>
          <span className='font-semibold'>{formatCurrency(subtotal, currency)}</span>
        </div>
        <div className='flex items-center justify-between border-t border-[rgba(10,132,255,0.18)] pt-2 text-base'>
          <span className='font-semibold'>Total</span>
          <span className='font-semibold'>
            {formatCurrency(subtotal, currency)}
          </span>
        </div>
      </div>

      {invoice.notes ? (
        <div className='mt-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-white p-3 text-xs text-[var(--text-muted)]'>
          <p className='font-semibold text-[var(--text-dark)]'>Notes</p>
          <p>{invoice.notes}</p>
        </div>
      ) : null}
    </aside>
  )
}

export default InvoicePreview
