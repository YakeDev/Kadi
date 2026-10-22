import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Company from '../pages/Company.jsx'
const mocks = vi.hoisted(() => ({
  upload: vi.fn(), update: vi.fn(), error: vi.fn(),
  auth: { profile: { company: 'Entreprise' }, user: { id: 'user-1' }, isLoading: false }
}))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({ ...mocks.auth, updateProfile: mocks.update }) }))
vi.mock('../services/supabase.js', () => ({ uploadCompanyLogo: mocks.upload }))
vi.mock('../services/auth.js', () => ({ changePassword: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: { error: mocks.error, success: vi.fn() } }))
test('an upload error aborts saving instead of announcing a successful company update', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  mocks.upload.mockRejectedValue(new Error('Stockage inaccessible'))
  const { container } = render(<Company />)
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [new File(['png'], 'logo.png', { type: 'image/png' })] } })
  fireEvent.submit(container.querySelector('form'))
  await waitFor(() => expect(mocks.error).toHaveBeenCalled())
  expect(mocks.update).not.toHaveBeenCalled()
  expect(screen.getAllByText(/Stockage inaccessible/).length).toBeGreaterThan(0)
})
