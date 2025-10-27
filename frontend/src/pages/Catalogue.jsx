import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  PackagePlus,
  Package,
  Wand2,
  RefreshCcw,
  BadgeCheck,
  Search,
  Filter,
  Archive,
  X
} from 'lucide-react'
import { createCatalogItem, fetchCatalogItems, updateCatalogItem } from '../services/catalog.js'
import { showErrorToast } from '../utils/errorToast.js'
import FormSection from '../components/FormSection.jsx'

const emptyForm = {
  name: '',
  description: '',
  item_type: 'product',
  unit_price: '',
  currency: 'USD',
  sku: ''
}

const ITEM_TYPE_LABELS = {
  product: 'Produit',
  service: 'Service'
}

const formatAmount = (amount, currency = 'USD') =>
  `${Number(amount || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`

const Catalogue = () => {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [blockingId, setBlockingId] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const [filters, setFilters] = useState({
    search: '',
    draftSearch: '',
    type: 'all',
    showInactive: false
  })

  const [form, setForm] = useState(emptyForm)

  const filteredCount = useMemo(() => items.length, [items])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: prev.draftSearch }))
    }, 250)
    return () => clearTimeout(timer)
  }, [filters.draftSearch])

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = {}
      if (filters.type !== 'all') {
        params.type = filters.type
      }
      if (!filters.showInactive) {
        params.active = 'true'
      }
      if (filters.search.trim()) {
        params.search = filters.search.trim()
      }
      const data = await fetchCatalogItems(params)
      setItems(data ?? [])
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsLoading(false)
    }
  }, [filters.search, filters.showInactive, filters.type])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const openDrawer = () => {
    setForm(emptyForm)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setForm(emptyForm)
  }

  const resetForm = () => setForm(emptyForm)

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      toast.error('Le nom est obligatoire.')
      return
    }
    setIsCreating(true)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim() || null,
        unit_price: form.unit_price ? Number(form.unit_price) : 0,
        currency: form.currency?.trim().toUpperCase() || 'USD',
        sku: form.sku.trim() || null,
        item_type: form.item_type
      }
      await createCatalogItem(payload)
      toast.success('Article ajouté au catalogue 🎉')
      await loadItems()
      closeDrawer()
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleActive = async (item) => {
    setBlockingId(item.id)
    try {
      await updateCatalogItem(item.id, { is_active: !item.is_active })
      toast.success(item.is_active ? 'Article archivé.' : 'Article réactivé.')
      await loadItems()
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setBlockingId(null)
    }
  }

  const handleFilterChange = (type) => {
    setFilters((prev) => ({ ...prev, type }))
  }

  const renderCatalogueFormSections = () => (
    <div className='space-y-4'>
      <FormSection
        title='Informations générales'
        description='Nom, description et nature de votre prestation.'
        icon={Package}
      >
        <div className='flex flex-col gap-2'>
          <label className='label' htmlFor='name'>Nom de l’article</label>
          <input
            id='name'
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            className='input-compact'
            placeholder='Nom du produit ou service'
            required
          />
        </div>
        <div className='flex flex-col gap-2'>
          <label className='label' htmlFor='description'>Description</label>
          <textarea
            id='description'
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            className='textarea textarea-compact min-h-[110px]'
            placeholder='Détaillez en quoi consiste cet article…'
          />
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-2'>
            <label className='label'>Type</label>
            <div className='grid grid-cols-2 gap-2'>
              <button
                type='button'
                onClick={() => setForm((prev) => ({ ...prev, item_type: 'product' }))}
                className={`btn-ghost h-9 justify-center text-xs font-semibold ${
                  form.item_type === 'product' ? 'border-[var(--primary)] text-[var(--primary)]' : ''
                }`}
              >
                <Package className='mr-2 h-4 w-4' /> Produit
              </button>
              <button
                type='button'
                onClick={() => setForm((prev) => ({ ...prev, item_type: 'service' }))}
                className={`btn-ghost h-9 justify-center text-xs font-semibold ${
                  form.item_type === 'service' ? 'border-[var(--primary)] text-[var(--primary)]' : ''
                }`}
              >
                <Wand2 className='mr-2 h-4 w-4' /> Service
              </button>
            </div>
          </div>
          <div className='flex flex-col gap-2'>
            <label className='label' htmlFor='sku'>Référence interne (SKU)</label>
            <input
              id='sku'
              value={form.sku}
              onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
              className='input-compact'
              placeholder='Ex. PROD-001'
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        title='Tarification'
        description='Déterminez le prix par défaut et la devise.'
        icon={BadgeCheck}
      >
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <label className='label' htmlFor='unit_price'>Prix unitaire</label>
            <input
              id='unit_price'
              type='number'
              min='0'
              step='0.01'
              value={form.unit_price}
              onChange={(event) => setForm((prev) => ({ ...prev, unit_price: event.target.value }))}
              className='input-compact'
              placeholder='0.00'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='label' htmlFor='currency'>Devise</label>
            <input
              id='currency'
              value={form.currency}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  currency: event.target.value.toUpperCase().slice(0, 3)
                }))
              }
              className='input-compact uppercase'
              placeholder='USD'
              maxLength={3}
            />
          </div>
        </div>
      </FormSection>
    </div>
  )

  return (
    <div className='space-y-8'>
      <header className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div className='space-y-2'>
          <p className='text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]'>Catalogue</p>
          <h1 className='text-3xl font-semibold text-[var(--text-dark)]'>Produits & services</h1>
          <p className='text-sm text-[var(--text-muted)]'>
            Centralisez vos prestations pour les injecter en un clic dans vos factures.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <button
            type='button'
            onClick={loadItems}
            className='btn-ghost h-10 px-4 text-sm font-semibold'
            disabled={isLoading}
          >
            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button type='button' onClick={openDrawer} className='btn-primary h-10 px-4 text-sm font-semibold'>
            <PackagePlus className='mr-2 h-4 w-4' />
            Nouvel article
          </button>
        </div>
      </header>

      <section className='card border border-white/40 p-0 shadow-[0_18px_52px_-44px_rgba(28,28,30,0.22)]'>
        <div className='space-y-4 border-b border-[var(--border)] px-4 py-4'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-sm font-semibold text-[var(--text-dark)]'>Catalogue ({filteredCount})</p>
              <p className='text-xs text-[var(--text-muted)]'>
                {filters.showInactive ? 'Affichage des articles actifs et archivés.' : 'Affichage des articles actifs uniquement.'}
              </p>
            </div>
          </div>

          <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-[0_12px_35px_-30px_rgba(28,28,30,0.22)] transition focus-within:border-[var(--primary)]'>
              <Search className='h-4 w-4 text-[var(--text-muted)]' />
              <input
                className='flex-1 bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
                placeholder='Rechercher un article (nom, description, SKU)…'
                value={filters.draftSearch}
                onChange={(event) => setFilters((prev) => ({ ...prev, draftSearch: event.target.value }))}
              />
              {filters.draftSearch ? (
                <button
                  type='button'
                  onClick={() => setFilters((prev) => ({ ...prev, draftSearch: '', search: '' }))}
                  className='text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-dark)]'
                >
                  Effacer
                </button>
              ) : null}
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='button'
                onClick={() => handleFilterChange('all')}
                className={`btn-ghost h-9 px-3 text-xs font-semibold ${
                  filters.type === 'all' ? 'border-[var(--primary)] text-[var(--primary)]' : ''
                }`}
              >
                <Filter className='mr-2 h-4 w-4' />
                Tous
              </button>
              <button
                type='button'
                onClick={() => handleFilterChange('product')}
                className={`btn-ghost h-9 px-3 text-xs font-semibold ${
                  filters.type === 'product' ? 'border-[var(--primary)] text-[var(--primary)]' : ''
                }`}
              >
                <Package className='mr-2 h-4 w-4' />
                Produits
              </button>
              <button
                type='button'
                onClick={() => handleFilterChange('service')}
                className={`btn-ghost h-9 px-3 text-xs font-semibold ${
                  filters.type === 'service' ? 'border-[var(--primary)] text-[var(--primary)]' : ''
                }`}
              >
                <Wand2 className='mr-2 h-4 w-4' />
                Services
              </button>
              <label className='ml-auto flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]'>
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-[var(--primary)]'
                  checked={filters.showInactive}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, showInactive: event.target.checked }))
                  }
                />
                Inclure les éléments archivés
              </label>
            </div>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-[var(--border)] text-sm'>
            <thead className='text-[var(--text-muted)]'>
              <tr>
                <th className='px-4 py-3 text-left font-semibold'>Article</th>
                <th className='px-4 py-3 text-left font-semibold'>Type</th>
                <th className='px-4 py-3 text-left font-semibold'>Tarif</th>
                <th className='px-4 py-3 text-left font-semibold'>SKU</th>
                <th className='px-4 py-3 text-left font-semibold'>Statut</th>
                <th className='px-4 py-3 text-right font-semibold'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-[var(--border)]'>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className='py-12 text-center text-sm text-[var(--text-muted)]'>
                    <div className='inline-flex items-center gap-3'>
                      <RefreshCcw className='h-5 w-5 animate-spin' />
                      Chargement du catalogue…
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className='py-16 text-center text-sm text-[var(--text-muted)]'>
                    <div className='flex flex-col items-center gap-4'>
                      <div className='rounded-full bg-[var(--primary-soft)] p-5 text-[var(--primary)] shadow-soft'>
                        <PackagePlus className='h-10 w-10' />
                      </div>
                      <div className='space-y-1'>
                        <p className='text-base font-semibold text-[var(--text-dark)]'>Aucun article trouvé</p>
                        <p>Ajoutez votre premier produit ou service pour le retrouver ici.</p>
                      </div>
                      <button
                        type='button'
                        onClick={openDrawer}
                        className='btn-primary px-4 text-sm font-semibold'
                      >
                        <PackagePlus className='mr-2 h-4 w-4' />
                        Ajouter un article
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className='transition hover:bg-[rgba(10,132,255,0.08)]'>
                    <td className='px-4 py-3'>
                      <p className='font-semibold text-[var(--text-dark)]'>{item.name}</p>
                      {item.description ? (
                        <p className='text-xs text-[var(--text-muted)]'>{item.description}</p>
                      ) : null}
                    </td>
                    <td className='px-4 py-3'>
                      <span className='badge bg-[var(--primary-soft)] text-[var(--primary)]'>
                        {ITEM_TYPE_LABELS[item.item_type] || 'Produit'}
                      </span>
                    </td>
                    <td className='px-4 py-3 font-semibold text-[var(--text-dark)]'>
                      {formatAmount(item.unit_price, item.currency)}
                    </td>
                    <td className='px-4 py-3 text-[var(--text-muted)]'>{item.sku || '—'}</td>
                    <td className='px-4 py-3'>
                      {item.is_active ? (
                        <span className='inline-flex items-center gap-2 text-xs font-semibold text-[#30d058]'>
                          <BadgeCheck className='h-4 w-4' />
                          Actif
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]'>
                          <Archive className='h-4 w-4' />
                          Archivé
                        </span>
                      )}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <button
                        type='button'
                        onClick={() => handleToggleActive(item)}
                        disabled={blockingId === item.id}
                        className='btn-ghost h-9 justify-end text-xs font-semibold'
                      >
                        {blockingId === item.id ? (
                          <RefreshCcw className='h-4 w-4 animate-spin' />
                        ) : item.is_active ? (
                          <>
                            <Archive className='mr-2 h-4 w-4' />
                            Archiver
                          </>
                        ) : (
                          <>
                            <BadgeCheck className='mr-2 h-4 w-4' />
                            Réactiver
                          </>
                        )}
                      </button>
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
                <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Ajouter un article</h2>
                <p className='text-xs text-[var(--text-muted)]'>
                  Enregistrez vos tarifs pour générer vos devis et factures en un clic.
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
            <form onSubmit={handleCreate} className='flex h-full flex-col'>
              <div className='flex-1 space-y-4 overflow-y-auto px-6 py-6'>
                {renderCatalogueFormSections()}
              </div>
              <div className='flex items-center justify-between gap-2 border-t border-[var(--border)] px-6 py-4'>
                <button
                  type='button'
                  onClick={resetForm}
                  className='btn-ghost h-10 px-4 text-sm font-semibold'
                  disabled={isCreating}
                >
                  Réinitialiser
                </button>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={closeDrawer}
                    className='btn-ghost h-10 px-4 text-sm font-semibold'
                    disabled={isCreating}
                  >
                    Annuler
                  </button>
                  <button
                    type='submit'
                    className='btn-primary h-10 px-4 text-sm font-semibold'
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <RefreshCcw className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <PackagePlus className='mr-2 h-4 w-4' />
                    )}
                    {isCreating ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Catalogue
