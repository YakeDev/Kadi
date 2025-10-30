import { useCallback, useEffect, useState } from 'react'
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
import FormSection from '../components/FormSection.jsx'
import { showErrorToast } from '../utils/errorToast.js'
import PageHeader from '../components/PageHeader.jsx'
import FloatingActionButton from '../components/FloatingActionButton.jsx'
import Pagination from '../components/Pagination.jsx'

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
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })

  useEffect(() => {
    const value = filters.draftSearch
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }))
      setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }))
    }, 250)
    return () => clearTimeout(timer)
  }, [filters.draftSearch])

  const fetchClients = useCallback(async ({ page, pageSize, search }) => {
    try {
      setIsFetching(true)
      const { data } = await api.get('/clients', {
        params: {
          page,
          pageSize,
          search: search || undefined
        }
      })

      setClients(data?.data ?? [])
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
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchClients({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filters.search
    })
  }, [fetchClients, filters.search, pagination.page, pagination.pageSize])

  const isEmpty = !isFetching && clients.length === 0 && pagination.total === 0

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
      if (pagination.page === 1) {
        fetchClients({ page: 1, pageSize: pagination.pageSize, search: filters.search })
      } else {
        setPagination((prev) => ({ ...prev, page: 1 }))
      }
      setIsDrawerOpen(false)
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Confirmer la suppression du client ?')) return
    try {
      await api.delete(`/clients/${id}`)
      toast.success('Client supprimé', { icon: '🗑️' })
      fetchClients({ page: pagination.page, pageSize: pagination.pageSize, search: filters.search })
    } catch (error) {
      showErrorToast(toast.error, error)
    }
  }

  const handlePageChange = (nextPage) => {
    setPagination((prev) => {
      const target = Math.max(1, nextPage)
      if (target === prev.page) return prev
      return { ...prev, page: target }
    })
  }

  const handlePageSizeChange = (size) => {
    setPagination((prev) => {
      if (size === prev.pageSize) return prev
      return { ...prev, pageSize: size, page: 1 }
    })
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
      fetchClients({ page: pagination.page, pageSize: pagination.pageSize, search: filters.search })
    } catch (error) {
      showErrorToast(toast.error, error)
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

  const buildFormSections = (values, onChangeHandler) => (
    <div className='space-y-4'>
      <FormSection
        title='Identité client'
        description="Nom de l'entreprise et personne de contact."
        icon={Building2}
      >
        <div className='flex flex-col gap-2'>
          <label className='label'>Entreprise</label>
          <input
            name='company_name'
            value={values.company_name}
            onChange={onChangeHandler}
            placeholder='Ex. Alpha SARL'
            className='input'
            required
          />
        </div>
        <div className='flex flex-col gap-2'>
          <label className='label'>Contact principal</label>
          <input
            name='contact_name'
            value={values.contact_name}
            onChange={onChangeHandler}
            placeholder='Nom & prénom'
            className='input'
          />
        </div>
      </FormSection>

      <FormSection
        title='Coordonnées'
        description='Moyens de communication privilégiés.'
        icon={Mail}
      >
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <label className='label'>Email</label>
            <input
              type='email'
              name='email'
              value={values.email}
              onChange={onChangeHandler}
              placeholder='client@entreprise.com'
              className='input'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='label'>Téléphone</label>
            <input
              name='phone'
              value={values.phone}
              onChange={onChangeHandler}
              placeholder='+243 000 000 000'
              className='input'
            />
          </div>
        </div>
      </FormSection>

      <FormSection title='Adresse (optionnel)' icon={MapPin}>
        <textarea
          name='address'
          value={values.address}
          onChange={onChangeHandler}
          placeholder="Adresse postale du client"
          className='textarea textarea-compact min-h-[90px]'
        />
      </FormSection>
    </div>
  )

  return (
    <div className='space-y-8'>
      <PageHeader
        icon={Users}
        title='Répertoire client'
        subtitle='Centralisez vos contacts pour accélérer la génération de devis et factures.'
        actions={[
          <button
            key='refresh'
            type='button'
            onClick={() =>
              fetchClients({
                page: pagination.page,
                pageSize: pagination.pageSize,
                search: filters.search
              })
            }
            className='btn-ghost h-11 justify-center'
          >
            <RefreshCcw className='mr-2 h-4 w-4' />
            Actualiser
          </button>,
          <button key='create' type='button' onClick={openDrawer} className='btn-primary h-11 justify-center'>
            <PlusCircle className='mr-2 h-4 w-4' />
            Nouveau client
          </button>
        ]}
      />

      <section className='card p-0'>
        <div className='space-y-4 border-b border-[var(--border)] px-4 py-4'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm font-semibold text-[var(--text-dark)]'>Clients ({pagination.total})</p>
              <p className='text-xs text-[var(--text-muted)]'>
                Retrouvez vos clients, mettez à jour leurs informations et supprimez les entrées obsolètes.
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 transition focus-within:border-[var(--primary)]'>
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
                      <div className='rounded-full bg-[var(--primary-soft)] p-5 text-[var(--primary)]'>
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
                clients.map((client) => (
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
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isFetching || isLoading || isUpdatingClient}
        />
      </section>

      {isDrawerOpen ? (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-[rgba(15,23,42,0.35)] backdrop-blur-sm'>
          <div className='flex min-h-full items-stretch justify-end'>
            <div className='relative flex h-full min-h-full w-full max-w-lg flex-col border border-[var(--border)] bg-white'>
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
                  className='rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>

              <form onSubmit={handleSubmit} className='flex h-full flex-col'>
                <div className='flex-1 space-y-4 overflow-y-auto px-6 py-6'>
                  {buildFormSections(form, handleChange)}
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
        </div>
      ) : null}

      {editingClient ? (
        <div className='fixed inset-0 z-50 overflow-y-auto bg-[rgba(15,23,42,0.35)] backdrop-blur-sm'>
          <div className='flex min-h-full items-center justify-center px-4 py-6'>
            <div className='surface relative w-full max-w-xl space-y-6 p-6 max-h-[calc(100vh-3rem)] overflow-y-auto'>
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
                {buildFormSections(editingClient, handleEditChange)}

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
        </div>
      ) : null}

      {!isDrawerOpen ? (
        <FloatingActionButton
          icon={PlusCircle}
          label='Nouveau client'
          onClick={openDrawer}
          className='lg:hidden'
        />
      ) : null}
    </div>
  )
}

export default Clients
