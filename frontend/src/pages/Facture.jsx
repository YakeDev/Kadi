import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Inbox, FileText, X } from 'lucide-react'
import InvoiceForm from '../components/InvoiceForm.jsx'
import InvoiceList from '../components/InvoiceList.jsx'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'

const Facture = () => {
  const [clients, setClients] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const hasClients = useMemo(() => clients.length > 0, [clients])

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/clients')
      setClients(data)
    } catch (error) {
      showErrorToast(toast.error, error)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const openDrawer = () => {
    if (!hasClients) {
      toast.error('Ajoutez d’abord un client pour créer une facture.', { icon: 'ℹ️' })
      return
    }
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => setIsDrawerOpen(false)

  const handleInvoiceCreated = () => {
    setRefreshKey((prev) => prev + 1)
    closeDrawer()
  }

  return (
    <div className='space-y-8'>
      <header className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div className='space-y-2'>
          <div className='flex items-center gap-3'>
            <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)] shadow-soft'>
              <FileText className='h-5 w-5' />
            </div>
            <p className='text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]'>Facturation</p>
          </div>
          <h1 className='text-3xl font-semibold text-[var(--text-dark)]'>Gestion des factures</h1>
          <p className='text-sm text-[var(--text-muted)]'>
            Visualisez vos factures et créez-en de nouvelles en quelques secondes.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={openDrawer}
            className='btn-primary h-10 px-4 text-sm font-semibold'
            disabled={!hasClients}
          >
            <FileText className='mr-2 h-4 w-4' />
            Nouvelle facture
          </button>
        </div>
      </header>

      {!hasClients ? (
        <div className='card flex flex-col items-center justify-center gap-4 border border-white/40 p-8 text-center text-sm text-[var(--text-muted)] shadow-[0_18px_52px_-44px_rgba(28,28,30,0.22)]'>
          <div className='rounded-full bg-[var(--primary-soft)] p-4 text-[var(--primary)] shadow-soft'>
            <Inbox className='h-8 w-8' />
          </div>
          <div className='space-y-1'>
            <p className='text-base font-semibold text-[var(--text-dark)]'>Aucun client disponible</p>
            <p>Ajoutez d’abord un client pour générer votre première facture.</p>
          </div>
        </div>
      ) : null}

      <InvoiceList refreshKey={refreshKey} onCreate={openDrawer} canCreate={hasClients} />

      {isDrawerOpen ? (
        <div className='fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,0.35)] backdrop-blur-sm'>
          <div className='relative flex h-full w-full max-w-3xl flex-col border border-white/45 bg-[var(--bg-panel)] shadow-[0_28px_80px_-48px_rgba(28,28,30,0.32)]'>
            <div className='flex items-center justify-between border-b border-[var(--border)] px-6 py-4'>
              <div>
                <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Nouvelle facture</h2>
                <p className='text-xs text-[var(--text-muted)]'>
                  Sélectionnez vos clients et vos prestations pour générer une facture.
                </p>
              </div>
              <button
                type='button'
                onClick={closeDrawer}
                className='rounded-full border border-[var(--border)] bg-white/70 p-2 text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
              >
                <X className='h-4 w-4' />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto px-6 py-6'>
              <InvoiceForm
                variant='drawer'
                clients={clients}
                defaultClientId={clients[0]?.id}
                onCreated={handleInvoiceCreated}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Facture
