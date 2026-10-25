import { useEffect, useRef, useState } from 'react'

const PlatformActivityChart = ({ data, metric, label }) => {
  const container = useRef(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  if (!data.length) return <p className='py-10 text-center text-sm text-[var(--text-muted)]'>Aucune donnée sur cette période.</p>
  const height = 230, left = 42, right = width - 15, top = 15, bottom = height - 35
  const maximum = Math.max(1, ...data.map(day => Number(day[metric]) || 0))
  const x = index => data.length === 1 ? (left + right) / 2 : left + index * (right - left) / (data.length - 1)
  const y = value => bottom - Number(value || 0) / maximum * (bottom - top)
  const ticks = [...new Set([0, Math.floor(maximum / 2), maximum])]
  const labelCount = Math.min(data.length, width < 500 ? 3 : 6)
  const indices = [...new Set(Array.from({ length: labelCount }, (_, i) => labelCount === 1 ? 0 : Math.round(i * (data.length - 1) / (labelCount - 1))))]
  const path = data.map((day, i) => `${i ? 'L' : 'M'}${x(i)},${y(day[metric])}`).join(' ')
  return <div ref={container} className='min-w-0'>
    <svg role='img' aria-label={`${label} par jour. Le détail est disponible dans le tableau quotidien.`} viewBox={`0 0 ${width} ${height}`} width='100%' height={height}>
      {ticks.map(tick => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke='var(--border)' /><text x={left - 10} y={y(tick) + 4} fontSize='12' textAnchor='end' fill='var(--text-muted)'>{tick.toLocaleString('fr-FR')}</text></g>)}
      <path d={path} fill='none' stroke='var(--primary)' strokeWidth='2.5' strokeLinejoin='round' />
      {data.length <= 60 ? data.map((day, i) => <circle key={day.date} cx={x(i)} cy={y(day[metric])} r={data.length === 1 ? 5 : 3} fill='var(--primary)'><title>{day.date} : {day[metric] || 0}</title></circle>) : null}
      {indices.map(i => <text key={i} x={x(i)} y={height - 10} textAnchor={data.length === 1 ? 'middle' : i === data.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize='12' fill='var(--text-muted)'>{data[i].date.slice(8, 10)}/{data[i].date.slice(5, 7)}</text>)}
    </svg>
  </div>
}
export default PlatformActivityChart
