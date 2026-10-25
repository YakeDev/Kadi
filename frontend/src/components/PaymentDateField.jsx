import { useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPaymentDate, parsePaymentDate } from '../utils/paymentDates.js'
import { paymentDateToday } from '../utils/payments.js'

const dayLabel = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
})
const monthLabel = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
})
const weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const monthDate = (month) => new Date(`${month}-01T12:00:00Z`)
const moveMonth = (month, offset) => {
  const date = monthDate(month)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

const PaymentDateField = ({
  id,
  value,
  onChange,
  today = paymentDateToday()
}) => {
  const [open, setOpen] = useState(false)
  const selected = parsePaymentDate(value)
  const [month, setMonth] = useState((selected || today).slice(0, 7))
  const inputRef = useRef(null)
  const firstDay = monthDate(month)
  const days = new Date(
    Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)
  ).getUTCDate()
  const offset = (firstDay.getUTCDay() + 6) % 7

  const chooseDate = (date) => {
    onChange(formatPaymentDate(date))
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">
        Date de réception
      </label>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          required
          maxLength={10}
          placeholder="JJ/MM/AAAA"
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          className="input w-full pr-12"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (selected) onChange(formatPaymentDate(selected))
          }}
        />
        <button
          type="button"
          aria-label="Choisir la date de réception"
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--primary)] hover:bg-[var(--primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          onClick={() => {
            if (!open)
              setMonth(
                (selected && selected <= today ? selected : today).slice(0, 7)
              )
            setOpen((previous) => !previous)
          }}
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--text-muted)]">
        JJ/MM/AAAA · Vous pouvez choisir une date passée.
      </p>
      {open ? (
        <div
          id={`${id}-calendar`}
          role="group"
          aria-label="Calendrier de réception"
          className="mt-2 rounded-lg border border-[var(--border)] bg-white p-2"
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="Mois précédent"
              disabled={month === '0001-01'}
              onClick={() => setMonth(moveMonth(month, -1))}
              className="btn-ghost h-9 w-9 shrink-0 justify-center p-1 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p
              className="text-center text-sm font-semibold capitalize"
              aria-live="polite"
            >
              {monthLabel.format(firstDay)}
            </p>
            <button
              type="button"
              aria-label="Mois suivant"
              disabled={month >= today.slice(0, 7)}
              onClick={() => setMonth(moveMonth(month, 1))}
              className="btn-ghost h-9 w-9 shrink-0 justify-center p-1 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {weekdays.map((day, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="py-1 text-center text-xs text-[var(--text-muted)]"
              >
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span key={`empty-${index}`} aria-hidden="true" />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const date = `${month}-${String(index + 1).padStart(2, '0')}`
              const isSelected = date === selected
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={dayLabel.format(new Date(`${date}T12:00:00Z`))}
                  aria-pressed={isSelected}
                  aria-current={date === today ? 'date' : undefined}
                  disabled={date > today}
                  onClick={() => chooseDate(date)}
                  className={`flex h-9 min-w-0 items-center justify-center rounded-lg text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:text-slate-300 ${isSelected ? 'bg-[var(--primary)] font-semibold text-white' : 'text-[var(--text-dark)] hover:bg-[var(--primary-soft)]'}`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2">
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => chooseDate(today)}
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => {
                setOpen(false)
                inputRef.current?.focus()
              }}
            >
              Fermer le calendrier
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PaymentDateField
