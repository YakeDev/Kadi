import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'
import { useModalFocus } from '../hooks/useModalFocus.js'
import { formatInvoiceMoney as money } from '../utils/invoiceTotals.js'
import {
  paymentBalance,
  paymentDateToday,
  paymentMethods
} from '../utils/payments.js'
import Pagination from './Pagination.jsx'
import PaymentDateField from './PaymentDateField.jsx'
import { formatPaymentDate, parsePaymentDate } from '../utils/paymentDates.js'
import { downloadDocument } from '../utils/documentDownload.js'
import { showErrorToast } from '../utils/errorToast.js'

const dateLabel = (day) =>
  day
    ? new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', {
        timeZone: 'Africa/Lubumbashi'
      })
    : '—'
const errorMessage = (error) =>
  error?.response?.data?.message ||
  'Impossible de terminer cette opération. Actualisez l’historique avant de réessayer.'

const PaymentPanel = ({ invoice: initialInvoice, onClose, onUpdated }) => {
  const [invoice, setInvoice] = useState(initialInvoice)
  const [payments, setPayments] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1
  })
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    amount: '',
    paid_on: formatPaymentDate(paymentDateToday()),
    method: '',
    reference: ''
  })
  const [voidingId, setVoidingId] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const pending = useRef(false)
  const request = useRef(null)
  const loadVersion = useRef(0)
  const voidReasonRef = useRef(null)
  const prefix = useId()
  const panelRef = useModalFocus(true, () => {
    if (!pending.current) onClose()
  })
  const { paid, remaining } = paymentBalance(invoice)
  const currency = invoice.currency === '$' ? 'USD' : invoice.currency || 'USD'

  const load = useCallback(
    async (page = 1) => {
      const version = ++loadVersion.current
      setLoading(true)
      setError('')
      try {
        const [detail, history] = await Promise.all([
          api.get(`/invoices/${initialInvoice.id}`),
          api.get(`/invoices/${initialInvoice.id}/payments`, {
            params: { page, pageSize: 10 }
          })
        ])
        if (version !== loadVersion.current) return null
        setInvoice(detail.data)
        setPayments(history.data?.data ?? [])
        setPagination(
          history.data?.pagination ?? {
            page: 1,
            pageSize: 10,
            total: 0,
            totalPages: 1
          }
        )
        setReady(true)
        return history.data?.data ?? []
      } catch (loadError) {
        if (version === loadVersion.current) {
          setReady(false)
          setError(errorMessage(loadError))
        }
        return null
      } finally {
        if (version === loadVersion.current) setLoading(false)
      }
    },
    [initialInvoice.id]
  )

  useEffect(() => {
    load()
    return () => {
      loadVersion.current += 1
    }
  }, [load])

  useEffect(() => {
    if (voidingId) voidReasonRef.current?.focus()
  }, [voidingId])

  const savePayment = async (event) => {
    event.preventDefault()
    if (pending.current || loading || !ready) return
    const paidOn = parsePaymentDate(form.paid_on)
    if (!paidOn || paidOn > paymentDateToday()) {
      setError(
        'Indiquez une date de réception valide au format JJ/MM/AAAA, aujourd’hui ou dans le passé.'
      )
      return
    }
    const normalized = form.amount.trim().replace(',', '.')
    const amount = Number(normalized)
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(normalized) ||
      amount <= 0 ||
      Math.round(amount * 100) > Math.round(remaining * 100)
    ) {
      setError(
        'Indiquez un montant positif, avec deux décimales maximum, qui ne dépasse pas le solde restant.'
      )
      return
    }
    const payload = {
      ...form,
      paid_on: paidOn,
      amount,
      reference: form.reference.trim() || null
    }
    const signature = JSON.stringify(payload)
    if (request.current?.signature !== signature) {
      request.current = { signature, key: crypto.randomUUID() }
    }
    pending.current = true
    setSaving(true)
    setError('')
    let recorded = false
    try {
      await api.post(`/invoices/${invoice.id}/payments`, {
        ...payload,
        idempotency_key: request.current.key
      })
      recorded = true
      await load(1)
    } catch (saveError) {
      // A lost response can follow a committed receipt. Reconcile before retrying it.
      const history = await load(1)
      recorded = Boolean(
        history?.some((payment) => payment.id === request.current.key)
      )
      if (!recorded) setError(errorMessage(saveError))
    } finally {
      if (recorded) {
        request.current = null
        setForm((previous) => ({ ...previous, amount: '', reference: '' }))
        toast.success('Versement enregistré')
        onUpdated()
      }
      pending.current = false
      setSaving(false)
    }
  }

  const cancelPayment = async (event) => {
    event.preventDefault()
    if (pending.current || voidReason.trim().length < 3) return
    pending.current = true
    setSaving(true)
    setError('')
    let cancelled = false
    try {
      await api.post(`/invoices/${invoice.id}/payments/${voidingId}/void`, {
        reason: voidReason.trim()
      })
      cancelled = true
      await load(1)
    } catch (voidError) {
      const history = await load(1)
      cancelled = Boolean(
        history?.some(
          (payment) => payment.id === voidingId && payment.voided_at
        )
      )
      if (!cancelled) setError(errorMessage(voidError))
    } finally {
      if (cancelled) {
        setVoidingId(null)
        setVoidReason('')
        toast.success('Versement annulé ; solde recalculé')
        onUpdated()
      }
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-[rgba(15,23,42,0.45)]">
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${prefix}-title`}
        tabIndex={-1}
        className="native-edge-panel h-[100dvh] w-full max-w-xl overflow-y-auto bg-white shadow-xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 id={`${prefix}-title`} className="text-xl font-semibold">
              Versements
            </h2>
            <p className="mt-1 break-words text-sm text-[var(--text-muted)]">
              Facture {invoice.invoice_number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer les versements"
            className="btn-ghost h-10 w-10 shrink-0 p-2 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-6 p-5">
          {invoice.quote_number || invoice.po_reference ? <div className='space-y-1 break-words text-sm'>
            {invoice.quote_number ? <p>Devis d’origine : {invoice.quote_number}</p> : null}
            {invoice.po_reference ? <p>Référence PO : {invoice.po_reference}</p> : null}
          </div> : null}
          {invoice.pdf_available !== false ? <button type='button' className='btn-secondary min-h-11' onClick={async () => {
            try { await downloadDocument(`/invoices/pdf/${invoice.id}`,`facture-${invoice.invoice_number}.pdf`) }
            catch (error) { showErrorToast(toast.error,error) }
          }}>Télécharger la facture à jour</button> : null}
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-[var(--bg-panel)] p-4 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">
                Montant de la facture
              </dt>
              <dd className="mt-1 break-words font-semibold">
                {money(invoice.total_amount, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Déjà reçu</dt>
              <dd className="mt-1 break-words font-semibold">
                {money(paid, currency)}
              </dd>
            </div>
            <div className="col-span-2 border-t border-[var(--border)] pt-3">
              <dt>Reste à payer</dt>
              <dd className="mt-1 break-words text-2xl font-semibold text-[var(--primary)]">
                {money(remaining, currency)}
              </dd>
            </div>
          </dl>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
              <button
                type="button"
                onClick={() => load(pagination.page)}
                disabled={saving || loading}
                className="mt-2 block underline"
              >
                Actualiser l’historique
              </button>
            </div>
          ) : null}
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Actualisation des versements…
            </p>
          ) : null}
          {ready && remaining > 0 && invoice.status !== 'draft' ? (
            <form
              onSubmit={savePayment}
              className="space-y-4"
              aria-label="Enregistrer un versement"
            >
              <div>
                <h3 className="font-semibold">Ajouter un versement</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Enregistrez un paiement déjà reçu, dans la devise de cette
                  facture.
                </p>
              </div>
              <fieldset
                disabled={saving || loading}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <div>
                  <label htmlFor={`${prefix}-amount`} className="label">
                    Montant reçu ({currency})
                  </label>
                  <input
                    id={`${prefix}-amount`}
                    type="text"
                    inputMode="decimal"
                    required
                    pattern="\d+([.,]\d{1,2})?"
                    placeholder="0,00"
                    className="input mt-1 w-full"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        amount: event.target.value
                      }))
                    }
                  />
                </div>
                <PaymentDateField
                  id={`${prefix}-date`}
                  value={form.paid_on}
                  onChange={(paid_on) =>
                    setForm((previous) => ({ ...previous, paid_on }))
                  }
                />
                <div>
                  <label htmlFor={`${prefix}-method`} className="label">
                    Mode de paiement
                  </label>
                  <select
                    id={`${prefix}-method`}
                    required
                    className="input mt-1 w-full"
                    value={form.method}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        method: event.target.value
                      }))
                    }
                  >
                    <option value="">Choisir un mode</option>
                    {Object.entries(paymentMethods)
                      .filter(([key]) => key !== 'legacy')
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${prefix}-reference`} className="label">
                    Référence (facultatif)
                  </label>
                  <input
                    id={`${prefix}-reference`}
                    maxLength={160}
                    className="input mt-1 w-full"
                    value={form.reference}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reference: event.target.value
                      }))
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full sm:col-span-2"
                >
                  {saving ? 'Enregistrement…' : 'Enregistrer le versement'}
                </button>
              </fieldset>
            </form>
          ) : ready && remaining === 0 ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              Cette facture est soldée.
            </p>
          ) : null}
          <section aria-labelledby={`${prefix}-history`}>
            <h3 id={`${prefix}-history`} className="mb-3 font-semibold">
              Historique des versements ({pagination.total})
            </h3>
            {ready && payments.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Aucun versement enregistré.
              </p>
            ) : null}
            <ol className="space-y-3">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-lg border border-[var(--border)] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p
                        className={`font-semibold ${payment.voided_at ? 'line-through' : ''}`}
                      >
                        {money(payment.amount, payment.currency)}
                      </p>
                      <p className="mt-1 text-[var(--text-muted)]">
                        {dateLabel(payment.paid_on)} ·{' '}
                        {paymentMethods[payment.method] || payment.method}
                      </p>
                    </div>
                    {payment.voided_at ? (
                      <span className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
                        Annulé
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving || loading}
                        aria-label={`Annuler le versement de ${money(payment.amount, payment.currency)} du ${dateLabel(payment.paid_on)}`}
                        className="btn-ghost text-xs"
                        onClick={() => {
                          setVoidingId(payment.id)
                          setVoidReason('')
                        }}
                      >
                        Annuler la saisie
                      </button>
                    )}
                  </div>
                  {payment.reference ? (
                    <p className="mt-2 break-words text-[var(--text-muted)]">
                      {payment.reference}
                    </p>
                  ) : null}
                  {payment.is_legacy ? (
                    <p className="mt-2 text-xs text-amber-800">
                      Historique repris : ce montant provient de l’ancien statut
                      « Payée ».
                    </p>
                  ) : null}
                  {payment.voided_at ? (
                    <p className="mt-2 break-words text-red-800">
                      Motif : {payment.void_reason}
                    </p>
                  ) : null}
                  {voidingId === payment.id && !payment.voided_at ? (
                    <form
                      onSubmit={cancelPayment}
                      className="mt-3 space-y-2 border-t border-[var(--border)] pt-3"
                    >
                      <p className="text-xs text-[var(--text-muted)]">
                        Corrigez une erreur de saisie. Le versement restera
                        visible et le solde sera recalculé.
                      </p>
                      <label htmlFor={`${prefix}-void`} className="label">
                        Motif de l’annulation
                      </label>
                      <textarea
                        ref={voidReasonRef}
                        id={`${prefix}-void`}
                        required
                        minLength={3}
                        maxLength={500}
                        disabled={saving}
                        value={voidReason}
                        onChange={(event) => setVoidReason(event.target.value)}
                        className="input w-full"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={saving || loading}
                          className="btn-primary"
                        >
                          Confirmer l’annulation
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setVoidingId(null)}
                          className="btn-ghost"
                        >
                          Conserver le versement
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              ))}
            </ol>
            {ready && pagination.totalPages > 1 ? (
              <div className="mt-3">
                <Pagination
                  {...pagination}
                  onPageChange={load}
                  isLoading={loading || saving}
                />
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  )
}

export default PaymentPanel
