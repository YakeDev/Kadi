import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import InvoiceForm from '../components/InvoiceForm.jsx'
import { invoiceDraftKey } from '../utils/invoiceDraft.js'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  userId: 'account-a'
}))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../services/catalog.js', () => ({
  fetchCatalogItems: async () => ({ data: [] })
}))
vi.mock('../hooks/useAuth.jsx', () => ({
  useAuth: () => ({ user: { id: mocks.userId }, profile: { company: 'Test' } })
}))
const clients = [
  { id: 'client-a', company_name: 'Client A' },
  { id: 'client-b', company_name: 'Client B' }
]
const fillInvoice = () => {
  fireEvent.change(screen.getByLabelText('Intitulé de la prestation'), {
    target: { value: 'Prestation à conserver' }
  })
  fireEvent.change(screen.getByLabelText(/Prix unitaire/), {
    target: { value: '350' }
  })
  fireEvent.change(screen.getByLabelText('Notes et conditions de paiement'), {
    target: { value: 'Sous 7 jours' }
  })
}
beforeEach(() => {
  sessionStorage.clear()
  mocks.userId = 'account-a'
  mocks.post.mockReset()
  mocks.patch.mockReset()
})
afterEach(() => vi.restoreAllMocks())

test('refreshing the client list and selecting a newly created client preserves invoice fields', () => {
  const { rerender } = render(
    <InvoiceForm clients={clients} defaultClientId='client-a' variant='page' />
  )
  fillInvoice()
  rerender(
    <InvoiceForm
      clients={[clients[1], clients[0]]}
      defaultClientId='client-b'
      newClientId='client-b'
      variant='page'
    />
  )
  expect(screen.getByLabelText('Intitulé de la prestation')).toHaveValue(
    'Prestation à conserver'
  )
  expect(screen.getByLabelText(/Prix unitaire/)).toHaveValue(350)
  expect(screen.getByLabelText('Notes et conditions de paiement')).toHaveValue(
    'Sous 7 jours'
  )
  expect(
    JSON.parse(sessionStorage.getItem(invoiceDraftKey('account-a'))).form
      .client_id
  ).toBe('client-b')
})

test('the draft survives unmount and remount, including the selected client and tax', () => {
  const { unmount } = render(
    <InvoiceForm clients={clients} defaultClientId='client-b' variant='page' />
  )
  fillInvoice()
  fireEvent.change(screen.getByLabelText('Taxe optionnelle (%)'), {
    target: { value: '16' }
  })
  unmount()
  render(
    <InvoiceForm clients={clients} defaultClientId='client-a' variant='page' />
  )
  expect(screen.getByLabelText('Intitulé de la prestation')).toHaveValue(
    'Prestation à conserver'
  )
  expect(screen.getByLabelText(/Prix unitaire/)).toHaveValue(350)
  expect(screen.getByLabelText('Taxe optionnelle (%)')).toHaveValue(16)
  expect(screen.getByLabelText('Total de la facture')).toHaveTextContent(
    '406,00 USD'
  )
  expect(
    JSON.parse(sessionStorage.getItem(invoiceDraftKey('account-a'))).form
      .client_id
  ).toBe('client-b')
})

test('drafts are isolated per account and per saved invoice version', () => {
  const first = render(<InvoiceForm clients={clients} variant='page' />)
  fillInvoice()
  mocks.userId = 'account-b'
  first.rerender(<InvoiceForm clients={clients} variant='page' />)
  expect(screen.getByLabelText('Intitulé de la prestation')).toHaveValue('')
  first.unmount()
  mocks.userId = 'account-a'
  render(
    <InvoiceForm
      clients={clients}
      variant='page'
      invoice={{
        id: 'saved',
        version: 2,
        items: [{ description: 'Version serveur', quantity: 1, unitPrice: 25 }]
      }}
    />
  )
  expect(screen.getByLabelText('Intitulé de la prestation')).toHaveValue('Version serveur')
  expect(invoiceDraftKey('account-a', { id: 'saved', version: 1 })).not.toBe(
    invoiceDraftKey('account-a', { id: 'saved', version: 2 })
  )
})

test('a failed save preserves the draft and a successful save clears it', async () => {
  mocks.post
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({ data: { id: 'saved' } })
  const onCreated = vi.fn()
  const { container } = render(
    <InvoiceForm
      clients={clients}
      defaultClientId='client-a'
      variant='page'
      onCreated={onCreated}
    />
  )
  fillInvoice()
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Enregistrer la facture' })
    ).toBeEnabled()
  )
  expect(readStored().items[0].unitPrice).toBe(350)
  expect(onCreated).not.toHaveBeenCalled()
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
  expect(sessionStorage.getItem(invoiceDraftKey('account-a'))).toBeNull()
})

const readStored = () =>
  JSON.parse(sessionStorage.getItem(invoiceDraftKey('account-a'))).form

test('malformed local data falls back to an empty form', () => {
  sessionStorage.setItem(invoiceDraftKey('account-a'), '{broken')
  render(<InvoiceForm clients={clients} variant='page' />)
  expect(screen.getByLabelText('Intitulé de la prestation')).toHaveValue('')
})

test('blocked storage displays a warning and warns before a browser reload', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Unavailable')
  })
  render(<InvoiceForm clients={clients} variant='page' />)
  expect(
    await screen.findByText(/La sauvegarde dans cet onglet est indisponible/)
  ).toHaveAttribute('role', 'status')
  fillInvoice()
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
})
