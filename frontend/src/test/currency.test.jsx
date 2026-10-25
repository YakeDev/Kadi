import { test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InvoiceForm from '../components/InvoiceForm.jsx'
import InvoicePreview from '../components/InvoicePreview.jsx'
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../services/catalog.js', () => ({ fetchCatalogItems: async () => ({ data: [] }) }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ profile: { company: 'Entreprise' } }) }))
beforeEach(() => mocks.post.mockReset())
test('the only currency choices are USD and CDF and optional tax is included in the preview and payload', async () => {
  mocks.post.mockResolvedValue({ data: {} })
  const { container } = render(<InvoiceForm invoice={{ status: 'draft', currency: '$', tax_rate: 16,
    items: [{ description: 'Article', currency: '$', quantity: 1, unitPrice: 100 }] }} />)
  const currency = screen.getByLabelText('Devise de la facture')
  expect([...currency.options].map((option) => option.value)).toEqual(['USD', 'CDF'])
  expect(currency.value).toBe('USD')
  expect(screen.getByText('Taxe (16 %)')).toBeInTheDocument()
  expect(screen.getByText(/116,00/)).toBeInTheDocument()
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() => expect(mocks.post).toHaveBeenCalled())
  expect(mocks.post.mock.calls[0][1]).toMatchObject({ currency: 'USD', tax_rate: 16,
    items: [expect.objectContaining({ currency: 'USD', unitPrice: 100 })] })
})
test('issued preview retains recorded totals and accepts a legacy dollar label', () => {
  render(<InvoicePreview invoice={{ status: 'sent', currency: '$', subtotal_amount: 100, tax_rate: 16,
    tax_amount: 15, total_amount: 115, items: [] }} />)
  expect(screen.getByText(/115,00/, { selector: 'p' })).toBeInTheDocument()
  expect(screen.getByText(/^15,00/)).toBeInTheDocument()
  expect(screen.queryByText(/116,00/)).toBeNull()
})
test('preview uses the invoice currency consistently', () => {
  render(<InvoicePreview invoice={{ currency: 'CDF', items: [{ description: 'Article', currency: 'USD', quantity: 1, unitPrice: 10 }] }} />)
  expect(screen.queryByText(/\$US/)).toBeNull()
  expect(screen.getAllByText(/CDF/).length).toBeGreaterThan(0)
})
test('changing invoice currency clears old prices and the submitted lines all use it', async () => {
  mocks.post.mockResolvedValue({ data: {} })
  const { container } = render(<InvoiceForm invoice={{ client_id: '', status: 'draft', currency: 'USD', items: [{ description: 'Article', quantity: 1, unitPrice: 10 }] }} />)
  fireEvent.change(screen.getByLabelText('Devise de la facture'), { target: { value: 'CDF' } })
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() => expect(mocks.post).toHaveBeenCalled())
  const body = mocks.post.mock.calls[0][1]
  expect(body.currency).toBe('CDF')
  expect(body.items[0].unitPrice).toBe(0)
  expect(body.items[0].currency).toBe('CDF')
})
