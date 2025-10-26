import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Users,
  Building2,
  IdCard,
  Mail,
  Phone,
  MapPin,
  Trash2,
  Loader2,
  Inbox,
  Pencil,
  X,
  Search,
  RefreshCcw,
  PlusCircle
} from 'lucide-react'
import { api } from '../services/api.js'

const initialState = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  address: ''
}

const Clients = () => {
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(initialState)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [isUpdatingClient, setIsUpdatingClient] = useState(false)
  const [filters, setFilters] = useState({ search: '', draftSearch: '' })

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((prev) => ({ ...prev, search: prev.draftSearch })),
      250
    )
    return () => clearTimeout(timer)
  }, [filters.draftSearch])

  const fetchClients = async () => {
    try {
      setIsFetching(true)
      const { data } = await api.get('/clients')
      setClients(data)
    } catch (error) {
      toast.error(error.message, { icon: '⚠️' })
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const filteredClients = useMemo(() => {
    const term = filters.search.trim().toLowerCase()
    if (!term) return clients
    return clients.filter((client) =>
      [client.company_name, client.contact_name, client.email, client.phone]
        .filter(Boolean)
        .some((value) => value?.toString().toLowerCase().includes(term))
    )
  }, [clients, filters.search])

  const isEmpty = !isFetching && filteredClients.length === 0

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    try {
      await api.post('/clients', form)
      toast.success('Client ajouté', { icon: '✅' })
      setForm(initialState)
      fetchClients()
      setIsDrawerOpen(false)
    } catch (error) {
      toast.error(error.message, { icon: '⚠️' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Confirmer la suppression du client ?')) return
    try {
      await api.delete(`/clients/${id}`)
      toast.success('Client supprimé', { icon: '🗑️' })
      fetchClients()
    } catch (error) {
      toast.error(error.message, { icon: '⚠️' })
    }
  }

  const openEditClient = (client) => {
    setEditingClient({
      id: client.id,
      company_name: client.company_name || '',
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || ''
    })
  }

  const closeEditClient = () => {
    setEditingClient(null)
    setIsUpdatingClient(false)
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target
    setEditingClient((prev) => (prev ? { ...prev, [name]: value } : prev))
  }

  const handleUpdateClient = async (event) => {
    event.preventDefault()
    if (!editingClient) return
    setIsUpdatingClient(true)
    try {
      await api.patch(`/clients/${editingClient.id}`, {
        company_name: editingClient.company_name,
        contact_name: editingClient.contact_name,
        email: editingClient.email,
        phone: editingClient.phone,
        address: editingClient.address
      })
      toast.success('Client mis à jour', { icon: '✏️' })
      closeEditClient()
      fetchClients()
    } catch (error) {
      toast.error(error.message, { icon: '⚠️' })
      setIsUpdatingClient(false)
    }
  }

  const openDrawer = () => {
    setForm(initialState)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    if (!isLoading) {
      setIsDrawerOpen(false)
    }
  }

  return (
    <div className='space-y-8'>
      <header className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div className='space-y-2'>
          <div className='flex items-center gap-3'>
            <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)] shadow-soft'>
              <Users className='h-5 w-5' />
            </div>
            <p className='text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]'>Clients</p>
          </div>
          <h1 className='text-3xl font-semibold text-[var(--text-dark)]'>Répertoire client</h1>
          <p className='text-sm text-[var(--text-muted)]'>
            Centralisez vos contacts pour accélérer la génération de devis et factures.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button type='button' onClick={fetchClients} className='btn-ghost h-10 px-4 text-sm font-semibold'>
            <RefreshCcw className='mr-2 h-4 w-4' />
            Actualiser
          </button>
          <button type='button' onClick={openDrawer} className='btn-primary h-10 px-4 text-sm font-semibold'>
            <PlusCircle className='mr-2 h-4 w-4' />
            Nouveau client
          </button>
        </div>
      </header>

      <section className='card border border-white/40 p-0 shadow-[0_18px_52px_-44px_rgba(28,28,30,0.22)]'>
        <div className='space-y-4 border-b border-[var(--border)] px-4 py-4'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm font-semibold text-[var(--text-dark)]'>Clients ({filteredClients.length})</p>
              <p className='text-xs text-[var(--text-muted)]'>
                Retrouvez vos clients, mettez à jour leurs informations et supprimez les entrées obsolètes.
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-[0_12px_35px_-30px_rgba(28,28,30,0.22)] transition focus-within:border-[var(--primary)]'>
            <Search className='h-4 w-4 text-[var(--text-muted)]' />
            <input
              className='flex-1 bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
              placeholder='Rechercher un client (raison sociale, contact, email)…'
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
        </div>

        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-[var(--border)] text-sm'>
            <thead className='text-[var(--text-muted)]'>
              <tr>
                <th className='px-4 py-3 text-left font-semibold'>Entreprise</th>
                <th className='px-4 py-3 text-left font-semibold'>Contact</th>
                <th className='px-4 py-3 text-left font-semibold'>Email</th>
                <th className='px-4 py-3 text-left font-semibold'>Téléphone</th>
                <th className='px-4 py-3 text-left font-semibold'>Adresse</th>
                <th className='px-4 py-3 text-right font-semibold'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-[var(--border)]'>
              {isFetching ? (
                <tr>
                  <td colSpan={6} className='py-12 text-center text-sm text-[var(--text-muted)]'>
                    <div className='inline-flex items-center gap-2'>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Chargement des clients…
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
                        <p className='text-base font-semibold text-[var(--text-dark)]'>Aucun client trouvé</p>
                        <p>Ajoutez un client pour le retrouver rapidement dans vos factures.</p>
                      </div>
                      <button type='button' onClick={openDrawer} className='btn-primary px-4 text-sm font-semibold'>
                        <PlusCircle className='mr-2 h-4 w-4' />
                        Nouveau client
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className='transition hover:bg-[rgba(10,132,255,0.08)]'>
                    <td className='px-4 py-3 font-semibold text-[var(--text-dark)]'>{client.company_name}</td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>{client.contact_name || '—'}</td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>{client.email || '—'}</td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>{client.phone || '—'}</td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>{client.address || '—'}</td>
                    <td className='px-4 py-3 text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <button
                          type='button'
                          onClick={() => openEditClient(client)}
                          className='btn-ghost h-9 px-3 text-xs font-semibold'
                        >
                          <Pencil className='mr-2 h-4 w-4' />
                          Modifier
                        </button>
                        <button
                          type='button'
                          onClick={() => handleDelete(client.id)}
                          className='btn-ghost h-9 px-3 text-xs font-semibold text-[#ff453a] hover:bg-[rgba(255,69,58,0.14)]'
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isDrawerOpen ? (
        <div className='fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,0.35)] backdrop-blur-sm'>
          <div className='relative flex h-full w-full max-w-lg flex-col border border-white/45 bg-[var(--bg-panel)] shadow-[0_28px_80px_-48px_rgba(28,28,30,0.32)]'>
            <div className='flex items-center justify-between border-b border-[var(--border)] px-6 py-4'>
              <div>
                <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Nouveau client</h2>
                <p className='text-xs text-[var(--text-muted)]'>
                  Sauvegardez les informations de vos clients pour les réutiliser instantanément.
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

            <form onSubmit={handleSubmit} className='flex h-full flex-col'>
              <div className='flex-1 space-y-4 overflow-y-auto px-6 py-6'>
                <div className='space-y-2'>
                  <label className='label flex items-center gap-2'>
                    <Building2 className='h-4 w-4 text-[var(--text-muted)]' />
                    Raison sociale
                  </label>
                  <input
                    name='company_name'
                    value={form.company_name}
                    onChange={handleChange}
                    className='input-compact'
                    placeholder='Nom de l’entreprise'
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <label className='label flex items-center gap-2'>
                    <IdCard className='h-4 w-4 text-[var(--text-muted)]' />
                    Contact principal
                  </label>
                  <input
                    name='contact_name'
                    value={form.contact_name}
                    onChange={handleChange}
                    className='input-compact'
                    placeholder='Nom et prénom'
                  />
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <label className='label flex items-center gap-2'>
                      <Mail className='h-4 w-4 text-[var(--text-muted)]' />
                      Email
                    </label>
                    <input
                      type='email'
                      name='email'
                      value={form.email}
                      onChange={handleChange}
                      className='input-compact'
                      placeholder='exemple@entreprise.com'
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='label flex items-center gap-2'>
                      <Phone className='h-4 w-4 text-[var(--text-muted)]' />
                      Téléphone
                    </label>
                    <input
                      name='phone'
                      value={form.phone}
                      onChange={handleChange}
                      className='input-compact'
                      placeholder='+243 000 000'
                    />
                  </div>
                </div>
                <div className='space-y-2'>
                  <label className='label flex items-center gap-2'>
                    <MapPin className='h-4 w-4 text-[var(--text-muted)]' />
                    Adresse complète
                  </label>
                  <textarea
                    name='address'
                    value={form.address}
                    onChange={handleChange}
                    className='textarea textarea-compact min-h-[110px]'
                    placeholder='Adresse postale, ville, pays…'
                  />
                </div>
              </div>
              <div className='flex items-center justify-between gap-2 border-t border-[var(--border)] px-6 py-4'>
                <button
                  type='button'
                  onClick={() => setForm(initialState)}
                  className='btn-ghost h-10 px-4 text-sm font-semibold'
                  disabled={isLoading}
                >
                  Réinitialiser
                </button>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={closeDrawer}
                    className='btn-ghost h-10 px-4 text-sm font-semibold'
                    disabled={isLoading}
                  >
                    Annuler
                  </button>
                  <button type='submit' className='btn-primary h-10 px-4 text-sm font-semibold' disabled={isLoading}>
                    {isLoading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <PlusCircle className='mr-2 h-4 w-4' />}
                    {isLoading ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingClient ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.35)] px-4 py-6 backdrop-blur-sm'>
          <div className='surface relative w-full max-w-xl space-y-6 p-6'>
            <button
              type='button'
              onClick={closeEditClient}
              className='absolute right-4 top-4 text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
            >
              <X className='h-4 w-4' />
            </button>
            <div className='space-y-2 pr-6'>
              <h3 className='text-lg font-semibold text-[var(--text-dark)]'>Modifier le client</h3>
              <p className='text-xs text-[var(--text-muted)]'>
                Mettez à jour les informations du compte pour garder vos factures précises.
              </p>
            </div>

            <form onSubmit={handleUpdateClient} className='space-y-4'>
              <div className='space-y-2'>
                <label className='label flex items-center gap-2'>
                  <Building2 className='h-4 w-4 text-[var(--text-muted)]' />
                  Raison sociale
                </label>
                <input
                  name='company_name'
                  value={editingClient.company_name}
                  onChange={handleEditChange}
                  className='input'
                  required
                />
              </div>
              <div className='space-y-2'>
                <label className='label flex items-center gap-2'>
                  <IdCard className='h-4 w-4 text-[var(--text-muted)]' />
                  Contact principal
                </label>
                <input
                  name='contact_name'
                  value={editingClient.contact_name}
                  onChange={handleEditChange}
                  className='input'
                />
              </div>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <label className='label flex items-center gap-2'>
                    <Mail className='h-4 w-4 text-[var(--text-muted)]' />
                    Email
                  </label>
                  <input
                    type='email'
                    name='email'
                    value={editingClient.email}
                    onChange={handleEditChange}
                    className='input'
                  />
                </div>
                <div className='space-y-2'>
                  <label className='label flex items-center gap-2'>
                    <Phone className='h-4 w-4 text-[var(--text-muted)]' />
                    Téléphone
                  </label>
                  <input
                    name='phone'
                    value={editingClient.phone}
                    onChange={handleEditChange}
                    className='input'
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <label className='label flex items-center gap-2'>
                  <MapPin className='h-4 w-4 text-[var(--text-muted)]' />
                  Adresse complète
                </label>
                <textarea
                  name='address'
                  value={editingClient.address}
                  onChange={handleEditChange}
                  className='textarea min-h-[120px]'
                />
              </div>

              <div className='flex justify-end gap-2 pt-2'>
                <button type='button' onClick={closeEditClient} className='btn-ghost px-4 text-sm font-semibold'>
                  Annuler
                </button>
                <button type='submit' className='btn-primary px-4 text-sm font-semibold' disabled={isUpdatingClient}>
                  {isUpdatingClient ? <Loader2 className='h-4 w-4 animate-spin' /> : <Pencil className='h-4 w-4' />}
                  <span className='ml-2'>{isUpdatingClient ? 'Enregistrement…' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Clients
