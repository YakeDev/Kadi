import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Clock, CheckCircle2, Plug, ArrowUpRight, Inbox } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'

const cards = [
  { key: 'monthlyRevenue', title: 'Revenus du mois', suffix: 'USD', icon: DollarSign },
  { key: 'outstanding', title: 'En retard', suffix: 'USD', icon: Clock },
  { key: 'paid', title: 'Factures payées', suffix: '', icon: CheckCircle2 }
]

const formatMoney = (value, currency = 'USD') =>
  `${Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`

const Dashboard = () => {
  const [summary, setSummary] = useState({
    monthlyRevenue: 0,
    outstanding: 0,
    paid: 0
  })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const [{ data: summaryData }, { data: invoices }] = await Promise.all([
        api.get('/invoices/summary'),
        api.get('/invoices')
      ])
      setSummary(summaryData)
      setRecentInvoices((invoices || []).slice(0, 5))
    } catch (error) {
      toast.error(error.message, {
        icon: '⚠️'
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const emptyState = useMemo(
    () => recentInvoices.length === 0 && !isLoading,
    [recentInvoices, isLoading]
  )

  return (
    <div className='space-y-8'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <p className='text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]'>Tableau de bord</p>
          <h1 className='mt-2 text-3xl font-semibold text-[var(--text-dark)]'>
            Bonjour, voici votre activité
          </h1>
          <p className='mt-1 text-sm text-[var(--text-muted)]'>
            Visualisez vos revenus, fluidifiez la facturation et relancez vos clients en un coup d’œil.
          </p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Link to='/factures' className='btn-primary'>
            <ArrowUpRight className='h-4 w-4' />
            Créer une facture
          </Link>
          <Link to='/clients' className='btn-secondary'>
            Gérer mes clients
          </Link>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.key} className='card p-6'>
              <div className='flex items-center justify-between'>
                <div className='rounded-full bg-[var(--primary-soft)] p-2 text-[var(--primary)] shadow-soft'>
                  <Icon className='h-5 w-5' />
                </div>
                <span className='text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]'>
                  {card.title}
                </span>
              </div>
              <p className='mt-8 text-3xl font-semibold text-[var(--text-dark)]'>
                {isLoading ? '—' : summary[card.key]?.toLocaleString('fr-FR')}
                {card.suffix && !isLoading ? ` ${card.suffix}` : ''}
              </p>
            </div>
          )
        })}
      </div>

      <div className='grid gap-6 lg:grid-cols-[1.2fr,1fr]'>
        <div className='card flex flex-col gap-4 p-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-[var(--text-dark)]'>Activité récente</h2>
            <Link to='/factures' className='text-sm font-semibold text-[var(--primary)] hover:underline'>
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
            <div className='divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] backdrop-blur'>
              {recentInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className='flex items-center justify-between gap-4 px-4 py-3 text-sm transition hover:bg-[rgba(10,132,255,0.08)]'
                >
                  <div>
                    <p className='font-semibold text-[var(--text-dark)]'>#{invoice.invoice_number}</p>
                    <p className='text-xs text-[var(--text-muted)]'>
                      {invoice.client?.company_name ?? 'Client inconnu'}
                    </p>
                  </div>
                  <div className='flex items-center gap-6'>
                    <span className='text-sm font-semibold text-[var(--text-dark)]'>
                      {formatMoney(invoice.total_amount)}
                    </span>
                    <span className='text-xs text-[var(--text-muted)]'>{invoice.issue_date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='card flex flex-col gap-4 bg-gradient-to-br from-[var(--bg-panel)] via-[var(--bg-panel)] to-[rgba(10,132,255,0.08)] p-6'>
          <div className='flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'>
            <Plug className='h-5 w-5' />
          </div>
          <h3 className='text-xl font-semibold text-[var(--text-dark)]'>Connectez Kadi à vos outils</h3>
          <p className='text-sm text-[var(--text-muted)]'>
            Synchronisez Kadi avec votre CRM et votre outil comptable pour automatiser la création et le suivi des
            factures.
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
