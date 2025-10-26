import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
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

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/clients')
      setClients(data)
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    try {
      await api.post('/clients', form)
      toast.success('Client ajouté')
      setForm(initialState)
      fetchClients()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Confirmer la suppression du client ?')) return
    try {
      await api.delete(`/clients/${id}`)
      toast.success('Client supprimé')
      fetchClients()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className='space-y-8'>
      <div className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
        <h1 className='text-xl font-semibold text-nuit'>Clients</h1>
        <p className='text-sm text-slate-500'>
          Enregistrez vos clients pour pré-remplir vos factures et conserver l’historique.
        </p>

        <form onSubmit={handleSubmit} className='mt-6 grid gap-4 md:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Raison sociale
            </label>
            <input
              name='company_name'
              value={form.company_name}
              onChange={handleChange}
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
              required
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Contact principal
            </label>
            <input
              name='contact_name'
              value={form.contact_name}
              onChange={handleChange}
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Email
            </label>
            <input
              type='email'
              name='email'
              value={form.email}
              onChange={handleChange}
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Téléphone
            </label>
            <input
              name='phone'
              value={form.phone}
              onChange={handleChange}
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
          </div>
          <div className='md:col-span-2 flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>
              Adresse complète
            </label>
            <textarea
              name='address'
              value={form.address}
              onChange={handleChange}
              rows={3}
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
          </div>
          <div>
            <button
              type='submit'
              disabled={isLoading}
              className='rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-slate-400'
            >
              {isLoading ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>

      <div className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
        <h2 className='text-lg font-semibold text-nuit'>Liste des clients</h2>
        <div className='mt-4 overflow-x-auto'>
          <table className='min-w-full divide-y divide-slate-200'>
            <thead>
              <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                <th className='px-4 py-2 font-medium'>Entreprise</th>
                <th className='px-4 py-2 font-medium'>Contact</th>
                <th className='px-4 py-2 font-medium'>Email</th>
                <th className='px-4 py-2 font-medium'>Téléphone</th>
                <th className='px-4 py-2 font-medium'>Adresse</th>
                <th className='px-4 py-2 font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100 text-sm text-slate-600'>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td className='px-4 py-3 font-semibold text-nuit'>{client.company_name}</td>
                  <td className='px-4 py-3'>{client.contact_name}</td>
                  <td className='px-4 py-3'>{client.email}</td>
                  <td className='px-4 py-3'>{client.phone}</td>
                  <td className='px-4 py-3 text-slate-500'>{client.address || '—'}</td>
                  <td className='px-4 py-3'>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className='rounded-xl border border-slate-200 px-3 py-1 text-xs font-medium text-red-500 hover:border-red-500'
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan='5' className='px-4 py-6 text-center text-sm text-slate-500'>
                    Ajoutez votre premier client pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Clients
