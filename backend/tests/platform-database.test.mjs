import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222'
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const clientA='cccccccc-cccc-4ccc-8ccc-cccccccccccc',clientB='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
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
    if(index===0) await db.exec('alter table invoices add column tax_rate numeric default 0;alter table invoices add column tax_amount numeric default 0;')
  }
  await db.exec(`insert into auth.users values('${admin}','admin@example.invalid'),('${member}','member@example.invalid');
    insert into tenants(id,name,created_at)values('${a}','A','2026-01-01 21:30'),('${b}','B','2026-01-01 22:30');
    insert into profiles(id,tenant_id,email,created_at)values('${admin}','${a}','admin@example.invalid','2026-01-01 21:30'),('${member}','${b}','member@example.invalid','2026-01-01 22:30');
    insert into clients(id,tenant_id,company_name)values('${clientA}','${a}','A'),('${clientB}','${b}','B');
    insert into invoices(tenant_id,client_id,invoice_number,status,issue_date,items,subtotal_amount,total_amount,created_at)
    values('${a}','${clientA}','A-1','draft','2026-01-01','[{"description":"A","quantity":1,"unitPrice":10}]',10,10,'2026-01-01 21:30'),
      ('${b}','${clientB}','B-1','draft','2026-01-02','[{"description":"B","quantity":1,"unitPrice":10}]',10,10,'2026-01-01 22:30');
    update invoices set status='sent',client_snapshot='{"company_name":"Archive B"}',issuer_snapshot='{"company":"Issuer B"}',issued_at='2026-01-01 22:45Z' where invoice_number='B-1';
    insert into kadi_private.platform_admins(user_id,grant_reason)values('${admin}','Test owner grant');
    insert into kadi_private.platform_activity_days(activity_day,user_id,tenant_id)values('2026-01-01','${admin}','${a}'),('2026-01-02','${admin}','${a}'),('2026-01-02','${member}','${b}');`)
})
after(async()=>{await db?.close()})
const overview=async(actor=admin,from='2026-01-01',to='2026-01-03')=>(await db.query('select public.kadi_platform_overview($1,$2,$3) as data',[actor,from,to])).rows[0].data

test('only the granted platform administrator can read global statistics; revocation applies immediately',async()=>{
  await assert.rejects(overview(member),/Super administrateur/)
  assert.equal((await overview()).totals.companies,2)
  await db.query('update kadi_private.platform_admins set revoked_at=now() where user_id=$1',[admin])
  await assert.rejects(overview(),/Super administrateur/)
  await db.query('update kadi_private.platform_admins set revoked_at=null where user_id=$1',[admin])
})
test('daily counts use Lubumbashi midnight, distinguish creation and issuance and fill empty days',async()=>{
  const data=await overview()
  assert.deepEqual(data.totals,{companies:2,users:2,invoices:2,quotes:0})
  assert.equal(data.daily.length,3)
  assert.deepEqual(data.daily.map(d=>[d.date,d.companies_registered,d.invoices_created,d.invoices_issued]),[
    ['2026-01-01',1,1,0],['2026-01-02',1,1,1],['2026-01-03',0,0,0]
  ])
  assert.equal(data.period.invoices_created,2);assert.equal(data.period.invoices_issued,1)
  assert.equal(data.range.time_zone,'Africa/Lubumbashi')
})
test('period activity counts distinct users and companies rather than adding daily counts',async()=>{
  const data=await overview()
  assert.equal(data.daily[0].users_active,1);assert.equal(data.daily[1].users_active,2)
  assert.equal(data.period.users_active,2);assert.equal(data.period.companies_active,2)
  assert.ok(data.activity_tracking_started_at)
})
test('session recording is idempotent per user/day and cannot set an administrator grant',async()=>{
  await db.exec('set role service_role')
  try{
    const first=(await db.query('select kadi_platform_session($1) as data',[member])).rows[0].data
    await db.query('select kadi_platform_session($1)',[member])
    assert.equal(first.is_super_admin,false)
    const today=(await db.query("select (now() at time zone 'Africa/Lubumbashi')::date as day")).rows[0].day
    assert.equal((await db.query('select count(*)::int as n from kadi_private.platform_activity_days where user_id=$1 and activity_day=$2',[member,today])).rows[0].n,1)
    await assert.rejects(db.query('insert into kadi_private.platform_admins(user_id,grant_reason)values($1,$2)',[member,'forged']),/permission denied/)
  }finally{await db.exec('reset role')}
})
test('browser roles cannot call platform RPCs, read private activity or promote themselves',async()=>{
  for(const role of ['anon','authenticated']){
    await db.exec(`set role ${role};set request.jwt.claim.sub='${admin}'`)
    try{
      for(const sql of [`select * from kadi_private.platform_admins`,`select * from kadi_private.platform_activity_days`,
        `select kadi_platform_admin_status('${admin}')`,`select kadi_platform_session('${admin}')`,
        `select kadi_platform_overview('${admin}','2026-01-01','2026-01-03')`]) await assert.rejects(db.query(sql),/permission denied/)
      if(role==='authenticated')assert.equal((await db.query('select * from invoices')).rows.length,1,'super admin grant does not bypass ordinary company RLS')
    }finally{await db.exec('reset role')}
  }
})
test('aggregated responses contain no customer, user, invoice identifiers or invoice descriptions',async()=>{
  const text=JSON.stringify(await overview())
  for(const secret of [admin,member,clientA,clientB,'admin@example.invalid','Archive B','A-1','B-1'])assert.ok(!text.includes(secret),secret)
  await assert.rejects(overview(admin,'2026-01-03','2026-01-01'),/période/)
  await assert.rejects(overview(admin,'2024-01-01','2026-01-01'),/période/)
  await assert.rejects(overview(admin,'2099-01-01','2099-01-02'),/période/)
})

test('deletion requests are server-only and ordinary invoice immutability remains enforced',async()=>{
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${member}'`)
  try{
    await assert.rejects(db.query('select * from public.account_deletion_requests'),/permission denied/)
    await assert.rejects(db.query('select kadi_erase_requested_account($1,$2)',[member,member]),/permission denied/)
  }finally{await db.exec('reset role')}
  await db.exec('set role service_role')
  try{
    await assert.rejects(db.query("delete from public.invoices where invoice_number='B-1'"),/immutable/)
  }finally{await db.exec('reset role')}
})

test('a verified admin operation deletes only the requested tenant and can be replayed safely',async()=>{
  await db.exec('set role service_role')
  try{
    const {rows:[{id}]}=await db.query(`insert into public.account_deletion_requests(user_id,tenant_id,email,status,verified_at,export_acknowledged)
      values($1,$2,'member@example.invalid','pending_review',now(),true) returning id`,[member,b])
    await assert.rejects(db.query('select kadi_erase_requested_account($1,$2)',[id,member]),/Super administrateur/)
    const result=(await db.query('select kadi_erase_requested_account($1,$2) as data',[id,admin])).rows[0].data
    assert.deepEqual(result,{user_id:member,stage:'data_erased'})
    assert.deepEqual((await db.query('select kadi_erase_requested_account($1,$2) as data',[id,admin])).rows[0].data,result)
    assert.equal((await db.query('select count(*)::int as n from public.invoices where tenant_id=$1',[b])).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int as n from public.tenants where id=$1',[b])).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int as n from public.profiles where id=$1',[member])).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int as n from public.invoices where tenant_id=$1',[a])).rows[0].n,1)
    assert.equal((await db.query('select status from public.account_deletion_requests where id=$1',[id])).rows[0].status,'data_erased')
  }finally{await db.exec('reset role')}
  assert.equal((await db.query('select count(*)::int as n from auth.users where id=$1',[member])).rows[0].n,1,'Auth deletion occurs only after Storage cleanup in the API')
})
