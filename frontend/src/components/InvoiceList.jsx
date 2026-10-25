import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FileText,
  User,
  Wallet,
  Send,
  Calendar,
  Download,
  Inbox,
  Loader2,
  RefreshCcw,
  Search,
  Filter,
  PlusCircle,
  Pencil,
  MoreHorizontal
} from 'lucide-react'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import Pagination from './Pagination.jsx'
import { isNativeAndroid } from '../native/platform.js'
import { NativeCollection, NativeEmpty } from '../native/NativeCollection.jsx'
import NativeSheet from '../native/NativeSheet.jsx'
import PaymentPanel from './PaymentPanel.jsx'
import { paymentBalance } from '../utils/payments.js'
import { formatInvoiceMoney } from '../utils/invoiceTotals.js'
import { downloadDocument } from '../utils/documentDownload.js'

const statusStyles = {
  draft: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  sent: 'bg-[rgba(52,199,89,0.16)] text-[#176b37]',
  paid: 'bg-[rgba(48,209,88,0.18)] text-[#176b37]',
  partially_paid: 'bg-amber-50 text-amber-800',
  overdue: 'bg-[rgba(255,69,58,0.16)] text-[#b42318]'
}

const statusLabels = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  partially_paid: 'Partiellement payée',
  overdue: 'En retard'
}

const statusFilters = [
  { value: 'all', label: 'Tous' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'sent', label: 'Envoyées' },
  { value: 'paid', label: 'Payées' },
  { value: 'partially_paid', label: 'Paiements partiels' },
  { value: 'overdue', label: 'En retard' }
]

const InvoiceList = ({ refreshKey, onCreate, onEdit, canCreate = true }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStatus = searchParams.get('status')
  const linkedInvoiceId = searchParams.get('invoice')
  const status = statusFilters.some((filter) => filter.value === requestedStatus) ? requestedStatus : 'all'
  const [invoices, setInvoices] = useState([])
  const [fetchError, setFetchError] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState(null)
  const [actionInvoice, setActionInvoice] = useState(null)
  useEffect(() => {
    if (!linkedInvoiceId) return
    let active = true
    api.get(`/invoices/${linkedInvoiceId}`).then(({ data }) => { if (active) setPaymentInvoice(data) })
      .catch(error => { if (active) showErrorToast(toast.error,error) })
    return () => { active = false }
  }, [linkedInvoiceId])
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    draftSearch: ''
  })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const requestVersion = useRef(0)
  const currentQuery = useRef(null)
  currentQuery.current = { page: pagination.page, pageSize: pagination.pageSize, search: filters.search, status }

  const resetPageToFirst = useCallback(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }))
  }, [])

  useEffect(() => {
    if (filters.draftSearch === filters.search) return
    const value = filters.draftSearch
    const handler = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }))
      resetPageToFirst()
    }, 250)
    return () => clearTimeout(handler)
  }, [filters.draftSearch, filters.search, resetPageToFirst])

  useEffect(() => resetPageToFirst(), [status, resetPageToFirst])
  useEffect(() => () => { requestVersion.current += 1 }, [])

  const fetchInvoices = useCallback(
    async ({ page, pageSize, search, status }) => {
      const version = ++requestVersion.current
      try {
        setIsLoading(true)
        setFetchError(false)
        const params = { page, pageSize }
        if (status && status !== 'all') {
          params.status = status
        }
        if (search) {
          params.search = search
        }

        const { data } = await api.get('/invoices', { params })
        if (version !== requestVersion.current) return
        setInvoices(data?.data ?? [])
        const meta = data?.pagination ?? {}
        setPagination((prev) => {
          const next = {
            page: meta.page ?? page,
            pageSize: meta.pageSize ?? pageSize,
            total: meta.total ?? prev.total,
            totalPages: meta.totalPages ?? prev.totalPages
          }
          if (
            next.page === prev.page &&
            next.pageSize === prev.pageSize &&
            next.total === prev.total &&
            next.totalPages === prev.totalPages
          ) {
            return prev
          }
          return next
        })
      } catch (error) {
        if (version === requestVersion.current) { setFetchError(true); showErrorToast(toast.error, error) }
      } finally {
        if (version === requestVersion.current) setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchInvoices({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filters.search,
      status: status
    })
  }, [fetchInvoices, filters.search, status, pagination.page, pagination.pageSize, refreshKey])

  const isEmpty = !isLoading && invoices.length === 0 && pagination.total === 0

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/invoices/${id}`, { status })
      toast.success('Statut mis à jour', { icon: '✅' })
      await fetchInvoices(currentQuery.current)
    } catch (error) {
      showErrorToast(toast.error, error)
    }
  }

  const handleDownloadPdf = async (id, invoiceNumber) => {
    try {
      const result = await downloadDocument(`/invoices/pdf/${id}`, `facture-${invoiceNumber || id}.pdf`)
      if (result.action === 'downloaded') toast.success('PDF téléchargé', { icon: '⬇️' })
    } catch (error) {
      showErrorToast(toast.error, error)
    }
  }

  const handleStatusFilterChange = (nextStatus) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextStatus === 'all') next.delete('status')
      else next.set('status', nextStatus)
      return next
    })
    resetPageToFirst()
  }

  const handlePageChange = (nextPage) => {
    setPagination((prev) => {
      const target = Math.max(1, nextPage)
      if (target === prev.page) {
        return prev
      }
      return { ...prev, page: target }
    })
  }

  const handlePageSizeChange = (size) => {
    setPagination((prev) => {
      if (size === prev.pageSize) {
        return prev
      }
      return { ...prev, pageSize: size, page: 1 }
    })
  }

  return (
    <div className={isNativeAndroid() ? 'native-invoice-list' : 'card p-0'}>
      {isNativeAndroid() ? <>
        <NativeCollection label='Factures' count={pagination.total} search={filters.draftSearch} onSearch={value => setFilters(prev => ({ ...prev, draftSearch: value }))} searchLabel='Numéro ou client' filters={statusFilters} value={status} onFilter={handleStatusFilterChange} loading={isLoading} error={fetchError} onRetry={() => fetchInvoices(currentQuery.current)}
          toolsAction={<button type='button' aria-label='Actualiser' className='native-icon-button' disabled={isLoading} onClick={() => fetchInvoices(currentQuery.current)}><RefreshCcw aria-hidden='true' /></button>}
          empty={<NativeEmpty icon={FileText} title={filters.search || status !== 'all' ? 'Aucune facture trouvée' : 'Vos factures, au même endroit'} description={filters.search || status !== 'all' ? 'Essayez un autre client ou un autre statut.' : 'Créez votre première facture ou convertissez un devis accepté.'} />}>
          {invoices.map(invoice => <article key={invoice.id} className='native-record'>
            <button type='button' className='native-record-top' onClick={() => invoice.status === 'draft' ? onEdit?.(invoice) : setPaymentInvoice(invoice)} aria-label={`Ouvrir la facture ${invoice.invoice_number}`}>
              <span className='native-record-icon'><FileText aria-hidden='true' /></span><div className='native-record-heading'><strong>{invoice.client?.company_name || 'Client'}</strong><p className='native-record-ref'>{invoice.invoice_number}</p></div>
              <span className={`native-status ${statusStyles[invoice.status] || statusStyles.draft}`}>{statusLabels[invoice.status] || invoice.status}</span>
            </button>
            <div className='native-record-money'><strong>{formatInvoiceMoney(invoice.total_amount, invoice.currency === '$' ? 'USD' : invoice.currency || 'USD')}</strong><span className='native-record-note'>{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('fr-FR') : ''}</span></div>
            {invoice.status !== 'draft' ? <p className='native-record-note'>Reçu {formatInvoiceMoney(paymentBalance(invoice).paid, invoice.currency === '$' ? 'USD' : invoice.currency || 'USD')} · Reste {formatInvoiceMoney(paymentBalance(invoice).remaining, invoice.currency === '$' ? 'USD' : invoice.currency || 'USD')}</p> : null}
            {invoice.is_overdue ? <p className='native-record-note text-red-800'>Solde en retard</p> : null}
            {invoice.pdf_available === false ? <p className='native-record-note'>Archive PDF non vérifiée</p> : null}
            <div className='native-record-actions'>
              <button type='button' aria-label={`Télécharger la facture ${invoice.invoice_number} en PDF`} disabled={invoice.pdf_available === false} onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}><Download aria-hidden='true' />PDF</button>
              <button type='button' className='native-icon-button' aria-label={`Actions de la facture ${invoice.invoice_number}`} onClick={() => setActionInvoice(invoice)}><MoreHorizontal aria-hidden='true' /></button>
              {invoice.status === 'draft' ? <button type='button' className='native-record-main-action' onClick={() => onEdit?.(invoice)}><Pencil aria-hidden='true' />Modifier</button> : <button type='button' className='native-record-main-action' aria-label={`Versements de la facture ${invoice.invoice_number}`} onClick={() => setPaymentInvoice(invoice)}><Wallet aria-hidden='true' />Versements</button>}
            </div>
          </article>)}
        </NativeCollection>
        {actionInvoice ? <NativeSheet title='Actions de la facture' onClose={() => setActionInvoice(null)}><p className='text-sm text-[var(--text-muted)]'>{actionInvoice.invoice_number}</p><label className='label mt-4 block'>Statut
                        <select
                          value={actionInvoice.status}
                          aria-label={`Statut de la facture ${actionInvoice.invoice_number}`}
                          disabled={['paid', 'partially_paid'].includes(actionInvoice.status)}
                          onChange={(event) => { handleStatusChange(actionInvoice.id, event.target.value); setActionInvoice(null) }}
                          className='input-compact h-9 w-36 border-[var(--border)] bg-[var(--bg-panel)] text-xs'
                        >
                          {actionInvoice.status === 'draft' ? <option value='draft'>Brouillon</option> : null}
                          {!['paid', 'partially_paid'].includes(actionInvoice.status) ? <option value='sent'>Envoyée</option> : null}
                          {actionInvoice.status === 'partially_paid' ? <option value='partially_paid'>Partiellement payée</option> : null}
                          {actionInvoice.status === 'paid' || Number(actionInvoice.total_amount) === 0 ? <option value='paid'>Payée</option> : null}
                          {!['paid', 'partially_paid'].includes(actionInvoice.status) ? <option value='overdue'>En retard</option> : null}
                        </select>
        </label></NativeSheet> : null}
      </> : <>
      <div className='space-y-4 border-b border-[var(--border)] px-4 py-4'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-[var(--text-dark)]'>
              Factures ({pagination.total})
            </h2>
            <p className='text-xs text-[var(--text-muted)]'>
              Consultez, mettez à jour et exportez vos factures.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() =>
                fetchInvoices({
                  page: pagination.page,
                  pageSize: pagination.pageSize,
                  search: filters.search,
                  status: status
                })
              }
              className='btn-ghost h-9 px-3 text-xs font-semibold'
              disabled={isLoading}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            {onCreate ? (
              <button
                type='button'
                onClick={onCreate}
                className='btn-primary h-9 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60'
                disabled={!canCreate}
              >
                <PlusCircle className='mr-2 h-4 w-4' />
                Nouvelle facture
              </button>
            ) : null}
          </div>
        </div>

        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 transition focus-within:border-[var(--primary)]'>
            <Search className='h-4 w-4 text-[var(--text-muted)]' />
            <input
              className='flex-1 bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
              placeholder='Rechercher une facture (numéro, client, statut)…'
              value={filters.draftSearch}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, draftSearch: event.target.value }))
              }
            />
            {filters.draftSearch ? (
              <button
                type='button'
                onClick={() => {
                  setFilters((prev) => ({ ...prev, draftSearch: '', search: '' }))
                  resetPageToFirst()
                }}
                className='text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-dark)]'
              >
                Effacer
              </button>
            ) : null}
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                type='button'
                aria-pressed={status === filter.value}
                onClick={() => handleStatusFilterChange(filter.value)}
                className={`btn-ghost h-9 px-3 text-xs font-semibold ${
                  status === filter.value ? 'border-[var(--primary)] text-[var(--primary)]' : ''
                }`}
              >
                {filter.value === 'all' ? <Filter className='mr-2 h-4 w-4' /> : null}
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='responsive-records min-w-full divide-y divide-[var(--border)] text-sm'>
            <caption className='sr-only'>Liste des factures</caption>
          <thead className='text-[var(--text-muted)]'>
            <tr>
              <th scope='col' className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <FileText className='h-4 w-4' /> Numéro
                </div>
              </th>
              <th scope='col' className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <User className='h-4 w-4' /> Client
                </div>
              </th>
              <th scope='col' className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <Wallet className='h-4 w-4' /> Montant
                </div>
              </th>
              <th scope='col' className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <Send className='h-4 w-4' /> Statut
                </div>
              </th>
              <th scope='col' className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <Calendar className='h-4 w-4' /> Émise
                </div>
              </th>
              <th scope='col' className='px-4 py-3 text-right font-semibold'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-[var(--border)]'>
            {isLoading ? (
              <tr>
                <td colSpan={6} className='py-12 text-center text-sm text-[var(--text-muted)]'>
                  <div className='inline-flex items-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Chargement des factures…
                  </div>
                </td>
              </tr>
            ) : null}

            {!isLoading && isEmpty ? (
              <tr>
                <td colSpan={6} className='py-16 text-center text-sm text-[var(--text-muted)]'>
                  <div className='flex flex-col items-center gap-4'>
                    <div className='rounded-full bg-[var(--primary-soft)] p-5 text-[var(--primary)]'>
                      <Inbox className='h-9 w-9' />
                    </div>
                    <div className='space-y-1'>
                      <p className='text-base font-semibold text-[var(--text-dark)]'>Aucune facture enregistrée</p>
                      <p>Créez votre première facture pour la retrouver ici.</p>
                    </div>
                    {onCreate ? (
                      <button
                        type='button'
                        onClick={onCreate}
                        disabled={!canCreate}
                        className='btn-primary px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        <PlusCircle className='mr-2 h-4 w-4' />
                        Nouvelle facture
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : null}

            {!isLoading && !isEmpty
              ? invoices.map((invoice) => (
                  <tr key={invoice.id} className='transition hover:bg-[rgba(10,132,255,0.08)]'>
                    <td data-label='Numéro' className='px-4 py-3 font-semibold text-[var(--text-dark)]'>
                      #{invoice.invoice_number}
                      {invoice.pdf_available === false ? (
                        <span
                          className='mt-1 block text-xs font-medium text-amber-700'
                          title='Les données de cette ancienne facture sont conservées, mais son PDF original ne peut pas être reconstitué de manière fiable.'
                        >
                          Archive PDF non vérifiée
                        </span>
                      ) : null}
                    </td>
                    <td data-label='Client' className='px-4 py-3 text-[var(--text-muted)]'>
                      {invoice.client?.company_name || '—'}
                    </td>
                    <td data-label='Montant' className='px-4 py-3 font-semibold text-[var(--text-dark)]'>
                      {Number(invoice.total_amount || 0).toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}
                      {invoice.currency === '$' ? 'USD' : invoice.currency || 'USD'}
                      {invoice.status !== 'draft' ? <div className='mt-1 space-y-1 text-xs font-normal text-[var(--text-muted)]'><p>Reçu : {formatInvoiceMoney(paymentBalance(invoice).paid, invoice.currency === '$' ? 'USD' : invoice.currency || 'USD')}</p><p className='font-medium'>Solde : {formatInvoiceMoney(paymentBalance(invoice).remaining, invoice.currency === '$' ? 'USD' : invoice.currency || 'USD')}</p></div> : null}
                    </td>
                    <td data-label='Statut' className='px-4 py-3'>
                      <span className={`badge ${statusStyles[invoice.status] || statusStyles.draft}`}>
                        {statusLabels[invoice.status] ?? invoice.status}
                      </span>
                      {invoice.status === 'partially_paid' && invoice.is_overdue ? <span className='mt-1 block text-xs font-medium text-red-800'>Solde en retard</span> : null}
                    </td>
                    <td data-label='Émise' className='px-4 py-3 text-[var(--text-muted)]'>
                      {invoice.issue_date
                        ? new Date(invoice.issue_date).toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td data-label='Actions' className='px-4 py-3 text-right'>
                      <div className='flex flex-wrap items-center justify-end gap-2'>
                        <select
                          value={invoice.status}
                          aria-label={`Statut de la facture ${invoice.invoice_number}`}
                          disabled={['paid', 'partially_paid'].includes(invoice.status)}
                          onChange={(event) => handleStatusChange(invoice.id, event.target.value)}
                          className='input-compact h-9 w-36 border-[var(--border)] bg-[var(--bg-panel)] text-xs'
                        >
                          {invoice.status === 'draft' ? <option value='draft'>Brouillon</option> : null}
                          {!['paid', 'partially_paid'].includes(invoice.status) ? <option value='sent'>Envoyée</option> : null}
                          {invoice.status === 'partially_paid' ? <option value='partially_paid'>Partiellement payée</option> : null}
                          {invoice.status === 'paid' || Number(invoice.total_amount) === 0 ? <option value='paid'>Payée</option> : null}
                          {!['paid', 'partially_paid'].includes(invoice.status) ? <option value='overdue'>En retard</option> : null}
                        </select>
                    {invoice.status !== 'draft' ? <button type='button' onClick={() => setPaymentInvoice(invoice)} aria-label={`Versements de la facture ${invoice.invoice_number}`} className='btn-ghost text-xs font-semibold'><Wallet className='h-4 w-4' />Versements</button> : null}
                    <button
                      type='button'
                      onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                      disabled={invoice.pdf_available === false}
                      title={invoice.pdf_available === false
                        ? 'Original indisponible : cette facture historique ne possède pas de copie figée à son émission.'
                        : 'Télécharger la facture PDF'}
                      aria-label={invoice.pdf_available === false
                        ? `PDF indisponible pour la facture ${invoice.invoice_number} : archive manquante`
                        : `Télécharger la facture ${invoice.invoice_number} en PDF`}
                      className='btn-ghost text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <Download className='h-4 w-4' />
                      PDF
                    </button>
                    {invoice.status === 'draft' ? (
                      <button
                        type='button'
                        onClick={() => onEdit?.(invoice)}
                        className='btn-ghost text-xs font-semibold'
                      >
                        <Pencil className='h-4 w-4' />
                        Modifier
                      </button>
                    ) : null}
                  </div>
                </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      </>}
      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        isLoading={isLoading}
      />
      {paymentInvoice ? <PaymentPanel key={paymentInvoice.id} invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)} onUpdated={() => fetchInvoices(currentQuery.current)} /> : null}
    </div>
  )
}

export default InvoiceList
