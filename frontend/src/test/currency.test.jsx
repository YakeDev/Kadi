import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InvoiceForm from '../components/InvoiceForm.jsx'
import InvoicePreview from '../components/InvoicePreview.jsx'
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../services/catalog.js', () => ({ fetchCatalogItems: async () => ({ data: [] }) }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ profile: { company: 'Entreprise' } }) }))
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
