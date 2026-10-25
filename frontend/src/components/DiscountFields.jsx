const DiscountFields = ({ id, label, currency, type = 'none', value = 0, onChange, compact = false }) => (
  <div className={compact ? 'invoice-discount-fields' : 'grid min-w-0 gap-3 sm:grid-cols-2'} data-has-value={type !== 'none'}>
    <div className='min-w-0 space-y-2'>
      <label htmlFor={`${id}-type`} className={compact ? 'sr-only' : 'label'}>{label}</label>
      <select id={`${id}-type`} className='input' value={type} onChange={(event) => onChange({ type: event.target.value, value: 0 })}>
        <option value='none'>{compact ? 'Aucune' : 'Aucune remise'}</option>
        <option value='percent'>{compact ? '%' : 'Pourcentage (%)'}</option>
        <option value='fixed'>{compact ? currency : `Montant fixe (${currency})`}</option>
      </select>
    </div>
    {type !== 'none' ? (
      <div className='min-w-0 space-y-2'>
        <label htmlFor={`${id}-value`} className={compact ? 'sr-only' : 'label'}>{label} ({type === 'percent' ? '%' : currency})</label>
        <input id={`${id}-value`} type='number' min='0' max={type === 'percent' ? '100' : undefined} step='0.01' className='input' value={value} onChange={(event) => onChange({ type, value: Number(event.target.value) })} />
      </div>
    ) : null}
  </div>
)

export default DiscountFields
