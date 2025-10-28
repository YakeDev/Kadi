import clsx from 'clsx'

const baseTitle = 'text-2xl font-semibold text-[var(--text-dark)]'
const baseSubtitle = 'text-sm text-[var(--text-muted)]'

const PageHeader = ({ icon: Icon, title, subtitle, actions = [], className, align = 'start' }) => {
  return (
    <div
      className={clsx(
        'flex flex-col gap-4 border border-[var(--border)] bg-[var(--bg-panel)]/80 px-5 py-4 shadow-soft backdrop-blur md:flex-row md:items-center md:justify-between',
        'rounded-[var(--radius-xl)]',
        className
      )}
    >
      <div className={clsx('flex flex-1 flex-col gap-3', align === 'center' && 'md:items-center text-center')}>
        <div className={clsx('flex flex-col gap-3 md:flex-row md:items-center md:gap-4', align === 'center' && 'md:justify-center')}>
          {Icon ? (
            <span className='inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'>
              <Icon className='h-5 w-5' />
            </span>
          ) : null}
          <div className='flex flex-col gap-2'>
            {title ? <h1 className={baseTitle}>{title}</h1> : null}
            {subtitle ? <p className={baseSubtitle}>{subtitle}</p> : null}
          </div>
        </div>
      </div>
      {actions.length > 0 ? (
        <div className='flex flex-col gap-3 md:flex-row md:items-center'>{actions.map((action) => action)}</div>
      ) : null}
    </div>
  )
}

export default PageHeader
