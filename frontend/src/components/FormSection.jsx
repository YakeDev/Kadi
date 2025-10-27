import clsx from 'clsx'

const baseCard = 'rounded-[var(--radius-xl)] border border-[var(--border)] bg-white/85 p-6 shadow-soft'

const FormSection = ({ title, description, icon: Icon, children, className }) => (
  <section className={clsx(baseCard, 'space-y-4', className)}>
    {(title || description || Icon) && (
      <header className='flex items-start gap-3'>
        {Icon ? (
          <span className='inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'>
            <Icon className='h-4 w-4' />
          </span>
        ) : null}
        <div>
          {title ? <h2 className='text-base font-semibold text-[var(--text-dark)]'>{title}</h2> : null}
          {description ? <p className='text-sm text-[var(--text-muted)]'>{description}</p> : null}
        </div>
      </header>
    )}
    <div className='space-y-3'>{children}</div>
  </section>
)

export default FormSection
