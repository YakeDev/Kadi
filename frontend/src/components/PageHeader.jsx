import clsx from 'clsx'
import { Children, cloneElement } from 'react'
import { Plus, RefreshCcw } from 'lucide-react'
import { isNativeAndroid } from '../native/platform.js'

const baseTitle = 'text-2xl font-semibold text-[var(--text-dark)]'
const baseSubtitle = 'text-sm text-[var(--text-muted)]'

const PageHeader = ({ icon: Icon, title, nativeTitle, nativeCreateLabel, subtitle, actions = [], className, align = 'start' }) => {
  if (isNativeAndroid()) return <header className='native-page-header'>
    <h1>{nativeTitle || title}</h1>
    <div className='native-page-actions'>{actions.filter(Boolean).map(action => action.key === 'refresh' ? cloneElement(action, { className: 'native-icon-button', 'aria-label': 'Actualiser', children: <RefreshCcw aria-hidden='true' /> }) : cloneElement(action, {
      className: `${action.props.className || ''} native-page-action`,
      ...(nativeCreateLabel && action.key === 'create' ? { 'aria-label': action.props['aria-label'] || Children.toArray(action.props.children).filter(child => typeof child === 'string').join('').trim(), children: <><Plus aria-hidden='true' />{nativeCreateLabel}</> } : {})
    }))}</div>
  </header>
  return (
    <div
      className={clsx(
        'flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-white px-5 py-4 xl:flex-row xl:items-center xl:justify-between',
        className
      )}
    >
      <div className={clsx('flex flex-1 flex-col gap-3', align === 'center' && 'md:items-center text-center')}>
        <div className={clsx('flex flex-col gap-3 md:flex-row md:items-center md:gap-4', align === 'center' && 'md:justify-center')}>
          {Icon ? (
            <span className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]'>
              <Icon aria-hidden='true' className='h-5 w-5' />
            </span>
          ) : null}
          <div className='flex flex-col gap-2'>
            {title ? <h1 className={baseTitle}>{title}</h1> : null}
            {subtitle ? <p className={baseSubtitle}>{subtitle}</p> : null}
          </div>
        </div>
      </div>
      {actions.length > 0 ? (
        <div className='flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center'>{actions.map((action) => action)}</div>
      ) : null}
    </div>
  )
}

export default PageHeader
