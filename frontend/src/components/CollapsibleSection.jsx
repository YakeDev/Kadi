import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const CollapsibleSection = ({
  title,
  description,
  defaultOpen = true,
  children,
  action,
  className
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <section
      className={clsx(
        'rounded-[var(--radius-xl)] border border-[var(--border)] bg-white',
        className
      )}
    >
      <header
        className='flex items-start justify-between gap-3 px-5 py-4'
      >
        <button
          type='button'
          onClick={() => setIsOpen((prev) => !prev)}
          className='flex flex-1 items-start gap-3 text-left'
          aria-expanded={isOpen}
        >
          <span className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]'>
            <ChevronDown
              className={clsx(
                'h-4 w-4 transition-transform duration-200',
                isOpen ? 'rotate-0' : '-rotate-90'
              )}
            />
          </span>
          <div className='space-y-1'>
            {title ? (
              <h3 className='text-sm font-semibold text-[var(--text-dark)]'>
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className='text-xs text-[var(--text-muted)]'>{description}</p>
            ) : null}
          </div>
        </button>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </header>
      {isOpen ? <div className='border-t border-[var(--border)] px-5 py-5 space-y-4'>{children}</div> : null}
    </section>
  )
}

export default CollapsibleSection
