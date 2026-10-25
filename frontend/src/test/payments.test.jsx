import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PaymentPanel from '../components/PaymentPanel.jsx'
import InvoicePreview from '../components/InvoicePreview.jsx'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  success: vi.fn()
}))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('react-hot-toast', () => ({ default: { success: mocks.success } }))
let invoice
let payments
let updated
const initial = () => ({
  id: 'invoice-one',
  invoice_number: 'FAC-001',
  status: 'sent',
  currency: 'USD',
  total_amount: 350,
  paid_amount: 0,
  balance_due: 350,
  items: [{ description: 'Service', quantity: 1, unitPrice: 350 }]
})

beforeEach(() => {
  vi.clearAllMocks()
  invoice = initial()
  payments = []
  updated = vi.fn()
  mocks.get.mockImplementation(async (url, config) => {
    if (url.endsWith('/payments')) {
      const page = config?.params?.page || 1
      return {
        data: {
          data: structuredClone(payments.slice((page - 1) * 10, page * 10)),
          pagination: {
            page,
            pageSize: 10,
            total: payments.length,
            totalPages: Math.max(1, Math.ceil(payments.length / 10))
          }
        }
      }
    }
    return { data: structuredClone(invoice) }
  })
  mocks.post.mockImplementation(async (url, payload) => {
    if (url.endsWith('/void')) {
      const id = url.split('/').at(-2)
      payments = payments.map((payment) =>
        payment.id === id
          ? {
              ...payment,
              voided_at: new Date().toISOString(),
              void_reason: payload.reason
            }
          : payment
      )
    } else {
      payments.unshift({
        id: payload.idempotency_key,
        amount: payload.amount,
        currency: invoice.currency,
        paid_on: payload.paid_on,
        method: payload.method,
        reference: payload.reference
      })
    }
    invoice.paid_amount = payments
      .filter((payment) => !payment.voided_at)
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
    invoice.balance_due = invoice.total_amount - invoice.paid_amount
    invoice.status =
      invoice.balance_due === 0
        ? 'paid'
        : invoice.paid_amount > 0
          ? 'partially_paid'
          : 'sent'
    return { data: { id: payload.idempotency_key } }
  })
})
const mount = () =>
  render(
    <PaymentPanel invoice={invoice} onClose={vi.fn()} onUpdated={updated} />
  )
const fillReceipt = async (amount = '150') => {
  const amountField = await screen.findByLabelText('Montant reçu (USD)')
  fireEvent.change(amountField, { target: { value: amount } })
  fireEvent.change(screen.getByLabelText('Date de réception'), {
    target: { value: '05/01/2026' }
  })
  fireEvent.change(screen.getByLabelText('Mode de paiement'), {
    target: { value: 'cash' }
  })
}
const submitReceipt = () =>
  fireEvent.submit(
    screen.getByRole('form', { name: 'Enregistrer un versement' })
  )

test('a partial receipt, final settlement and correction update the visible balance and keep payment history', async () => {
  mount()
  await fillReceipt()
  submitReceipt()
  await screen.findByText('200,00 USD')
  expect(updated).toHaveBeenCalledTimes(1)
  expect(screen.getByText('150,00 USD', { selector: 'dd' })).toBeInTheDocument()
  await fillReceipt('200')
  submitReceipt()
  await screen.findByText('Cette facture est soldée.')
  expect(screen.queryByLabelText('Montant reçu (USD)')).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: /Annuler le versement de 200/ })
  )
  const reason = screen.getByLabelText('Motif de l’annulation')
  expect(reason).toHaveFocus()
  fireEvent.change(reason, { target: { value: 'Double saisie' } })
  fireEvent.submit(reason.closest('form'))
  await screen.findByLabelText('Montant reçu (USD)')
  expect(screen.getByText('200,00 USD', { selector: 'dd' })).toBeInTheDocument()
  expect(screen.getByText('Annulé')).toBeInTheDocument()
  expect(screen.getByText('Motif : Double saisie')).toBeInTheDocument()
  expect(updated).toHaveBeenCalledTimes(3)
})

test('French decimal input is normalized and excessive receipts never reach the API', async () => {
  mount()
  await fillReceipt('350,01')
  submitReceipt()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'ne dépasse pas le solde'
  )
  expect(mocks.post).not.toHaveBeenCalled()
  await fillReceipt('150,25')
  submitReceipt()
  await waitFor(() =>
    expect(mocks.post).toHaveBeenCalledWith(
      '/invoices/invoice-one/payments',
      expect.objectContaining({
        amount: 150.25,
        method: 'cash',
        paid_on: '2026-01-05'
      })
    )
  )
  await screen.findByText('199,75 USD')
})

test('a network failure retains input and reuses the same idempotency key on retry', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Lost connection'))
  mount()
  await fillReceipt()
  submitReceipt()
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(screen.getByLabelText('Montant reçu (USD)')).toHaveValue('150')
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Enregistrer le versement' })
    ).toBeEnabled()
  )
  submitReceipt()
  await screen.findByText('200,00 USD')
  expect(mocks.post.mock.calls[0][1].idempotency_key).toBe(
    mocks.post.mock.calls[1][1].idempotency_key
  )
  expect(updated).toHaveBeenCalledTimes(1)
})

test('a lost response after commit is reconciled from history without a duplicate receipt', async () => {
  mocks.post.mockImplementationOnce(async (_url, payload) => {
    payments.push({
      id: payload.idempotency_key,
      amount: 150,
      currency: 'USD',
      paid_on: '2026-01-05',
      method: 'cash'
    })
    invoice = {
      ...invoice,
      paid_amount: 150,
      balance_due: 200,
      status: 'partially_paid'
    }
    throw new Error('Response lost after commit')
  })
  mount()
  await fillReceipt()
  submitReceipt()
  await screen.findByText('200,00 USD')
  await waitFor(() => expect(updated).toHaveBeenCalledTimes(1))
  expect(mocks.post).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Montant reçu (USD)')).toHaveValue('')
})

test('history loading errors block receipt entry and can be retried', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Offline'))
  mount()
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('Montant reçu (USD)')).not.toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'Actualiser l’historique' })
  )
  await screen.findByLabelText('Montant reçu (USD)')
})

test('invalid or future receipt dates retain the entry and never reach the API', async () => {
  mount()
  await fillReceipt()
  for (const date of ['31/02/2026', '01/01/2099', 'date inconnue']) {
    fireEvent.change(screen.getByLabelText('Date de réception'), {
      target: { value: date }
    })
    submitReceipt()
    expect(await screen.findByRole('alert')).toHaveTextContent('JJ/MM/AAAA')
    expect(mocks.post).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Date de réception')).toHaveValue(date)
  }
  fireEvent.change(screen.getByLabelText('Date de réception'), {
    target: { value: '05/01/2026' }
  })
  submitReceipt()
  await screen.findByText('200,00 USD')
  expect(mocks.post).toHaveBeenCalledWith(
    '/invoices/invoice-one/payments',
    expect.objectContaining({ paid_on: '2026-01-05' })
  )
})

test('legacy settlements are explicitly identified and history is paginated', async () => {
  invoice = { ...invoice, status: 'paid', paid_amount: 350, balance_due: 0 }
  payments = Array.from({ length: 11 }, (_, index) => ({
    id: String(index),
    amount: 1,
    currency: 'USD',
    paid_on: '2026-01-05',
    method: 'legacy',
    is_legacy: true,
    reference: `Ancien ${index}`
  }))
  mount()
  await screen.findByText('Historique des versements (11)')
  expect(screen.getAllByText(/Historique repris/)).toHaveLength(10)
  fireEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  await screen.findByText('Ancien 10')
  expect(screen.getAllByText(/Historique repris/)).toHaveLength(1)
})

test('Escape closes the panel and focus returns to its opener after unmount', async () => {
  const opener = document.createElement('button')
  document.body.appendChild(opener)
  opener.focus()
  const close = vi.fn()
  const { unmount } = render(
    <PaymentPanel invoice={invoice} onClose={close} onUpdated={updated} />
  )
  await screen.findByLabelText('Montant reçu (USD)')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(close).toHaveBeenCalledOnce()
  unmount()
  expect(opener).toHaveFocus()
  expect(document.body.style.overflow).not.toBe('hidden')
  opener.remove()
})

test('invoice preview preserves the full amount while showing receipts and balance', () => {
  render(
    <InvoicePreview
      invoice={{ ...initial(), status: 'partially_paid', paid_amount: 150 }}
      company={{ company: 'Atelier Démo' }}
      client={{ company_name: 'Client Démo' }}
    />
  )
  expect(screen.getByText('Partiellement payée')).toBeInTheDocument()
  expect(screen.getByText('150,00 USD', { selector: 'dd' })).toBeInTheDocument()
  expect(screen.getByText('200,00 USD', { selector: 'dd' })).toBeInTheDocument()
})
