import { test,before,after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile,readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
const actor='11111111-1111-4111-8111-111111111111',otherActor='22222222-2222-4222-8222-222222222222'
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',otherTenant='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const client='cccccccc-cccc-4ccc-8ccc-cccccccccccc',otherClient='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
let db
before(async()=>{
 db=new PGlite()
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated;`)
 const paths=(await readdir(new URL('../../supabase/migrations/',import.meta.url))).sort()
 for(const [index,path] of paths.entries()){
  await db.exec(await readFile(new URL(`../../supabase/migrations/${path}`,import.meta.url),'utf8'))
  if(index===0) await db.exec(`alter table invoices add column tax_rate numeric default 0;alter table invoices add column tax_amount numeric default 0;
  insert into auth.users values('${actor}','a@example.invalid'),('${otherActor}','b@example.invalid');
  insert into tenants(id,name) values('${tenant}','A'),('${otherTenant}','B');
  insert into profiles(id,tenant_id,email) values('${actor}','${tenant}','a@example.invalid'),('${otherActor}','${otherTenant}','b@example.invalid');
  insert into clients(id,tenant_id,company_name) values('${client}','${tenant}','A'),('${otherClient}','${otherTenant}','B');`)
 }
})
after(async()=>{await db?.close()})
const items=(amount,currency='USD')=>JSON.stringify([{description:'Service',quantity:1,unitPrice:amount,currency}])
const quote=async(amount=400,currency='USD',owner=tenant)=>{
 const id=randomUUID()
 await db.query(`insert into quotes(id,tenant_id,client_id,quote_number,issue_date,status,currency,items,subtotal_amount,total_amount)
 values($1,$2,$3,$4,'2026-01-01','sent',$5,$6,$7,$7)`,[id,owner,owner===tenant?client:otherClient,`DEV-${id}`,currency,items(amount,currency),amount])
 return id
}
const receipt=(amount=150)=>({idempotency_key:randomUUID(),amount,paid_on:'2026-01-05',method:'cash',reference:'Acompte réel'})
const convert=async(id,{key=randomUUID(),po='PO-1',payment=null,version=0,owner=tenant,by=actor}={})=>{
 const c=owner===tenant?client:otherClient
 const result=await db.query(`select convert_kadi_quote($1,$2,$3,$4,$5,'2026-01-10','2026-02-10',$6,$7,$8,$9,$10) as id`,
 [owner,id,version,key,`FAC-${key}`,po,payment?JSON.stringify(payment):null,JSON.stringify({id:c,company_name:'Archive'}),JSON.stringify({company:'Émetteur archivé'}),by])
 return result.rows[0].id
}
const readQuote=async id=>(await db.query('select * from quotes where id=$1',[id])).rows[0]
const readInvoice=async id=>(await db.query('select * from invoices where id=$1',[id])).rows[0]
const count=async id=>(await db.query('select count(*)::int as n from invoices where quote_id=$1',[id])).rows[0].n
test('PO-only conversion creates exactly one unpaid invoice and freezes the quote',async()=>{
 const id=await quote(),invoiceId=await convert(id)
 const bill=await readInvoice(invoiceId)
 assert.equal(bill.po_reference,'PO-1');assert.equal(bill.quote_id,id)
 assert.equal(Number(bill.paid_amount),0);assert.equal(bill.status,'sent')
 assert.equal((await readQuote(id)).status,'converted')
 await assert.rejects(db.query('update quotes set notes=$1 where id=$2',['modification',id]),/consultable/)
 await assert.rejects(db.query('delete from quotes where id=$1',[id]),/consultable/)
 await assert.rejects(convert(id),/déjà été converti/)
 assert.equal(await count(id),1)
})
test('revise a sent quote before attaching a received deposit, then add another receipt to the same invoice',async()=>{
 const id=await quote(350)
 await db.query(`update quotes set subtotal_amount=400,total_amount=400,items=$1 where id=$2`,[items(400),id])
 await assert.rejects(convert(id,{payment:receipt(),po:null}),/a changé/)
 assert.equal(await count(id),0)
 const invoiceId=await convert(id,{version:1,payment:receipt(),po:null})
 let bill=await readInvoice(invoiceId)
 assert.equal(Number(bill.total_amount),400);assert.equal(Number(bill.paid_amount),150);assert.equal(bill.status,'partially_paid')
 await db.query(`select record_kadi_payment($1,$2,$3,100,'2026-01-15','bank_transfer','Second versement',$4)`,[tenant,invoiceId,randomUUID(),actor])
 bill=await readInvoice(invoiceId)
 assert.equal(Number(bill.paid_amount),250);assert.equal(Number(bill.total_amount)-Number(bill.paid_amount),150)
 const snapshot=(await db.query('select kadi_invoice_pdf_state($1,$2) as snapshot',[tenant,invoiceId])).rows[0].snapshot
 assert.equal(snapshot.payments.length,2)
 assert.equal(snapshot.payments.reduce((sum,p)=>sum+Number(p.amount),0),Number(snapshot.invoice.paid_amount))
 assert.equal(await count(id),1)
})
test('missing evidence and invalid receipts roll back invoice and quote together',async()=>{
 const id=await quote(100)
 await assert.rejects(convert(id,{po:'   '}),/obligatoire/)
 for(const payment of [receipt(101),{...receipt(10),paid_on:'2099-01-01'},{...receipt(10),method:'invalid'}]){
  await assert.rejects(convert(id,{po:null,payment}))
  assert.equal(await count(id),0);assert.equal((await readQuote(id)).status,'sent')
 }
})
test('idempotent retries never duplicate the invoice or deposit; altered requests conflict',async()=>{
 const id=await quote(),key=randomUUID(),payment=receipt()
 const first=await convert(id,{key,payment})
 assert.equal(await convert(id,{key,payment}),first)
 await assert.rejects(convert(id,{key,payment:{...payment,amount:151}}),/déjà été converti/)
 assert.equal(await count(id),1)
 assert.equal((await db.query('select count(*)::int as n from invoice_payments where invoice_id=$1',[first])).rows[0].n,1)
})
test('competing conversions create only one invoice; CDF full settlement retains exact cents',async()=>{
 const id=await quote(0.3,'CDF')
 const outcomes=await Promise.allSettled([convert(id,{payment:receipt(0.3)}),convert(id,{payment:receipt(0.3)})])
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1)
 const bill=await readInvoice(outcomes.find(r=>r.status==='fulfilled').value)
 assert.equal(bill.currency,'CDF');assert.equal(bill.status,'paid');assert.equal(Number(bill.paid_amount),0.3)
 assert.equal(await count(id),1)
})
test('tenant isolation, actor checks and browser-role grants protect quote and PDF RPCs',async()=>{
 const id=await quote(400,'USD',otherTenant)
 await assert.rejects(convert(id),/introuvable/)
 await assert.rejects(convert(id,{owner:otherTenant,by:actor}),/refusé/)
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${actor}';`)
 try{
  assert.equal((await db.query('select * from quotes where id=$1',[id])).rows.length,0)
  await assert.rejects(db.query('update quotes set notes=$1',['forbidden']),/permission denied/)
  await assert.rejects(convert(id),/permission denied/)
  await assert.rejects(db.query('select kadi_invoice_pdf_state($1,$2)',[tenant,randomUUID()]),/permission denied/)
 }finally{await db.exec('reset role')}
})
test('verified account deletion removes a converted quote, its invoice and receipts in one tenant',async()=>{
 await db.exec(`insert into kadi_private.platform_admins(user_id,grant_reason)values('${actor}','Deletion test');`)
 const id=await quote(90,'USD',otherTenant)
 const invoiceId=await convert(id,{owner:otherTenant,by:otherActor,payment:receipt(30)})
 await db.exec('set role service_role')
 try{
  const requestId=(await db.query(`insert into account_deletion_requests(user_id,tenant_id,email,status,verified_at,export_acknowledged)
   values($1,$2,'b@example.invalid','pending_review',now(),true) returning id`,[otherActor,otherTenant])).rows[0].id
  await db.query('select kadi_erase_requested_account($1,$2)',[requestId,actor])
  assert.equal((await db.query('select count(*)::int as n from quotes where tenant_id=$1',[otherTenant])).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int as n from invoices where id=$1',[invoiceId])).rows[0].n,0)
  assert.equal((await db.query('select count(*)::int as n from invoice_payments where tenant_id=$1',[otherTenant])).rows[0].n,0)
  assert.ok((await db.query('select count(*)::int as n from quotes where tenant_id=$1',[tenant])).rows[0].n>0)
 }finally{await db.exec('reset role')}
})
