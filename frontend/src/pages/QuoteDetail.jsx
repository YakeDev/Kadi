import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../services/api.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { showErrorToast } from '../utils/errorToast.js'
import { downloadDocument } from '../utils/documentDownload.js'
import InvoicePreview from '../components/InvoicePreview.jsx'
import QuoteConversion from '../components/QuoteConversion.jsx'

const QuoteDetail = () => {
  const { id }=useParams()
  const navigate=useNavigate()
  const { profile }=useAuth()
  const [quote,setQuote]=useState(null)
  const [loading,setLoading]=useState(true)
  const [failed,setFailed]=useState(false)
  const [attempt,setAttempt]=useState(0)
  const [converting,setConverting]=useState(false)
  const [downloading,setDownloading]=useState(false)
  useEffect(()=>{
    let active=true
    setLoading(true);setFailed(false);setQuote(null);setConverting(false)
    api.get(`/quotes/${id}`).then(({data})=>{if(active)setQuote(data)}).catch(error=>{if(active){setFailed(true);showErrorToast(toast.error,error)}}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[id,attempt])
  const download=async()=>{setDownloading(true);try{await downloadDocument(`/quotes/pdf/${id}`,`devis-${quote.quote_number}.pdf`)}catch(error){showErrorToast(toast.error,error);setAttempt(v=>v+1)}finally{setDownloading(false)}}
  if(loading)return <p role='status'>Chargement du devis…</p>
  if(failed || !quote)return <div role='alert' className='card space-y-3 p-5'><p>Impossible de charger le devis.</p><button type='button' className='btn-secondary' onClick={()=>setAttempt(v=>v+1)}>Réessayer</button><Link to='/devis' className='block underline'>Retour aux devis</Link></div>
  const converted=quote.status==='converted'
  return <div className='space-y-4'>
    <Link to='/devis' className='inline-flex min-h-11 items-center text-sm text-[var(--text-muted)]'>← Retour aux devis</Link>
    <header className='flex flex-wrap items-center justify-between gap-4'><div><h1 className='break-words text-2xl'>{quote.quote_number}</h1><p className='mt-1 text-sm text-[var(--text-muted)]'>{converted ? 'Converti · Consultation uniquement' : quote.status==='sent' ? 'Envoyé · Modifiable avant conversion' : 'Brouillon'}</p></div><div className='flex flex-wrap gap-2'>{converted ? <Link className='btn-primary min-h-11' to={`/factures?invoice=${quote.converted_invoice_id}`}>Ouvrir la facture liée</Link> : <><Link className='btn-secondary min-h-11' to={`/devis/nouveau?id=${id}`}>Modifier</Link><button type='button' disabled={downloading} className='btn-secondary min-h-11' onClick={download}>{downloading ? 'Téléchargement…' : 'Télécharger le devis'}</button><button type='button' className='btn-primary min-h-11' onClick={()=>setConverting(true)}>Convertir en facture</button></>}</div></header>
    {converted ? <p className='rounded-lg bg-[var(--primary-soft)] p-3 text-sm'>Ce devis a été converti une seule fois. Il reste consultable ; sa modification et son téléchargement sont désactivés.</p> : null}
    <InvoicePreview documentType='quote' invoice={quote} company={quote.issuer_snapshot || profile} client={quote.client} maxItems={Infinity} />
    {converting && !converted ? <QuoteConversion quote={quote} onClose={()=>setConverting(false)} onConverted={invoiceId=>navigate(`/factures?invoice=${invoiceId}`)} /> : null}
  </div>
}
export default QuoteDetail
