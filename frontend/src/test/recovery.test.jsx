import { test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPassword from '../pages/ResetPassword.jsx'
const auth = vi.hoisted(() => ({ session: null, isLoading: false, resetPassword: vi.fn() }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => auth }))
const renderPage = () => render(<MemoryRouter initialEntries={['/reset-password']}><Routes>
  <Route path='/reset-password' element={<ResetPassword />} />
  <Route path='/login' element={<p>Connexion après réinitialisation</p>} />
</Routes></MemoryRouter>)
beforeEach(() => { auth.session = { user: { id: 'one' } }; auth.resetPassword.mockReset() })
test('an expired/reused link offers a new request and cannot submit a password', () => {
  auth.session = null
  renderPage()
  expect(screen.getByRole('alert')).toHaveTextContent('expiré ou déjà utilisé')
  expect(screen.queryByLabelText('Nouveau mot de passe')).toBeNull()
})
test('valid recovery session sets the new password and returns to login', async () => {
  auth.resetPassword.mockResolvedValue(undefined)
  renderPage()
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'New-password-123' } })
  fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'New-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
  await waitFor(() => expect(auth.resetPassword).toHaveBeenCalledWith('New-password-123'))
  expect(await screen.findByText('Connexion après réinitialisation')).toBeInTheDocument()
})
test('provider rejects an expired session with an actionable error', async () => {
  auth.resetPassword.mockRejectedValue(new Error('Ce lien est expiré. Demandez un nouveau lien.'))
  renderPage()
  for (const label of ['Nouveau mot de passe', 'Confirmation']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'New-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('expiré')
})
