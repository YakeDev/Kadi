import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const uid1 = '11111111-1111-4111-8111-111111111111'
const uid2 = '22222222-2222-4222-8222-222222222222'
const t1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const t2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const c1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const c2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const legacyId = randomUUID()
const zeroId = randomUUID()
let db

before(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;`)
  const paths = (await readdir(new URL('../../supabase/migrations/', import.meta.url))).sort()
  const sql = (path) => readFile(new URL(`../../supabase/migrations/${path}`, import.meta.url), 'utf8')
  await db.exec(await sql(paths[0]))
  await db.exec(`insert into auth.users values ('${uid1}', 'one@example.invalid'), ('${uid2}', 'two@example.invalid');
    insert into tenants(id,name) values ('${t1}', 'One'), ('${t2}', 'Two');
    insert into profiles(id,tenant_id,email) values ('${uid1}','${t1}','one@example.invalid'), ('${uid2}','${t2}','two@example.invalid');
    insert into clients(id,tenant_id,company_name) values ('${c1}','${t1}','One'), ('${c2}','${t2}','Two');
    alter table invoices add column tax_rate numeric default 0;
    alter table invoices add column tax_amount numeric default 0;
    insert into invoices(id,tenant_id,client_id,invoice_number,status,issue_date,subtotal_amount,tax_rate,tax_amount,total_amount,currency)
      values ('${legacyId}','${t1}','${c1}','LEGACY','paid','2026-01-01',100,16,15,115,'USD'),
      ('${zeroId}','${t1}','${c1}','ZERO-PAID','paid','2026-01-01',0,0,0,0,'CDF');`)
  await db.exec(await sql(paths[1]))
  await db.exec(await sql(paths.find((path) => path.includes('partial_payments'))))
  await db.exec(await sql(paths.find((path) => path.includes('invoice_discounts'))))
})
after(async () => { await db?.close() })

const bill = async (amount = 350, currency = 'USD', tenant = t1, status = 'sent') => {
  const id = randomUUID()
  await db.query(`insert into invoices(id,tenant_id,client_id,invoice_number,status,issue_date,due_date,subtotal_amount,total_amount,currency,items,client_snapshot,issuer_snapshot,issued_at)
    values ($1,$2,$3,$4,$5,'2026-01-01','2026-02-01',$6,$6,$7,$8,'{"company_name":"Archived client"}','{"company":"Archived issuer"}',now())`,
  [id, tenant, tenant === t1 ? c1 : c2, `TEST-${id}`, status, amount, currency,
    JSON.stringify([{ description: 'Service', quantity: 1, unitPrice: amount, currency }])])
  return id
}
const readBill = async (id) => (await db.query('select * from invoices where id=$1', [id])).rows[0]
const record = async (invoiceId, amount, { id = randomUUID(), tenant = t1, actor = uid1, date = '2026-01-05' } = {}) => {
  await db.query(`select record_kadi_payment($1,$2,$3,$4,$5,'cash',null,$6)`, [tenant, invoiceId, id, amount, date, actor])
  return id
}
const voidReceipt = (invoiceId, id, tenant = t1, actor = uid1, reason = 'Erreur de saisie') =>
  db.query('select void_kadi_payment($1,$2,$3,$4,$5)', [tenant, invoiceId, id, reason, actor])
const asRole = async (role, callback, uid = uid1) => {
  await db.exec(`set role ${role}; set request.jwt.claim.sub='${uid}';`)
  try { return await callback() } finally { await db.exec('reset role') }
}

test('legacy paid invoices retain exact tax, totals and archive availability, with an explicit imported receipt', async () => {
  const invoice = await readBill(legacyId)
  assert.equal(Number(invoice.total_amount), 115)
  assert.equal(Number(invoice.tax_amount), 15)
  assert.equal(Number(invoice.paid_amount), 115)
  assert.equal(Number(invoice.discount_amount), 0)
  assert.equal(Number(invoice.line_discount_amount), 0)
  assert.equal(invoice.client_snapshot, null)
  const receipts = (await db.query('select * from invoice_payments where invoice_id=$1', [legacyId])).rows
  assert.equal(receipts.length, 1)
  assert.equal(receipts[0].is_legacy, true)
  assert.equal(receipts[0].method, 'legacy')
  assert.match(receipts[0].reference, /date estimée/)
  assert.equal((await db.query('select count(*)::int as count from invoice_payments where invoice_id=$1', [zeroId])).rows[0].count, 0)
})

test('350 USD can be settled as 150 + 123 + 77 without changing the issued document', async () => {
  const id = await bill()
  const original = await readBill(id)
  await asRole('service_role', async () => {
    await record(id, 150)
    let invoice = await readBill(id)
    assert.equal(invoice.status, 'partially_paid')
    assert.equal(Number(invoice.paid_amount), 150)
    await record(id, 123)
    invoice = await readBill(id)
    assert.equal(Number(invoice.total_amount) - Number(invoice.paid_amount), 77)
    await record(id, 77)
  })
  const invoice = await readBill(id)
  assert.equal(invoice.status, 'paid')
  assert.equal(Number(invoice.paid_amount), 350)
  assert.ok(invoice.paid_at)
  for (const key of ['total_amount', 'subtotal_amount', 'items', 'client_snapshot', 'issuer_snapshot', 'issued_at']) {
    assert.deepEqual(invoice[key], original[key], key)
  }
})

test('idempotent retries, changed payloads and competing final receipts cannot duplicate cash or overpay', async () => {
  const id = await bill(100)
  const key = await record(id, 60)
  await record(id, 60, { id: key })
  assert.equal(Number((await readBill(id)).paid_amount), 60)
  await assert.rejects(record(id, 61, { id: key }), /clé de versement/)
  const attempts = await Promise.allSettled([record(id, 40), record(id, 40)])
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(Number((await readBill(id)).paid_amount), 100)
  assert.equal((await db.query('select count(*)::int as count from invoice_payments where invoice_id=$1', [id])).rows[0].count, 2)
})

test('invalid amounts, excessive precision, future dates and drafts leave balances unchanged', async () => {
  const id = await bill(10)
  for (const amount of [0, -1, 10.01, '0.001', 'NaN', 'Infinity']) {
    await assert.rejects(record(id, amount))
    assert.equal(Number((await readBill(id)).paid_amount), 0)
  }
  await assert.rejects(record(id, 1, { date: '2099-01-01' }), /futur/)
  const draft = await bill(10, 'USD', t1, 'draft')
  await assert.rejects(record(draft, 1), /Émettez/)
})

test('CDF receipts preserve cent precision and reject mixed currencies', async () => {
  const id = await bill(0.3, 'CDF')
  await record(id, 0.1)
  await record(id, 0.2)
  assert.equal((await readBill(id)).status, 'paid')
  const other = await bill(10, 'CDF')
  await assert.rejects(db.query(`insert into invoice_payments(invoice_id,tenant_id,amount,currency,paid_on)
    values ($1,$2,1,'USD','2026-01-01')`, [other, t1]), /devise/)
})

test('receipt voiding reopens the correct balance and retains immutable history', async () => {
  const id = await bill(100)
  const first = await record(id, 40)
  const second = await record(id, 60)
  await assert.rejects(voidReceipt(id, second, t1, uid1, ''), /motif/)
  await voidReceipt(id, second)
  assert.equal((await readBill(id)).status, 'partially_paid')
  assert.equal(Number((await readBill(id)).paid_amount), 40)
  assert.equal((await readBill(id)).paid_at, null)
  await voidReceipt(id, second)
  await voidReceipt(id, first)
  assert.equal((await readBill(id)).status, 'overdue')
  assert.equal(Number((await readBill(id)).paid_amount), 0)
  const history = (await db.query('select * from invoice_payments where invoice_id=$1', [id])).rows
  assert.equal(history.length, 2)
  assert.ok(history.every((payment) => payment.voided_at && payment.void_reason === 'Erreur de saisie'))
  await assert.rejects(db.query('update invoice_payments set amount=1 where id=$1', [first]), /immutable/)
  await assert.rejects(db.query('delete from invoice_payments where id=$1', [first]), /deleted/)
})

test('tenants and actors are checked in both RPCs; browser roles cannot write or call server RPCs', async () => {
  const id = await bill(50, 'USD', t2)
  const receipt = await record(id, 10, { tenant: t2, actor: uid2 })
  await assert.rejects(record(id, 1), /introuvable/)
  await assert.rejects(record(id, 1, { tenant: t2, actor: uid1 }), /refusé/)
  await assert.rejects(voidReceipt(id, receipt), /introuvable/)
  await asRole('anon', async () => { await assert.rejects(db.query('select * from invoice_payments'), /permission denied/) })
  await asRole('authenticated', async () => {
    assert.equal((await db.query('select * from invoice_payments where invoice_id=$1', [id])).rows.length, 0)
    await assert.rejects(record(id, 1, { tenant: t2, actor: uid2 }), /permission denied/)
    await assert.rejects(voidReceipt(id, receipt, t2, uid2), /permission denied/)
    await assert.rejects(db.query('update invoice_payments set amount=1'), /permission denied/)
    await assert.rejects(db.query('delete from invoice_payments'), /permission denied/)
  })
  await asRole('authenticated', async () => {
    assert.equal((await db.query('select * from invoice_payments where invoice_id=$1', [id])).rows.length, 1)
  }, uid2)
})

test('only ledger triggers can change paid amounts or reopen a paid invoice', async () => {
  const id = await bill(10)
  await assert.rejects(db.query('update invoices set paid_amount=5 where id=$1', [id]), /ledger/)
  await record(id, 10)
  await assert.rejects(db.query("update invoices set status='sent' where id=$1", [id]), /transition/)
  await assert.rejects(db.query("update invoices set notes='Changed archive' where id=$1", [id]), /immutable/)
})

test('legacy mark-paid writes still record exactly one complete settlement during deployment', async () => {
  const id = await bill(115)
  await db.query("update invoices set status='paid', paid_at=now() where id=$1", [id])
  assert.equal(Number((await readBill(id)).paid_amount), 115)
  await db.query("update invoices set status='paid' where id=$1", [id])
  assert.equal((await db.query('select count(*)::int as count from invoice_payments where invoice_id=$1', [id])).rows[0].count, 1)
})

for (const currency of ['USD', 'CDF']) {
  test(`discounted ${currency} invoices accept receipts only up to the discounted amount and keep their archive`, async () => {
    const id = await bill(350, currency, t1, 'draft')
    await db.query(`update invoices set items=$2, discount_type='percent', discount_value=10,
      line_discount_amount=52.5, discount_amount=82.25, tax_rate=16, tax_amount=42.84, total_amount=310.59, status='sent' where id=$1`,
    [id, JSON.stringify([{ description: 'Service', quantity: 1, unitPrice: 350, currency, discountType: 'percent', discountValue: 15 }])])
    await asRole('service_role', async () => {
      await record(id, 150)
      assert.equal(Number((await readBill(id)).paid_amount), 150)
      await assert.rejects(record(id, 160.6), /dépasse/)
      await record(id, 160.59)
    })
    const invoice = await readBill(id)
    assert.equal(invoice.status, 'paid')
    assert.equal(Number(invoice.paid_amount), 310.59)
    assert.equal(Number(invoice.total_amount), 310.59)
    assert.equal(Number(invoice.discount_amount), 82.25)
    await assert.rejects(db.query("update invoices set discount_value=20 where id=$1", [id]), /immutable/)
  })
}

test('database constraints reject inconsistent discount and total fields, including direct server writes', async () => {
  const id = await bill(100, 'USD', t1, 'draft')
  await db.query("update invoices set discount_type='percent',discount_value=10,discount_amount=10,total_amount=90 where id=$1", [id])
  for (const sql of ["discount_type='other'", 'discount_value=101', 'discount_value=-1', 'discount_amount=101',
    'line_discount_amount=20', 'total_amount=92', "discount_type='none'"])
    await assert.rejects(db.query(`update invoices set ${sql} where id=$1`, [id]), /check constraint/)
  assert.equal(Number((await readBill(id)).total_amount), 90)
})
