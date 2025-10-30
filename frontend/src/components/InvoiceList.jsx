import { useCallback, useEffect, useState } from 'react'
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
  Pencil
} from 'lucide-react'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import Pagination from './Pagination.jsx'

const statusStyles = {
  draft: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  sent: 'bg-[rgba(52,199,89,0.16)] text-[#34c759]',
  paid: 'bg-[rgba(48,209,88,0.18)] text-[#30d058]',
  overdue: 'bg-[rgba(255,69,58,0.16)] text-[#ff453a]'
}

const statusLabels = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard'
}

const statusFilters = [
  { value: 'all', label: 'Tous' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'sent', label: 'Envoyées' },
  { value: 'paid', label: 'Payées' },
  { value: 'overdue', label: 'En retard' }
]

const InvoiceList = ({ refreshKey, onCreate, onEdit, canCreate = true }) => {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    draftSearch: '',
    status: 'all'
  })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  const resetPageToFirst = useCallback(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }))
  }, [])

  useEffect(() => {
    const value = filters.draftSearch
    const handler = setTimeout(() => {
      let changed = false
      setFilters((prev) => {
        if (prev.search === value) {
          return prev
        }
        changed = true
        return { ...prev, search: value }
      })
      if (changed) {
        resetPageToFirst()
      }
    }, 250)
    return () => clearTimeout(handler)
  }, [filters.draftSearch, resetPageToFirst])

  const fetchInvoices = useCallback(
    async ({ page, pageSize, search, status }) => {
      try {
        setIsLoading(true)
        const params = { page, pageSize }
        if (status && status !== 'all') {
          params.status = status
        }
        if (search) {
          params.search = search
        }

        const { data } = await api.get('/invoices', { params })
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
        showErrorToast(toast.error, error)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchInvoices({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filters.search,
      status: filters.status
    })
  }, [fetchInvoices, filters.search, filters.status, pagination.page, pagination.pageSize, refreshKey])

  const isEmpty = !isLoading && invoices.length === 0 && pagination.total === 0

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/invoices/${id}`, { status })
      toast.success('Statut mis à jour', { icon: '✅' })
      await fetchInvoices({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: filters.search,
        status: filters.status
      })
    } catch (error) {
      showErrorToast(toast.error, error)
    }
  }

  const handleDownloadPdf = async (id, invoiceNumber) => {
    try {
      const { data } = await api.get(`/invoices/pdf/${id}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `facture-${invoiceNumber || id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('PDF téléchargé', { icon: '⬇️' })
    } catch (error) {
      showErrorToast(toast.error, error)
    }
  }

  const handleStatusFilterChange = (status) => {
    let changed = false
    setFilters((prev) => {
      if (prev.status === status) {
        return prev
      }
      changed = true
      return { ...prev, status }
    })
    if (changed) {
      resetPageToFirst()
    }
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
    <div className='card border border-white/40 p-0 shadow-[0_18px_52px_-44px_rgba(28,28,30,0.22)]'>
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
                  status: filters.status
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
          <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-[0_12px_35px_-30px_rgba(28,28,30,0.22)] transition focus-within:border-[var(--primary)]'>
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
                onClick={() => handleStatusFilterChange(filter.value)}
                className={`btn-ghost h-9 px-3 text-xs font-semibold ${
                  filters.status === filter.value ? 'border-[var(--primary)] text-[var(--primary)]' : ''
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
        <table className='min-w-full divide-y divide-[var(--border)] text-sm'>
          <thead className='text-[var(--text-muted)]'>
            <tr>
              <th className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <FileText className='h-4 w-4' /> Numéro
                </div>
              </th>
              <th className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <User className='h-4 w-4' /> Client
                </div>
              </th>
              <th className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <Wallet className='h-4 w-4' /> Montant
                </div>
              </th>
              <th className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <Send className='h-4 w-4' /> Statut
                </div>
              </th>
              <th className='px-4 py-3 text-left font-semibold'>
                <div className='flex items-center gap-2'>
                  <Calendar className='h-4 w-4' /> Émise
                </div>
              </th>
              <th className='px-4 py-3 text-right font-semibold'>Actions</th>
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
                    <div className='rounded-full bg-[var(--primary-soft)] p-5 text-[var(--primary)] shadow-soft'>
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
                    <td className='px-4 py-3 font-semibold text-[var(--text-dark)]'>
                      #{invoice.invoice_number}
                    </td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>
                      {invoice.client?.company_name || '—'}
                    </td>
                    <td className='px-4 py-3 font-semibold text-[var(--text-dark)]'>
                      {Number(invoice.total_amount || 0).toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}
                      {invoice.currency || 'USD'}
                    </td>
                    <td className='px-4 py-3'>
                      <span className={`badge ${statusStyles[invoice.status] || statusStyles.draft}`}>
                        {statusLabels[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>
                      {invoice.issue_date
                        ? new Date(invoice.issue_date).toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <select
                          value={invoice.status}
                          onChange={(event) => handleStatusChange(invoice.id, event.target.value)}
                          className='input-compact h-9 w-36 border-[var(--border)] bg-[var(--bg-panel)] text-xs'
                        >
                          <option value='draft'>Brouillon</option>
                          <option value='sent'>Envoyée</option>
                          <option value='paid'>Payée</option>
                          <option value='overdue'>En retard</option>
                        </select>
                    <button
                      type='button'
                      onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                      className='btn-ghost text-xs font-semibold'
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
      <Pagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        isLoading={isLoading}
      />
    </div>
  )
}

export default InvoiceList
