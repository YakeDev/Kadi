import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import InvoiceForm from '../components/InvoiceForm.jsx'

const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../services/catalog.js', () => ({ fetchCatalogItems: async () => ({ data: [] }) }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ user: { id: 'discount-user' }, profile: { company: 'Entreprise' } }) }))
const invoice = () => ({ status: 'draft', currency: 'USD', tax_rate: 16, items: [
  { description: 'Conception', quantity: 2, unitPrice: 100 },
  { description: 'Conseil', quantity: 1, unitPrice: 50 }
] })
beforeEach(() => { mocks.post.mockReset(); mocks.get.mockReset(); mocks.post.mockResolvedValue({ data: {} }); sessionStorage.clear() })
const selectDiscount = (label, type, value) => {
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: type } })
  fireEvent.change(screen.getByLabelText(`${label} (${type === 'percent' ? '%' : 'USD'})`, { exact: true }), { target: { value: String(value) } })
}

test('line and global discounts change the preview and the submitted invoice before optional tax', async () => {
  const { container } = render(<InvoiceForm invoice={invoice()} />)
  selectDiscount('Remise de la ligne 1', 'percent', 10)
  selectDiscount('Remise de la ligne 2', 'fixed', 5)
  selectDiscount('Remise globale', 'fixed', 25)
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu', exact: true }))
  const preview = within(screen.getByRole('complementary', { name: 'Aperçu de la facture' }))
  expect(preview.getByText('232,00 USD')).toBeInTheDocument()
  expect(preview.getByText('Net avant taxe')).toBeInTheDocument()
  expect(preview.getByText('32,00 USD')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Fermer l’aperçu' }))
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

test('an AI draft that changes currency also resets the previous fixed document discount', async () => {
  render(<InvoiceForm invoice={invoice()} />)
  selectDiscount('Remise globale', 'fixed', 25)
  mocks.post.mockResolvedValueOnce({ data: { currency: 'CDF', items: [{ description: 'Article CDF', quantity: 1, unitPrice: 1000 }] } })
  fireEvent.change(screen.getByLabelText('Décrire la facture (facultatif)'), { target: { value: 'Une prestation en CDF' } })
  fireEvent.click(screen.getByRole('button', { name: 'Générer via IA' }))
  expect(await screen.findByLabelText('Remise globale (CDF)')).toHaveValue(0)
  expect(screen.getByLabelText('Prix unitaire (CDF)')).toHaveValue(1000)
})

test('the preview opens on demand, includes every line and preserves the editor when closed', () => {
  render(<InvoiceForm variant='page' invoice={{ ...invoice(), items: Array.from({ length: 6 }, (_, index) => ({ description: `Prestation ${index + 1}`, quantity: 1, unitPrice: 100 })) }} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  selectDiscount('Remise globale', 'percent', 10)
  fireEvent.click(screen.getByRole('button', { name: 'Aperçu', exact: true }))
  const dialog = within(screen.getByRole('dialog', { name: 'Aperçu de la facture' }))
  expect(dialog.getByText('Prestation 6')).toBeInTheDocument()
  expect(dialog.getByText('626,40 USD')).toBeInTheDocument()
  fireEvent.click(dialog.getByRole('button', { name: 'Fermer l’aperçu' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Remise globale (%)')).toHaveValue(10)
  expect(screen.getByLabelText('Total de la facture')).toHaveTextContent('626,40 USD')
})

test('inserting from the catalogue reuses an empty line then appends without replacing existing work', async () => {
  mocks.get.mockResolvedValue({ data: { data: [{ id: 'product-a', name: 'Service catalogue', unit_price: 350, currency: 'USD' }] } })
  render(<InvoiceForm variant='page' />)
  fireEvent.click(screen.getByRole('button', { name: 'Depuis le catalogue' }))
  fireEvent.click(await screen.findByRole('button', { name: /Service catalogue/ }))
  expect(screen.getAllByLabelText('Description', { exact: true })).toHaveLength(1)
  expect(screen.getByLabelText('Description')).toHaveValue('Service catalogue')
  selectDiscount('Remise de la ligne 1', 'percent', 15)
  fireEvent.click(screen.getByRole('button', { name: 'Depuis le catalogue' }))
  fireEvent.click(await screen.findByRole('button', { name: /Service catalogue/ }))
  expect(screen.getAllByLabelText('Description', { exact: true })).toHaveLength(2)
  expect(screen.getByLabelText('Remise de la ligne 1 (%)')).toHaveValue(15)
  expect(screen.getByLabelText('Total de la facture')).toHaveTextContent('647,50 USD')
})

test('removing a line preserves the remaining line discount and zero quantities require correction', () => {
  render(<InvoiceForm invoice={invoice()} />)
  selectDiscount('Remise de la ligne 2', 'percent', 10)
  fireEvent.click(screen.getByRole('button', { name: 'Retirer la ligne 1' }))
  expect(screen.getByLabelText('Description')).toHaveValue('Conseil')
  expect(screen.getByLabelText('Remise de la ligne 1 (%)')).toHaveValue(10)
  expect(screen.getByLabelText('Total de la facture')).toHaveTextContent('52,20 USD')
  fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '0' } })
  expect(screen.getByLabelText('Quantité')).toHaveValue(0)
  expect(screen.getByRole('alert')).toHaveTextContent('quantité')
  expect(screen.getByRole('button', { name: 'Enregistrer la facture' })).toBeDisabled()
  expect(mocks.post).not.toHaveBeenCalled()
})
