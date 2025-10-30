import clsx from 'clsx'

const base = 'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-panel)]/90 p-5 shadow-soft'

const metric = 'text-3xl font-semibold text-[var(--text-dark)]'
const helper = 'text-xs text-[var(--text-muted)]'

const TrendBadge = ({ trend }) => {
  if (!trend) return null
  const isPositive = trend.value >= 0
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isPositive
          ? 'bg-[rgba(16,185,129,0.12)] text-emerald-600'
          : 'bg-[rgba(248,113,113,0.12)] text-rose-500'
      )}
    >
      <span>{isPositive ? '▲' : '▼'}</span>
      {Math.abs(trend.value).toLocaleString()}%
      {trend.label ? <span className='font-normal text-[var(--text-muted)]'>vs {trend.label}</span> : null}
    </span>
  )
}

const StatsCard = ({ icon: Icon, title, value, helperText, trend, className, actions }) => (
  <div className={clsx(base, className)}>
    <div className='flex items-start justify-between gap-3'>
      <div className='space-y-2'>
        {title ? <p className='text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]'>{title}</p> : null}
        <p className={metric}>{value}</p>
        {helperText ? <p className={helper}>{helperText}</p> : null}
        <TrendBadge trend={trend} />
      </div>
      {Icon ? (
        <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'>
          <Icon className='h-5 w-5' />
        </span>
      ) : null}
    </div>
    {actions ? <div className='mt-4 flex flex-wrap gap-2'>{actions}</div> : null}
  </div>
)

export default StatsCard
