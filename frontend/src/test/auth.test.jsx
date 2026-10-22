import { test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../hooks/useAuth.jsx'
const mocks = vi.hoisted(() => ({ callback: null, get: vi.fn(), signOut: vi.fn(), unsubscribe: vi.fn() }))
vi.mock('../services/supabase.js', () => ({
  supabase: { auth: {
    onAuthStateChange: (callback) => { mocks.callback = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } },
    signOut: mocks.signOut
  } }, resolveCompanyLogo: async (value) => value
}))
vi.mock('../services/session.js', () => ({ getCurrentSession: async () => null }))
vi.mock('../services/api.js', () => ({ api: { get: mocks.get } }))
const session = (id) => ({ user: { id, email: `${id}@example.com` }, access_token: 'test' })
const Probe = () => {
  const auth = useAuth()
  return <div><span data-testid='company'>{auth.profile.company}</span><span data-testid='recovery'>{String(auth.isPasswordRecovery)}</span></div>
}
beforeEach(() => { mocks.get.mockReset(); mocks.unsubscribe.mockReset(); window.history.replaceState({}, '', '/') })

test('refresh callback returns synchronously and hydrates outside the Supabase lock', async () => {
  let insideCallback = false
  mocks.get.mockImplementation(async () => {
    expect(insideCallback).toBe(false)
    return { data: { company: 'Entreprise' } }
  })
  render(<AuthProvider><Probe /></AuthProvider>)
  await act(async () => {})
  act(() => {
    insideCallback = true
    const result = mocks.callback('TOKEN_REFRESHED', session('one'))
    expect(result).toBeUndefined()
    insideCallback = false
  })
  await waitFor(() => expect(screen.getByTestId('company')).toHaveTextContent('Entreprise'))
})
test('a delayed profile from the previous account cannot overwrite the next account', async () => {
  let resolveOld
  mocks.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    .mockResolvedValueOnce({ data: { company: 'Second account' } })
  render(<AuthProvider><Probe /></AuthProvider>)
  await act(async () => {})
  act(() => mocks.callback('SIGNED_IN', session('one')))
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1))
  act(() => mocks.callback('SIGNED_OUT', null))
  act(() => mocks.callback('SIGNED_IN', session('two')))
  await waitFor(() => expect(screen.getByTestId('company')).toHaveTextContent('Second account'))
  await act(async () => resolveOld({ data: { company: 'First account secret' } }))
  expect(screen.getByTestId('company')).toHaveTextContent('Second account')
})
test('password recovery event opens the recovery flow without fetching a profile', async () => {
  render(<AuthProvider><Probe /></AuthProvider>)
  await act(async () => {})
  act(() => mocks.callback('PASSWORD_RECOVERY', session('one')))
  expect(screen.getByTestId('recovery')).toHaveTextContent('true')
  expect(mocks.get).not.toHaveBeenCalled()
})
