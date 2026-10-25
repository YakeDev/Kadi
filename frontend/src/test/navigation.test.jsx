import { beforeEach, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'

const mocks = vi.hoisted(() => ({ logout: vi.fn() }))
vi.mock('../hooks/useAuth.jsx', () => ({ useAuth: () => ({
  user: { email: 'eric@example.invalid', user_metadata: { full_name: 'Eric Démo' } },
  profile: { company: 'Entreprise Démo', logo_url: 'https://example.invalid/company-logo.png' },
  logout: mocks.logout
}) }))
const CurrentPath = () => <output aria-label='Page actuelle'>{useLocation().pathname}</output>
const renderNavigation = () => render(<MemoryRouter initialEntries={['/factures/nouvelle']}><Sidebar /><Topbar /><CurrentPath /></MemoryRouter>)
beforeEach(() => { mocks.logout.mockReset(); mocks.logout.mockResolvedValue() })

test('application branding is independent of the company and account details open from the account button', () => {
  renderNavigation()
  const sidebar = within(screen.getByRole('complementary', { name: 'Barre latérale Kadi' }))
  expect(sidebar.getByRole('link', { name: 'Kadi — Tableau de bord' })).toHaveAttribute('href', '/')
  expect(sidebar.queryByText('Entreprise Démo')).not.toBeInTheDocument()
  expect(sidebar.queryByRole('img')).not.toBeInTheDocument()
  const nav = within(sidebar.getByRole('navigation', { name: 'Navigation principale' }))
  expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual(['Tableau de bord', 'Devis', 'Factures', 'Clients', 'Catalogue', 'Mon entreprise'])
  expect(screen.queryByText('eric@example.invalid')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
  const account = within(screen.getByRole('region', { name: 'Compte utilisateur' }))
  expect(account.getByText('eric@example.invalid')).toBeInTheDocument()
  expect(account.getByText('Eric Démo')).toBeInTheDocument()
})

test('Escape closes each disclosure and returns focus to its trigger', () => {
  renderNavigation()
  const accountTrigger = screen.getByRole('button', { name: 'Menu du compte' })
  fireEvent.click(accountTrigger)
  expect(within(screen.getByRole('region', { name: 'Compte utilisateur' })).getByRole('link', { name: 'Mon entreprise' })).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('region', { name: 'Compte utilisateur' })).not.toBeInTheDocument()
  expect(accountTrigger).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la navigation' }))
  expect(within(screen.getByRole('navigation', { name: 'Navigation mobile' })).getByRole('link', { name: 'Tableau de bord' })).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('navigation', { name: 'Navigation mobile' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ouvrir la navigation' })).toHaveFocus()
})

test('account and navigation disclosures close on outside interaction and selecting a destination', () => {
  renderNavigation()
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la navigation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
  expect(screen.queryByRole('navigation', { name: 'Navigation mobile' })).not.toBeInTheDocument()
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('region', { name: 'Compte utilisateur' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir la navigation' }))
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Navigation mobile' })).getByRole('link', { name: 'Clients' }))
  expect(screen.queryByRole('navigation', { name: 'Navigation mobile' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Page actuelle')).toHaveTextContent('/clients')
  fireEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
  fireEvent.click(within(screen.getByRole('region', { name: 'Compte utilisateur' })).getByRole('link', { name: 'Mon entreprise' }))
  expect(screen.getByLabelText('Page actuelle')).toHaveTextContent('/entreprise')
  expect(screen.queryByRole('region', { name: 'Compte utilisateur' })).not.toBeInTheDocument()
})

test('logout remains available in the account disclosure', () => {
  renderNavigation()
  fireEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
  fireEvent.click(screen.getByRole('button', { name: 'Déconnexion' }))
  expect(mocks.logout).toHaveBeenCalledOnce()
  expect(screen.queryByRole('region', { name: 'Compte utilisateur' })).not.toBeInTheDocument()
})
