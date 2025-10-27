import { useEffect, useMemo, useState } from 'react'
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
  PlusCircle
} from 'lucide-react'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'

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

const InvoiceList = ({ refreshKey, onCreate, canCreate = true }) => {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    draftSearch: '',
    status: 'all'
  })

  useEffect(() => {
    const handler = setTimeout(
      () => setFilters((prev) => ({ ...prev, search: prev.draftSearch })),
      250
    )
    return () => clearTimeout(handler)
  }, [filters.draftSearch])

  const fetchInvoices = async () => {
    setIsLoading(true)
    try {
      const { data } = await api.get('/invoices')
      setInvoices(data)
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const filteredInvoices = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const matchesStatus = filters.status === 'all' || invoice.status === filters.status
      const matchesSearch =
        term.length === 0 ||
        [invoice.invoice_number, invoice.client?.company_name, invoice.total_amount, invoice.status]
          .filter(Boolean)
          .some((value) => value?.toString().toLowerCase().includes(term))
      return matchesStatus && matchesSearch
    })
  }, [filters.search, filters.status, invoices])

  const isEmpty = !isLoading && filteredInvoices.length === 0

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/invoices/${id}`, { status })
      toast.success('Statut mis à jour', { icon: '✅' })
      fetchInvoices()
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
    setFilters((prev) => ({ ...prev, status }))
  }

  return (
    <div className='card border border-white/40 p-0 shadow-[0_18px_52px_-44px_rgba(28,28,30,0.22)]'>
      <div className='space-y-4 border-b border-[var(--border)] px-4 py-4'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Factures</h2>
            <p className='text-xs text-[var(--text-muted)]'>
              Consultez, mettez à jour et exportez vos factures.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={fetchInvoices}
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
                onClick={() => setFilters((prev) => ({ ...prev, draftSearch: '', search: '' }))}
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

            {isEmpty ? (
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

            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className='transition hover:bg-[rgba(10,132,255,0.08)]'>
                <td className='px-4 py-3 font-semibold text-[var(--text-dark)]'>#{invoice.invoice_number}</td>
                <td className='px-4 py-3 text-[var(--text-muted)]'>{invoice.client?.company_name || '—'}</td>
                <td className='px-4 py-3 font-semibold text-[var(--text-dark)]'>
                  {Number(invoice.total_amount || 0).toFixed(2)} {invoice.currency || 'USD'}
                </td>
                <td className='px-4 py-3'>
                  <span className={`badge ${statusStyles[invoice.status] || statusStyles.draft}`}>
                    {statusLabels[invoice.status] ?? invoice.status}
                  </span>
                </td>
                <td className='px-4 py-3 text-[var(--text-muted)]'>{invoice.issue_date}</td>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default InvoiceList
