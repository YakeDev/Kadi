import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, UserPlus, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import InvoiceForm from '../components/InvoiceForm.jsx'
import ClientIdentifiers from '../components/ClientIdentifiers.jsx'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import { useModalFocus } from '../hooks/useModalFocus.js'

const InvoiceCreate = ({ documentType = 'invoice' }) => {
  const isQuote = documentType === 'quote'
  const listPath = isQuote ? '/devis' : '/factures'
  const endpoint = isQuote ? '/quotes' : '/invoices'
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	const invoiceId = searchParams.get('id')
	const [clients, setClients] = useState([])
	const [invoice, setInvoice] = useState(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isClientModalOpen, setIsClientModalOpen] = useState(false)
	const [newClient, setNewClient] = useState({
		company_name: '',
		contact_name: '',
		email: '',
		nif: '',
		national_id: '',
		rccm: '',
	})
	const [isCreatingClient, setIsCreatingClient] = useState(false)
  const [newClientId, setNewClientId] = useState(null)
  const clientPanelRef = useModalFocus(isClientModalOpen, () => { if (!isCreatingClient) setIsClientModalOpen(false) })

  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setIsLoading(true)
    setLoadError(false)
    Promise.all([
      api.get('/clients', { params: { pageSize: 100 } }),
      invoiceId ? api.get(`${endpoint}/${invoiceId}`) : Promise.resolve({ data: null })
    ]).then(([clientResponse, invoiceResponse]) => {
      if (!active) return
      if (invoiceId && !invoiceResponse.data?.id) throw new Error('Invoice unavailable')
      const loadedClients = clientResponse.data?.data ?? []
      const documentClient = invoiceResponse.data?.client
      setClients(documentClient?.id && !loadedClients.some(client => client.id === documentClient.id) ? [documentClient, ...loadedClients] : loadedClients)
      setInvoice(isQuote && invoiceResponse.data ? { ...invoiceResponse.data, due_date: invoiceResponse.data.valid_until } : invoiceResponse.data)
      setNewClientId(null)
    }).catch(() => { if (active) setLoadError(true) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [invoiceId, loadAttempt, endpoint, isQuote])
  const hasClients = clients.length > 0

	const handleInvoiceCreated = () => {
		navigate(listPath, { replace: true })
		toast.success(isQuote ? 'Devis enregistré' : 'Facture enregistrée', { icon: '✅' })
	}

	const handleInvoiceUpdated = () => {
		navigate(listPath, { replace: true })
		toast.success(isQuote ? 'Devis mis à jour' : 'Facture mise à jour', { icon: '✅' })
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
		setIsCreatingClient(true)
		try {
			const { data: createdClient } = await api.post('/clients', {
				company_name: newClient.company_name.trim(),
				contact_name: newClient.contact_name.trim() || null,
				email: newClient.email.trim() || null,
				nif: newClient.nif.trim() || null,
				national_id: newClient.national_id.trim() || null,
				rccm: newClient.rccm.trim() || null,
			})
			toast.success('Client ajouté', { icon: '✅' })
			setNewClient({ company_name: '', contact_name: '', email: '', nif: '', national_id: '', rccm: '' })
			setIsClientModalOpen(false)
      setClients((prev) => [createdClient, ...prev.filter((client) => client.id !== createdClient.id)])
      setNewClientId(createdClient.id)
		} catch (error) {
			showErrorToast(toast.error, error)
		} finally {
			setIsCreatingClient(false)
		}
	}

	if (isLoading) {
		return (
			<div className='flex min-h-[60vh] items-center justify-center text-[var(--text-muted)]'>
				Chargement…
			</div>
		)
	}

  if (loadError) return <section role='alert' className='card space-y-3 p-6'><h1 className='text-lg'>Impossible de charger l’éditeur</h1><p className='text-sm text-[var(--text-muted)]'>Votre saisie conservée dans cet onglet reste disponible. Réessayez le chargement.</p><button type='button' className='btn-primary' onClick={() => setLoadAttempt((prev) => prev + 1)}>Réessayer</button></section>

  if (invoice && (isQuote ? invoice.status === 'converted' : invoice.status !== 'draft')) return <div className='card space-y-3 p-6'><p>{isQuote ? 'Ce devis est converti et ne peut plus être modifié.' : 'Cette facture est émise et ne peut plus être modifiée.'}</p><Link to={listPath} className='underline'>{isQuote ? 'Retour aux devis' : 'Retour aux factures'}</Link></div>

	return (
		<div className='space-y-4'>
      <Link to={listPath} className='native-editor-back inline-flex items-center gap-2 py-2 text-sm text-[var(--text-muted)]'>
        <ArrowLeft aria-hidden='true' className='h-4 w-4' /> {isQuote ? 'Retour aux devis' : 'Retour aux factures'}
      </Link>

			{!hasClients ? (
				<div className='rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-white p-6 text-sm text-[var(--text-muted)]'>
					<p className='font-semibold text-[var(--text-dark)]'>Aucun client disponible</p>
					<p className='mt-2'>Ajoutez d’abord un client pour créer un document.</p>
				</div>
			) : null}

			<InvoiceForm
        key={`${invoice?.id || 'new'}:${invoice?.version ?? invoice?.updated_at ?? '0'}`}
        newClientId={newClientId}
        documentType={documentType}
				clients={clients}
				defaultClientId={invoice?.client_id ?? clients[0]?.id}
				invoice={invoice}
				onCreated={handleInvoiceCreated}
				onUpdated={handleInvoiceUpdated}
        onNewClient={() => setIsClientModalOpen(true)}
				variant='page'
			/>

			{isClientModalOpen ? (
				<div className='fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.35)] backdrop-blur-sm px-4'>
					<div ref={clientPanelRef} role='dialog' aria-modal='true' aria-labelledby='new-client-title' tabIndex={-1} className='w-full max-w-lg rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white max-h-[calc(100vh-3rem)] overflow-y-auto'>
						<div className='flex items-center justify-between border-b border-[var(--border)] px-6 py-4'>
							<div className='space-y-1'>
								<h2 id='new-client-title' className='text-lg font-semibold text-[var(--text-dark)]'>Nouveau client</h2>
								<p className='text-xs text-[var(--text-muted)]'>Créez un client sans quitter l’éditeur.</p>
							</div>
							<button
								type='button'
								aria-label='Fermer le formulaire client'
                  disabled={isCreatingClient}
                  onClick={() => setIsClientModalOpen(false)}
								className='rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
							>
								<X className='h-4 w-4' />
							</button>
						</div>
						<form onSubmit={handleCreateClient} className='flex flex-col gap-4 px-6 py-6'>
							<div className='flex flex-col gap-2'>
								<label className='label' htmlFor='invoicecreate-company_name'>Entreprise *</label>
								<input id='invoicecreate-company_name'
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
									<label className='label' htmlFor='invoicecreate-contact_name'>Contact</label>
									<input id='invoicecreate-contact_name'
										name='contact_name'
										value={newClient.contact_name}
										onChange={handleNewClientChange}
										placeholder='Nom & prénom'
										className='input'
									/>
								</div>
								<div className='flex flex-col gap-2'>
									<label className='label' htmlFor='invoicecreate-email'>Email</label>
									<input id='invoicecreate-email'
										type='email'
										name='email'
										value={newClient.email}
										onChange={handleNewClientChange}
										placeholder='contact@entreprise.com'
										className='input'
									/>
								</div>
							</div>
							<ClientIdentifiers values={newClient} onChange={handleNewClientChange} idPrefix='invoicecreate-client' />
							<div className='flex flex-col gap-3 sm:flex-row sm:justify-end'>
								<button type='button' className='btn-ghost justify-center' onClick={() => setIsClientModalOpen(false)} disabled={isCreatingClient}>
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
			) : null}
		</div>
	)
}

export default InvoiceCreate
