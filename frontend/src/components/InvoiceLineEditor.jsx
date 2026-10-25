import { PackageSearch, Trash2 } from 'lucide-react'
import DiscountFields from './DiscountFields.jsx'
import { getInvoiceLineTotals, formatInvoiceMoney } from '../utils/invoiceTotals.js'

const InvoiceLineEditor = ({ item, index, currency, canRemove, onChange, onDiscountChange, onCatalog, onRemove }) => {
  const line = getInvoiceLineTotals(item)
  const number = index + 1

  return (
    <div className='invoice-line' role='group' aria-label={`Ligne ${number}`}>
      <div className='invoice-line-description'>
        <label htmlFor={`line-description-${index}`} className='invoice-mobile-label'>Description</label>
        <textarea
          id={`line-description-${index}`}
          value={item.description}
          onChange={(event) => onChange('description', event.target.value)}
          placeholder='Prestation, produit, service…'
          className='input'
          rows={1}
          required
        />
        <button type='button' className='invoice-text-action' aria-label={`Choisir un article pour la ligne ${number}`} onClick={onCatalog}>
          <PackageSearch aria-hidden='true' className='h-3.5 w-3.5' />
          {item.catalogItemId ? 'Modifier l’article' : 'Catalogue'}
        </button>
      </div>
      <div>
        <label htmlFor={`line-quantity-${index}`} className='invoice-mobile-label'>Quantité</label>
        <input id={`line-quantity-${index}`} type='number' min='0.001' max='1000000' step='0.001'
          value={item.quantity} onChange={(event) => onChange('quantity', event.target.value === '' ? '' : Number(event.target.value))} className='input' required />
      </div>
      <div>
        <label htmlFor={`line-price-${index}`} className='invoice-mobile-label'>Prix unitaire ({currency})</label>
        <input id={`line-price-${index}`} type='number' min='0' step='0.01'
          value={item.unitPrice} onChange={(event) => onChange('unitPrice', event.target.value === '' ? '' : Number(event.target.value))} className='input' required />
      </div>
      <div className='invoice-line-discount'>
        <span className='invoice-mobile-label' aria-hidden='true'>Remise</span>
        <DiscountFields compact id={`line-discount-${index}`} label={`Remise de la ligne ${number}`} currency={currency}
          type={item.discountType || 'none'} value={item.discountValue ?? 0} onChange={onDiscountChange} />
      </div>
      <div className='invoice-line-net'>
        <span className='invoice-mobile-label'>Montant net</span>
        <span>{line.calculationError ? 'À vérifier' : formatInvoiceMoney(line.net, currency)}</span>
      </div>
      <button type='button' className='invoice-remove' disabled={!canRemove} aria-label={`Retirer la ligne ${number}`} onClick={onRemove}>
        <Trash2 aria-hidden='true' className='h-4 w-4' />
      </button>
      {line.calculationError ? <p className='invoice-line-error'>{line.calculationError}</p> : null}
    </div>
  )
}

export default InvoiceLineEditor
