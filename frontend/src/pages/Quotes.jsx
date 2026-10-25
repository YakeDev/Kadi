import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'
import { showErrorToast } from '../utils/errorToast.js'
import { formatInvoiceMoney } from '../utils/invoiceTotals.js'
import { downloadDocument } from '../utils/documentDownload.js'
import Pagination from '../components/Pagination.jsx'

const labels = { draft: 'Brouillon', sent: 'Envoyé', converted: 'Converti' }
const Quotes = () => {
  const [rows,setRows] = useState([])
  const [status,setStatus] = useState('')
  const [search,setSearch] = useState('')
  const [query,setQuery] = useState('')
  const [page,setPage] = useState(1)
  const [meta,setMeta] = useState({total:0,totalPages:1})
  const [loading,setLoading] = useState(true)
  const [failure,setFailure] = useState(false)
  const [attempt,setAttempt] = useState(0)
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(1)},250);return()=>clearTimeout(timer)},[search])
  useEffect(()=>{
    const controller=new AbortController()
    setLoading(true);setFailure(false)
    api.get('/quotes',{params:{page,pageSize:10,status:status || undefined,search:query || undefined},signal:controller.signal})
      .then(({data})=>{if(!controller.signal.aborted){setRows(data.data || []);setMeta(data.pagination || {total:0,totalPages:1})}})
      .catch(error=>{if(!controller.signal.aborted){setFailure(true);showErrorToast(toast.error,error)}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[page,status,query,attempt])
  const download=async quote=>{try{await downloadDocument(`/quotes/pdf/${quote.id}`,`devis-${quote.quote_number}.pdf`)}catch(error){showErrorToast(toast.error,error)}}
  return <div className='space-y-5'>
    <header className='flex flex-wrap items-center justify-between gap-4'><div><h1 className='text-2xl'>Devis</h1><p className='mt-1 text-sm text-[var(--text-muted)]'>Préparez votre offre, puis convertissez-la en facture à réception d’un PO ou d’un acompte.</p></div><Link to='/devis/nouveau' className='btn-primary min-h-11'><Plus aria-hidden='true' className='h-4 w-4' />Nouveau devis</Link></header>
    <section className='card min-w-0 overflow-hidden'>
      <div className='grid gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-2'><label className='text-sm'>Rechercher un devis<input value={search} onChange={e=>setSearch(e.target.value)} className='input mt-1' maxLength={160} placeholder='Numéro ou client' /></label><label className='text-sm'>Statut du devis<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}} className='input mt-1'><option value=''>Tous</option><option value='draft'>Brouillons</option><option value='sent'>Envoyés</option><option value='converted'>Convertis</option></select></label></div>
      {loading ? <p role='status' className='p-5 text-sm'>Chargement des devis…</p> : failure ? <div role='alert' className='space-y-3 p-5'><p>Impossible de charger les devis.</p><button className='btn-secondary' type='button' onClick={()=>setAttempt(v=>v+1)}>Réessayer</button></div> : !rows.length ? <p className='p-6 text-sm text-[var(--text-muted)]'>Aucun devis à afficher.</p> : <table className='responsive-records w-full text-sm'><thead><tr className='border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]'>{['Devis','Client','Validité','Total','Statut','Actions'].map(t=><th key={t} className='p-4'>{t}</th>)}</tr></thead><tbody>{rows.map(q=><tr key={q.id} className='border-b border-[var(--border)]'>
        <td data-label='Devis' className='break-words p-4 font-medium'><Link to={`/devis/${q.id}`} className='text-[var(--primary)] underline'>{q.quote_number}</Link></td>
        <td data-label='Client' className='break-words p-4'>{q.client?.company_name || 'Client'}</td><td data-label='Validité' className='p-4'>{q.valid_until ? new Date(q.valid_until).toLocaleDateString('fr-FR') : '—'}</td><td data-label='Total' className='p-4 tabular-nums'>{formatInvoiceMoney(q.total_amount,q.currency)}</td><td data-label='Statut' className='p-4'>{labels[q.status]}</td>
        <td className='p-4'><div className='flex flex-wrap items-center gap-2'><Link className='btn-secondary min-h-11' to={`/devis/${q.id}`}>Consulter</Link>{q.status!=='converted' ? <><Link className='btn-ghost min-h-11' to={`/devis/nouveau?id=${q.id}`}>Modifier</Link><button type='button' aria-label={`Télécharger ${q.quote_number}`} className='btn-ghost min-h-11' onClick={()=>download(q)}><FileDown aria-hidden='true' className='h-4 w-4' />PDF</button></> : null}</div></td>
      </tr>)}</tbody></table>}
      <Pagination page={page} pageSize={10} total={meta.total} totalPages={meta.totalPages} onPageChange={setPage} isLoading={loading} />
    </section>
  </div>
}
export default Quotes
