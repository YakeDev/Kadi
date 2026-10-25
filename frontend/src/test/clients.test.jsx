import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Clients from '../pages/Clients.jsx'
import InvoiceCreate from '../pages/InvoiceCreate.jsx'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ user: { id: 'client-test-user' }, profile: { company: 'Studio' } }) }))
const client = { id: 'client-1', company_name: 'Entreprise Démo', nif: '000123', national_id: '01-ABC', rccm: 'CD/001' }
beforeEach(() => {
  sessionStorage.clear()
  mocks.get.mockReset().mockResolvedValue({ data: { data: [client], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } } })
  mocks.post.mockReset().mockResolvedValue({ data: client })
  mocks.patch.mockReset().mockResolvedValue({ data: client })
})

test('editing a client retains identifiers, permits clearing one, and closes the drawer after saving', async () => {
  render(<Clients />)
  fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
  const drawer = within(screen.getByRole('dialog', { name: 'Modifier le client' }))
  expect(drawer.getByLabelText('NIF')).toHaveValue('000123')
  expect(drawer.getByLabelText('ID national')).toHaveValue('01-ABC')
  fireEvent.change(drawer.getByLabelText('RCCM'), { target: { value: '' } })
  fireEvent.click(drawer.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/clients/client-1', expect.objectContaining({ nif: '000123', national_id: '01-ABC', rccm: '' })))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('a new client can be saved without any administrative identifiers', async () => {
  render(<Clients />)
  fireEvent.click(screen.getByRole('button', { name: 'Nouveau client' }))
  const drawer = within(screen.getByRole('dialog'))
  for (const name of ['NIF', 'ID national', 'RCCM']) expect(drawer.getByLabelText(name)).not.toBeRequired()
  fireEvent.change(drawer.getByLabelText('Entreprise'), { target: { value: 'Particulier' } })
  fireEvent.click(drawer.getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/clients', expect.objectContaining({ company_name: 'Particulier', nif: '', national_id: '', rccm: '' })))
})

test('creating a client from a quote submits the identifiers and selects the created client', async () => {
  render(<MemoryRouter initialEntries={['/devis/nouveau']}><InvoiceCreate documentType='quote' /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }))
  const drawer = within(screen.getByRole('dialog', { name: 'Nouveau client' }))
  fireEvent.change(drawer.getByLabelText('Entreprise *'), { target: { value: 'Entreprise Démo' } })
  fireEvent.change(drawer.getByLabelText('NIF'), { target: { value: ' 000123 ' } })
  fireEvent.change(drawer.getByLabelText('ID national'), { target: { value: '01-ABC' } })
  fireEvent.change(drawer.getByLabelText('RCCM'), { target: { value: 'CD/001' } })
  fireEvent.click(drawer.getByRole('button', { name: 'Créer le client' }))
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/clients', expect.objectContaining({ nif: '000123', national_id: '01-ABC', rccm: 'CD/001' })))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Client', exact: true })).toHaveTextContent('Entreprise Démo')
})
