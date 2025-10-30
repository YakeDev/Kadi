import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
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
  RefreshCcw,
  ChevronDown
} from 'lucide-react'
import { api } from '../services/api.js'
import { fetchCatalogItems } from '../services/catalog.js'
import { showErrorToast } from '../utils/errorToast.js'
import { useAuth } from '../hooks/useAuth.jsx'
import CollapsibleSection from './CollapsibleSection.jsx'
import ClientPickerModal from './ClientPickerModal.jsx'
import CatalogPickerModal from './CatalogPickerModal.jsx'
import InvoicePreview from './InvoicePreview.jsx'

const createEmptyItem = () => ({
  catalogItemId: null,
  description: '',
  quantity: 1,
  unitPrice: 0,
  currency: 'USD'
})

const statusOptions = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyée' },
  { value: 'paid', label: 'Payée' },
  { value: 'overdue', label: 'En retard' }
]

const normalizeInvoiceForForm = (invoice, fallbackClientId) => {
  if (!invoice) {
    return {
      client_id: fallbackClientId || '',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: '',
      status: 'draft',
      notes: '',
      currency: 'USD',
      items: [createEmptyItem()]
    }
  }

  const items = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items.map((line) => ({
        catalogItemId: line.catalogItemId ?? line.catalog_item_id ?? null,
        description: line.description ?? '',
        quantity: Number(line.quantity ?? 1),
        unitPrice: Number(line.unitPrice ?? line.unit_price ?? 0),
        currency: line.currency ?? invoice.currency ?? 'USD'
      }))
    : [createEmptyItem()]

  return {
    client_id: invoice.client_id ?? fallbackClientId ?? '',
    issue_date: invoice.issue_date ?? new Date().toISOString().slice(0, 10),
    due_date: invoice.due_date ?? '',
    status: invoice.status ?? 'draft',
    notes: invoice.notes ?? '',
    currency: invoice.currency || 'USD',
    items
  }
}

const InvoiceForm = ({
  clients = [],
  onCreated,
  onUpdated,
  defaultClientId,
  variant = 'card',
  invoice = null
}) => {
  const isDrawer = variant === 'drawer'
  const isFullPage = variant === 'page'
  const [form, setForm] = useState(() => normalizeInvoiceForForm(invoice, defaultClientId))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [catalog, setCatalog] = useState([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)
  const [catalogPicker, setCatalogPicker] = useState({ open: false, index: null })
  const isEditing = Boolean(invoice?.id)
  const { profile: companyProfile } = useAuth()

  useEffect(() => {
    if (!isEditing) {
      setForm((prev) => ({ ...prev, client_id: defaultClientId || '' }))
    }
  }, [defaultClientId, isEditing])

  useEffect(() => {
    setForm(normalizeInvoiceForForm(invoice, defaultClientId))
    setAiPrompt('')
  }, [invoice, defaultClientId])

  useEffect(() => {
    const loadCatalog = async () => {
      setIsCatalogLoading(true)
      try {
        const data = await fetchCatalogItems({ active: 'true' })
        setCatalog(data?.data ?? [])
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
      setCatalog(data?.data ?? [])
      toast.success('Catalogue mis à jour.')
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsCatalogLoading(false)
    }
  }

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) || null,
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

  const applyCatalogSelection = (index, selected) => {
    setForm((prev) => {
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
          currency: selected.currency || item.currency || prev.currency || 'USD'
        }
      })
      return { ...prev, items: nextItems }
    })
  }

  const handleCatalogPickerSelect = (catalogItem) => {
    if (catalogPicker.index == null) return
    applyCatalogSelection(catalogPicker.index, catalogItem)
    setCatalogPicker({ open: false, index: null })
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
    setForm(normalizeInvoiceForForm(null, defaultClientId))
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
      if (isEditing) {
        await api.patch(`/invoices/${invoice.id}`, form)
        notifySuccess('Facture mise à jour')
        onUpdated?.()
      } else {
        await api.post('/invoices', form)
        notifySuccess('Facture enregistrée avec succès')
        resetForm()
        onCreated?.()
      }
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
              currency: line.currency ?? prev.currency ?? 'USD'
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

  const inputClass = isDrawer ? 'input-compact' : 'input'
  const textareaClass = isDrawer ? 'textarea textarea-compact' : 'textarea'
  const layoutClass = isDrawer
    ? 'space-y-6'
    : clsx(
        'space-y-6',
        isFullPage && 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6'
      )

  return (
    <>
      <div className={layoutClass}>
        <form onSubmit={handleSubmit} className='space-y-5'>
          {isDrawer ? (
            <div className='space-y-2'>
              <label className='label' htmlFor='ia-prompt'>
                Prompt IA
              </label>
              <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2'>
                <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)]'>
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
                <h2 className='mt-2 text-2xl font-semibold text-[var(--text-dark)]'>
                  {isEditing ? 'Modifier la facture' : 'Nouvelle facture'}
                </h2>
                <p className='text-sm text-[var(--text-muted)]'>
                  {isEditing
                    ? 'Mettez à jour les informations avant validation.'
                    : 'Renseignez les éléments ci-dessous ou laissez Kadi IA préparer la facture.'}
                </p>
              </div>
              <div className='w-full max-w-md space-y-2'>
                <label className='label' htmlFor='ia-prompt'>
                  Prompt IA
                </label>
                <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2'>
                  <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)]'>
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

          <CollapsibleSection
            title='Client & échéances'
            description='Sélectionnez le client et définissez la période de facturation.'
            defaultOpen
            action={
              <button
                type='button'
                onClick={() => setIsClientPickerOpen(true)}
                className='btn-ghost h-9 px-3 text-xs font-semibold'
              >
                <Building2 className='mr-2 h-4 w-4' />
                Choisir un client
              </button>
            }
          >
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              <div className='space-y-2'>
                <p className='text-xs font-semibold text-[var(--text-muted)]'>Client</p>
                <button
                  type='button'
                  onClick={() => setIsClientPickerOpen(true)}
                  className='flex w-full items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-dark)] transition hover:border-[var(--primary)]'
                >
                  <span>{selectedClient?.company_name ?? 'Sélectionner un client'}</span>
                  <ChevronDown className='h-4 w-4 text-[var(--text-muted)]' />
                </button>
                {selectedClient ? (
                  <p className='text-xs text-[var(--text-muted)]'>
                    {[selectedClient.contact_name, selectedClient.email].filter(Boolean).join(' • ')}
                  </p>
                ) : (
                  <p className='text-xs text-[var(--text-muted)]'>Aucun client sélectionné.</p>
                )}
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
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title='Lignes de facturation'
            description='Ajoutez les prestations à facturer.'
            defaultOpen
            action={
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={refreshCatalog}
                  className='btn-ghost h-9 px-3 text-xs font-semibold'
                  disabled={isCatalogLoading}
                >
                  <RefreshCcw className={`mr-2 h-4 w-4 ${isCatalogLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
                <button type='button' onClick={addItem} className='btn-ghost h-9 px-3 text-xs font-semibold'>
                  <PlusCircle className='mr-2 h-4 w-4' />
                  Ajouter une ligne
                </button>
              </div>
            }
          >
            {catalog.length === 0 && !isCatalogLoading ? (
              <p className='rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--primary-soft)]/40 px-4 py-3 text-xs text-[var(--text-muted)]'>
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
                    className='grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 backdrop-blur md:grid-cols-[1.5fr,1.5fr,0.8fr,0.8fr,auto]'
                  >
                    <div className='space-y-2'>
                      <label className='label flex items-center gap-2'>
                        <PackageSearch className='h-4 w-4 text-[var(--text-muted)]' />
                        Article catalogue
                      </label>
                      <button
                        type='button'
                        onClick={() => setCatalogPicker({ open: true, index })}
                        className='flex w-full items-center justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-4 py-2 text-sm text-[var(--text-dark)] transition hover:border-[var(--primary)]'
                      >
                        <span>
                          {selectedCatalog?.name || (item.catalogItemId ? 'Article introuvable' : 'Choisir dans le catalogue')}
                        </span>
                        <ChevronDown className='h-4 w-4 text-[var(--text-muted)]' />
                      </button>
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
                    {form.items.length > 1 ? (
                      <button
                        type='button'
                        className='btn-ghost mt-7 justify-center px-3 py-2 text-xs font-medium text-[#ff453a] hover:bg-[rgba(255,69,58,0.14)]'
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className='h-4 w-4' />
                        Retirer
                      </button>
                    ) : (
                      <span className='mt-7 text-[11px] text-[var(--text-muted)]'>—</span>
                    )}
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title='Notes & conditions'
            description='Ajoutez un message personnalisé ou vos conditions de paiement.'
          >
            <textarea
              id='notes'
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder='Conditions de paiement, message de remerciement…'
              className={`${textareaClass} ${isDrawer ? 'min-h-[120px]' : 'min-h-[140px]'} resize-none`}
              rows={3}
            />
          </CollapsibleSection>

          <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-end'>
            <button type='button' onClick={resetForm} className='btn-ghost justify-center'>
              Réinitialiser
            </button>
            <button type='submit' disabled={isSubmitting} className='btn-primary justify-center'>
              {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
              {isSubmitting ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : 'Enregistrer la facture'}
            </button>
          </div>
        </form>

        <InvoicePreview
          className='hidden lg:flex lg:flex-col lg:sticky lg:top-24'
          company={companyProfile}
          client={selectedClient}
          invoice={form}
        />
      </div>

      {isDrawer ? (
        <InvoicePreview
          className='mt-6 flex lg:hidden'
          company={companyProfile}
          client={selectedClient}
          invoice={form}
        />
      ) : null}

      <ClientPickerModal
        isOpen={isClientPickerOpen}
        onClose={() => setIsClientPickerOpen(false)}
        onSelect={(client) => {
          updateField('client_id', client.id)
          setIsClientPickerOpen(false)
        }}
      />
      <CatalogPickerModal
        isOpen={catalogPicker.open}
        onClose={() => setCatalogPicker({ open: false, index: null })}
        onSelect={handleCatalogPickerSelect}
      />
    </>
  )
}

export default InvoiceForm
