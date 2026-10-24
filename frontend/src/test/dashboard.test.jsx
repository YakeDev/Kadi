import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard.jsx'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../hooks/useAuth.jsx', () => ({
  useAuth: () => ({ user: { id: 'test' }, profile: { company: 'Entreprise' } })
}))
const summary = (count = 0) => ({
  totals: {
    invoiceCount: count,
    revenue: 0,
    outstanding: 0,
    averagePaymentDelay: null
  },
  charts: {},
  meta: {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.999Z'
  }
})
const respond = (url, count = 0, recent = []) =>
  Promise.resolve({
    data:
      url === '/invoices/summary'
        ? summary(count)
        : url === '/invoices'
          ? { data: recent }
          : { overdue: [], dueSoon: [], drafts: [] }
  })
const show = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  )
beforeEach(() => mocks.get.mockReset())

test('a new account gets one creation action and no repeated empty charts', async () => {
  mocks.get.mockImplementation((url) => respond(url))
  show()
  await screen.findByText('Votre première facture vous attend')
  expect(
    screen.getAllByRole('link', { name: 'Nouvelle facture' })
  ).toHaveLength(1)
  expect(
    screen.getByRole('link', { name: 'Nouvelle facture' })
  ).toHaveAttribute('href', '/factures/nouvelle')
  expect(
    screen.queryByLabelText('Graphiques de la période')
  ).not.toBeInTheDocument()
  expect(screen.queryByText(/Aucune donnée disponible/)).not.toBeInTheDocument()
})

test('an empty period for an existing account offers date selection, not first-invoice onboarding', async () => {
  mocks.get.mockImplementation((url) =>
    respond(url, 0, [
      { id: 'old', invoice_number: 'OLD', currency: 'USD', total_amount: 20 }
    ])
  )
  show()
  await screen.findByText('Aucune donnée sur cette période')
  expect(
    screen.queryByText('Votre première facture vous attend')
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Changer de période' }))
  expect(screen.getByLabelText('Du').closest('details')).toHaveAttribute('open')
  expect(screen.getByLabelText('Du')).toHaveFocus()
})

test('load failure stays visible without false-zero metrics and can be retried', async () => {
  mocks.get.mockRejectedValue(new Error('503'))
  show()
  await screen.findByText('Données indisponibles')
  expect(screen.queryByText('Revenus encaissés')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Votre première facture vous attend')
  ).not.toBeInTheDocument()
  mocks.get.mockImplementation((url) => respond(url))
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  await screen.findByText('Votre première facture vous attend')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an incomplete summary response is shown as unavailable instead of zero activity', async () => {
  mocks.get.mockResolvedValue({ data: { totals: {}, data: [] } })
  show()
  await screen.findByText('Données indisponibles')
  expect(screen.queryByText('Revenus encaissés')).not.toBeInTheDocument()
})

test('the inclusive end date agrees with the date input regardless of local time', async () => {
  mocks.get.mockImplementation((url) => respond(url))
  show()
  await screen.findByText('01/10/2026 – 31/10/2026')
  expect(screen.getByLabelText('Au, inclus')).toHaveValue('2026-10-31')
})

test('a retry preserves the requested custom range and currency', async () => {
  mocks.get.mockImplementation((url) => respond(url))
  show()
  await screen.findByText('Votre première facture vous attend')
  fireEvent.change(screen.getByLabelText('Du'), {
    target: { value: '2026-09-01' }
  })
  fireEvent.change(screen.getByLabelText('Au, inclus'), {
    target: { value: '2026-09-30' }
  })
  mocks.get.mockRejectedValue(new Error('503'))
  fireEvent.submit(screen.getByLabelText('Du').form)
  await screen.findByText('Données indisponibles')
  mocks.get.mockImplementation((url) => respond(url))
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  await screen.findByText('Votre première facture vous attend')
  expect(mocks.get).toHaveBeenLastCalledWith('/invoices/todo')
  expect(mocks.get).toHaveBeenCalledWith('/invoices/summary', {
    params: {
      period: 'month',
      currency: 'USD',
      start: '2026-09-01',
      end: '2026-09-30'
    }
  })
})

test('a late error from the previous currency does not replace the current results', async () => {
  let rejectPrevious
  mocks.get.mockImplementation((url, opts) =>
    url === '/invoices/summary' && opts?.params.currency === 'USD'
      ? new Promise((_, reject) => {
          rejectPrevious = reject
        })
      : respond(url)
  )
  show()
  fireEvent.change(screen.getByLabelText('Devise'), {
    target: { value: 'CDF' }
  })
  await screen.findByText('Votre première facture vous attend')
  await act(async () => {
    rejectPrevious(new Error('Late failure'))
  })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Devise')).toHaveValue('CDF')
  await waitFor(() =>
    expect(screen.getByText('Revenus encaissés')).toBeInTheDocument()
  )
})
