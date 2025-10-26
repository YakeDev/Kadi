import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'

const createEmptyItem = () => ({ description: '', quantity: 1, unitPrice: 0 })

const InvoiceForm = ({ clients = [], onCreated, defaultClientId }) => {
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

  useEffect(() => {
    setForm((prev) => ({ ...prev, client_id: defaultClientId || '' }))
  }, [defaultClientId])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, items }
    })
  }

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }))
  }

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await api.post('/invoices', form)
      toast.success('Facture créée avec succès')
      resetForm()
      onCreated?.()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAIGenerate = async () => {
    if (!aiPrompt) {
      toast.error('Veuillez saisir une instruction texte pour l’IA.')
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
        status: data.status || 'draft',
        notes: data.notes || '',
        items: data.items?.length ? data.items : [createEmptyItem()]
      }))
      toast.success('Facture générée par IA')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
      <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
        <div>
          <h2 className='text-lg font-semibold text-nuit'>Nouvelle facture</h2>
          <p className='text-sm text-slate-500'>Renseignez les éléments ci-dessous ou générez-les via IA.</p>
        </div>
        <div className='flex flex-col gap-2 md:w-1/2'>
          <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Prompt IA</label>
          <div className='flex gap-2'>
            <input
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder='Ex. Crée une facture pour 10 cartons de jus à 8$ chacun pour Gocongo.'
              className='w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
            <button
              type='button'
              className='rounded-2xl bg-nuit px-4 py-2 text-sm font-semibold text-white transition hover:bg-nuit/90 disabled:cursor-not-allowed disabled:bg-slate-400'
              onClick={handleAIGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'IA…' : 'Générer'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className='mt-6 space-y-6'>
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Client</label>
            <select
              value={form.client_id}
              onChange={(event) => updateField('client_id', event.target.value)}
              className='rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
              required
            >
              <option value=''>Sélectionner un client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Émise le</label>
            <input
              type='date'
              value={form.issue_date}
              onChange={(event) => updateField('issue_date', event.target.value)}
              className='rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Échéance</label>
            <input
              type='date'
              value={form.due_date}
              onChange={(event) => updateField('due_date', event.target.value)}
              className='rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            />
          </div>
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-nuit'>Lignes de facturation</h3>
            <button
              type='button'
              onClick={addItem}
              className='text-sm font-medium text-accent hover:text-accent/80'
            >
              + Ajouter une ligne
            </button>
          </div>

          {form.items.map((item, index) => (
            <div
              key={`invoice-item-${index}`}
              className='grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[2fr,1fr,1fr,auto]'
            >
              <input
                type='text'
                value={item.description}
                onChange={(event) => updateItem(index, 'description', event.target.value)}
                placeholder='Description'
                className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
                required
              />
              <input
                type='number'
                min='1'
                value={item.quantity}
                onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))}
                className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
              />
              <input
                type='number'
                min='0'
                step='0.01'
                value={item.unitPrice}
                onChange={(event) => updateItem(index, 'unitPrice', Number(event.target.value))}
                className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
              />
              {form.items.length > 1 && (
                <button
                  type='button'
                  className='text-xs text-slate-400 hover:text-red-500'
                  onClick={() => removeItem(index)}
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>

        <div className='flex flex-col gap-2'>
          <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            placeholder='Conditions de paiement, message de remerciement…'
            className='rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
            rows={3}
          />
        </div>

        <div className='flex items-center justify-end gap-3'>
          <button
            type='reset'
            onClick={resetForm}
            className='rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-nuit'
          >
            Réinitialiser
          </button>
          <button
            type='submit'
            disabled={isSubmitting}
            className='rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-slate-400'
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer la facture'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default InvoiceForm
