import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FilePenLine, FileText, Users, Package } from 'lucide-react'
import { isNativeAndroid } from '../native/platform.js'

const links = [
  { to: '/', label: 'Accueil', Icon: LayoutDashboard, end: true },
  { to: '/devis', label: 'Devis', Icon: FilePenLine },
  { to: '/factures', label: 'Factures', Icon: FileText },
  { to: '/clients', label: 'Clients', Icon: Users },
  { to: '/catalogue', label: 'Catalogue', Icon: Package }
]
const MobileTabBar = () => isNativeAndroid() ? <nav aria-label='Navigation Android' className='native-tab-bar'>
  {links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end}
    className={({ isActive }) => `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium ${isActive ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
    <Icon aria-hidden='true' className='h-5 w-5' />{label}
  </NavLink>)}
</nav> : null

export default MobileTabBar
