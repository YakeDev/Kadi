import { useEffect, useMemo, useRef, useState } from 'react'
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
import { getInvoiceTotals, getInvoiceLineTotals, formatInvoiceMoney } from '../utils/invoiceTotals.js'
import DiscountFields from './DiscountFields.jsx'
import { clearInvoiceDraft, invoiceDraftKey, readInvoiceDraft, writeInvoiceDraft } from '../utils/invoiceDraft.js'

const createEmptyItem = (currency = 'USD') => ({
  catalogItemId: null,
  description: '',
  quantity: 1,
  unitPrice: 0,
  currency,
  discountType: 'none',
  discountValue: 0
})

const statusOptions = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyée' },
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
      tax_rate: 0,
      discount_type: 'none',
      discount_value: 0,
      items: [createEmptyItem()]
    }
  }

  const items = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items.map((line) => ({
        catalogItemId: line.catalogItemId ?? line.catalog_item_id ?? null,
        description: line.description ?? '',
        quantity: Number(line.quantity ?? 1),
        unitPrice: Number(line.unitPrice ?? line.unit_price ?? 0),
        discountType: line.discountType || 'none',
        discountValue: Number(line.discountValue || 0),
        currency: (line.currency ?? invoice.currency) === '$' ? 'USD' : line.currency ?? invoice.currency ?? 'USD'
      }))
    : [createEmptyItem()]

  return {
    client_id: invoice.client_id ?? fallbackClientId ?? '',
    issue_date: invoice.issue_date ?? new Date().toISOString().slice(0, 10),
    due_date: invoice.due_date ?? '',
    status: invoice.status ?? 'draft',
    notes: invoice.notes ?? '',
    currency: invoice.currency === '$' ? 'USD' : invoice.currency || 'USD',
    tax_rate: Number(invoice.tax_rate || 0),
    discount_type: invoice.discount_type || 'none',
    discount_value: Number(invoice.discount_value || 0),
    items
  }
}

const InvoiceEditor = ({
  clients = [],
  onCreated,
  onUpdated,
  defaultClientId,
  newClientId,
  variant = 'card',
  invoice = null
}) => {
  const isDrawer = variant === 'drawer'
  const isFullPage = variant === 'page'
  const { profile: companyProfile, user } = useAuth()
  const draftKey = variant === 'page' ? invoiceDraftKey(user?.id, invoice) : null
  const skipDraftSave = useRef(false)
  const [form, setForm] = useState(() => readInvoiceDraft(draftKey) || normalizeInvoiceForForm(invoice, defaultClientId))
  const savedFormSignature = useRef(JSON.stringify(normalizeInvoiceForForm(invoice, defaultClientId)))
  const isDirty = JSON.stringify(form) !== savedFormSignature.current
  const [draftSaved, setDraftSaved] = useState(true)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [catalog, setCatalog] = useState([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)
  const [catalogPicker, setCatalogPicker] = useState({ open: false, index: null })
  const isEditing = Boolean(invoice?.id)

  useEffect(() => {
    if (!isEditing) {
      setForm((prev) => prev.client_id ? prev : { ...prev, client_id: defaultClientId || '' })
    }
  }, [defaultClientId, isEditing])

  useEffect(() => {
    if (newClientId) setForm((prev) => ({ ...prev, client_id: newClientId }))
  }, [newClientId])

  useEffect(() => {
    if (skipDraftSave.current) { skipDraftSave.current = false; return }
    if (draftKey) setDraftSaved(writeInvoiceDraft(draftKey, form))
  }, [draftKey, form])

  useEffect(() => {
    if (!draftKey || !isDirty) return
    const warnBeforeUnload = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [draftKey, isDirty])

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
    if (field === 'currency') {
      setForm((prev) => ({ ...prev, currency: value,
        discount_value: prev.discount_type === 'fixed' ? 0 : prev.discount_value,
        items: prev.items.map((item) => ({ ...item, currency: value, unitPrice: 0, catalogItemId: null,
          discountValue: item.discountType === 'fixed' ? 0 : item.discountValue })) }))
      toast('Devise modifiée. Ressaisissez les prix et remises fixes ; aucune conversion automatique.')
      return
    }
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const nextItems = prev.items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
      return { ...prev, items: nextItems }
    })
  }

  const applyCatalogSelection = (index, selected) => {
    if (selected && (selected.currency || 'USD') !== form.currency) {
      toast.error('Cet article utilise une autre devise. Choisissez un article dans la devise de la facture.')
      return
    }
    setForm((prev) => {
      const nextItems = prev.items.map((item, idx) => {
        if (idx !== index) return item
        if (!selected) {
          return { ...item, catalogItemId: null }
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
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem(prev.currency)] }))
  }

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }))
  }

  const resetForm = () => {
    clearInvoiceDraft(draftKey)
    const initial = normalizeInvoiceForForm(invoice, defaultClientId)
    savedFormSignature.current = JSON.stringify(initial)
    setForm(initial)
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
    const checked = getInvoiceTotals(form)
    if (checked.calculationError) {
      notifyError(checked.calculationError)
      return
    }
    setIsSubmitting(true)
    try {
      if (isEditing) {
        await api.patch(`/invoices/${invoice.id}`, form)
        savedFormSignature.current = JSON.stringify(form)
        skipDraftSave.current = true
        clearInvoiceDraft(draftKey)
        notifySuccess('Facture mise à jour')
        onUpdated?.()
      } else {
        await api.post('/invoices', form)
        skipDraftSave.current = true
        clearInvoiceDraft(draftKey)
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
        client_id: prev.client_id,
        currency: data.currency || prev.currency,
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
              currency: data.currency ?? prev.currency ?? 'USD'
            }))
          : prev.items
      }))
      notifySuccess('Brouillon préparé. Vérifiez chaque ligne avant de l’enregistrer.')
    } catch (error) {
      notifyError(error)
    } finally {
      setIsGenerating(false)
    }
  }

  const { total, currency, calculationError } = getInvoiceTotals(form)
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
        <form onSubmit={handleSubmit} className='min-w-0 space-y-5'>
          {draftKey ? <p className='text-sm text-[var(--text-muted)]' role='status'>{draftSaved ? 'Saisie conservée dans cet onglet. Enregistrez la facture avant de le fermer.' : 'La sauvegarde dans cet onglet est indisponible. Enregistrez la facture avant de quitter cette page.'}</p> : null}
          {isDrawer ? (
            <div className='space-y-2'>
              <label className='label' htmlFor='ia-prompt'>
                Décrire la facture (facultatif)
              </label>
              <div className='flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2'>
                <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)]'>
                  <Sparkles className='h-4 w-4' />
                </div>
                <input
                  maxLength={4000}
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
              {!isFullPage ? <div>
                <p className='text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]'>Factures</p>
                <h2 className='mt-2 text-2xl font-semibold text-[var(--text-dark)]'>
                  {isEditing ? 'Modifier la facture' : 'Nouvelle facture'}
                </h2>
                <p className='text-sm text-[var(--text-muted)]'>
                  {isEditing
                    ? 'Mettez à jour les informations avant validation.'
                    : 'Renseignez les éléments ci-dessous ou laissez Kadi IA préparer la facture.'}
                </p>
              </div> : null}
              <div className='w-full space-y-2'>
                <label className='label' htmlFor='ia-prompt'>
                  Décrire la facture (facultatif)
                </label>
                <div className='flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2'>
                  <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)]'>
                    <Sparkles className='h-4 w-4' />
                  </div>
                  <input
                    maxLength={4000}
                  id='ia-prompt'
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder='Décrivez votre facture…'
                    className='min-w-0 flex-1 bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
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
                <label className='label' htmlFor='invoice-currency'>Devise de la facture</label>
                <select id='invoice-currency' value={form.currency} onChange={(event) => updateField('currency', event.target.value)} className={inputClass}>
                  <option value='USD'>USD — Dollar américain</option>
                  <option value='CDF'>CDF — Franc congolais</option>
                </select>
                <p className='text-xs text-[var(--text-muted)]'>Changer de devise remet les prix à zéro.</p>
              </div>
              <div className='space-y-2'>
                <label className='label' htmlFor='invoice-tax-rate'>Taxe optionnelle (%)</label>
                <input id='invoice-tax-rate' type='number' min='0' max='100' step='0.01'
                  value={form.tax_rate} onChange={(event) => updateField('tax_rate', event.target.value)}
                  className={inputClass} aria-describedby='invoice-tax-help' />
                <p id='invoice-tax-help' className='text-xs text-[var(--text-muted)]'>Laissez 0 si aucune taxe ne s’applique.</p>
              </div>
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

          {form.status !== 'draft' ? <p className='text-sm text-[var(--text-muted)]'>Une facture émise est définitive : ses montants et coordonnées ne pourront plus être modifiés.</p> : null}

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
                const line = getInvoiceLineTotals(item)
                return (
                  <div
                    key={`invoice-item-${index}`}
                    className='grid min-w-0 grid-cols-2 gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] p-4 md:grid-cols-4'
                  >
                    <div className='col-span-2 min-w-0 space-y-2'>
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
                    <div className='col-span-2 min-w-0 space-y-2'>
                      <label htmlFor={`line-description-${index}`} className='label flex items-center gap-2'>
                        <FileText className='h-4 w-4 text-[var(--text-muted)]' />
                        Description
                      </label>
                      <input
                        id={`line-description-${index}`}
                        type='text'
                        value={item.description}
                        onChange={(event) => updateItem(index, 'description', event.target.value)}
                        placeholder='Prestation, produit, service…'
                        className={inputClass}
                        required
                      />
                    </div>
                    <div className='space-y-2'>
                      <label htmlFor={`line-quantity-${index}`} className='label block min-h-8'>Quantité</label>
                      <input
                        id={`line-quantity-${index}`}
                        type='number'
                        min='0.001' max='1000000' step='0.001'
                        value={item.quantity}
                        onChange={(event) => updateItem(index, 'quantity', Number(event.target.value) || 1)}
                        className={inputClass}
                      />
                    </div>
                    <div className='space-y-2'>
                      <label htmlFor={`line-price-${index}`} className='label block min-h-8'>Prix unitaire ({form.currency})</label>
                      <input
                        id={`line-price-${index}`}
                        type='number'
                        min='0'
                        step='0.01'
                        value={item.unitPrice}
                        onChange={(event) => updateItem(index, 'unitPrice', Number(event.target.value) || 0)}
                        className={inputClass}
                      />
                    </div>
                    <div className='col-span-2 min-w-0 space-y-2 md:col-span-4'>
                      <DiscountFields id={`line-discount-${index}`} label={`Remise de la ligne ${index + 1}`} currency={form.currency} type={item.discountType || 'none'} value={item.discountValue ?? 0} onChange={(discount) => setForm((prev) => ({ ...prev, items: prev.items.map((entry, idx) => idx === index ? { ...entry, discountType: discount.type, discountValue: discount.value } : entry) }))} />
                      <p className='text-sm font-semibold'>{line.calculationError ? line.calculationError : `Total de la ligne : ${formatInvoiceMoney(line.net, form.currency)}`}</p>
                    </div>
                    {form.items.length > 1 ? (
                      <button
                        type='button'
                        className='btn-ghost mt-7 justify-center px-3 py-2 text-xs font-medium text-[#b42318] hover:bg-[rgba(255,69,58,0.14)] md:col-span-2'
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className='h-4 w-4' />
                        Retirer
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title='Remise globale' description='Appliquée après les remises par ligne et avant la taxe éventuelle.' defaultOpen>
            <DiscountFields id='invoice-discount' label='Remise globale' currency={form.currency} type={form.discount_type || 'none'} value={form.discount_value ?? 0} onChange={(discount) => setForm((prev) => ({ ...prev, discount_type: discount.type, discount_value: discount.value }))} />
          </CollapsibleSection>
          {calculationError ? <p role='alert' className='rounded-lg bg-red-50 p-3 text-sm text-red-800'>{calculationError}</p> : null}

          <CollapsibleSection
            title='Notes & conditions'
            description='Ajoutez un message personnalisé ou vos conditions de paiement.'
          >
            <textarea
              id='notes'
              aria-label='Notes et conditions de paiement'
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
          id='invoice-preview'
          className={clsx('scroll-mt-24 lg:sticky lg:top-24', isFullPage && !isPreviewOpen && 'hidden lg:flex')}
          company={companyProfile}
          client={selectedClient}
          invoice={form}
        />
      </div>

      {isFullPage ? (
        <div className='fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-white px-4 py-3 shadow-lg lg:hidden'>
          <div><p className='text-xs text-[var(--text-muted)]'>Total de la facture</p><output aria-label='Total de la facture' aria-live='polite' className='text-lg font-semibold'>{calculationError ? 'À vérifier' : formatInvoiceMoney(total, currency)}</output></div>
          <button type='button' aria-expanded={isPreviewOpen} aria-controls='invoice-preview' className='btn-secondary' onClick={() => {
            setIsPreviewOpen((prev) => !prev)
            if (!isPreviewOpen) requestAnimationFrame(() => {
              const preview = document.getElementById('invoice-preview')
              preview?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              preview?.focus({ preventScroll: true })
            })
          }}>{isPreviewOpen ? 'Masquer l’aperçu' : 'Voir l’aperçu'}</button>
        </div>
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

const InvoiceForm = (props) => {
  const { user } = useAuth()
  const identity = `${user?.id || 'anonymous'}:${props.invoice?.id || 'new'}:${props.invoice?.version ?? props.invoice?.updated_at ?? '0'}`
  return <InvoiceEditor key={identity} {...props} />
}

export default InvoiceForm
