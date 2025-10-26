import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'

const cards = [
  { key: 'monthlyRevenue', title: 'Revenus du mois', suffix: 'USD' },
  { key: 'outstanding', title: 'En retard', suffix: 'USD' },
  { key: 'paid', title: 'Factures payées', suffix: '' }
]

const Dashboard = () => {
  const [summary, setSummary] = useState({
    monthlyRevenue: 0,
    outstanding: 0,
    paid: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchSummary = async () => {
    setIsLoading(true)
    try {
      const { data } = await api.get('/invoices/summary')
      setSummary(data)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  return (
    <div className='space-y-8'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-nuit'>Bienvenue sur votre tableau de bord</h1>
          <p className='text-sm text-slate-500'>
            Visualisez vos indicateurs clés et créez rapidement des factures.
          </p>
        </div>
        <div className='flex gap-3'>
          <Link
            to='/factures'
            className='rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90'
          >
            Nouvelle facture
          </Link>
          <Link
            to='/clients'
            className='rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-nuit hover:border-nuit'
          >
            Gérer les clients
          </Link>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-3'>
        {cards.map((card) => (
          <div
            key={card.key}
            className='rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md'
          >
            <p className='text-xs font-medium uppercase tracking-wide text-slate-500'>{card.title}</p>
            <p className='mt-4 text-2xl font-semibold text-nuit'>
              {isLoading ? '…' : summary[card.key]?.toLocaleString('fr-FR')}
              {card.suffix && !isLoading ? ` ${card.suffix}` : ''}
            </p>
          </div>
        ))}
      </div>

      <div className='rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500'>
        Connectez Kadi à vos outils (comptabilité, CRM) dans les paramètres pour automatiser vos flux.
      </div>
    </div>
  )
}

export default Dashboard
