const DiscountFields = ({ id, label, currency, type = 'none', value = 0, onChange }) => (
  <div className='grid min-w-0 gap-3 sm:grid-cols-2'>
    <div className='min-w-0 space-y-2'>
      <label htmlFor={`${id}-type`} className='label'>{label}</label>
      <select id={`${id}-type`} className='input' value={type} onChange={(event) => onChange({ type: event.target.value, value: 0 })}>
        <option value='none'>Aucune remise</option>
        <option value='percent'>Pourcentage (%)</option>
        <option value='fixed'>Montant fixe ({currency})</option>
      </select>
    </div>
    {type !== 'none' ? (
      <div className='min-w-0 space-y-2'>
        <label htmlFor={`${id}-value`} className='label'>{label} ({type === 'percent' ? '%' : currency})</label>
        <input id={`${id}-value`} type='number' min='0' max={type === 'percent' ? '100' : undefined} step='0.01' className='input' value={value} onChange={(event) => onChange({ type, value: Number(event.target.value) })} />
      </div>
    ) : null}
  </div>
)

export default DiscountFields
