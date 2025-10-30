import { NavLink } from 'react-router-dom'
import {
	LayoutDashboard,
	FileText,
	Users,
	LogOut,
	Package,
	Building2,
} from 'lucide-react'
import { navigationLinks } from '../constants/navigation.js'
import { useAuth } from '../hooks/useAuth.jsx'

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
		<Icon className='h-5 w-5 opacity-80' />
		{label}
	</NavLink>
)

const Sidebar = () => {
	const { logout, profile } = useAuth()

	const fallbackName = import.meta.env.VITE_APP_NAME || 'Kadi'
	const fallbackTagline =
		import.meta.env.VITE_APP_TAGLINE || 'Facturation simple pour PME locales'

	const companyName = profile?.company?.trim() || fallbackName
	const companyTagline = profile?.tagline?.trim() || fallbackTagline
	const companyLogo = profile?.logo_url?.trim?.() || null
	const companyInitial = (companyName?.trim().charAt(0) || 'K').toUpperCase()

	const locationHint = profile?.city || profile?.state
		? [profile.city, profile.state].filter(Boolean).join(', ')
		: `${companyName} – votre copilote de facturation.`

	return (
		<aside className='fixed inset-y-0 hidden w-64 flex-col border-r border-[var(--border)] bg-white lg:flex'>
			<div className='px-6 pt-4'>
				<div className='flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-4 py-3'>
					<div className='grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-white'>
						{companyLogo ? (
							<img
								src={companyLogo}
								alt={`${companyName} logo`}
								className='h-full w-full object-cover'
								width={44}
								height={44}
							/>
						) : (
							<span className='text-base font-semibold text-[var(--primary)]'>
								{companyInitial}
							</span>
						)}
					</div>
					<div className='leading-tight'>
						<p className='text-lg font-semibold text-[var(--text-dark)]'>
							{companyName}
						</p>
						{companyTagline ? (
							<p className='text-[11px] font-medium text-[var(--text-muted)]'>
								{companyTagline}
							</p>
						) : null}
					</div>
				</div>
				<p className='mt-4 text-xs text-[var(--text-muted)]'>{locationHint}</p>
			</div>

			<nav className='flex-1 space-y-1 px-4 pt-8'>
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
				<button
					onClick={logout}
					className='btn-ghost mt-4 w-full justify-center text-sm font-semibold text-[var(--text-muted)]'>
					<LogOut className='h-4 w-4' />
					Déconnexion
				</button>
			</div>
		</aside>
	)
}

export default Sidebar
