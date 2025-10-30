import clsx from 'clsx'

const FloatingActionButton = ({ icon: Icon, label, onClick, className, disabled }) => (
  <button
    type='button'
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40',
      disabled && 'opacity-60 pointer-events-none',
      className
    )}
  >
    {Icon ? <Icon className='h-4 w-4' /> : null}
    {label}
  </button>
)

export default FloatingActionButton
