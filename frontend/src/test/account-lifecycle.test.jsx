import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AccountLifecycle from '../components/AccountLifecycle.jsx'
import DeletionRequestPage from '../pages/DeletionRequestPage.jsx'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../services/api.js', () => ({ api: mocks }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ session: null }) }))
vi.mock('../native/platform.js', () => ({ isNativeAndroid: () => false }))

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: { request: null } })
  mocks.post.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  window.history.replaceState({}, '', '/')
})

test('account settings require a password and export acknowledgement before requesting removal', async () => {
  mocks.post.mockResolvedValue({ data: { request: { id: 'request-1', status: 'pending_review' } } })
  render(<AccountLifecycle />)
  await screen.findByLabelText('Mot de passe actuel')
  fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'password123' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Demander la suppression du compte' }))
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/deletion-request', { password: 'password123', exportAcknowledged: true }))
  expect(screen.getByText(/En attente d’examen/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Annuler ma demande' })).toBeInTheDocument()
})

test('public request verifies the emailed token through the API', async () => {
  const token = 'a'.repeat(43)
  window.history.replaceState({}, '', `/suppression-compte?token=${token}`)
  mocks.post.mockResolvedValue({ data: { message: 'Demande vérifiée.' } })
  render(<MemoryRouter><DeletionRequestPage /></MemoryRouter>)
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/deletion-request/verify', { token }))
  expect(await screen.findByText('Demande vérifiée.')).toBeInTheDocument()
  expect(window.location.search).toBe('')
})

test('public request gives a generic response without disclosing the account', async () => {
  mocks.post.mockResolvedValue({ data: { message: 'Si cette adresse correspond à un compte Kadi, un lien sera envoyé.' } })
  render(<MemoryRouter><DeletionRequestPage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('Adresse email du compte'), { target: { value: 'unknown@example.invalid' } })
  fireEvent.click(screen.getByRole('button', { name: 'Recevoir un lien de vérification' }))
  expect(await screen.findByText(/Si cette adresse correspond/)).toBeInTheDocument()
  expect(mocks.post).toHaveBeenCalledWith('/auth/deletion-request/public', { email: 'unknown@example.invalid' })
})
