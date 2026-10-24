import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardChart from '../components/DashboardChart.jsx'

test('chart values and full labels remain accessible without hovering', () => {
  render(
    <DashboardChart
      label='Ventes USD'
      data={[{ label: 'Service avec un long intitulé', total: 12000 }]}
    />
  )
  expect(screen.getByRole('img')).toHaveAccessibleName(
    /^Ventes USD : Service avec un long intitulé : 12\s000$/
  )
  expect(screen.getByText('12 k')).toBeInTheDocument()
})

test('one observation shows its amount without implying a trend', () => {
  render(
    <DashboardChart type='line' data={[{ label: '2026-10', total: 350 }]} />
  )
  expect(screen.getByText('350')).toBeInTheDocument()
  expect(screen.getByText(/Une seule période disponible/)).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
