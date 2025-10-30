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

			const [{ data: summaryData }, { data: invoicesResponse }] = await Promise.all([
				api.get('/invoices/summary', { params }),
				api.get('/invoices', {
					params: {
						page: 1,
						pageSize: 5,
					},
				}),
			])
			setSummary(summaryData)
			setRecentInvoices(invoicesResponse?.data ?? [])
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

			<div className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-panel)]/90 px-4 py-4 shadow-soft'>
				<div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
					<div className='flex items-start gap-3'>
						<span className='hidden h-11 w-11 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft sm:flex'>
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
										'inline-flex h-9 items-center justify-center rounded-full border border-[var(--border)] bg-white/80 px-4 text-xs font-semibold text-[var(--text-muted)] shadow-[0_10px_25px_-20px_rgba(28,28,30,0.24)] transition hover:border-[var(--primary)] hover:text-[var(--text-dark)]',
										period === option.value &&
											'border-[var(--primary)] bg-[rgba(10,132,255,0.12)] text-[var(--primary)] shadow-[0_14px_32px_-18px_rgba(10,132,255,0.45)]'
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
								<div className='flex min-w-[160px] flex-1 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/85 px-3 py-2 text-sm text-[var(--text-dark)] shadow-[0_18px_45px_-40px_rgba(28,28,30,0.22)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[rgba(10,132,255,0.2)]'>
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
								<div className='flex min-w-[160px] flex-1 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/85 px-3 py-2 text-sm text-[var(--text-dark)] shadow-[0_18px_45px_-40px_rgba(28,28,30,0.22)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[rgba(10,132,255,0.2)]'>
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
											: 'bg-[var(--primary)] shadow-glass hover:bg-[#0a7aea]'
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
				<StatsCard
					icon={TrendingUp}
					title='Revenus encaissés'
					value={isLoading ? '—' : formatCurrency(totals.revenue || 0)}
					helperText='Montant des factures payées'
				/>
				<StatsCard
					icon={TrendingDown}
					title='Montant en attente'
					value={isLoading ? '—' : formatCurrency(totals.outstanding || 0)}
					helperText='Factures envoyées ou en retard'
				/>
				<StatsCard
					title='Factures émises'
					value={isLoading ? '—' : formatNumber(totals.invoiceCount || 0)}
					helperText='Nombre de factures sur la période'
				/>
				<StatsCard
					title='Délai moyen de paiement'
					value={
						isLoading
							? '—'
							: `${Number(totals.averagePaymentDelay || 0).toFixed(1)} j`
					}
					helperText='Entre émission et règlement'
				/>
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
						<div className='flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--bg-panel)] py-10 text-center text-sm text-[var(--text-muted)] backdrop-blur'>
							<Inbox className='h-8 w-8 text-[var(--text-muted)]' />
							<div>
								<p className='font-medium'>Aucune facture enregistrée</p>
								<p>Commencez par créer votre première facture.</p>
							</div>
						</div>
					) : (
						<div className='divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] backdrop-blur max-h-48 overflow-y-auto pr-1'>
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

				<div className='card flex flex-col gap-4 bg-gradient-to-br from-[var(--bg-panel)] via-[var(--bg-panel)] to-[rgba(10,132,255,0.08)] p-6'>
					<div className='flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'>
						<LayoutDashboard className='h-5 w-5' />
					</div>
					<h3 className='text-xl font-semibold text-[var(--text-dark)]'>
						Connectez Kadi à vos outils
					</h3>
					<p className='text-sm text-[var(--text-muted)]'>
						Synchronisez Kadi avec votre CRM et votre outil comptable pour
						automatiser la création et le suivi des factures.
					</p>
					<div className='flex flex-col gap-2 sm:flex-row'>
						<button type='button' className='btn-primary w-full justify-center'>
							Configurer maintenant
						</button>
						<button type='button' className='btn-ghost w-full justify-center'>
							En savoir plus
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default Dashboard
