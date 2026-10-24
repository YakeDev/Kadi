import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

const formatNumber = (value) =>
  Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
const shortNumber = (value) =>
  Math.abs(value) >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
    : Math.abs(value) >= 10_000
      ? `${(value / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`
      : formatNumber(value)
const shortLabel = (value, type) => {
  if (type === 'line' && /^\d{4}-\d{2}(-\d{2})?$/.test(value)) {
    return new Intl.DateTimeFormat(
      'fr-FR',
      value.length === 7
        ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
        : { day: 'numeric', month: 'short', timeZone: 'UTC' }
    ).format(
      new Date(`${value.length === 7 ? value + '-01' : value}T12:00:00Z`)
    )
  }
  return value.length > 14 ? `${value.slice(0, 13)}…` : value
}

const DashboardChart = ({
  data = [],
  valueKey = 'total',
  labelKey = 'label',
  type = 'bar',
  className,
  height = 220,
  label = 'Montants de la période'
}) => {
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(400)
  const points = data
    .map((item) => ({
      value: Number(item?.[valueKey] ?? 0),
      label: String(item?.[labelKey] ?? '')
    }))
    .filter((point) => Number.isFinite(point.value))

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) =>
      setContainerWidth(Math.round(entry.contentRect.width))
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [points.length])

  if (!points.length)
    return (
      <p
        className={clsx(
          'rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--text-muted)]',
          className
        )}
      >
        Aucune donnée sur cette période.
      </p>
    )
  if (type === 'line' && points.length === 1)
    return (
      <div className={clsx('card space-y-2 p-5', className)}>
        <p className='text-sm text-[var(--text-muted)]'>
          {shortLabel(points[0].label, type)}
        </p>
        <p className='text-2xl font-semibold'>
          {formatNumber(points[0].value)}
        </p>
        <p className='text-xs text-[var(--text-muted)]'>
          Une seule période disponible. La tendance apparaîtra avec les
          prochaines périodes.
        </p>
      </div>
    )

  const chartWidth = Math.max(containerWidth, points.length * 100 + 24)
  const chartHeight = Math.max(height, 160)
  const padding = 48
  const max = Math.max(...points.map((point) => Math.max(point.value, 0)), 1)
  const step =
    (chartWidth - padding * 2) /
    (type === 'line' ? points.length - 1 : points.length)
  const xAt = (index) =>
    padding + step * (type === 'line' ? index : index + 0.5)
  const yAt = (value) =>
    chartHeight - 36 - (Math.max(value, 0) / max) * (chartHeight - 72)
  const path = points
    .map(
      (point, index) => `${index ? 'L' : 'M'}${xAt(index)},${yAt(point.value)}`
    )
    .join(' ')

  return (
    <div className={clsx('card p-4', className)}>
      <div ref={containerRef} className='w-full overflow-x-auto'>
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role='img'
          aria-label={`${label} : ${points.map((point) => `${point.label} : ${formatNumber(point.value)}`).join(' ; ')}`}
        >
          <line
            x1={padding}
            y1={chartHeight - 36}
            x2={chartWidth - padding}
            y2={chartHeight - 36}
            stroke='var(--border)'
          />
          {type === 'line' ? (
            <path
              d={path}
              fill='none'
              stroke='var(--primary)'
              strokeWidth='3'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          ) : null}
          {points.map((point, index) => (
            <g key={`${point.label}-${index}`}>
              <title>
                {point.label} : {formatNumber(point.value)}
              </title>
              {type === 'bar' ? (
                <rect
                  x={xAt(index) - 20}
                  y={yAt(point.value)}
                  width='40'
                  height={Math.max(chartHeight - 36 - yAt(point.value), 2)}
                  rx='5'
                  fill='var(--primary)'
                />
              ) : (
                <circle
                  cx={xAt(index)}
                  cy={yAt(point.value)}
                  r='5'
                  fill='var(--primary)'
                />
              )}
              <text
                x={xAt(index)}
                y={Math.max(yAt(point.value) - 10, 14)}
                textAnchor='middle'
                fill='var(--text-dark)'
                fontSize='12'
                fontWeight='600'
              >
                {shortNumber(point.value)}
              </text>
              <text
                x={xAt(index)}
                y={chartHeight - 12}
                textAnchor='middle'
                fill='var(--text-muted)'
                fontSize='12'
              >
                {shortLabel(point.label, type)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

export default DashboardChart
