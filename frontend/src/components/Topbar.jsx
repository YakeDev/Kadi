import { useEffect, useRef, useState } from 'react'
import { Menu, X, Plus, ChevronDown, LayoutDashboard, FileText, FilePenLine, Users, Package, Building2, LogOut } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { navigationLinks } from '../constants/navigation.js'
import { useAuth } from '../hooks/useAuth.jsx'
import AppBrand from './AppBrand.jsx'

const mobileIcons = { LayoutDashboard, FileText, FilePenLine, Building2, Package, Users }

const Topbar = () => {
  const { user, profile, logout } = useAuth()
  const { pathname } = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const mobileNavRef = useRef(null)
  const mobileTriggerRef = useRef(null)
  const profileMenuRef = useRef(null)
  const profileTriggerRef = useRef(null)

  const companyName = profile?.company?.trim() || 'Mon entreprise'
  const accountLabel = profile?.manager_name?.trim() || user?.user_metadata?.full_name?.trim() || user?.email?.split('@')[0] || 'Mon compte'
  const nameParts = accountLabel.split(/[\s._-]+/u).filter(Boolean)
  const initials = [nameParts[0]?.[0], nameParts.length > 1 ? nameParts.at(-1)?.[0] : ''].join('').toLocaleUpperCase('fr-FR')

  useEffect(() => {
    setIsMobileNavOpen(false)
    setIsProfileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobileNavOpen && !isProfileMenuOpen) return
    const handleOutside = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setIsProfileMenuOpen(false)
      if (!mobileNavRef.current?.contains(event.target)) setIsMobileNavOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (isProfileMenuOpen) {
        setIsProfileMenuOpen(false)
        profileTriggerRef.current?.focus()
      } else {
        setIsMobileNavOpen(false)
        mobileTriggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileNavOpen, isProfileMenuOpen])

  useEffect(() => {
    if (isProfileMenuOpen) profileMenuRef.current?.querySelector('a')?.focus()
    if (isMobileNavOpen) mobileNavRef.current?.querySelector('nav a')?.focus()
  }, [isProfileMenuOpen, isMobileNavOpen])

  const handleLogout = async () => {
    setIsProfileMenuOpen(false)
    await logout()
  }

  return (
    <header aria-label='Barre supérieure' className='fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-white lg:left-64'>
      <div className='mx-auto flex h-[72px] w-full max-w-[1200px] items-center justify-between gap-3 px-4 md:px-6'>
        <div ref={mobileNavRef} className='flex min-w-0 flex-1 items-center gap-3'>
          <button ref={mobileTriggerRef} type='button' aria-label={isMobileNavOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
            aria-expanded={isMobileNavOpen} aria-controls='mobile-navigation'
            onClick={() => { setIsMobileNavOpen((prev) => !prev); setIsProfileMenuOpen(false) }}
            className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] text-[var(--text-muted)] lg:hidden'>
            {isMobileNavOpen ? <X aria-hidden='true' className='h-5 w-5' /> : <Menu aria-hidden='true' className='h-5 w-5' />}
          </button>
          <div className='min-w-0 lg:hidden'><AppBrand compact subtitle={companyName} /></div>
          <div className='hidden min-w-0 lg:block'>
            <p className='text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]'>Entreprise</p>
            <p className='truncate text-sm font-semibold text-[var(--text-dark)]' title={companyName}>{companyName}</p>
          </div>
          {isMobileNavOpen ? <nav id='mobile-navigation' aria-label='Navigation mobile'
            className='absolute inset-x-4 top-[80px] flex max-h-[calc(100dvh-96px)] flex-col gap-1 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-2 shadow-lg lg:hidden'>
            {navigationLinks.map((link) => {
              const Icon = mobileIcons[link.icon]
              return <NavLink key={link.to} to={link.to} onClick={() => setIsMobileNavOpen(false)}
                className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium ${isActive ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-base)]'}`}>
                <Icon aria-hidden='true' className='h-4 w-4' />{link.label}
              </NavLink>
            })}
          </nav> : null}
        </div>

        <div className='flex shrink-0 items-center gap-3'>
          {!pathname.startsWith('/devis') && !['/', '/factures', '/factures/nouvelle'].includes(pathname) ? <Link to='/factures/nouvelle' className='btn-primary hidden xl:inline-flex'>
            <Plus aria-hidden='true' className='h-4 w-4' />Nouvelle facture
          </Link> : null}
          <div ref={profileMenuRef} className='relative'
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsProfileMenuOpen(false) }}>
            <button ref={profileTriggerRef} type='button' aria-label='Menu du compte' aria-expanded={isProfileMenuOpen} aria-controls='account-menu'
              onClick={() => { setIsProfileMenuOpen((prev) => !prev); setIsMobileNavOpen(false) }}
              className={`flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-1 text-sm transition hover:bg-[var(--bg-base)] lg:px-2 ${isProfileMenuOpen ? 'ring-2 ring-[var(--primary)]' : ''}`}>
              <span aria-hidden='true' className='inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]'>{initials}</span>
              <span className='hidden max-w-[140px] truncate text-[var(--text-dark)] lg:block' title={accountLabel}>{accountLabel}</span>
              <ChevronDown aria-hidden='true' className='hidden h-4 w-4 text-[var(--text-muted)] lg:block' />
            </button>
            {isProfileMenuOpen ? <section id='account-menu' aria-label='Compte utilisateur'
              className='absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-lg'>
              <div className='border-b border-[var(--border)] px-4 py-3'>
                <p className='break-words text-sm font-semibold text-[var(--text-dark)]'>{accountLabel}</p>
                <p className='mt-1 break-all text-xs text-[var(--text-muted)]'>{user?.email || 'Mon compte'}</p>
              </div>
              <div className='p-2'>
                <Link to='/entreprise' onClick={() => setIsProfileMenuOpen(false)} className='flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-dark)] hover:bg-[var(--bg-base)]'>
                  <Building2 aria-hidden='true' className='h-4 w-4' />Mon entreprise
                </Link>
                <button type='button' onClick={handleLogout} className='flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[#b42318] hover:bg-red-50'>
                  <LogOut aria-hidden='true' className='h-4 w-4' />Déconnexion
                </button>
              </div>
            </section> : null}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
