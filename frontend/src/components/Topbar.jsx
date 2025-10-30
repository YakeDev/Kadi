import {
  Menu,
  Plus,
  Bell,
  CircleUser,
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Building2
} from 'lucide-react'
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

const Topbar = () => {
  const { user, profile } = useAuth()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  const companyName = profile?.company?.trim() || import.meta.env.VITE_APP_NAME || 'Kadi'
  const companyTagline = profile?.tagline?.trim() || ''

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

        <div className='hidden flex-col items-start leading-tight text-[var(--text-muted)] md:flex'>
          <span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]'>
            {companyName}
          </span>
          {companyTagline ? <span className='text-[11px]'>{companyTagline}</span> : null}
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
