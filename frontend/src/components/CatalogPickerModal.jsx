import { useEffect, useMemo, useState } from 'react'
import { X, Search, Loader2, PackagePlus } from 'lucide-react'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import toast from 'react-hot-toast'

const CatalogPickerModal = ({ isOpen, onClose, onSelect }) => {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)
      try {
        const { data } = await api.get('/products', {
          params: {
            active: 'true',
            search: search || undefined,
            pageSize: 30
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
      <div className='w-full max-w-3xl rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white p-6'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Insérer un article du catalogue</h2>
            <p className='text-xs text-[var(--text-muted)]'>Retrouvez rapidement vos produits ou services et injectez-les dans la facture.</p>
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
            placeholder='Rechercher un article (nom, description, SKU)…'
            className='flex-1 bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
          />
        </div>

        <div className='mt-4 max-h-72 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white'>
          {isLoading ? (
            <div className='flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Chargement du catalogue…
            </div>
          ) : hasNoResults ? (
            <div className='flex flex-col items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]'>
              <PackagePlus className='h-6 w-6' />
              <p>Aucun article actif ne correspond à votre recherche.</p>
            </div>
          ) : (
            <ul className='divide-y divide-[var(--border)] text-sm'>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type='button'
                    onClick={() => onSelect?.(item)}
                    className='flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-[rgba(10,132,255,0.08)]'
                  >
                    <div>
                      <p className='font-semibold text-[var(--text-dark)]'>{item.name}</p>
                      {item.description ? (
                        <p className='text-xs text-[var(--text-muted)]'>{item.description}</p>
                      ) : null}
                    </div>
                    <div className='text-right text-xs text-[var(--text-muted)]'>
                      <p className='font-semibold text-[var(--text-dark)]'>
                        {Number(item.unit_price || 0).toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}{' '}
                        {item.currency}
                      </p>
                      {item.sku ? <p>SKU : {item.sku}</p> : null}
                    </div>
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

export default CatalogPickerModal
