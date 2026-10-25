import { NavLink } from 'react-router-dom'
import {
	LayoutDashboard,
	FileText,
	Users,
	Package,
	Building2,
} from 'lucide-react'
import { navigationLinks } from '../constants/navigation.js'
import AppBrand from './AppBrand.jsx'

const iconMap = {
	LayoutDashboard,
	FileText,
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

const Sidebar = () => (
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
			</nav>

			<div className='px-6 py-6'>
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

export default Sidebar
