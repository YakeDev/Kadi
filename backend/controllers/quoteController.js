import { supabase } from '../models/supabaseClient.js'
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js'
import { generateInvoiceNumber } from '../utils/validation.js'
import { sanitizeQuote, validateQuote, sanitizeConversion, generateQuoteNumber, quoteTotals } from '../utils/quotes.js'
import { createInvoicePdf } from '../utils/invoicePdf.js'
import { issueSnapshot, logoForPdf } from './invoiceController.js'

const conflict = (message) => Object.assign(new Error(message), { status: 409 })
const read = async (id, tenant) => {
  const { data, error } = await supabase.from('quotes').select('*, client:clients(*)').eq('id',id).eq('tenant_id',tenant).maybeSingle()
  if (error) throw error
  if (!data) throw Object.assign(new Error('Devis introuvable.'),{status:404})
  return data
}
const clientFor = async (id, tenant) => {
  const { data,error } = await supabase.from('clients').select('*').eq('id',id).eq('tenant_id',tenant).maybeSingle()
  if (error) throw error
  if (!data) throw Object.assign(new Error('Client introuvable pour ce compte.'),{status:400})
  return data
}
const present = (quote,tenant) => {
  const { conversion_key, conversion_payload, issuer_snapshot, ...publicQuote } = quote
  const { logo_base64, ...issuer } = issuer_snapshot || {}
  return { ...publicQuote, issuer_snapshot: issuer_snapshot ? issuer : null,
    client: quote.client_snapshot || (quote.client?.tenant_id === tenant ? quote.client : null) }
}
export const listQuotes = async (req,res,next) => {
  try {
    const {page,pageSize,from,to} = getPaginationParams(req.query)
    let query = supabase.from('quotes').select('*, client:clients(*)',{count:'exact'}).eq('tenant_id',req.tenantId)
    if (req.query.status) {
      if (!['draft','sent','converted'].includes(req.query.status)) throw Object.assign(new Error('Statut de devis invalide.'),{status:400})
      query = query.eq('status',req.query.status)
    }
    const term = String(req.query.search || '').trim()
    if (term.length>160) throw Object.assign(new Error('Recherche trop longue.'),{status:400})
    if (term) query = query.ilike('quote_search',`%${term}%`)
    const {data,error,count} = await query.order('created_at',{ascending:false}).order('id').range(from,to)
    if(error)throw error
    res.json({data:(data || []).map(q=>present(q,req.tenantId)),pagination:buildPaginationMeta(count || 0,page,pageSize)})
  }catch(error){next(error)}
}
export const getQuote = async (req,res,next) => {
  try{res.json(present(await read(req.params.id,req.tenantId),req.tenantId))}catch(error){next(error)}
}
export const createQuote = async(req,res,next)=>{
  try{
    const {quote}=sanitizeQuote(req.body)
    const totals=validateQuote(quote)
    const client=await clientFor(quote.client_id,req.tenantId)
    const {data,error}=await supabase.from('quotes').insert({...quote,...quoteTotals(totals),tenant_id:req.tenantId,quote_number:generateQuoteNumber(),client_label:client.company_name}).select('*, client:clients(*)').single()
    if(error)throw error
    res.status(201).json(present(data,req.tenantId))
  }catch(error){next(error)}
}
export const updateQuote = async(req,res,next)=>{
  try{
    const {quote,version}=sanitizeQuote(req.body,{partial:true})
    const existing=await read(req.params.id,req.tenantId)
    if(existing.status==='converted')throw conflict('Un devis converti est consultable uniquement.')
    if(existing.version!==version)throw conflict('Le devis a changé. Rechargez-le avant de modifier.')
    const merged={...existing,...quote}
    const totals=validateQuote(merged)
    const client=await clientFor(merged.client_id,req.tenantId)
    const {data,error}=await supabase.from('quotes').update({...quote,...quoteTotals(totals),client_label:client.company_name})
      .eq('id',existing.id).eq('tenant_id',req.tenantId).eq('version',version).neq('status','converted').select('*, client:clients(*)').maybeSingle()
    if(error)throw error
    if(!data)throw conflict('Le devis a changé. Rechargez-le avant de modifier.')
    res.json(present(data,req.tenantId))
  }catch(error){next(error)}
}
export const convertQuote = async(req,res,next)=>{
  try{
    const input=sanitizeConversion(req.body)
    const quote=await read(req.params.id,req.tenantId)
    let snapshots={}
    if(quote.status!=='converted'){
      if(quote.version!==input.version)throw conflict('Le devis a changé. Rechargez-le avant la conversion.')
      validateQuote(quote)
      if(input.payment && input.payment.amount>Number(quote.total_amount))throw Object.assign(new Error('L’acompte dépasse le total du devis révisé.'),{status:400})
      const client=await clientFor(quote.client_id,req.tenantId)
      snapshots=await issueSnapshot({status:'sent'},req,client)
    }
    const {data,error}=await supabase.rpc('convert_kadi_quote',{
      p_tenant_id:req.tenantId,p_quote_id:quote.id,p_expected_version:input.version,p_operation_id:input.idempotency_key,
      p_invoice_number:generateInvoiceNumber(),p_issue_date:input.issue_date,p_due_date:input.due_date,p_po_reference:input.po_reference,
      p_payment:input.payment,p_client_snapshot:snapshots.client_snapshot || null,p_issuer_snapshot:snapshots.issuer_snapshot || null,p_actor_id:req.user.id
    })
    if(error)throw error
    res.status(201).json({invoice_id:data,quote_id:quote.id})
  }catch(error){next(error)}
}
export const streamQuotePdf = async(req,res,next)=>{
  try{
    const quote=await read(req.params.id,req.tenantId)
    if(quote.status==='converted')throw conflict('Ce devis est converti : son téléchargement est désactivé.')
    const client=await clientFor(quote.client_id,req.tenantId)
    const logo=await logoForPdf(req.profile,req.user.id)
    const latest=await read(quote.id,req.tenantId)
    if(latest.status==='converted' || latest.version!==quote.version)throw conflict('Le devis a changé. Rechargez-le avant de télécharger.')
    const doc=createInvoicePdf({...quote,invoice_number:quote.quote_number,due_date:quote.valid_until,client},req.profile,logo,{kind:'quote'})
    res.setHeader('Content-Type','application/pdf')
    res.setHeader('Content-Disposition',`attachment; filename="devis-${quote.quote_number.replace(/[^a-z0-9_-]/giu,'-')}.pdf"`)
    res.setHeader('Cache-Control','private, no-store')
    doc.on('error',next);doc.pipe(res);doc.end()
  }catch(error){next(error)}
}
