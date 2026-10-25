import { useState } from 'react'
import { expect, test } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PaymentDateField from '../components/PaymentDateField.jsx'
import { parsePaymentDate } from '../utils/paymentDates.js'

const Field = ({ initial = '25/10/2026', today = '2026-10-25' }) => {
  const [value, setValue] = useState(initial)
  return (
    <PaymentDateField
      id="receipt-date"
      value={value}
      onChange={setValue}
      today={today}
    />
  )
}

test('a past day can be selected directly and returns focus to the date field', () => {
  render(<Field />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Choisir la date de réception' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'jeudi 15 octobre 2026' }))
  expect(screen.getByLabelText('Date de réception')).toHaveValue('15/10/2026')
  expect(screen.getByLabelText('Date de réception')).toHaveFocus()
  expect(
    screen.queryByRole('group', { name: 'Calendrier de réception' })
  ).not.toBeInTheDocument()
})

test('the calendar navigates to previous months and keeps future days disabled', () => {
  render(<Field />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Choisir la date de réception' })
  )
  expect(
    screen.getByRole('button', { name: 'lundi 26 octobre 2026' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Mois suivant' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
  expect(screen.getByText('septembre 2026')).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'mercredi 30 septembre 2026' })
  )
  expect(screen.getByLabelText('Date de réception')).toHaveValue('30/09/2026')
})

test('manual French dates and numeric mobile input preserve leap years and reject impossible dates', () => {
  render(<Field />)
  const input = screen.getByLabelText('Date de réception')
  fireEvent.change(input, { target: { value: '29022024' } })
  fireEvent.blur(input)
  expect(input).toHaveValue('29/02/2024')
  expect(parsePaymentDate(input.value)).toBe('2024-02-29')
  expect(parsePaymentDate('29/02/2025')).toBeNull()
  expect(parsePaymentDate('31/04/2026')).toBeNull()
  expect(parsePaymentDate('00/10/2026')).toBeNull()
  expect(parsePaymentDate('01/01/0000')).toBeNull()
})

test('December to January navigation and the today shortcut keep the correct year', () => {
  render(<Field initial="31/12/2025" today="2026-01-10" />)
  fireEvent.click(
    screen.getByRole('button', { name: 'Choisir la date de réception' })
  )
  fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }))
  expect(screen.getByText('janvier 2026')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aujourd’hui' }))
  expect(screen.getByLabelText('Date de réception')).toHaveValue('10/01/2026')
})
