import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
	LayoutDashboard,
	ArrowUpRight,
	Inbox,
	Loader2,
	TrendingUp,
	TrendingDown,
	CalendarRange,
	Calendar,
	FileText,
	UserPlus,
	PackagePlus,
	ListTodo,
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { showErrorToast } from '../utils/errorToast.js'
import PageHeader from '../components/PageHeader.jsx'
import StatsCard from '../components/StatsCard.jsx'
import DashboardChart from '../components/DashboardChart.jsx'

const PERIOD_OPTIONS = [
	{ label: 'Jour', value: 'day' },
	{ label: 'Mois', value: 'month' },
	{ label: 'Année', value: 'year' },
]

const formatCurrency = (value) =>
	new Intl.NumberFormat('fr-FR', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
	}).format(Number(value || 0))

const formatNumber = (value) =>
	Number(value || 0).toLocaleString('fr-FR', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	})

const formatDate = (value) =>
	value ? new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'

const Dashboard = () => {
	const { user, profile } = useAuth()
	const [period, setPeriod] = useState('month')
	const [summary, setSummary] = useState(null)
	const [recentInvoices, setRecentInvoices] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [range, setRange] = useState(null)
	const [rangeDraft, setRangeDraft] = useState({ start: '', end: '' })
	const [isCustomRange, setIsCustomRange] = useState(false)
	const [todo, setTodo] = useState({ overdue: [], dueSoon: [], drafts: [] })
	const [isTodoLoading, setIsTodoLoading] = useState(true)

	const fetchData = async (selectedPeriod, rangeOverride) => {
		setIsRefreshing(true)
		try {
			const hasOverride = rangeOverride !== undefined
			const appliedRange = hasOverride
				? rangeOverride === null
					? null
					: rangeOverride
				: range
			const willUseCustomRange = hasOverride
				? rangeOverride !== null
				: isCustomRange

			const params = { period: selectedPeriod }
			if (appliedRange?.start) {
				params.start = appliedRange.start
			}
			if (appliedRange?.end) {
				params.end = appliedRange.end
			}

			setIsTodoLoading(true)
			const [{ data: summaryData }, { data: invoicesResponse }, { data: todoResponse }] = await Promise.all([
				api.get('/invoices/summary', { params }),
				api.get('/invoices', {
					params: {
						page: 1,
						pageSize: 5,
					},
				}),
				api.get('/invoices/todo'),
			])
			setSummary(summaryData)
			setRecentInvoices(invoicesResponse?.data ?? [])
			setTodo({
				overdue: todoResponse?.overdue ?? [],
				dueSoon: todoResponse?.dueSoon ?? [],
				drafts: todoResponse?.drafts ?? [],
			})
			const startISO = summaryData?.meta?.startDate?.slice(0, 10) || ''
			const endISO = summaryData?.meta?.endDate?.slice(0, 10) || ''
			const nextRange = { start: startISO, end: endISO }
			setRange(nextRange)
			setRangeDraft(nextRange)
			setIsCustomRange(
				willUseCustomRange && Boolean(appliedRange?.start && appliedRange?.end)
			)
		} catch (error) {
			showErrorToast(toast.error, error)
		} finally {
			setIsLoading(false)
			setIsRefreshing(false)
			setIsTodoLoading(false)
		}
	}

	useEffect(() => {
		setRange(null)
		setRangeDraft({ start: '', end: '' })
		fetchData(period, null)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [period])

	const handleRangeDraftChange = (field, value) => {
		setRangeDraft((prev) => ({ ...prev, [field]: value }))
	}

	const handleApplyRange = () => {
		if (!rangeDraft.start || !rangeDraft.end) {
			toast.error('Sélectionnez une date de début et de fin.')
			return
		}

		if (new Date(rangeDraft.start) > new Date(rangeDraft.end)) {
			toast.error('La date de fin doit être postérieure à la date de début.')
			return
		}

		const nextRange = { start: rangeDraft.start, end: rangeDraft.end }
		fetchData(period, nextRange)
	}

	const handleResetRange = () => {
		setRange(null)
		setIsCustomRange(false)
		setRangeDraft({ start: '', end: '' })
		fetchData(period, null)
	}

	const emptyState = useMemo(
		() => recentInvoices.length === 0 && !isLoading,
		[recentInvoices, isLoading]
	)

	const nameCandidate =
		user?.user_metadata?.full_name ||
		profile?.manager_name ||
		profile?.company ||
		user?.email?.split('@')[0] ||
		''

	const totals = summary?.totals ?? {}
	const charts = summary?.charts ?? {}
	const meta = summary?.meta ?? {}
	const currentRange = range ?? { start: '', end: '' }
	const isRangeDraftValid = Boolean(rangeDraft.start && rangeDraft.end)
	const isRangeChanged =
		isRangeDraftValid &&
		(rangeDraft.start !== currentRange.start ||
			rangeDraft.end !== currentRange.end)
	const isApplyDisabled = !isRangeDraftValid || !isRangeChanged || isRefreshing
	const isResetDisabled = !isCustomRange || isRefreshing
	const quickActions = [
		{
			label: 'Nouvelle facture',
			description: 'Créez et envoyez en quelques secondes.',
			to: '/factures',
			icon: FileText,
			variant: 'primary',
		},
		{
			label: 'Ajouter un client',
			description: 'Renseignez un nouveau client dans votre CRM.',
			to: '/clients',
			icon: UserPlus,
			variant: 'ghost',
		},
		{
			label: 'Ajouter un article',
			description: 'Enrichissez votre catalogue produits / services.',
			to: '/catalogue',
			icon: PackagePlus,
			variant: 'ghost',
		},
	]

	const statsCards = [
		{
			key: 'revenue',
			title: 'Revenus encaissés',
			icon: TrendingUp,
			value: isLoading ? '—' : formatCurrency(totals.revenue || 0),
			helperText: 'Montant des factures payées sur la période',
			actions: [
				<Link key='revenue-link' to='/factures?status=paid' className='btn-ghost h-8 px-3 text-[11px] font-semibold'>
					Voir les factures payées
				</Link>,
			],
		},
		{
			key: 'outstanding',
			title: 'Montant en attente',
			icon: TrendingDown,
			value: isLoading ? '—' : formatCurrency(totals.outstanding || 0),
			helperText: 'Factures envoyées ou en retard',
			actions: [
				<Link key='outstanding-link' to='/factures?status=sent' className='btn-ghost h-8 px-3 text-[11px] font-semibold'>
					Relancer un client
				</Link>,
			],
		},
		{
			key: 'count',
			title: 'Factures émises',
			value: isLoading ? '—' : formatNumber(totals.invoiceCount || 0),
			helperText: 'Nombre total sur la période',
			actions: [
				<Link key='all-link' to='/factures' className='btn-ghost h-8 px-3 text-[11px] font-semibold'>
					Ouvrir la liste
				</Link>,
			],
		},
		{
			key: 'delay',
			title: 'Délai moyen de paiement',
			value: isLoading ? '—' : `${Number(totals.averagePaymentDelay || 0).toFixed(1)} j`,
			helperText: 'Entre émission et règlement',
		},
	]

	const todoSections = [
		{
			key: 'overdue',
			title: 'En retard',
			accent: 'text-[#ff453a]',
			items: todo.overdue,
			empty: 'Aucune relance urgente.',
		},
		{
			key: 'dueSoon',
			title: 'À échéance',
			accent: 'text-[var(--primary)]',
			items: todo.dueSoon,
			empty: 'Rien à prévoir pour aujourd’hui.',
		},
		{
			key: 'drafts',
			title: 'Brouillons',
			accent: 'text-[var(--text-muted)]',
			items: todo.drafts,
			empty: 'Aucun brouillon en attente.',
		},
	]

	return (
		<div className='space-y-8'>
			<PageHeader
				icon={LayoutDashboard}
				title={`Bonjour${nameCandidate ? ` ${nameCandidate}` : ''}, voici votre activité`}
				subtitle='Visualisez vos revenus, fluidifiez la facturation et relancez vos clients en un coup d’œil.'
				actions={[
					<Link
						key='invoice'
						to='/factures'
						className='btn-primary h-11 justify-center'>
						<ArrowUpRight className='h-4 w-4' />
						Créer une facture
					</Link>,
					<Link
						key='clients'
						to='/clients'
						className='btn-secondary h-11 justify-center'>
						Gérer mes clients
					</Link>,
				]}
			/>

			<div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
				{quickActions.map((action) => {
					const ActionIcon = action.icon
					const isPrimary = action.variant === 'primary'
					const actionClass = clsx(
						'group flex flex-col justify-between rounded-[var(--radius-xl)] border border-[var(--border)] p-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
						isPrimary
							? 'border-transparent bg-[var(--primary)] text-white shadow-[0_30px_80px_-48px_rgba(10,132,255,0.55)] focus-visible:ring-white'
							: 'bg-white shadow-[0_26px_68px_-48px_rgba(6,31,78,0.34)] focus-visible:ring-[var(--primary)]'
					)
					const accentIconBg = isPrimary ? 'bg-white/15 text-white' : 'bg-[var(--primary-soft)]/70 text-[var(--primary)]'
					const helperClass = clsx('mt-3 text-xs', isPrimary ? 'text-white/80' : 'text-[var(--text-muted)]')

					return (
						<Link key={action.label} to={action.to} className={actionClass}>
							<div className='flex items-center justify-between gap-3'>
								<div>
									<p className={clsx('text-xs font-semibold uppercase tracking-[0.25em]', isPrimary ? 'text-white/70' : 'text-[var(--text-muted)]')}>
										Action rapide
									</p>
									<h3 className={clsx('mt-1 text-sm font-semibold', isPrimary ? 'text-white' : 'text-[var(--text-dark)]')}>
										{action.label}
									</h3>
								</div>
								<span className={clsx('flex h-9 w-9 items-center justify-center rounded-full transition group-hover:scale-105', accentIconBg)}>
									<ActionIcon className='h-4 w-4' />
								</span>
							</div>
							<p className={helperClass}>{action.description}</p>
						</Link>
					)
				})}
			</div>

			<div className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-white px-4 py-4'>
				<div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
					<div className='flex items-start gap-3'>
						<span className='hidden h-11 w-11 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] sm:flex'>
							<CalendarRange className='h-5 w-5' />
						</span>
						<div>
							<p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]'>
								Période analysée
							</p>
							<p className='text-sm font-semibold text-[var(--text-dark)]'>
								{meta.startDate
									? new Date(meta.startDate).toLocaleDateString('fr-FR')
									: '—'}{' '}
								→{' '}
								{meta.endDate
									? new Date(meta.endDate).toLocaleDateString('fr-FR')
									: '—'}
							</p>
							<p className='mt-1 text-[11px] text-[var(--text-muted)]'>
								Choisissez un raccourci ou définissez votre propre plage de
								dates pour affiner les statistiques.
							</p>
						</div>
					</div>
					<div className='flex w-full flex-col gap-3 xl:w-auto'>
						<div className='flex flex-wrap items-center justify-end gap-2'>
							<span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]'>
								Raccourcis
							</span>
							{PERIOD_OPTIONS.map((option) => (
								<button
									key={option.value}
									type='button'
									onClick={() => setPeriod(option.value)}
									className={clsx(
										'inline-flex h-9 items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--text-dark)]',
										period === option.value &&
											'border-[var(--primary)] bg-[rgba(10,132,255,0.12)] text-[var(--primary)]'
									)}>
									{option.label}
								</button>
							))}
							{isRefreshing ? (
								<Loader2 className='h-4 w-4 animate-spin text-[var(--text-muted)]' />
							) : null}
						</div>
						<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3'>
							<div className='flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2'>
								<div className='flex min-w-[160px] flex-1 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text-dark)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[rgba(10,132,255,0.2)]'>
									<Calendar className='h-4 w-4 text-[var(--text-muted)]' />
									<input
										type='date'
										value={rangeDraft.start}
										onChange={(event) =>
											handleRangeDraftChange('start', event.target.value)
										}
										aria-label='Date de début'
										className='w-full bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
									/>
								</div>
								<span className='flex items-center justify-center text-[var(--text-muted)]'>
									→
								</span>
								<div className='flex min-w-[160px] flex-1 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text-dark)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[rgba(10,132,255,0.2)]'>
									<Calendar className='h-4 w-4 text-[var(--text-muted)]' />
									<input
										type='date'
										value={rangeDraft.end}
										onChange={(event) =>
											handleRangeDraftChange('end', event.target.value)
										}
										aria-label='Date de fin'
										className='w-full bg-transparent text-sm text-[var(--text-dark)] focus:outline-none'
									/>
								</div>
							</div>
							<div className='flex items-center gap-2 sm:flex-none'>
								<button
									type='button'
									onClick={handleApplyRange}
									className={clsx(
										'inline-flex h-10 items-center justify-center rounded-full px-5 text-xs font-semibold text-white transition',
										isApplyDisabled
											? 'bg-[var(--primary)]/50 opacity-70 cursor-not-allowed'
											: 'bg-[var(--primary)] hover:bg-[#0a7aea]'
									)}
									disabled={isApplyDisabled}>
									Appliquer
								</button>
								<button
									type='button'
									onClick={handleResetRange}
									className={clsx(
										'inline-flex h-10 items-center justify-center rounded-full border border-[var(--border)] px-5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-dark)]',
										isResetDisabled && 'opacity-60 cursor-not-allowed'
									)}
									disabled={isResetDisabled}>
									Réinitialiser
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
				{statsCards.map((card) => (
					<StatsCard
						key={card.key}
						icon={card.icon}
						title={card.title}
						value={card.value}
						helperText={card.helperText}
						actions={card.actions}
					/>
				))}
			</div>

			<div className='grid gap-6 xl:grid-cols-[1.4fr,1fr]'>
				<div>
					<h2 className='mb-3 text-sm font-semibold text-[var(--text-dark)]'>
						Tendance des revenus
					</h2>
					<DashboardChart
						data={charts.revenue}
						valueKey='total'
						labelKey='label'
						type='line'
						height={320}
					/>
				</div>
				<div className='space-y-6'>
					<div>
						<h2 className='mb-3 text-sm font-semibold text-[var(--text-dark)]'>
							Top clients
						</h2>
						<DashboardChart
							data={charts.topClients}
							valueKey='total'
							labelKey='company'
							type='bar'
							height={180}
						/>
					</div>
					<div>
						<h2 className='mb-3 text-sm font-semibold text-[var(--text-dark)]'>
							Top produits / services
						</h2>
						<DashboardChart
							data={charts.topProducts}
							valueKey='total'
							labelKey='label'
							type='bar'
							height={180}
						/>
					</div>
				</div>
			</div>

			<div className='grid gap-6 lg:grid-cols-[1.2fr,1fr]'>
				<div className='card flex flex-col gap-4 p-6'>
					<div className='flex items-center justify-between'>
						<h2 className='text-lg font-semibold text-[var(--text-dark)]'>
							Activité récente
						</h2>
						<Link
							to='/factures'
							className='text-sm font-semibold text-[var(--primary)] hover:underline'>
							Voir toutes les factures
						</Link>
					</div>

					{emptyState ? (
						<div className='flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-white py-10 text-center text-sm text-[var(--text-muted)]'>
							<Inbox className='h-8 w-8 text-[var(--text-muted)]' />
							<div>
								<p className='font-medium'>Aucune facture enregistrée</p>
								<p>Commencez par créer votre première facture.</p>
							</div>
						</div>
					) : (
						<div className='divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white max-h-[346px] overflow-y-auto pr-1'>
							{recentInvoices.map((invoice) => (
								<div
									key={invoice.id}
									className='flex items-center justify-between gap-4 px-4 py-3 text-sm transition hover:bg-[rgba(10,132,255,0.08)]'>
									<div>
										<p className='font-semibold text-[var(--text-dark)]'>
											#{invoice.invoice_number}
										</p>
										<p className='text-xs text-[var(--text-muted)]'>
											{invoice.client?.company_name ?? 'Client inconnu'}
										</p>
									</div>
									<div className='flex items-center gap-6'>
										<span className='text-sm font-semibold text-[var(--text-dark)]'>
											{formatCurrency(invoice.total_amount)}
										</span>
										<span className='text-xs text-[var(--text-muted)]'>
											{invoice.issue_date}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

			<div className='card flex flex-col gap-4 p-6'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<span className='flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]'>
							<ListTodo className='h-5 w-5' />
						</span>
						<div>
							<h3 className='text-lg font-semibold text-[var(--text-dark)]'>À faire aujourd’hui</h3>
							<p className='text-xs text-[var(--text-muted)]'>Gardez un œil sur les factures à relancer et les brouillons.</p>
						</div>
					</div>
					<Link to='/factures' className='text-xs font-semibold text-[var(--primary)] hover:underline'>Tout voir</Link>
				</div>

				{isTodoLoading ? (
					<div className='flex items-center justify-center gap-2 py-10 text-sm text-[var(--text-muted)]'>
						<Loader2 className='h-4 w-4 animate-spin' />
						Chargement des éléments à traiter…
					</div>
				) : (
					<div className='space-y-3 overflow-y-auto pr-2 max-h-[380px] sm:max-h-[420px] lg:max-h-[460px]'>
						{todoSections.map((section) => (
							<div key={section.key} className='space-y-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4'>
								<div className='flex items-center justify-between'>
									<p className='text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]'>{section.title}</p>
									<span className={clsx('text-[11px] font-semibold', section.accent)}>
										{section.items.length}
									</span>
								</div>
								{section.items.length === 0 ? (
									<p className='rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-white px-3 py-2 text-xs text-[var(--text-muted)]'>
										{section.empty}
									</p>
								) : (
									<ul className='space-y-2 text-xs'>
										{section.items.map((item) => (
											<li
												key={item.id}
												className='flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-[var(--text-dark)]'
											>
												<div>
													<p className='text-sm font-semibold'>#{item.invoice_number}</p>
													<p className='text-[11px] text-[var(--text-muted)]'>{item.client?.company_name ?? 'Client inconnu'}</p>
												</div>
												<div className='text-right text-[11px] text-[var(--text-muted)]'>
													{item.due_date ? <p>Échéance {formatDate(item.due_date)}</p> : null}
													<p className='font-semibold text-[var(--text-dark)]'>{formatCurrency(item.total_amount)}</p>
													<Link to='/factures' className='mt-1 inline-flex items-center text-[var(--primary)] hover:underline'>
														Consulter
													</Link>
												</div>
											</li>
										))}
									</ul>
								)}
							</div>
						))}
					</div>
				)}
			</div>
			</div>
		</div>
	)
}

export default Dashboard
