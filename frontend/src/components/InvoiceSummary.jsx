import { useState } from 'react'
import DiscountFields from './DiscountFields.jsx'
import { formatInvoiceMoney } from '../utils/invoiceTotals.js'

const InvoiceSummary = ({ form, totals, onChange, onDiscountChange }) => {
  const [isTaxOpen, setIsTaxOpen] = useState(Number(form.tax_rate) > 0)
  const { subtotal, lineDiscountAmount, globalDiscountAmount, netSubtotal, taxAmount, total, currency, calculationError } = totals
  const money = (value) => calculationError ? '—' : formatInvoiceMoney(value, currency)

  return (
    <aside className='invoice-summary' aria-labelledby='invoice-summary-title'>
      <h2 id='invoice-summary-title'>Récapitulatif</h2>
      <dl className='invoice-summary-amounts'>
        <div><dt>Sous-total</dt><dd>{money(subtotal)}</dd></div>
        {lineDiscountAmount > 0 ? <div><dt>Remises sur lignes</dt><dd>−{money(lineDiscountAmount)}</dd></div> : null}
      </dl>
      <div className='invoice-summary-discount'>
        <p>Remise globale</p>
        <DiscountFields compact id='invoice-discount' label='Remise globale' currency={currency}
          type={form.discount_type || 'none'} value={form.discount_value ?? 0} onChange={onDiscountChange} />
        {globalDiscountAmount > 0 ? <p className='invoice-summary-discount-value'><span>Remise appliquée</span><span>−{money(globalDiscountAmount)}</span></p> : null}
      </div>
      {taxAmount > 0 ? <dl className='invoice-summary-amounts'>
        <div><dt>Net avant taxe</dt><dd>{money(netSubtotal)}</dd></div>
        <div><dt>Taxe ({form.tax_rate} %)</dt><dd>{money(taxAmount)}</dd></div>
      </dl> : null}
      <div className='invoice-summary-total'>
        <span>Total</span>
        <output aria-label='Total de la facture' aria-live='polite'>{calculationError ? 'À vérifier' : formatInvoiceMoney(total, currency)}</output>
      </div>
      <details className='invoice-secondary' open={isTaxOpen} onToggle={(event) => setIsTaxOpen(event.currentTarget.open)}>
        <summary>{Number(form.tax_rate) > 0 ? 'Taxe appliquée' : 'Ajouter une taxe'}</summary>
        <div className='invoice-secondary-content'>
          <label htmlFor='invoice-tax-rate'>Taxe optionnelle (%)</label>
          <input id='invoice-tax-rate' type='number' min='0' max='100' step='0.01' value={form.tax_rate}
            onChange={(event) => onChange('tax_rate', event.target.value)} className='input' aria-describedby='invoice-tax-help' />
          <p id='invoice-tax-help'>Laissez 0 si aucune taxe ne s’applique.</p>
        </div>
      </details>
      <div className='invoice-save-options'>
        <label htmlFor='status'>Statut à l’enregistrement</label>
        <select id='status' value={form.status} onChange={(event) => onChange('status', event.target.value)} className='input'>
          <option value='draft'>Brouillon</option>
          <option value='sent'>Envoyée</option>
          <option value='overdue'>En retard</option>
        </select>
        {form.status !== 'draft' ? <p>Une facture émise est définitive : ses montants et coordonnées ne pourront plus être modifiés.</p> : null}
      </div>
    </aside>
  )
}

export default InvoiceSummary
