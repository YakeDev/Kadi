import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilePenLine, FilePlus2, FileCheck2, FileDown, Filter, Loader2, Plus, RefreshCcw, Search, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import { formatInvoiceMoney } from '../utils/invoiceTotals.js'
import { downloadDocument } from '../utils/documentDownload.js'
import PageHeader from '../components/PageHeader.jsx'
import Pagination from '../components/Pagination.jsx'
import { isNativeAndroid } from '../native/platform.js'
import { NativeCollection, NativeEmpty } from '../native/NativeCollection.jsx'

const statuses = {
  draft: { label: 'Brouillon', color: 'bg-amber-50 text-amber-800' },
  sent: { label: 'Envoyé', color: 'bg-blue-50 text-blue-700' },
  converted: { label: 'Converti', color: 'bg-emerald-50 text-emerald-700' }
}
const filters = [
  { value: '', label: 'Tous', icon: Filter },
  { value: 'draft', label: 'Brouillons', icon: FilePenLine },
  { value: 'sent', label: 'Envoyés', icon: Send },
  { value: 'converted', label: 'Convertis', icon: FileCheck2 }
]
const formatDate = (value) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR') : '—'

const Quotes = () => {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFailure(false)
    api.get('/quotes', {
      params: { page, pageSize, status: status || undefined, search: query || undefined },
      signal: controller.signal
    }).then(({ data }) => {
      if (!controller.signal.aborted) {
        setRows(data.data || [])
        setMeta(data.pagination || { total: 0, totalPages: 1 })
      }
    }).catch(error => {
      if (!controller.signal.aborted) { setFailure(true); showErrorToast(toast.error, error) }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, pageSize, status, query, attempt])

  const download = async (quote) => {
    try { await downloadDocument(`/quotes/pdf/${quote.id}`, `devis-${quote.quote_number}.pdf`) }
    catch (error) { showErrorToast(toast.error, error) }
  }
  const resetFilters = () => { setSearch(''); setQuery(''); setStatus(''); setPage(1) }
  const isFiltered = Boolean(query || status)

  return (
    <div className='space-y-8'>
      <PageHeader
        icon={FilePenLine}
        title='Gestion des devis' nativeTitle='Devis' nativeCreateLabel='Créer'
        subtitle='Préparez vos offres et convertissez-les en factures à réception d’un PO ou d’un acompte.'
        actions={[
          <button key='refresh' type='button' className='btn-ghost min-h-11 justify-center' disabled={loading} onClick={() => setAttempt(value => value + 1)}>
            <RefreshCcw aria-hidden='true' className='mr-2 h-4 w-4' />Actualiser
          </button>,
          <Link key='create' to='/devis/nouveau' className='btn-primary min-h-11 justify-center'>
            <Plus aria-hidden='true' className='mr-2 h-4 w-4' />Nouveau devis
          </Link>
        ]}
      />

      {isNativeAndroid() ? <>
        <NativeCollection label='Devis' count={meta.total} search={search} onSearch={setSearch} searchLabel='Numéro ou client' filters={filters} value={status} onFilter={value => { setStatus(value); setPage(1) }} loading={loading} error={failure} onRetry={() => setAttempt(value => value + 1)}
          empty={<NativeEmpty icon={FilePenLine} title={isFiltered ? 'Aucun devis trouvé' : 'Votre prochaine offre, ici'} description={isFiltered ? 'Essayez un autre client ou un autre statut.' : 'Créez un devis, partagez-le et suivez son avancement jusqu’à la facture.'} action={isFiltered ? <button type='button' className='btn-secondary' onClick={resetFilters}>Effacer les filtres</button> : null} />}>
          {rows.map(quote => <article key={quote.id} className='native-record'>
            <Link className='native-record-top' to={`/devis/${quote.id}`} aria-label={`Consulter ${quote.quote_number}`}>
              <span className='native-record-icon'><FilePenLine aria-hidden='true' /></span>
              <div className='native-record-heading'><strong>{quote.client?.company_name || 'Client'}</strong><p className='native-record-ref'>{quote.quote_number}</p></div>
              <span className={`native-status ${statuses[quote.status]?.color || ''}`}>{statuses[quote.status]?.label || quote.status}</span>
            </Link>
            <div className='native-record-money'><strong>{formatInvoiceMoney(quote.total_amount, quote.currency)}</strong><span className='native-record-note'>Valide au {formatDate(quote.valid_until)}</span></div>
            <div className='native-record-actions'>
              {quote.status !== 'converted' ? <><button type='button' aria-label={`Télécharger ${quote.quote_number}`} onClick={() => download(quote)}><FileDown aria-hidden='true' />PDF</button><Link to={`/devis/nouveau?id=${quote.id}`}>Modifier</Link></> : null}
              <Link className='native-record-main-action' to={`/devis/${quote.id}`}>{quote.status === 'converted' ? 'Consulter' : 'Ouvrir le devis'}</Link>
            </div>
          </article>)}
        </NativeCollection>
        <Pagination page={page} pageSize={pageSize} total={meta.total} totalPages={meta.totalPages} onPageChange={setPage} isLoading={loading} />
      </> : (
      <section className='card min-w-0 overflow-hidden p-0' aria-labelledby='quotes-list-title'>
        <div className='space-y-4 border-b border-[var(--border)] px-4 py-4'>
          <div>
            <h2 id='quotes-list-title' className='text-sm font-semibold text-[var(--text-dark)]'>Devis ({meta.total})</h2>
            <p className='mt-1 text-xs text-[var(--text-muted)]'>Retrouvez vos offres, leur validité et leur état d’avancement.</p>
          </div>
          <div className='flex flex-col gap-3 xl:flex-row xl:items-center'>
            <div className='flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 focus-within:border-[var(--primary)]'>
              <Search aria-hidden='true' className='h-4 w-4 shrink-0 text-[var(--text-muted)]' />
              <input aria-label='Rechercher un devis' value={search} onChange={event => setSearch(event.target.value)} className='min-h-7 min-w-0 flex-1 bg-transparent text-sm outline-none' maxLength={160} placeholder='Rechercher un devis (numéro ou client)…' />
              {search ? <button type='button' className='min-h-7 text-xs font-semibold text-[var(--text-muted)]' onClick={() => { setSearch(''); setQuery(''); setPage(1) }}>Effacer</button> : null}
            </div>
            <div role='group' aria-label='Statut du devis' className='flex flex-wrap gap-2'>
              {filters.map(({ value, label, icon: Icon }) => (
                <button key={value} type='button' aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1) }} className={`${status === value ? 'btn-secondary border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]' : 'btn-ghost'} min-h-11 px-3 text-xs font-semibold`}>
                  <Icon aria-hidden='true' className='mr-2 h-4 w-4' />{label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div role='status' className='flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-muted)]'><Loader2 aria-hidden='true' className='h-4 w-4 animate-spin' />Chargement des devis…</div>
        ) : failure ? (
          <div role='alert' className='space-y-3 p-6'><p>Impossible de charger les devis.</p><button className='btn-secondary' type='button' onClick={() => setAttempt(value => value + 1)}>Réessayer</button></div>
        ) : !rows.length ? (
          <div className='flex flex-col items-center gap-4 px-5 py-16 text-center text-sm text-[var(--text-muted)]'>
            <span className='rounded-full bg-[var(--primary-soft)] p-5 text-[var(--primary)]'><FilePlus2 aria-hidden='true' className='h-9 w-9' /></span>
            <div className='space-y-1'><p className='text-base font-semibold text-[var(--text-dark)]'>{isFiltered ? 'Aucun devis trouvé' : 'Votre premier devis commence ici'}</p><p>{isFiltered ? 'Essayez un autre numéro, un nom de client ou un autre statut.' : 'Préparez une offre pour votre client, puis suivez-la jusqu’à la facturation.'}</p></div>
            {isFiltered ? <button type='button' onClick={resetFilters} className='btn-secondary min-h-11'>Réinitialiser les filtres</button> : <Link to='/devis/nouveau' className='btn-primary min-h-11'><Plus aria-hidden='true' className='mr-2 h-4 w-4' />Créer un devis</Link>}
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='responsive-records min-w-full divide-y divide-[var(--border)] text-sm'>
              <caption className='sr-only'>Liste des devis</caption>
              <thead className='text-[var(--text-muted)]'><tr>{['Numéro', 'Client', 'Montant', 'Statut', 'Dates', 'Actions'].map(label => <th scope='col' key={label} className={`px-4 py-3 font-semibold ${label === 'Actions' ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr></thead>
              <tbody className='divide-y divide-[var(--border)]'>
                {rows.map(quote => (
                  <tr key={quote.id} className='transition hover:bg-[rgba(10,132,255,0.04)]'>
                    <td data-label='Numéro' className='max-w-52 break-words px-4 py-4 font-semibold'><Link to={`/devis/${quote.id}`} className='text-[var(--primary)] hover:underline'>{quote.quote_number}</Link></td>
                    <td data-label='Client' className='max-w-52 break-words px-4 py-4'>{quote.client?.company_name || 'Client'}</td>
                    <td data-label='Montant' className='px-4 py-4 font-semibold tabular-nums'>{formatInvoiceMoney(quote.total_amount, quote.currency)}</td>
                    <td data-label='Statut' className='px-4 py-4'><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statuses[quote.status]?.color || ''}`}>{statuses[quote.status]?.label || quote.status}</span></td>
                    <td data-label='Dates' className='px-4 py-4 text-xs text-[var(--text-muted)]'><p>Émis : {formatDate(quote.issue_date)}</p><p className='mt-1'>Validité : {formatDate(quote.valid_until)}</p></td>
                    <td data-label='Actions' className='px-4 py-3'><div className='flex flex-wrap items-center justify-end gap-1'>
                      <Link className='btn-ghost min-h-11 px-3 text-xs' to={`/devis/${quote.id}`}>Consulter</Link>
                      {quote.status !== 'converted' ? <><Link className='btn-ghost min-h-11 px-3 text-xs' to={`/devis/nouveau?id=${quote.id}`}>Modifier</Link><button type='button' aria-label={`Télécharger ${quote.quote_number}`} className='btn-ghost min-h-11 px-3 text-xs' onClick={() => download(quote)}><FileDown aria-hidden='true' className='mr-2 h-4 w-4' />PDF</button></> : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={meta.total} totalPages={meta.totalPages} onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1) }} isLoading={loading} />
      </section>
      )}
    </div>
  )
}
export default Quotes
