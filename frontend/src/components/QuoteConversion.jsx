import { useRef, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import { formatInvoiceMoney } from '../utils/invoiceTotals.js'
import { paymentDateToday } from '../utils/payments.js'
import { formatPaymentDate, parsePaymentDate } from '../utils/paymentDates.js'
import PaymentDateField from './PaymentDateField.jsx'
import { useModalFocus } from '../hooks/useModalFocus.js'

const QuoteConversion = ({ quote, onClose, onConverted }) => {
  const [hasPo, setHasPo] = useState(false)
  const [hasPayment, setHasPayment] = useState(false)
  const [po, setPo] = useState('')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(formatPaymentDate(paymentDateToday()))
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [issueDate, setIssueDate] = useState(paymentDateToday())
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const keys = useRef({ invoice: crypto.randomUUID(), payment: crypto.randomUUID() })
  const panel = useModalFocus(true, () => { if (!saving) onClose() })
  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    setError('')
    const date = parsePaymentDate(paidOn)
    if (!hasPo && !hasPayment) { setError('Renseignez un acompte reçu ou une référence PO.'); return }
    if (hasPayment && (!date || date > paymentDateToday() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > Number(quote.total_amount))) {
      setError('Vérifiez la date et le montant reçu : l’acompte doit être positif et ne pas dépasser le total du devis.'); return
    }
    setSaving(true)
    try {
      const { data } = await api.post(`/quotes/${quote.id}/convert`, {
        idempotency_key: keys.current.invoice, version: quote.version, issue_date: issueDate, due_date: dueDate || null,
        po_reference: hasPo ? po.trim() : null,
        payment: hasPayment ? { idempotency_key: keys.current.payment, amount: Number(amount), paid_on: date, method, reference: reference.trim() || null } : null
      })
      toast.success('Devis converti. La facture et ses versements sont disponibles.')
      onConverted(data.invoice_id)
    } catch (failure) { showErrorToast(toast.error, failure); setError(failure.message || 'La conversion a échoué. Votre saisie est conservée.') }
    finally { setSaving(false) }
  }
  return <div className='fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-3'>
    <section ref={panel} role='dialog' aria-modal='true' aria-labelledby='quote-conversion-title' tabIndex={-1} className='max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5'>
      <header className='flex items-start justify-between gap-3'><div><h2 id='quote-conversion-title' className='text-xl'>Convertir en facture</h2><p className='mt-1 break-words text-sm text-[var(--text-muted)]'>{quote.quote_number} · {formatInvoiceMoney(quote.total_amount, quote.currency)}</p></div><button type='button' aria-label='Fermer la conversion' disabled={saving} onClick={onClose} className='btn-ghost min-h-11 min-w-11 justify-center p-2'><X aria-hidden='true' className='h-5 w-5' /></button></header>
      <p className='mt-4 rounded-lg bg-[var(--primary-soft)] p-3 text-sm'>Le devis restera consultable. Sa modification et son téléchargement seront désactivés. Une seule facture sera créée.</p>
      <form onSubmit={submit} className='mt-4 space-y-4'>
        <div className='grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2'>
          <label className='text-sm'>Date de facture<input type='date' required value={issueDate} onChange={e=>setIssueDate(e.target.value)} className='input mt-1 min-w-0' /></label>
          <label className='text-sm'>Échéance de paiement<input type='date' min={issueDate} value={dueDate} onChange={e=>setDueDate(e.target.value)} className='input mt-1 min-w-0' /></label>
        </div>
        <label className='flex min-h-11 items-center gap-3 text-sm'><input type='checkbox' checked={hasPo} onChange={e=>setHasPo(e.target.checked)} className='h-5 w-5' />PO reçu</label>
        {hasPo ? <label className='block text-sm'>Référence PO<input required maxLength={160} value={po} onChange={e=>setPo(e.target.value)} className='input mt-1' placeholder='Ex. PO-2026-0158' /></label> : null}
        <label className='flex min-h-11 items-center gap-3 text-sm'><input type='checkbox' checked={hasPayment} onChange={e=>setHasPayment(e.target.checked)} className='h-5 w-5' />Acompte reçu</label>
        {hasPayment ? <div className='space-y-3 rounded-lg border border-[var(--border)] p-3'>
          <label className='block text-sm'>Montant reçu ({quote.currency})<input type='number' min='0.01' max={quote.total_amount} step='0.01' required value={amount} onChange={e=>setAmount(e.target.value)} className='input mt-1' /></label>
          <PaymentDateField id='quote-payment-date' value={paidOn} onChange={setPaidOn} />
          <label className='block text-sm'>Mode de paiement<select value={method} onChange={e=>setMethod(e.target.value)} className='input mt-1'><option value='bank_transfer'>Virement bancaire</option><option value='cash'>Espèces</option><option value='mobile_money'>Mobile Money</option><option value='other'>Autre</option></select></label>
          <label className='block text-sm'>Référence du versement (facultatif)<input maxLength={160} value={reference} onChange={e=>setReference(e.target.value)} className='input mt-1' /></label>
        </div> : null}
        {error ? <p role='alert' className='text-sm text-red-800'>{error}</p> : null}
        <div className='sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[var(--border)] bg-white py-3'><button type='button' disabled={saving} onClick={onClose} className='btn-secondary min-h-11'>Annuler</button><button type='submit' disabled={saving || (!hasPo && !hasPayment)} className='btn-primary min-h-11 disabled:opacity-50'>{saving ? <Loader2 aria-hidden='true' className='h-4 w-4 animate-spin' /> : null}{saving ? 'Conversion…' : 'Créer la facture'}</button></div>
      </form>
    </section>
  </div>
}
export default QuoteConversion
