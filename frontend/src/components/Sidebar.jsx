import { NavLink } from 'react-router-dom'
import {
	LayoutDashboard,
	FileText,
	FilePenLine,
	Users,
	Package,
	Building2,
	ShieldCheck,
	Info,
} from 'lucide-react'
import { navigationLinks } from '../constants/navigation.js'
import AppBrand from './AppBrand.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

const iconMap = {
	LayoutDashboard,
	FileText,
	FilePenLine,
	Package,
	Building2,
	Users,
}

const SidebarLink = ({ to, label, icon: Icon }) => (
	<NavLink
		to={to}
		className={({ isActive }) =>
			[
				'group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-all',
				isActive
					? 'bg-[var(--primary-soft)] text-[var(--primary)]'
					: 'text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.75)] hover:text-[var(--text-dark)]',
			].join(' ')
		}>
		<Icon aria-hidden='true' className='h-5 w-5 opacity-80' />
		{label}
	</NavLink>
)

const Sidebar = () => {
  const { isSuperAdmin } = useAuth()
  return (
		<aside aria-label='Barre latérale Kadi' className='fixed inset-y-0 hidden w-64 flex-col overflow-y-auto border-r border-[var(--border)] bg-white lg:flex'>
			<div className='px-6 py-6'>
				<AppBrand />
			</div>

			<nav aria-label='Navigation principale' className='flex-1 space-y-1 px-4 pt-3'>
				{navigationLinks.map((link) => {
					const Icon = iconMap[link.icon]
					return (
						<SidebarLink
							key={link.to}
							to={link.to}
							label={link.label}
							icon={Icon}
						/>
					)
				})}
        {isSuperAdmin ? <div className='mt-5 border-t border-[var(--border)] pt-4'><p className='mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]'>Plateforme</p><SidebarLink to='/administration' label='Administration' icon={ShieldCheck} /></div> : null}
			</nav>

			<div className='px-6 py-6'>
				<SidebarLink to='/a-propos' label='À propos de Kadi' icon={Info} />
				<div className='surface p-4'>
					<p className='text-sm font-semibold text-[var(--text-dark)]'>
						Besoin d&apos;aide ?
					</p>
					<p className='mt-1 text-xs text-[var(--text-muted)]'>
						Consultez la base de connaissance pour les bonnes pratiques Kadi.
					</p>
					<a
						href='https://help.kadi.app'
						className='mt-3 inline-flex text-xs font-semibold text-[var(--primary)] hover:underline'>
						Ouvrir la documentation →
					</a>
				</div>
			</div>
		</aside>
)
}

export default Sidebar
