import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Sparkles,
  PlusCircle,
  Save,
  Loader2,
  FileText,
  ChevronDown,
  Eye,
  X,
  UserPlus
} from 'lucide-react'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import { useAuth } from '../hooks/useAuth.jsx'
import ClientPickerModal from './ClientPickerModal.jsx'
import CatalogPickerModal from './CatalogPickerModal.jsx'
import InvoicePreview from './InvoicePreview.jsx'
import { getInvoiceTotals } from '../utils/invoiceTotals.js'
import InvoiceLineEditor from './InvoiceLineEditor.jsx'
import InvoiceSummary from './InvoiceSummary.jsx'
import { useModalFocus } from '../hooks/useModalFocus.js'
import './invoice-editor.css'
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
  onNewClient,
  defaultClientId,
  newClientId,
  variant = 'card',
  documentType = 'invoice',
  invoice = null
}) => {
  const isFullPage = variant === 'page'
  const isQuote = documentType === 'quote'
  const endpoint = isQuote ? '/quotes' : '/invoices'
  const { profile: companyProfile, user } = useAuth()
  const draftKey = variant === 'page' ? invoiceDraftKey(user?.id, invoice)?.replace('invoice-draft', isQuote ? 'quote-draft' : 'invoice-draft') : null
  const skipDraftSave = useRef(false)
  const [form, setForm] = useState(() => readInvoiceDraft(draftKey) || normalizeInvoiceForForm(invoice, defaultClientId))
  const savedFormSignature = useRef(JSON.stringify(normalizeInvoiceForForm(invoice, defaultClientId)))
  const isDirty = JSON.stringify(form) !== savedFormSignature.current
  const [draftSaved, setDraftSaved] = useState(true)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)
  const [catalogPicker, setCatalogPicker] = useState({ open: false, index: null })
  const isEditing = Boolean(invoice?.id)
  const [isAIOpen, setIsAIOpen] = useState(!isFullPage && !isQuote)
  const [isNotesOpen, setIsNotesOpen] = useState(Boolean(form.notes))
  const previewRef = useModalFocus(isPreviewOpen, () => setIsPreviewOpen(false))

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
    if ((catalogItem.currency || 'USD') !== form.currency) {
      toast.error('Cet article utilise une autre devise. Choisissez un article dans la devise de la facture.')
      return
    }
    const emptyIndex = form.items.findIndex((item) => !item.catalogItemId && !item.description.trim() && !Number(item.unitPrice))
    const targetIndex = catalogPicker.index ?? (emptyIndex >= 0 ? emptyIndex : null)
    if (targetIndex != null) {
      applyCatalogSelection(targetIndex, catalogItem)
    } else {
      setForm((prev) => ({ ...prev, items: [...prev.items, {
        ...createEmptyItem(prev.currency),
        catalogItemId: catalogItem.id,
        description: catalogItem.description || catalogItem.name,
        unitPrice: Number(catalogItem.unit_price || 0)
      }] }))
    }
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

  const quotePayload = () => {
    const { due_date, ...payload } = form
    return { ...payload, valid_until: due_date || null, ...(isEditing ? { version: invoice.version } : {}) }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    const checked = getInvoiceTotals(form)
    if (checked.calculationError) {
      notifyError(checked.calculationError)
      return
    }
    setIsSubmitting(true)
    try {
      if (isEditing) {
        await api.patch(`${endpoint}/${invoice.id}`, isQuote ? quotePayload() : form)
        savedFormSignature.current = JSON.stringify(form)
        skipDraftSave.current = true
        clearInvoiceDraft(draftKey)
        notifySuccess(isQuote ? 'Devis mis à jour' : 'Facture mise à jour')
        onUpdated?.()
      } else {
        await api.post(endpoint, isQuote ? quotePayload() : form)
        skipDraftSave.current = true
        clearInvoiceDraft(draftKey)
        notifySuccess(isQuote ? 'Devis enregistré avec succès' : 'Facture enregistrée avec succès')
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
        discount_value: data.currency && data.currency !== prev.currency && prev.discount_type === 'fixed' ? 0 : prev.discount_value,
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

  const totals = getInvoiceTotals(form)
  const { calculationError } = totals

  return (
    <>
      <form onSubmit={handleSubmit} className='invoice-editor'>
        <header className='invoice-editor-toolbar'>
          <div className='invoice-editor-title'>
            {isFullPage ? <h1>{isQuote ? (isEditing ? 'Modifier le devis' : 'Nouveau devis') : (isEditing ? 'Modifier la facture' : 'Nouvelle facture')}</h1> : <h2>{isQuote ? (isEditing ? 'Modifier le devis' : 'Nouveau devis') : (isEditing ? 'Modifier la facture' : 'Nouvelle facture')}</h2>}
            <span className='invoice-editor-badge'>{form.status === 'draft' ? 'Brouillon' : isQuote ? 'Envoyé' : 'À émettre'}</span>
          </div>
          <div className='invoice-editor-actions'>
            <button type='button' className='btn-secondary' aria-haspopup='dialog' onClick={() => setIsPreviewOpen(true)}>
              <Eye aria-hidden='true' className='h-4 w-4' />Aperçu
            </button>
            <button type='submit' aria-label={isSubmitting ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : `Enregistrer ${isQuote ? 'le devis' : 'la facture'}`} disabled={isSubmitting || isGenerating || Boolean(calculationError)} className='btn-primary'>
              {isSubmitting ? <Loader2 aria-hidden='true' className='h-4 w-4 animate-spin' /> : <Save aria-hidden='true' className='h-4 w-4' />}
              {isSubmitting ? 'Enregistrement…' : isEditing ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        </header>

        <section className='invoice-editor-meta' aria-label={`Client et dates du document`}>
          <div className='invoice-editor-client'>
            <div className='invoice-editor-client-label'>
              <label htmlFor='invoice-client'>Client</label>
              {onNewClient ? <button type='button' onClick={onNewClient} className='invoice-text-action'><UserPlus aria-hidden='true' className='h-3.5 w-3.5' />Nouveau client</button> : null}
            </div>
            <button id='invoice-client' type='button' onClick={() => setIsClientPickerOpen(true)} className='input invoice-client-picker'>
              <span>{selectedClient?.company_name ?? 'Sélectionner un client'}</span>
              <ChevronDown aria-hidden='true' className='h-4 w-4 shrink-0' />
            </button>
          </div>
          <div><label htmlFor='issue-date'>{isQuote ? 'Émis le' : 'Émise le'}</label><input id='issue-date' type='date' value={form.issue_date} onChange={(event) => updateField('issue_date', event.target.value)} className='input' required /></div>
          <div><label htmlFor='due-date'>{isQuote ? 'Valable jusqu’au' : 'Échéance'}</label><input id='due-date' type='date' value={form.due_date} onChange={(event) => updateField('due_date', event.target.value)} className='input' /></div>
          <div><label htmlFor='invoice-currency'>Devise de la facture</label><select id='invoice-currency' value={form.currency} onChange={(event) => updateField('currency', event.target.value)} className='input' aria-describedby='invoice-currency-help'><option value='USD'>USD</option><option value='CDF'>CDF</option></select></div>
        </section>
        <p id='invoice-currency-help' className='invoice-editor-hint'>Changer de devise remet les prix et les remises fixes à zéro.</p>

        <div className='invoice-editor-content'>
          <div className='invoice-editor-entry'>
            <section className='invoice-lines-panel' aria-labelledby='invoice-lines-title'>
              <div className='invoice-lines-heading'>
                <h2 id='invoice-lines-title'>Prestations <span>{form.items.length} ligne{form.items.length > 1 ? 's' : ''}</span></h2>
                <button type='button' hidden={isQuote} className='invoice-text-action' aria-expanded={isAIOpen} aria-controls='invoice-ai' onClick={() => setIsAIOpen((prev) => !prev)}><Sparkles aria-hidden='true' className='h-4 w-4' />Aide IA</button>
              </div>
              <div id='invoice-ai' className='invoice-ai' hidden={!isAIOpen}>
                <label htmlFor='ia-prompt'>Décrire la facture (facultatif)</label>
                <textarea id='ia-prompt' maxLength={4000} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder='Décrivez votre facture…' className='textarea' rows={2} />
                <button type='button' className='btn-secondary' onClick={handleAIGenerate} disabled={isGenerating || isSubmitting}>
                  {isGenerating ? <Loader2 aria-hidden='true' className='h-4 w-4 animate-spin' /> : <Sparkles aria-hidden='true' className='h-4 w-4' />}
                  {isGenerating ? 'Génération…' : 'Générer via IA'}
                </button>
              </div>
              <div className='invoice-line-columns' aria-hidden='true'><span>Description</span><span>Qté</span><span>Prix unitaire</span><span>Remise</span><span>Montant net</span><span /></div>
              {form.items.map((item, index) => <InvoiceLineEditor key={`invoice-item-${index}`} item={item} index={index} currency={form.currency}
                canRemove={form.items.length > 1} onChange={(field, value) => updateItem(index, field, value)}
                onDiscountChange={(discount) => setForm((prev) => ({ ...prev, items: prev.items.map((entry, idx) => idx === index ? { ...entry, discountType: discount.type, discountValue: discount.value } : entry) }))}
                onCatalog={() => setCatalogPicker({ open: true, index })} onRemove={() => removeItem(index)} />)}
              <div className='invoice-lines-footer'>
                <button type='button' onClick={addItem} className='invoice-text-action'><PlusCircle aria-hidden='true' className='h-4 w-4' />Ajouter une ligne</button>
                <button type='button' onClick={() => setCatalogPicker({ open: true, index: null })} className='invoice-text-action'><FileText aria-hidden='true' className='h-4 w-4' />Depuis le catalogue</button>
              </div>
            </section>
            <details className='invoice-secondary invoice-notes' open={isNotesOpen} onToggle={(event) => setIsNotesOpen(event.currentTarget.open)}>
              <summary>Notes et conditions de paiement</summary>
              <textarea id='notes' aria-label='Notes et conditions de paiement' value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder='Conditions de paiement, message de remerciement…' className='textarea' rows={3} />
            </details>
            {draftKey ? <p className='invoice-editor-hint' role='status'>{draftSaved ? 'Saisie conservée dans cet onglet. Enregistrez le document avant de le fermer.' : 'La sauvegarde dans cet onglet est indisponible. Enregistrez le document avant de quitter cette page.'}</p> : null}
            <button type='button' onClick={resetForm} className='invoice-reset'>Réinitialiser la saisie</button>
          </div>
          <div className='invoice-editor-summary'>
            <InvoiceSummary documentType={documentType} form={form} totals={totals} onChange={updateField} onDiscountChange={(discount) => setForm((prev) => ({ ...prev, discount_type: discount.type, discount_value: discount.value }))} />
            {calculationError ? <p role='alert' className='invoice-calculation-error'>{calculationError}</p> : null}
          </div>
        </div>
      </form>

      {isPreviewOpen ? <div className='invoice-preview-overlay'>
        <div ref={previewRef} role='dialog' aria-modal='true' aria-labelledby='invoice-preview-title' tabIndex={-1} className='invoice-preview-dialog'>
          <header><h2 id='invoice-preview-title'>Aperçu {isQuote ? 'du devis' : 'de la facture'}</h2><button type='button' className='btn-secondary' aria-label='Fermer l’aperçu' onClick={() => setIsPreviewOpen(false)}><X aria-hidden='true' className='h-4 w-4' /><span>Fermer</span></button></header>
          <InvoicePreview documentType={documentType} company={companyProfile} client={selectedClient} invoice={isQuote ? { ...form, quote_number: invoice?.quote_number } : form} maxItems={Infinity} />
        </div>
      </div> : null}
      <ClientPickerModal isOpen={isClientPickerOpen} onClose={() => setIsClientPickerOpen(false)} onSelect={(client) => { updateField('client_id', client.id); setIsClientPickerOpen(false) }} />
      <CatalogPickerModal isOpen={catalogPicker.open} onClose={() => setCatalogPicker({ open: false, index: null })} onSelect={handleCatalogPickerSelect} />
    </>
  )
}

const InvoiceForm = (props) => {
  const { user } = useAuth()
  const identity = `${props.documentType || 'invoice'}:${user?.id || 'anonymous'}:${props.invoice?.id || 'new'}:${props.invoice?.version ?? props.invoice?.updated_at ?? '0'}`
  return <InvoiceEditor key={identity} {...props} />
}

export default InvoiceForm
