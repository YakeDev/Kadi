import { beforeEach,expect,test,vi } from 'vitest'
import { sanitizeQuote,validateQuote,sanitizeConversion } from '../utils/quotes.js'
const ids={client:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',key:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',payment:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}
const payload=()=>({client_id:ids.client,issue_date:'2026-01-01',valid_until:'2026-02-01',status:'sent',currency:'USD',items:[{description:'Site web',quantity:1,unitPrice:350}],discount_type:'percent',discount_value:10})
const conversion=()=>({idempotency_key:ids.key,version:0,issue_date:'2026-01-10',po_reference:' PO-123 '})
test('quote validation reuses exact invoice calculations, permits sent edits and protects server totals',()=>{
 const {quote}=sanitizeQuote(payload())
 expect(validateQuote(quote).total).toBe(315)
 expect(quote.valid_until).toBe('2026-02-01')
 expect(()=>sanitizeQuote({...payload(),total_amount:1})).toThrow(/autorisés/)
 expect(()=>sanitizeQuote({...payload(),status:'converted'})).toThrow(/brouillon/)
 expect(()=>sanitizeQuote({...payload(),version:undefined},{partial:true})).toThrow(/version/)
 expect(()=>validateQuote({...quote,currency:'CDF',items:quote.items.map(item=>({...item,currency:'USD'}))})).toThrow(/devise/)
})
test('conversion requires evidence, valid dates and supports PO without inventing receipts',()=>{
 expect(sanitizeConversion(conversion())).toMatchObject({po_reference:'PO-123',payment:null})
 for(const change of [{po_reference:''},{version:-1},{due_date:'2026-01-09'},{issue_date:'2026-02-30'},{idempotency_key:'invalid'},{po_reference:'a'.repeat(161)}]) expect(()=>sanitizeConversion({...conversion(),...change})).toThrow()
})
test('a deposit can precede the invoice date and retains its real receipt date',()=>{
 const payment={idempotency_key:ids.payment,amount:150,paid_on:'2026-01-05',method:'cash'}
 expect(sanitizeConversion({...conversion(),po_reference:null,payment}).payment).toMatchObject({amount:150,paid_on:'2026-01-05'})
 expect(()=>sanitizeConversion({...conversion(),payment:{...payment,paid_on:'2099-01-01'}})).toThrow(/date/)
 expect(()=>sanitizeConversion({...conversion(),payment:{...payment,amount:0}})).toThrow(/montant|Montant/)
})
let controller,stored,writes,rpc
beforeEach(async()=>{
 vi.resetModules();writes=[]
 stored={id:'quote-one',tenant_id:'tenant-one',version:0,status:'sent',quote_number:'DEV-TEST',...payload(),subtotal_amount:350,total_amount:315}
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),neq:vi.fn().mockReturnThis(),
  maybeSingle:vi.fn(async()=>({data:stored,error:null})),update:vi.fn(body=>{writes.push(body);return query})}
 rpc=vi.fn(async()=>({data:'invoice-one',error:null}))
 vi.doMock('../models/supabaseClient.js',()=>({supabase:{from:vi.fn(()=>query),rpc}}))
 vi.doMock('../controllers/invoiceController.js',()=>({issueSnapshot:vi.fn(async()=>({client_snapshot:{id:ids.client},issuer_snapshot:{company:'Archive'}})),logoForPdf:vi.fn(async()=>null)}))
 controller=await import('../controllers/quoteController.js')
})
const invoke=async(name,body={})=>{
 const req={params:{id:'quote-one'},tenantId:'tenant-one',user:{id:'actor'},profile:{company:'Test'},body}
 const res={json:vi.fn(),status:vi.fn().mockReturnThis(),setHeader:vi.fn()};const next=vi.fn()
 await controller[name](req,res,next);return {res,next}
}
test('converted quotes remain readable but API editing and PDF export are refused',async()=>{
 stored.status='converted'
 const read=await invoke('getQuote');expect(read.res.json).toHaveBeenCalled()
 for(const name of ['streamQuotePdf','updateQuote']){
  const {next}=await invoke(name,{notes:'Changed',version:0})
  expect(next).toHaveBeenCalledWith(expect.objectContaining({status:409}))
 }
 expect(writes).toEqual([])
})
test('conversion API sends tenant and actor from the session, with no payment for PO-only conversion',async()=>{
 const {next,res}=await invoke('convertQuote',conversion())
 expect(next).not.toHaveBeenCalled()
 expect(rpc).toHaveBeenCalledWith('convert_kadi_quote',expect.objectContaining({p_tenant_id:'tenant-one',p_actor_id:'actor',p_quote_id:'quote-one',p_payment:null,p_po_reference:'PO-123'}))
 expect(res.json).toHaveBeenCalledWith({invoice_id:'invoice-one',quote_id:'quote-one'})
})
test('stale quotes and deposits exceeding the revised total cannot reach the conversion RPC',async()=>{
 const stale=await invoke('convertQuote',{...conversion(),version:1})
 expect(stale.next).toHaveBeenCalledWith(expect.objectContaining({status:409}))
 const excessive=await invoke('convertQuote',{...conversion(),payment:{idempotency_key:ids.payment,amount:316,paid_on:'2026-01-05',method:'cash'}})
 expect(excessive.next).toHaveBeenCalledWith(expect.objectContaining({status:400}))
 expect(rpc).not.toHaveBeenCalled()
})
test('serialized quote responses exclude conversion request data and embedded logo bytes',async()=>{
 Object.assign(stored,{conversion_key:'private-key',conversion_payload:{payment:{amount:150}},issuer_snapshot:{company:'Original',logo_base64:'bytes'}})
 const {res}=await invoke('getQuote')
 expect(res.json.mock.calls[0][0]).toMatchObject({issuer_snapshot:{company:'Original'}})
 expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/private-key|logo_base64|conversion_payload/)
})
