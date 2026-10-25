import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, FilePenLine, FileText, Users, Package } from 'lucide-react'
import { nativeRootPaths } from '../native/platform.js'
import { isNativeAndroid } from '../native/platform.js'

const links = [
  { to: '/', label: 'Accueil', Icon: LayoutDashboard, end: true },
  { to: '/devis', label: 'Devis', Icon: FilePenLine },
  { to: '/factures', label: 'Factures', Icon: FileText },
  { to: '/clients', label: 'Clients', Icon: Users },
  { to: '/catalogue', label: 'Catalogue', Icon: Package }
]
const MobileTabBar = () => {
  const { pathname } = useLocation()
  return isNativeAndroid() && nativeRootPaths.includes(pathname) ? <nav aria-label='Navigation Android' className='native-tab-bar'>
  {links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end}
    className={({ isActive }) => `native-tab ${isActive ? 'is-active' : ''}`}>
    <span><Icon aria-hidden='true' /></span><small>{label}</small>
  </NavLink>)}
</nav> : null
}

export default MobileTabBar
