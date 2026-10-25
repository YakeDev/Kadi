import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CalendarRange,
  Loader2,
  Plus,
  RefreshCcw
} from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import StatsCard from '../components/StatsCard.jsx'
import DashboardChart from '../components/DashboardChart.jsx'
import { isNativeAndroid } from '../native/platform.js'
import NativeHome from '../native/NativeHome.jsx'

const PERIODS = [
  { label: 'Jour', value: 'day' },
  { label: 'Mois', value: 'month' },
  { label: 'Année', value: 'year' }
]
const money = (value, currency) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(Number(value || 0))
// Ranges are inclusive calendar days; converting their instants to local time would shift the end date.
const calendarDay = (value) =>
  /^\d{4}-\d{2}-\d{2}/.test(value || '') ? value.slice(0, 10) : ''
const displayDay = (value) =>
  calendarDay(value).split('-').reverse().join('/') || '—'
const TODO_SECTIONS = [
  {
    key: 'overdue',
    label: 'En retard',
    status: 'overdue',
    linkLabel: 'Voir les retards',
    color: 'text-red-700'
  },
  {
    key: 'dueSoon',
    label: 'À échéance',
    status: 'sent',
    linkLabel: 'Voir les envoyées',
    color: 'text-[var(--primary)]'
  },
  {
    key: 'drafts',
    label: 'Brouillons',
    status: 'draft',
    linkLabel: 'Voir les brouillons',
    color: 'text-[var(--text-muted)]'
  }
]
const CHARTS = [
  {
    key: 'revenue',
    title: 'Tendance des revenus',
    labelKey: 'label',
    type: 'line'
  },
  {
    key: 'topClients',
    title: 'Principaux clients',
    labelKey: 'company',
    type: 'bar'
  },
  {
    key: 'topProducts',
    title: 'Produits et services',
    labelKey: 'label',
    type: 'bar'
  }
]

const Dashboard = () => {
  const { user, profile } = useAuth()
  const [period, setPeriod] = useState('month')
  const [currency, setCurrency] = useState('USD')
  const [state, setState] = useState({ status: 'loading' })
  const [rangeDraft, setRangeDraft] = useState({ start: '', end: '' })
  const [customRange, setCustomRange] = useState(false)
  const [rangeError, setRangeError] = useState('')
  const requestVersion = useRef(0)
  const requestedRange = useRef(null)
  const dateDetailsRef = useRef(null)

  const fetchData = useCallback(
    async (selectedRange = null) => {
      const version = ++requestVersion.current
      requestedRange.current = selectedRange
      setState({ status: 'loading' })
      const params = { period, currency, ...(selectedRange || {}) }
      try {
        const [{ data: summary }, { data: invoices }, { data: todo }] =
          await Promise.all([
            api.get('/invoices/summary', { params }),
            api.get('/invoices', { params: { page: 1, pageSize: 5 } }),
            api.get('/invoices/todo')
          ])
        if (version !== requestVersion.current) return
        if (
          !summary?.totals ||
          ![
            summary.totals.revenue,
            summary.totals.outstanding,
            summary.totals.invoiceCount
          ].every(
            (value) => typeof value === 'number' && Number.isFinite(value)
          ) ||
          !Array.isArray(invoices?.data)
        )
          throw new Error('Incomplete dashboard response')
        setState({
          status: 'ready',
          summary,
          recent: invoices?.data ?? [],
          todo: {
            overdue: todo?.overdue ?? [],
            dueSoon: todo?.dueSoon ?? [],
            drafts: todo?.drafts ?? []
          }
        })
        setRangeDraft({
          start: calendarDay(summary.meta?.startDate),
          end: calendarDay(summary.meta?.endDate)
        })
        setCustomRange(Boolean(selectedRange))
        setRangeError('')
      } catch {
        if (version === requestVersion.current) setState({ status: 'error' })
      }
    },
    [period, currency]
  )

  useEffect(() => {
    fetchData()
    return () => {
      requestVersion.current += 1
    }
  }, [fetchData])

  const applyRange = (event) => {
    event.preventDefault()
    if (
      !rangeDraft.start ||
      !rangeDraft.end ||
      rangeDraft.start > rangeDraft.end
    ) {
      setRangeError(
        'Choisissez une date de fin égale ou postérieure à la date de début.'
      )
      return
    }
    fetchData({ start: rangeDraft.start, end: rangeDraft.end })
  }
  const changeRange = () => {
    dateDetailsRef.current.open = true
    document.getElementById('range-start')?.focus()
  }

  const isLoading = state.status === 'loading'
  const isReady = state.status === 'ready'
  const totals = state.summary?.totals ?? {}
  const charts = state.summary?.charts ?? {}
  const meta = state.summary?.meta ?? {}
  const recent = state.recent ?? []
  const isNewAccount = isReady && recent.length === 0
  const isEmptyPeriod = isReady && Number(totals.invoiceCount || 0) === 0 && Number(totals.revenue || 0) === 0 && Number(totals.draftCount || 0) === 0
  const name =
    user?.user_metadata?.full_name ||
    profile?.manager_name ||
    profile?.company ||
    ''
  const availableCharts = CHARTS.filter(
    (chart) => charts[chart.key]?.length > 0
  )

  if (isNativeAndroid()) return <NativeHome name={name} state={state} period={period} setPeriod={setPeriod} currency={currency} setCurrency={setCurrency} customRange={customRange} rangeDraft={rangeDraft} setRangeDraft={setRangeDraft} rangeError={rangeError} applyRange={applyRange} fetchData={fetchData} requestedRange={requestedRange} chartDefinitions={CHARTS} />

  return (
    <div className='space-y-5'>
      <header className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl'>Tableau de bord</h1>
          <p className='mt-1 text-sm text-[var(--text-muted)]'>
            {name ? `Bonjour ${name}. ` : ''}Voici votre activité.
          </p>
        </div>
        <Link to='/factures/nouvelle' className='btn-primary justify-center'>
          <Plus className='h-4 w-4' />
          Nouvelle facture
        </Link>
      </header>

      <section
        aria-label='Filtres du tableau de bord'
        className='card space-y-3 p-4'
      >
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex flex-wrap gap-1' aria-label='Période'>
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type='button'
                aria-pressed={!customRange && period === option.value}
                onClick={() => {
                  if (period === option.value) fetchData()
                  else setPeriod(option.value)
                }}
                className={
                  !customRange && period === option.value
                    ? 'btn-secondary bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'btn-ghost'
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <label htmlFor='summary-currency' className='text-sm font-medium'>
            Devise
          </label>
          <select
            id='summary-currency'
            className='input w-auto'
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value='USD'>USD</option>
            <option value='CDF'>CDF</option>
          </select>
          <span className='text-sm text-[var(--text-muted)]'>
            {isReady
              ? `${displayDay(meta.startDate)} – ${displayDay(meta.endDate)}`
              : 'Période à charger'}
          </span>
        </div>
        <details ref={dateDetailsRef}>
          <summary className='cursor-pointer text-sm font-medium text-[var(--primary)]'>
            Choisir des dates
          </summary>
          <form
            onSubmit={applyRange}
            className='mt-3 flex flex-wrap items-end gap-3'
          >
            <div className='min-w-0 flex-1'>
              <label htmlFor='range-start' className='label'>
                Du
              </label>
              <input
                id='range-start'
                aria-describedby={rangeError ? 'range-error' : undefined}
                type='date'
                required
                value={rangeDraft.start}
                onChange={(event) =>
                  setRangeDraft((prev) => ({
                    ...prev,
                    start: event.target.value
                  }))
                }
                className='input mt-1'
              />
            </div>
            <div className='min-w-0 flex-1'>
              <label htmlFor='range-end' className='label'>
                Au, inclus
              </label>
              <input
                id='range-end'
                type='date'
                required
                min={rangeDraft.start || undefined}
                value={rangeDraft.end}
                onChange={(event) =>
                  setRangeDraft((prev) => ({
                    ...prev,
                    end: event.target.value
                  }))
                }
                className='input mt-1'
              />
            </div>
            <button className='btn-primary' disabled={isLoading}>
              Appliquer
            </button>
            {customRange ? (
              <button
                type='button'
                className='btn-ghost'
                disabled={isLoading}
                onClick={() => fetchData()}
              >
                Réinitialiser
              </button>
            ) : null}
          </form>
          {rangeError ? (
            <p
              id='range-error'
              role='alert'
              className='mt-2 text-sm text-red-700'
            >
              {rangeError}
            </p>
          ) : null}
          <p className='mt-2 text-xs text-[var(--text-muted)]'>
            Encaissements selon la date de réception ; factures et soldes selon la date d’émission, dans la devise choisie.
            Aucune conversion automatique.
          </p>
        </details>
      </section>

      {isLoading ? (
        <div
          role='status'
          className='card flex items-center gap-2 p-6 text-sm text-[var(--text-muted)]'
        >
          <Loader2 className='h-4 w-4 animate-spin' />
          Chargement de votre activité…
        </div>
      ) : null}
      {state.status === 'error' ? (
        <section
          role='alert'
          className='card flex flex-col items-start gap-3 p-6'
        >
          <AlertCircle className='h-6 w-6 text-red-700' />
          <h2 className='text-lg'>Données indisponibles</h2>
          <p className='text-sm text-[var(--text-muted)]'>
            Le chargement a échoué. Les montants et les factures ne peuvent pas
            être affichés pour le moment.
          </p>
          <button
            type='button'
            onClick={() => fetchData(requestedRange.current)}
            className='btn-primary'
          >
            <RefreshCcw className='h-4 w-4' />
            Réessayer
          </button>
        </section>
      ) : null}

      {isReady ? (
        <>
          <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>
            <StatsCard
              title='Revenus encaissés'
              value={money(totals.revenue, currency)}
              helperText='Versements reçus sur la période'
              actions={
                <Link
                  to='/factures'
                  className='text-sm font-medium text-[var(--primary)]'
                >
                  Voir les factures
                </Link>
              }
            />
            <StatsCard
              title='Montant en attente'
              value={money(totals.outstanding, currency)}
              helperText='Solde actuel des factures émises sur la période'
              actions={
                <Link
                  to='/factures?status=overdue'
                  className='text-sm font-medium text-[var(--primary)]'
                >
                  Voir les retards
                </Link>
              }
            />
            <StatsCard
              title='Factures émises'
              value={Number(totals.invoiceCount || 0).toLocaleString('fr-FR')}
              helperText='Sur la période choisie'
              actions={
                <Link
                  to='/factures'
                  className='text-sm font-medium text-[var(--primary)]'
                >
                  Ouvrir la liste
                </Link>
              }
            />
            <StatsCard
              title='Délai de paiement'
              value={
                totals.averagePaymentDelay == null
                  ? '—'
                  : `${Number(totals.averagePaymentDelay).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`
              }
              helperText='Délai moyen observé'
            />
          </div>

          {isNewAccount ? (
            <section className='card space-y-2 border-dashed p-5'>
              <h2 className='text-lg'>Votre première facture vous attend</h2>
              <p className='text-sm text-[var(--text-muted)]'>
                Utilisez « Nouvelle facture » pour commencer. Vous pourrez
                ajouter un client pendant la saisie.
              </p>
              <Link
                to='/clients'
                className='inline-block text-sm font-medium text-[var(--primary)]'
              >
                Gérer mes clients
              </Link>
            </section>
          ) : isEmptyPeriod ? (
            <section className='card flex flex-wrap items-center justify-between gap-3 border-dashed p-5'>
              <div>
                <h2 className='text-base'>Aucune donnée sur cette période</h2>
                <p className='mt-1 text-sm text-[var(--text-muted)]'>
                  Vos autres factures restent disponibles dans la liste.
                </p>
              </div>
              <button
                type='button'
                onClick={changeRange}
                className='btn-secondary'
              >
                <CalendarRange className='h-4 w-4' />
                Changer de période
              </button>
            </section>
          ) : null}

          <section className='card p-4'>
            <h2 className='text-base'>
              À suivre aujourd’hui{' '}
              <span className='text-xs font-normal text-[var(--text-muted)]'>
                · Toutes périodes et devises
              </span>
            </h2>
            <div className='mt-3 grid gap-2 sm:grid-cols-3'>
              {TODO_SECTIONS.map((section) => (
                <Link
                  key={section.key}
                  to={`/factures?status=${section.status}`}
                  className='flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm'
                >
                  <span>{section.label}</span>
                  <span className={`font-semibold ${section.color}`}>
                    {state.todo[section.key].length}
                  </span>
                </Link>
              ))}
            </div>
            {TODO_SECTIONS.some(
              (section) => state.todo[section.key].length > 0
            ) ? (
              <div className='mt-3 grid gap-3 md:grid-cols-3'>
                {TODO_SECTIONS.filter(
                  (section) => state.todo[section.key].length > 0
                ).map((section) => (
                  <div key={section.key} className='min-w-0'>
                    <h3 className='text-sm'>{section.label}</h3>
                    <ul className='mt-2 space-y-2'>
                      {state.todo[section.key].slice(0, 3).map((item) => (
                        <li
                          key={item.id}
                          className='rounded-lg bg-[var(--bg-base)] p-3 text-sm'
                        >
                          <p className='break-words font-medium'>
                            {item.client?.company_name || 'Client'} ·{' '}
                            {money(
                                item.balance_due ?? item.total_amount,
                              item.currency === '$'
                                ? 'USD'
                                : item.currency || 'USD'
                            )}
                          </p>
                          <p className='mt-1 break-words text-xs text-[var(--text-muted)]'>
                            #{item.invoice_number}
                            {item.due_date
                              ? ` · Échéance ${displayDay(item.due_date)}`
                              : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={`/factures?status=${section.status}`}
                      className='mt-2 inline-block text-sm text-[var(--primary)]'
                    >
                      {section.linkLabel}
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {recent.length > 0 ? (
            <section className='card p-4'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h2 className='text-base'>Factures récentes</h2>
                <Link
                  to='/factures'
                  className='text-sm font-medium text-[var(--primary)]'
                >
                  Tout voir
                </Link>
              </div>
              <p className='mt-1 text-xs text-[var(--text-muted)]'>
                Toutes périodes et devises
              </p>
              <ul className='mt-3 divide-y divide-[var(--border)]'>
                {recent.map((invoice) => (
                  <li
                    key={invoice.id}
                    className='flex flex-wrap items-center justify-between gap-2 py-3 text-sm'
                  >
                    <div className='min-w-0'>
                      <p className='break-words font-medium'>
                        {invoice.client?.company_name || 'Client'}
                      </p>
                      <p className='break-words text-xs text-[var(--text-muted)]'>
                        #{invoice.invoice_number} ·{' '}
                        {displayDay(invoice.issue_date)}
                      </p>
                    </div>
                    <span className='font-semibold'>
                      {money(
                        invoice.total_amount,
                        invoice.currency === '$'
                          ? 'USD'
                          : invoice.currency || 'USD'
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!isEmptyPeriod && availableCharts.length > 0 ? (
            <section
              aria-label='Graphiques de la période'
              className='grid items-start gap-4 xl:grid-cols-2'
            >
              {availableCharts.map((chart) => (
                <div key={chart.key} className='min-w-0'>
                  <h2 className='mb-2 text-sm'>
                    {chart.title} ({currency})
                  </h2>
                  <DashboardChart
                    label={`${chart.title} (${currency})`}
                    data={charts[chart.key]}
                    labelKey={chart.labelKey}
                    type={chart.type}
                    height={220}
                  />
                </div>
              ))}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default Dashboard
