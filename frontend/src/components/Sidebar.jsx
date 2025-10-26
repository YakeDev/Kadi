import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Users, LogOut, Package, Building2 } from 'lucide-react'
import { navigationLinks } from '../constants/navigation.js'
import { useAuth } from '../hooks/useAuth.jsx'

const iconMap = {
  LayoutDashboard,
  FileText,
  Package,
  Building2,
  Users
}

const SidebarLink = ({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        'group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-all',
        isActive
          ? 'bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'
          : 'text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.75)] hover:text-[var(--text-dark)] hover:shadow-soft'
      ].join(' ')
    }
  >
    <Icon className='h-5 w-5 opacity-80' />
    {label}
  </NavLink>
)

const Sidebar = () => {
  const { logout, profile } = useAuth()

  const companyName = profile?.company || 'Kadi'
  const companyTagline = profile?.tagline || 'Facturation simple pour PME'
  const companyInitial = (companyName?.trim().charAt(0) || 'K').toUpperCase()
  const companyLogo = (profile?.logo_url && profile.logo_url.trim()) || null

  return (
    <aside className='fixed inset-y-0 hidden w-64 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft backdrop-blur-xl lg:flex'>
      <div className='px-6 pt-8'>
        <div className='flex items-center gap-3 rounded-[var(--radius-lg)] border border-white/60 bg-[rgba(255,255,255,0.85)] px-4 py-3 shadow-[0_14px_38px_-32px_rgba(28,28,30,0.28)]'>
          {companyLogo ? (
            <img
              src={companyLogo}
              alt={`${companyName} logo`}
              className='h-11 w-11 rounded-[var(--radius-md)] object-contain shadow-soft'
              width={44}
              height={44}
            />
          ) : (
            <div className='grid h-11 w-11 place-items-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--primary)] to-[#0a7aea] text-base font-semibold text-white shadow-soft'>
              {companyInitial}
            </div>
          )}
          <div className='leading-tight'>
            <p className='text-lg font-semibold text-[var(--text-dark)]'>{companyName}</p>
            {companyTagline ? (
              <p className='text-[11px] font-medium text-[var(--text-muted)]'>{companyTagline}</p>
            ) : null}
          </div>
        </div>
        <p className='mt-4 text-xs text-[var(--text-muted)]'>
          {profile?.city || profile?.state
            ? [profile.city, profile.state].filter(Boolean).join(', ')
            : 'Plateforme de facturation moderne pour PME ambitieuses.'}
        </p>
      </div>

      <nav className='flex-1 space-y-1 px-4 pt-8'>
        {navigationLinks.map((link) => {
          const Icon = iconMap[link.icon]
          return <SidebarLink key={link.to} to={link.to} label={link.label} icon={Icon} />
        })}
      </nav>

      <div className='px-6 py-6'>
        <div className='surface p-4'>
          <p className='text-sm font-semibold text-[var(--text-dark)]'>Besoin d&apos;aide ?</p>
          <p className='mt-1 text-xs text-[var(--text-muted)]'>
            Consultez la base de connaissance pour les bonnes pratiques Kadi.
          </p>
          <a
            href='https://help.kadi.app'
            className='mt-3 inline-flex text-xs font-semibold text-[var(--primary)] hover:underline'
          >
            Ouvrir la documentation →
          </a>
        </div>
        <button
          onClick={logout}
          className='btn-ghost mt-4 w-full justify-center text-sm font-semibold text-[var(--text-muted)]'
        >
          <LogOut className='h-4 w-4' />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
