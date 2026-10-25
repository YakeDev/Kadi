import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import InvoiceForm from '../components/InvoiceForm.jsx'

const mocks = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../services/catalog.js', () => ({ fetchCatalogItems: async () => ({ data: [] }) }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ user: { id: 'discount-user' }, profile: { company: 'Entreprise' } }) }))
const invoice = () => ({ status: 'draft', currency: 'USD', tax_rate: 16, items: [
  { description: 'Conception', quantity: 2, unitPrice: 100 },
  { description: 'Conseil', quantity: 1, unitPrice: 50 }
] })
beforeEach(() => { mocks.post.mockReset(); mocks.post.mockResolvedValue({ data: {} }); sessionStorage.clear() })
const selectDiscount = (label, type, value) => {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: type } })
  fireEvent.change(screen.getByLabelText(`${label} (${type === 'percent' ? '%' : 'USD'})`, { exact: true }), { target: { value: String(value) } })
}

test('line and global discounts change the preview and the submitted invoice before optional tax', async () => {
  const { container } = render(<InvoiceForm invoice={invoice()} />)
  selectDiscount('Remise de la ligne 1', 'percent', 10)
  selectDiscount('Remise de la ligne 2', 'fixed', 5)
  selectDiscount('Remise globale', 'fixed', 25)
  const preview = within(screen.getByRole('complementary', { name: 'Aperçu de la facture' }))
  expect(preview.getByText('232,00 USD')).toBeInTheDocument()
  expect(preview.getByText('Net avant taxe')).toBeInTheDocument()
  expect(preview.getByText('32,00 USD')).toBeInTheDocument()
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() => expect(mocks.post).toHaveBeenCalled())
  expect(mocks.post.mock.calls[0][1]).toMatchObject({ discount_type: 'fixed', discount_value: 25,
    items: [expect.objectContaining({ discountType: 'percent', discountValue: 10 }), expect.objectContaining({ discountType: 'fixed', discountValue: 5 })] })
})

test('a discount larger than the remaining base is kept for correction and never submitted', () => {
  const { container } = render(<InvoiceForm invoice={invoice()} />)
  selectDiscount('Remise globale', 'fixed', 251)
  expect(screen.getByRole('alert')).toHaveTextContent('dépasser')
  fireEvent.submit(container.querySelector('form'))
  expect(mocks.post).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Remise globale (USD)')).toHaveValue(251)
})

test('changing currency resets monetary discounts and preserves percentage discounts', () => {
  render(<InvoiceForm invoice={invoice()} />)
  selectDiscount('Remise de la ligne 1', 'fixed', 10)
  selectDiscount('Remise de la ligne 2', 'percent', 5)
  selectDiscount('Remise globale', 'fixed', 25)
  fireEvent.change(screen.getByLabelText('Devise de la facture'), { target: { value: 'CDF' } })
  expect(screen.getByLabelText('Remise de la ligne 1 (CDF)')).toHaveValue(0)
  expect(screen.getByLabelText('Remise globale (CDF)')).toHaveValue(0)
  expect(screen.getByLabelText('Remise de la ligne 2 (%)')).toHaveValue(5)
})

test('discounts survive leaving and restoring the draft in the same tab', async () => {
  const first = render(<InvoiceForm variant='page' invoice={invoice()} />)
  selectDiscount('Remise de la ligne 1', 'percent', 15)
  selectDiscount('Remise globale', 'percent', 10)
  await waitFor(() => expect(sessionStorage.length).toBeGreaterThan(0))
  first.unmount()
  render(<InvoiceForm variant='page' invoice={invoice()} />)
  expect(screen.getByLabelText('Remise de la ligne 1 (%)')).toHaveValue(15)
  expect(screen.getByLabelText('Remise globale (%)')).toHaveValue(10)
})
