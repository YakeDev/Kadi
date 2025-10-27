import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Sparkles,
  PlusCircle,
  Trash2,
  Save,
  Loader2,
  Calendar,
  Building2,
  FileText,
  PackageSearch,
  RefreshCcw
} from 'lucide-react'
import { api } from '../services/api.js'
import { fetchCatalogItems } from '../services/catalog.js'
import { showErrorToast } from '../utils/errorToast.js'

const createEmptyItem = () => ({
  catalogItemId: null,
  description: '',
  quantity: 1,
  unitPrice: 0
})

const statusOptions = [
	{ value: 'draft', label: 'Brouillon' },
	{ value: 'sent', label: 'Envoyée' },
	{ value: 'paid', label: 'Payée' },
	{ value: 'overdue', label: 'En retard' },
]

const InvoiceForm = ({ clients = [], onCreated, defaultClientId, variant = 'card' }) => {
  const isDrawer = variant === 'drawer'
  const [form, setForm] = useState({
    client_id: defaultClientId || '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    status: 'draft',
    notes: '',
    items: [createEmptyItem()]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [catalog, setCatalog] = useState([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)

  useEffect(() => {
    setForm((prev) => ({ ...prev, client_id: defaultClientId || '' }))
  }, [defaultClientId])

  useEffect(() => {
    const loadCatalog = async () => {
      setIsCatalogLoading(true)
      try {
        const data = await fetchCatalogItems({ active: 'true' })
        setCatalog(data ?? [])
      } catch (error) {
        showErrorToast(toast.error, error)
      } finally {
        setIsCatalogLoading(false)
      }
    }
    loadCatalog()
  }, [])

  const refreshCatalog = async () => {
    setIsCatalogLoading(true)
    try {
      const data = await fetchCatalogItems({ active: 'true' })
      setCatalog(data ?? [])
      toast.success('Catalogue mis à jour.')
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsCatalogLoading(false)
    }
  }

  const defaultClientName = useMemo(
    () => clients.find((client) => client.id === form.client_id)?.company_name ?? 'Sélectionner un client',
    [clients, form.client_id]
  )

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const nextItems = prev.items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
      return { ...prev, items: nextItems }
    })
  }

  const handleSelectCatalogItem = (index, itemId) => {
    setForm((prev) => {
      const selected = catalog.find((entry) => entry.id === itemId)
      const nextItems = prev.items.map((item, idx) => {
        if (idx !== index) return item
        if (!selected) {
          const { catalogItemId, ...rest } = item
          return { ...rest, catalogItemId: null }
        }

        const autoDescription =
          item.description?.trim().length > 0 ? item.description : selected.description || selected.name

        return {
          ...item,
          catalogItemId: selected.id,
          description: autoDescription,
          unitPrice: Number(selected.unit_price || 0),
          currency: selected.currency || item.currency
        }
      })
      return { ...prev, items: nextItems }
    })
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }))
  }

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }))
  }

  const resetForm = () => {
    setForm({
      client_id: defaultClientId || '',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: '',
      status: 'draft',
      notes: '',
      items: [createEmptyItem()]
    })
    setAiPrompt('')
  }

  const notifySuccess = (message) =>
    toast.success(message, {
      icon: '✅'
    })

  const notifyError = (payload) => {
    if (typeof payload === 'string') {
      toast.error(payload, { icon: '⚠️' })
      return
    }
    showErrorToast(toast.error, payload)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await api.post('/invoices', form)
      notifySuccess('Facture enregistrée avec succès')
      resetForm()
      onCreated?.()
    } catch (error) {
      notifyError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAIGenerate = async () => {
    if (!aiPrompt) {
      notifyError('Veuillez saisir une instruction texte pour l’IA.')
      return
    }
    setIsGenerating(true)
    try {
      const { data } = await api.post('/ai/facture', { texte: aiPrompt })
      setForm((prev) => ({
        ...prev,
        client_id: data.client_id || prev.client_id,
        issue_date: data.issue_date || prev.issue_date,
        due_date: data.due_date || prev.due_date,
        status: data.status || prev.status,
        notes: data.notes || '',
        items: data.items?.length
          ? data.items.map((line) => ({
              catalogItemId: line.catalogItemId ?? line.catalog_item_id ?? null,
              description: line.description ?? '',
              quantity: Number(line.quantity ?? 1),
              unitPrice: Number(line.unitPrice ?? line.unit_price ?? 0),
              currency: line.currency
            }))
          : prev.items
      }))
      notifySuccess('Facture générée par IA')
    } catch (error) {
      notifyError(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const containerClass = isDrawer ? 'space-y-6' : 'card p-6'
  const inputClass = isDrawer ? 'input-compact' : 'input'
  const textareaClass = isDrawer ? 'textarea textarea-compact' : 'textarea'
  const sectionSpacingClass = isDrawer ? 'space-y-6' : 'mt-8 space-y-8'

  return (
    <div className={containerClass}>
      {isDrawer ? (
        <div className='space-y-2'>
          <label className='label' htmlFor='ia-prompt'>
            Prompt IA
          </label>
          <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-[0_12px_35px_-30px_rgba(28,28,30,0.22)] backdrop-blur'>
            <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)] shadow-soft'>
              <Sparkles className='h-4 w-4' />
            </div>
            <input
              id='ia-prompt'
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder='Décrivez votre facture…'
              className='w-full bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
            />
            <button type='button' className='btn-secondary whitespace-nowrap' onClick={handleAIGenerate} disabled={isGenerating}>
              {isGenerating ? <Loader2 className='h-4 w-4 animate-spin' /> : <Sparkles className='h-4 w-4' />}
              {isGenerating ? 'Génération…' : 'Générer via IA'}
            </button>
          </div>
        </div>
      ) : (
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <p className='text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]'>Factures</p>
            <h2 className='mt-2 text-2xl font-semibold text-[var(--text-dark)]'>Nouvelle facture</h2>
            <p className='text-sm text-[var(--text-muted)]'>
              Renseignez les éléments ci-dessous ou laissez Kadi IA préparer la facture.
            </p>
          </div>
          <div className='w-full max-w-md space-y-2'>
            <label className='label' htmlFor='ia-prompt'>
              Prompt IA
            </label>
            <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-soft backdrop-blur'>
              <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)] shadow-soft'>
                <Sparkles className='h-4 w-4' />
              </div>
              <input
                id='ia-prompt'
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder='Décrivez votre facture…'
                className='w-full bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
              />
              <button type='button' className='btn-secondary whitespace-nowrap' onClick={handleAIGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className='h-4 w-4 animate-spin' /> : <Sparkles className='h-4 w-4' />}
                {isGenerating ? 'Génération…' : 'Générer via IA'}
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={sectionSpacingClass}>
        <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          <div className='space-y-2'>
            <label className='label' htmlFor='client'>
              Client
            </label>
            <div className='relative'>
              <select
                id='client'
                value={form.client_id}
                onChange={(event) => updateField('client_id', event.target.value)}
                className={`${inputClass} appearance-none`}
                required
              >
                <option value=''>Sélectionner un client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name}
                  </option>
                ))}
              </select>
              <Building2 className='pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]' />
            </div>
            <p className='text-xs text-[var(--text-muted)]'>Client sélectionné : {defaultClientName}</p>
          </div>
          <div className='space-y-2'>
            <label className='label' htmlFor='issue-date'>
              Émise le
            </label>
            <div className='relative'>
              <Calendar className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]' />
              <input
                id='issue-date'
                type='date'
                value={form.issue_date}
                onChange={(event) => updateField('issue_date', event.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div className='space-y-2'>
            <label className='label' htmlFor='due-date'>
              Échéance
            </label>
            <div className='relative'>
              <Calendar className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]' />
              <input
                id='due-date'
                type='date'
                value={form.due_date}
                onChange={(event) => updateField('due_date', event.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div className='space-y-2'>
            <label className='label' htmlFor='status'>
              Statut
            </label>
            <select
              id='status'
              value={form.status}
              onChange={(event) => updateField('status', event.target.value)}
              className={inputClass}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className='space-y-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h3 className='text-sm font-semibold text-[var(--text-dark)]'>Lignes de facturation</h3>
            <div className='flex items-center gap-2'>
              <button type='button' onClick={refreshCatalog} className='btn-ghost h-9 px-3 text-xs font-semibold' disabled={isCatalogLoading}>
                <RefreshCcw className={`mr-2 h-4 w-4 ${isCatalogLoading ? 'animate-spin' : ''}`} />
                Catalogue
              </button>
              <button type='button' onClick={addItem} className='btn-ghost h-9 px-3 text-xs font-semibold'>
                <PlusCircle className='mr-2 h-4 w-4' />
                Ajouter une ligne
              </button>
            </div>
          </div>
          {catalog.length === 0 && !isCatalogLoading ? (
            <p className='rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.7)] px-4 py-3 text-xs text-[var(--text-muted)]'>
              Aucun article actif dans votre catalogue pour le moment. Rendez-vous dans l’onglet
              <span className='font-semibold text-[var(--text-dark)]'> Catalogue</span> pour ajouter vos produits ou services.
            </p>
          ) : null}
          <div className='space-y-3'>
            {form.items.map((item, index) => {
              const selectedCatalog = catalog.find((entry) => entry.id === item.catalogItemId)
              return (
                <div
                  key={`invoice-item-${index}`}
                  className='grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 backdrop-blur md:grid-cols-[1.4fr,1.6fr,0.8fr,0.8fr,auto]'
                >
                  <div className='space-y-2'>
                    <label className='label flex items-center gap-2'>
                      <PackageSearch className='h-4 w-4 text-[var(--text-muted)]' />
                      Catalogue
                    </label>
                    <select
                      value={item.catalogItemId || ''}
                      onChange={(event) => handleSelectCatalogItem(index, event.target.value || null)}
                      className={`${inputClass} appearance-none`}
                      disabled={isCatalogLoading}
                    >
                      <option value=''>{isCatalogLoading ? 'Chargement du catalogue…' : 'Sélectionner un article'}</option>
                      {catalog.map((catalogItem) => (
                        <option key={catalogItem.id} value={catalogItem.id}>
                          {catalogItem.name} · {Number(catalogItem.unit_price || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}{' '}
                          {catalogItem.currency}
                        </option>
                      ))}
                    </select>
                    {selectedCatalog?.description ? (
                      <p className='text-xs text-[var(--text-muted)]'>{selectedCatalog.description}</p>
                    ) : null}
                  </div>
                  <div className='space-y-2'>
                    <label className='label flex items-center gap-2'>
                      <FileText className='h-4 w-4 text-[var(--text-muted)]' />
                      Description
                    </label>
                    <input
                      type='text'
                      value={item.description}
                      onChange={(event) => updateItem(index, 'description', event.target.value)}
                      placeholder='Prestation, produit, service…'
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='label'>Quantité</label>
                    <input
                      type='number'
                      min='1'
                      value={item.quantity}
                      onChange={(event) => updateItem(index, 'quantity', Number(event.target.value) || 1)}
                      className={inputClass}
                    />
                  </div>
                  <div className='space-y-2'>
                    <label className='label'>Prix unitaire</label>
                    <input
                      type='number'
                      min='0'
                      step='0.01'
                      value={item.unitPrice}
                      onChange={(event) => updateItem(index, 'unitPrice', Number(event.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                  {form.items.length > 1 && (
                    <button
                      type='button'
                      className='btn-ghost mt-7 justify-center px-3 py-2 text-xs font-medium text-[#ff453a] hover:bg-[rgba(255,69,58,0.14)]'
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className='h-4 w-4' />
                      Retirer
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className='space-y-2'>
          <label className='label' htmlFor='notes'>
            Notes / Conditions
          </label>
          <textarea
            id='notes'
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder='Conditions de paiement, message de remerciement…'
            className={`${textareaClass} ${isDrawer ? 'min-h-[120px]' : 'min-h-[140px]'} resize-none`}
            rows={3}
          />
        </section>

        <section className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
          <button type='button' onClick={resetForm} className='btn-ghost justify-center'>
            Réinitialiser
          </button>
          <button type='submit' disabled={isSubmitting} className='btn-primary justify-center'>
            {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer la facture'}
          </button>
        </section>
      </form>
    </div>
  )
}

export default InvoiceForm
