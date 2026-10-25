import { clientIdentifierFields } from '../constants/clientIdentifiers.js'

const ClientIdentifiers = ({ values, onChange, idPrefix }) => (
  <fieldset className='min-w-0 space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4'>
    <legend className='px-1 text-sm font-semibold text-[var(--text-dark)]'>Identifiants administratifs <span className='font-normal text-[var(--text-muted)]'>(facultatif)</span></legend>
    <p id={`${idPrefix}-identifiers-help`} className='text-xs text-[var(--text-muted)]'>Renseignez uniquement les références disponibles. Elles apparaîtront sur les nouveaux devis et factures.</p>
    {clientIdentifierFields.map(({ name, label, placeholder }) => (
      <div key={name} className='flex min-w-0 flex-col gap-2'>
        <label htmlFor={`${idPrefix}-${name}`} className='label'>{label}</label>
        <input id={`${idPrefix}-${name}`} name={name} value={values[name] || ''} onChange={onChange} maxLength={160} placeholder={placeholder} aria-describedby={`${idPrefix}-identifiers-help`} className='input' />
      </div>
    ))}
  </fieldset>
)

export default ClientIdentifiers
