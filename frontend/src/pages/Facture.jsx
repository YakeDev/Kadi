import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Inbox, FileText, X, UserPlus, Loader2 } from 'lucide-react'
import InvoiceForm from '../components/InvoiceForm.jsx'
import InvoiceList from '../components/InvoiceList.jsx'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import PageHeader from '../components/PageHeader.jsx'
import FloatingActionButton from '../components/FloatingActionButton.jsx'

const Facture = () => {
  const [clients, setClients] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [newClient, setNewClient] = useState({ company_name: '', contact_name: '', email: '' })

  const hasClients = useMemo(() => clients.length > 0, [clients])

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/clients', {
        params: {
          pageSize: 100
        }
      })
      setClients(data?.data ?? [])
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

  const openClientModal = () => setIsClientModalOpen(true)

  const closeClientModal = () => {
    if (!isCreatingClient) {
      setIsClientModalOpen(false)
    }
  }

  const handleNewClientChange = (event) => {
    const { name, value } = event.target
    setNewClient((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateClient = async (event) => {
    event.preventDefault()
    if (!newClient.company_name.trim()) {
      toast.error("Le nom de l'entreprise est obligatoire.")
      return
    }

    const hadClients = clients.length > 0
    setIsCreatingClient(true)
    try {
      await api.post('/clients', {
        company_name: newClient.company_name.trim(),
        contact_name: newClient.contact_name.trim() || null,
        email: newClient.email.trim() || null
      })
      toast.success('Client ajouté', { icon: '✅' })
      setNewClient({ company_name: '', contact_name: '', email: '' })
      setIsClientModalOpen(false)
      await fetchClients()
      if (!hadClients) {
        setIsDrawerOpen(true)
      }
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsCreatingClient(false)
    }
  }

  const handleInvoiceCreated = () => {
    setRefreshKey((prev) => prev + 1)
    closeDrawer()
  }

  return (
    <div className='space-y-8'>
      <PageHeader
        icon={FileText}
        title='Gestion des factures'
        subtitle='Visualisez vos factures et créez-en de nouvelles en quelques secondes.'
        actions={[
          <button key='client' type='button' onClick={openClientModal} className='btn-secondary h-11 justify-center'>
            <UserPlus className='mr-2 h-4 w-4' />
            Nouveau client
          </button>,
          <button
            key='create'
            type='button'
            onClick={openDrawer}
            className='btn-primary h-11 justify-center'
            disabled={!hasClients}
          >
            <FileText className='mr-2 h-4 w-4' />
            Nouvelle facture
          </button>
        ]}
      />

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
        <div className='fixed inset-0 z-50 overflow-y-auto bg-[rgba(15,23,42,0.35)] backdrop-blur-sm'>
          <div className='flex min-h-full items-stretch justify-end'>
            <div className='relative flex h-full min-h-full w-full max-w-3xl flex-col border border-white/45 bg-[var(--bg-panel)] shadow-[0_28px_80px_-48px_rgba(28,28,30,0.32)]'>
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
        </div>
      ) : null}

      {hasClients && !isDrawerOpen ? (
        <FloatingActionButton
          icon={FileText}
          label='Nouvelle facture'
          onClick={openDrawer}
          className='lg:hidden'
        />
      ) : null}

      {isClientModalOpen ? (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-[rgba(15,23,42,0.35)] backdrop-blur-sm'>
          <div className='flex min-h-full items-center justify-center px-4 py-6'>
            <div className='w-full max-w-lg rounded-[var(--radius-2xl)] border border-white/50 bg-[var(--bg-panel)] shadow-[0_28px_80px_-48px_rgba(28,28,30,0.32)] max-h-[calc(100vh-3rem)] overflow-y-auto'>
              <div className='flex items-center justify-between border-b border-[var(--border)] px-6 py-4'>
                <div className='space-y-1'>
                  <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Nouveau client</h2>
                  <p className='text-xs text-[var(--text-muted)]'>Créez un client sans quitter l’éditeur de facture.</p>
                </div>
                <button
                  type='button'
                  onClick={closeClientModal}
                  className='rounded-full border border-[var(--border)] bg-white/70 p-2 text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
              <form onSubmit={handleCreateClient} className='flex flex-col gap-4 px-6 py-6'>
                <div className='flex flex-col gap-2'>
                  <label className='label'>Entreprise *</label>
                  <input
                    name='company_name'
                    value={newClient.company_name}
                    onChange={handleNewClientChange}
                    placeholder='Ex. Alpha SARL'
                    className='input'
                    required
                  />
                </div>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='flex flex-col gap-2'>
                    <label className='label'>Contact</label>
                    <input
                      name='contact_name'
                      value={newClient.contact_name}
                      onChange={handleNewClientChange}
                      placeholder='Nom & prénom'
                      className='input'
                    />
                  </div>
                  <div className='flex flex-col gap-2'>
                    <label className='label'>Email</label>
                    <input
                      type='email'
                      name='email'
                      value={newClient.email}
                      onChange={handleNewClientChange}
                      placeholder='contact@entreprise.com'
                      className='input'
                    />
                  </div>
                </div>
                <div className='flex flex-col gap-3 sm:flex-row sm:justify-end'>
                  <button type='button' className='btn-ghost justify-center' onClick={closeClientModal} disabled={isCreatingClient}>
                    Annuler
                  </button>
                  <button type='submit' className='btn-primary justify-center' disabled={isCreatingClient}>
                    {isCreatingClient ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <UserPlus className='mr-2 h-4 w-4' />}
                    {isCreatingClient ? 'Création…' : 'Créer le client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Facture
