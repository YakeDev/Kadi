import { Menu, Plus, Bell, CircleUser, LayoutDashboard, FileText, Users, Package, Building2 } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { navigationLinks } from '../constants/navigation.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { useState } from 'react'

const mobileIcons = {
  LayoutDashboard,
  FileText,
  Building2,
  Package,
  Users
}

const LOGO_SIZE = 36 // pixels
const TRUNCATED_TAGLINE_LENGTH = 22

const Topbar = () => {
  const { user, profile } = useAuth()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  const companyName = profile?.company || import.meta.env.VITE_APP_NAME || 'Kadi'
  const companyLogo = (profile?.logo_url && profile.logo_url.trim()) || import.meta.env.VITE_APP_LOGO || ''
  const taglineSource = profile?.tagline || import.meta.env.VITE_APP_TAGLINE || 'Invoices'
  const companyTagline =
    taglineSource.length > TRUNCATED_TAGLINE_LENGTH
      ? `${taglineSource.slice(0, TRUNCATED_TAGLINE_LENGTH - 1)}…`
      : taglineSource
  const companyInitial =
    (companyName && companyName.trim().charAt(0)?.toUpperCase()) ||
    (companyTagline && companyTagline.trim().charAt(0)?.toUpperCase()) ||
    'K'

  return (
    <header className='fixed top-0 right-0 left-0 z-50 border-b border-[var(--border)] bg-[var(--bg-elevated)] shadow-glass backdrop-blur-xl lg:left-64'>
      <div className='mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-3 md:px-6'>
        <button
          onClick={() => setIsMobileNavOpen((prev) => !prev)}
          className='inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[rgba(255,255,255,0.7)] lg:hidden'
          type='button'
        >
          <Menu className='h-4 w-4' />
          Menu
        </button>

        <div className='flex items-center gap-3'>
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={`${companyName} logo`}
              width={LOGO_SIZE}
              height={LOGO_SIZE}
              className='h-9 w-9 rounded-[var(--radius-md)] object-contain shadow-soft'
              loading='lazy'
            />
          ) : (
            <div className='grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-sm font-semibold uppercase text-[var(--primary)] shadow-soft'>
              {companyInitial}
            </div>
          )}
          <div className='leading-tight'>
            <p className='text-sm font-semibold text-[var(--text-dark)]'>{companyName}</p>
            {companyTagline ? (
              <p className='text-[11px] font-medium text-[var(--text-muted)]'>{companyTagline}</p>
            ) : null}
          </div>
        </div>

        <nav
          className={`${
            isMobileNavOpen ? 'flex' : 'hidden'
          } absolute left-4 right-4 top-16 flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-soft backdrop-blur-xl lg:hidden`}
        >
          {navigationLinks.map((link) => {
            const Icon = mobileIcons[link.icon]
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsMobileNavOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.7)] hover:text-[var(--text-dark)]'
                  ].join(' ')
                }
              >
                <Icon className='h-4 w-4' />
                {link.label}
              </NavLink>
            )
          })}
        </nav>

        <div className='hidden lg:flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]'>
          <Bell className='h-4 w-4' />
          {user?.email}
        </div>

        <div className='flex items-center gap-3'>
          <Link to='/factures' className='btn-primary hidden md:inline-flex'>
            <Plus className='h-4 w-4' />
            Nouvelle facture
          </Link>
          <button
            type='button'
            className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] shadow-soft transition hover:shadow-card'
          >
            <CircleUser className='h-5 w-5' />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Topbar
