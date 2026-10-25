import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

const AppBrand = ({ compact = false, subtitle = 'Facturation' }) => (
  <Link to='/' aria-label={compact ? `Kadi, ${subtitle} — Tableau de bord` : 'Kadi — Tableau de bord'}
    className='inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]'>
    <span className={`inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] text-white ${compact ? 'h-9 w-9' : 'h-11 w-11'}`}>
      <FileText aria-hidden='true' className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
    </span>
    <span className='min-w-0 leading-tight'>
      <span className={`block font-semibold tracking-tight text-[var(--text-dark)] ${compact ? 'text-lg' : 'text-2xl'}`}>Kadi</span>
      <span className={`block truncate text-xs text-[var(--text-muted)] ${compact ? 'max-w-[140px]' : ''}`} title={subtitle}>{subtitle}</span>
    </span>
  </Link>
)

export default AppBrand
