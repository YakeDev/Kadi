import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, FilePenLine, FileText, Loader2, RefreshCcw, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../services/api.js'
import PageHeader from '../components/PageHeader.jsx'
import PlatformActivityChart from '../components/PlatformActivityChart.jsx'
import { parsePaymentDate } from '../utils/paymentDates.js'

const number = value => Number(value || 0).toLocaleString('fr-FR')
const date = value => value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('fr-FR', { timeZone: 'Africa/Lubumbashi' }) : '—'
const today = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Lubumbashi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-')
}
const daysBefore = (to, count) => { const value = new Date(`${to}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - count); return value.toISOString().slice(0, 10) }
const metrics = [
  ['invoices_created', 'Factures créées'], ['invoices_issued', 'Factures émises'],
  ['companies_registered', 'Nouvelles entreprises'], ['users_registered', 'Nouveaux utilisateurs'],
  ['quotes_created', 'Devis créés'], ['quotes_converted', 'Devis convertis'], ['users_active', 'Utilisateurs actifs']
]
const invoiceStatuses = [['draft', 'Brouillons'], ['sent', 'Émises'], ['partially_paid', 'Partiellement payées'], ['paid', 'Payées'], ['overdue', 'En retard']]

const PlatformAdmin = () => {
  const { isSuperAdmin, platformAccessStatus, refreshPlatformAccess } = useAuth()
  const [range, setRange] = useState(() => ({ from: daysBefore(today(), 29), to: today() }))
  const [draft, setDraft] = useState(range)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dateError, setDateError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [metric, setMetric] = useState('invoices_created')
  useEffect(() => {
    if (!isSuperAdmin || platformAccessStatus !== 'ready') { setData(null); return }
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null)
    api.get('/platform/overview', { params: range, signal: controller.signal })
      .then(({ data: response }) => { if (!controller.signal.aborted) setData(response) })
      .catch(error => { if (!controller.signal.aborted) setError(error?.response?.data?.message || 'Impossible de charger les statistiques. Réessayez.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [range, attempt, isSuperAdmin, platformAccessStatus])
  if (platformAccessStatus === 'loading' || platformAccessStatus === 'idle') return <p role='status'>Vérification de l’accès administrateur…</p>
  if (platformAccessStatus === 'error') return <div role='alert' className='card space-y-3 p-6'><h1 className='text-xl'>Administration indisponible</h1><p>Impossible de vérifier votre accès pour le moment.</p><button type='button' className='btn-primary' onClick={refreshPlatformAccess}>Réessayer</button></div>
  if (!isSuperAdmin) return <div role='alert' className='card space-y-3 p-6'><h1 className='text-xl'>Accès réservé</h1><p>Cet espace est réservé au Super administrateur de Kadi.</p><Link to='/' className='btn-secondary'>Retour au tableau de bord</Link></div>

  const applyRange = event => {
    event.preventDefault()
    const from = parsePaymentDate(draft.from), to = parsePaymentDate(draft.to)
    if (!from || !to || from > to || to > today() || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 365) {
      setDateError('Choisissez une période valide de 366 jours au maximum, sans date future.'); return
    }
    setDateError(''); setRange({ from, to })
  }
  const quickRange = type => {
    const to = today(), from = type === 'today' ? to : type === 'month' ? to.slice(0, 8) + '01' : daysBefore(to, type === 'week' ? 6 : 29)
    setDateError(''); setDraft({ from, to }); setRange({ from, to })
  }
  const totals = data?.totals || {}, period = data?.period || {}
  return <div className='space-y-6'>
    <PageHeader icon={ShieldCheck} title='Administration Kadi' subtitle='Statistiques globales de toutes les entreprises · Heure de Lubumbashi' actions={[
      <button key='refresh' type='button' className='btn-secondary min-h-11 justify-center' onClick={() => setAttempt(value => value + 1)} disabled={loading}><RefreshCcw aria-hidden='true' className='mr-2 h-4 w-4' />Actualiser</button>
    ]} />
    <section className='card space-y-4 p-4' aria-label='Période des statistiques'>
      <div className='flex flex-wrap gap-2'>{[['today', 'Aujourd’hui'], ['week', '7 derniers jours'], ['month', 'Ce mois'], ['30days', '30 derniers jours']].map(([value, label]) => <button key={value} type='button' className='btn-ghost min-h-11 px-3 text-xs' onClick={() => quickRange(value)}>{label}</button>)}</div>
      <form onSubmit={applyRange} className='grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]'>
        <div><label htmlFor='admin-from' className='label'>Du</label><input id='admin-from' type='date' className='input mt-1' value={draft.from} max={draft.to || today()} onChange={event => setDraft(previous => ({ ...previous, from: event.target.value }))} required /></div>
        <div><label htmlFor='admin-to' className='label'>Au inclus</label><input id='admin-to' type='date' className='input mt-1' value={draft.to} max={today()} min={draft.from} onChange={event => setDraft(previous => ({ ...previous, to: event.target.value }))} required /></div>
        <button type='submit' className='btn-primary min-h-11'>Appliquer</button>
      </form>
      {dateError ? <p role='alert' className='text-sm text-red-700'>{dateError}</p> : null}
    </section>
    {loading ? <div role='status' className='flex items-center justify-center gap-2 py-16 text-sm'><Loader2 aria-hidden='true' className='h-5 w-5 animate-spin' />Chargement des statistiques…</div> : null}
    {error ? <div role='alert' className='card space-y-3 p-6'><p>{error}</p><button type='button' className='btn-secondary' onClick={() => setAttempt(value => value + 1)}>Réessayer</button></div> : null}
    {data && !loading && !error ? <>
      <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>
        {[
          ['companies', 'Entreprises inscrites', Building2, `${number(period.companies_registered)} nouvelle(s) sur la période`],
          ['users', 'Utilisateurs inscrits', Users, `${number(period.users_registered)} nouveau(x) sur la période`],
          ['invoices', 'Factures au total', FileText, 'Brouillons et factures émises'],
          ['quotes', 'Devis au total', FilePenLine, `${number(period.quotes_created)} créé(s) sur la période`]
        ].map(([key, label, Icon, detail]) => <section key={key} aria-label={label} className='card min-w-0 space-y-3 p-4 sm:p-5'><div className='flex items-center justify-between gap-2'><h2 className='text-xs text-[var(--text-muted)] sm:text-sm'>{label}</h2><Icon aria-hidden='true' className='h-4 w-4 shrink-0 text-[var(--primary)] sm:h-5 sm:w-5' /></div><p className='break-words text-2xl font-semibold tabular-nums sm:text-3xl'>{number(totals[key])}</p><p className='text-xs text-[var(--text-muted)]'>{detail}</p></section>)}
      </div>
      <section className='space-y-3' aria-labelledby='admin-period-title'>
        <h2 id='admin-period-title' className='text-lg font-semibold'>Du {date(data.range.from)} au {date(data.range.to)}</h2>
        <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>{[
          ['invoices_created', 'Factures créées', 'Nouveaux documents, brouillons inclus'],
          ['invoices_issued', 'Factures émises', 'Selon leur horodatage d’émission'],
          ['quotes_converted', 'Devis convertis', 'Convertis en facture sur la période'],
          ['users_active', 'Utilisateurs actifs', `${number(period.companies_active)} entreprise(s) active(s)`]
        ].map(([key, label, detail]) => <section key={key} aria-label={label} className='card min-w-0 space-y-2 p-4 sm:p-5'><h3 className='text-xs text-[var(--text-muted)] sm:text-sm'>{label}</h3><p className='text-2xl font-semibold tabular-nums'>{number(period[key])}</p><p className='text-xs text-[var(--text-muted)]'>{detail}</p></section>)}</div>
      </section>
      <section className='card min-w-0 space-y-4 p-4' aria-labelledby='admin-chart-title'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'><h2 id='admin-chart-title' className='text-lg font-semibold'>Activité quotidienne</h2><div><label htmlFor='admin-metric' className='sr-only'>Indicateur du graphique</label><select id='admin-metric' className='input min-h-11' value={metric} onChange={event => setMetric(event.target.value)}>{metrics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
        <PlatformActivityChart data={data.daily} metric={metric} label={metrics.find(([value]) => value === metric)?.[1]} />
      </section>
      <section className='card space-y-4 p-5' aria-labelledby='admin-status-title'><h2 id='admin-status-title' className='text-lg font-semibold'>Situation actuelle des factures</h2><dl className='grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5'>{invoiceStatuses.map(([key, label]) => <div key={key}><dt className='text-sm text-[var(--text-muted)]'>{label}</dt><dd className='mt-1 text-xl font-semibold tabular-nums'>{number(data.invoice_statuses?.[key])}</dd></div>)}</dl><p className='border-t border-[var(--border)] pt-3 text-sm text-[var(--text-muted)]'>{number(period.receipts_recorded)} versement(s) enregistré(s) sur la période, annulations comprises.</p></section>
      <details className='card p-4'><summary className='cursor-pointer text-sm font-semibold'>Voir le détail par jour</summary><div className='mt-4 max-h-96 overflow-auto'><table className='w-full min-w-[650px] text-sm'><caption className='sr-only'>Statistiques quotidiennes de Kadi</caption><thead className='sticky top-0 bg-white text-left text-xs text-[var(--text-muted)]'><tr>{['Jour', 'Entreprises inscrites', 'Utilisateurs actifs', 'Factures créées', 'Factures émises', 'Devis créés', 'Devis convertis'].map(label => <th scope='col' className='px-3 py-3' key={label}>{label}</th>)}</tr></thead><tbody>{data.daily.map(day => <tr key={day.date} className='border-t border-[var(--border)]'><th scope='row' className='whitespace-nowrap px-3 py-3 text-left font-medium'>{date(day.date)}</th>{['companies_registered', 'users_active', 'invoices_created', 'invoices_issued', 'quotes_created', 'quotes_converted'].map(key => <td key={key} className='px-3 py-3 tabular-nums'>{number(day[key])}</td>)}</tr>)}</tbody></table></div></details>
      <div className='space-y-2 text-xs leading-relaxed text-[var(--text-muted)]'>
        <p>Les totaux couvrent toutes les entreprises et tous les profils créés, y compris les comptes de test. Un utilisateur actif a ouvert une session visible de Kadi pendant la période. Suivi de l’activité depuis le {date(data.activity_tracking_started_at)}.</p>
        {data.historical_issued_without_timestamp > 0 ? <p>{number(data.historical_issued_without_timestamp)} facture(s) historique(s) sans horodatage d’émission figurent dans les totaux, mais pas dans les émissions quotidiennes.</p> : null}
        <p>Les journées sont calculées de minuit à minuit à Lubumbashi. Les dates choisies sur les factures et les versements peuvent être antérieures à leur enregistrement.</p>
      </div>
    </> : null}
  </div>
}
export default PlatformAdmin
