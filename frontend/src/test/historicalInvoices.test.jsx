import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import InvoiceList from '../components/InvoiceList.jsx'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  error: vi.fn()
}))
vi.mock('../services/api.js', () => ({
  api: { get: mocks.get, patch: mocks.patch }
}))
vi.mock('../utils/errorToast.js', () => ({ showErrorToast: mocks.error }))

const invoice = (number, overrides = {}) => ({
  id: number,
  invoice_number: number,
  status: 'sent',
  total_amount: 123,
  currency: 'USD',
  issue_date: '2026-10-01',
  client: { company_name: 'Client test' },
  ...overrides
})

beforeEach(() => {
  mocks.get.mockReset()
  mocks.patch.mockReset()
  mocks.error.mockReset()
})

test('historic invoices remain visible but cannot download an unreliable reconstructed PDF', async () => {
  mocks.get.mockResolvedValue({
    data: {
      data: [
        invoice('LEGACY', {
          pdf_available: false,
          pdf_unavailable_reason: 'historical_snapshot_missing'
        }),
        invoice('MODERN', { pdf_available: true })
      ],
      pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 }
    }
  })

  render(
    <MemoryRouter>
      <InvoiceList />
    </MemoryRouter>
  )
  await screen.findByText('Archive PDF non vérifiée')
  expect(screen.getByText('#LEGACY')).toBeInTheDocument()
  expect(screen.getByText('#MODERN')).toBeInTheDocument()
  const blocked = screen.getByRole('button', {
    name: /PDF indisponible pour la facture LEGACY/
  })
  const available = screen.getByRole('button', {
    name: /Télécharger la facture MODERN en PDF/
  })
  expect(blocked).toBeDisabled()
  expect(available).toBeEnabled()
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1))
})

test('status links filter the initial request and changing the filter updates requests', async () => {
  mocks.get.mockResolvedValue({
    data: {
      data: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
    }
  })
  render(
    <MemoryRouter initialEntries={['/factures?status=paid']}>
      <InvoiceList />
    </MemoryRouter>
  )
  await waitFor(() =>
    expect(mocks.get).toHaveBeenCalledWith('/invoices', {
      params: { page: 1, pageSize: 10, status: 'paid' }
    })
  )
  expect(
    screen.getByRole('button', { name: 'Payées', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(
    screen.getByRole('button', { name: 'Brouillons', exact: true })
  )
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/invoices', {
      params: { page: 1, pageSize: 10, status: 'draft' }
    })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Tous', exact: true }))
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/invoices', {
      params: { page: 1, pageSize: 10 }
    })
  )
})

test('a late response for the previous status cannot replace the current list', async () => {
  let resolvePaid
  mocks.get.mockImplementation((url, options) =>
    options.params.status === 'paid'
      ? new Promise((resolve) => {
          resolvePaid = resolve
        })
      : Promise.resolve({
          data: {
            data: [],
            pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
          }
        })
  )
  render(
    <MemoryRouter initialEntries={['/factures?status=paid']}>
      <InvoiceList />
    </MemoryRouter>
  )
  fireEvent.click(
    screen.getByRole('button', { name: 'Brouillons', exact: true })
  )
  await screen.findByText('Aucune facture enregistrée')
  await act(async () =>
    resolvePaid({
      data: {
        data: [invoice('OLD-PAID')],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      }
    })
  )
  expect(screen.queryByText('#OLD-PAID')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Brouillons', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
})
