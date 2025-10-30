import { useEffect, useMemo, useState } from 'react'
import { X, Search, Loader2, UserPlus } from 'lucide-react'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import toast from 'react-hot-toast'

const ClientPickerModal = ({
  isOpen,
  onClose,
  onSelect,
  allowCreate = false,
  onCreate
}) => {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)
      try {
        const { data } = await api.get('/clients', {
          params: {
            search: search || undefined,
            pageSize: 20
          },
          signal: controller.signal
        })
        setItems(data?.data ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          showErrorToast(toast.error, error)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    load()
    return () => controller.abort()
  }, [isOpen, search])

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen])

  const hasNoResults = useMemo(() => !isLoading && items.length === 0, [isLoading, items])

  if (!isOpen) return null

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.45)] backdrop-blur-sm px-4'>
      <div className='w-full max-w-2xl rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white p-6'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Sélectionner un client</h2>
            <p className='text-xs text-[var(--text-muted)]'>Choisissez un client existant ou créez-en un nouveau.</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-[var(--border)] bg-white p-2 text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='mt-4 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-3 py-2'>
          <Search className='h-4 w-4 text-[var(--text-muted)]' />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Rechercher par nom d’entreprise, contact, email…'
            className='flex-1 bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
          />
        </div>

        <div className='mt-4 max-h-72 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white'>
          {isLoading ? (
            <div className='flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Chargement des clients…
            </div>
          ) : hasNoResults ? (
            <div className='flex flex-col items-center justify-center gap-3 py-8 text-sm text-[var(--text-muted)]'>
              <p>Aucun client trouvé.</p>
              {allowCreate && onCreate ? (
                <button type='button' className='btn-primary h-9 px-4 text-xs font-semibold' onClick={onCreate}>
                  <UserPlus className='mr-2 h-4 w-4' />
                  Nouveau client
                </button>
              ) : null}
            </div>
          ) : (
            <ul className='divide-y divide-[var(--border)] text-sm'>
              {items.map((client) => (
                <li key={client.id}>
                  <button
                    type='button'
                    onClick={() => onSelect?.(client)}
                    className='flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-[rgba(10,132,255,0.08)]'
                  >
                    <span className='font-semibold text-[var(--text-dark)]'>{client.company_name}</span>
                    <span className='text-xs text-[var(--text-muted)]'>
                      {[client.contact_name, client.email]
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='mt-4 flex justify-end'>
          <button type='button' className='btn-ghost px-4 text-sm font-semibold' onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

export default ClientPickerModal
