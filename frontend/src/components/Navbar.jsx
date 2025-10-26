import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const navItems = [
  { to: '/', label: 'Tableau de bord' },
  { to: '/factures', label: 'Factures' },
  { to: '/clients', label: 'Clients' }
]

const Navbar = () => {
  const location = useLocation()
  const { logout, user } = useAuth()

  return (
    <header className='border-b border-slate-200 bg-white'>
      <div className='max-w-6xl mx-auto flex items-center justify-between px-4 py-4'>
        <div className='flex items-center gap-3'>
          <span className='h-10 w-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold'>
            K
          </span>
          <div>
            <p className='text-lg font-semibold text-nuit'>Kadi</p>
            <p className='text-sm text-slate-500'>Facturation simple pour PME</p>
          </div>
        </div>
        <nav className='hidden md:flex items-center gap-6'>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`text-sm font-medium transition ${
                location.pathname === item.to ? 'text-accent' : 'text-slate-500 hover:text-nuit'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className='flex items-center gap-3'>
          <div className='hidden sm:flex flex-col text-xs text-right'>
            <span className='text-slate-500'>Connecté en tant que</span>
            <span className='font-semibold text-nuit'>{user?.email}</span>
          </div>
          <button
            onClick={logout}
            className='rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-nuit transition hover:border-nuit'
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar
