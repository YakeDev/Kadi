import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'

const statusStyles = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-600',
  paid: 'bg-green-100 text-green-600',
  overdue: 'bg-red-100 text-red-600'
}

const InvoiceList = ({ refreshKey }) => {
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchInvoices = async () => {
    setIsLoading(true)
    try {
      const { data } = await api.get('/invoices')
      setInvoices(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/invoices/${id}`, { status })
      toast.success('Statut mis à jour')
      fetchInvoices()
    } catch (error) {
      toast.error(error.message)
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
      toast.success('PDF téléchargé')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-nuit'>Factures récentes</h2>
        <button
          onClick={fetchInvoices}
          className='rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-nuit'
        >
          Actualiser
        </button>
      </div>
      <div className='mt-6 overflow-x-auto'>
        <table className='min-w-full divide-y divide-slate-200'>
          <thead>
            <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
              <th className='px-4 py-2 font-medium'>Numéro</th>
              <th className='px-4 py-2 font-medium'>Client</th>
              <th className='px-4 py-2 font-medium'>Montant</th>
              <th className='px-4 py-2 font-medium'>Statut</th>
              <th className='px-4 py-2 font-medium'>Émise</th>
              <th className='px-4 py-2 font-medium'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-100'>
            {isLoading && (
              <tr>
                <td colSpan='6' className='px-4 py-6 text-center text-sm text-slate-500'>
                  Chargement des factures…
                </td>
              </tr>
            )}
            {!isLoading && invoices.length === 0 && (
              <tr>
                <td colSpan='6' className='px-4 py-6 text-center text-sm text-slate-500'>
                  Aucune facture pour le moment.
                </td>
              </tr>
            )}
            {invoices.map((invoice) => (
              <tr key={invoice.id} className='text-sm text-slate-600'>
                <td className='px-4 py-3 font-medium text-nuit'>#{invoice.invoice_number}</td>
                <td className='px-4 py-3'>{invoice.client?.company_name}</td>
                <td className='px-4 py-3 font-semibold text-nuit'>
                  {Number(invoice.total_amount || 0).toFixed(2)} {invoice.currency || 'USD'}
                </td>
                <td className='px-4 py-3'>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      statusStyles[invoice.status] || statusStyles.draft
                    }`}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className='px-4 py-3'>{invoice.issue_date}</td>
                <td className='px-4 py-3'>
                  <div className='flex flex-wrap gap-2'>
                    <select
                      value={invoice.status}
                      onChange={(event) => handleStatusChange(invoice.id, event.target.value)}
                      className='rounded-xl border border-slate-200 px-3 py-1 text-xs focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
                    >
                      <option value='draft'>Brouillon</option>
                      <option value='sent'>Envoyée</option>
                      <option value='paid'>Payée</option>
                      <option value='overdue'>Retard</option>
                    </select>
                    <button
                      onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                      className='rounded-xl border border-slate-200 px-3 py-1 text-xs font-medium text-nuit hover:border-nuit'
                    >
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
