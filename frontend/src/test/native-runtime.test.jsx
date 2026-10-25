import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ native: true, callbacks: {}, remove: vi.fn(), minimize: vi.fn(), appListener: vi.fn(), networkListener: vi.fn(), getStatus: vi.fn() }))
vi.mock('../native/platform.js', async importOriginal => ({ ...await importOriginal(), isNativeAndroid: () => mocks.native }))
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.appListener, minimizeApp: mocks.minimize } }))
vi.mock('@capacitor/network', () => ({ Network: { addListener: mocks.networkListener, getStatus: mocks.getStatus } }))
import NativeRuntime from '../components/NativeRuntime.jsx'
import MobileTabBar from '../components/MobileTabBar.jsx'
beforeEach(() => {
  vi.clearAllMocks(); mocks.native = true; mocks.callbacks = {}
  const listen = async (event, callback) => { mocks.callbacks[event] = callback; return { remove: mocks.remove } }
  mocks.appListener.mockImplementation(listen); mocks.networkListener.mockImplementation(listen)
  mocks.getStatus.mockResolvedValue({ connected: true }); mocks.minimize.mockResolvedValue()
  window.history.replaceState(null, '', '/')
})
test('Android bottom navigation keeps distinct quote and invoice destinations', () => {
  render(<MemoryRouter initialEntries={['/devis']}><MobileTabBar /></MemoryRouter>)
  expect(screen.getByRole('navigation', { name: 'Navigation Android' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Devis' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: 'Factures' })).toHaveAttribute('href', '/factures')
})
test('web clients get no Android navigation or native listeners', async () => {
  mocks.native = false
  render(<MemoryRouter><NativeRuntime /><MobileTabBar /></MemoryRouter>)
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument(); expect(mocks.appListener).not.toHaveBeenCalled()
})
test('hardware back closes a modal before navigation and minimizes at the root', async () => {
  const view = render(<MemoryRouter><NativeRuntime /></MemoryRouter>)
  await waitFor(() => expect(mocks.callbacks.backButton).toBeTypeOf('function'))
  const close = vi.fn(event => { if (event.key === 'Escape') event.preventDefault() })
  document.addEventListener('keydown', close)
  act(() => mocks.callbacks.backButton({ canGoBack: false }))
  expect(close).toHaveBeenCalledOnce(); expect(mocks.minimize).not.toHaveBeenCalled()
  document.removeEventListener('keydown', close)
  act(() => mocks.callbacks.backButton({ canGoBack: false }))
  expect(mocks.minimize).toHaveBeenCalledOnce()
  view.unmount(); expect(mocks.remove).toHaveBeenCalled()
})
test('network interruption and reconnection are reported without claiming offline saves', async () => {
  render(<MemoryRouter><NativeRuntime /></MemoryRouter>)
  await waitFor(() => expect(mocks.callbacks.networkStatusChange).toBeTypeOf('function'))
  act(() => mocks.callbacks.networkStatusChange({ connected: false }))
  expect(screen.getByRole('status')).toHaveTextContent('Reconnectez-vous pour enregistrer')
  act(() => mocks.callbacks.networkStatusChange({ connected: true }))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
