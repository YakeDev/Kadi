import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migrations = (await readdir(new URL('../../supabase/migrations/', import.meta.url))).sort()
const migration = async (name) => readFile(new URL(`../../supabase/migrations/${migrations.find((file) => file.includes(name))}`, import.meta.url), 'utf8')
const uid1 = '11111111-1111-4111-8111-111111111111'
const uid2 = '22222222-2222-4222-8222-222222222222'
const t1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const t2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const c1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const c2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
let db
const bootstrap = async () => {
  const instance = new PGlite()
  await instance.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  await instance.exec(await migration('initial_schema'))
  return instance
}
before(async () => {
  db = await bootstrap()
  await db.exec(`
    insert into auth.users values ('${uid1}', 'one@example.com'), ('${uid2}', 'two@example.com');
    insert into tenants(id, name) values ('${t1}', 'One'), ('${t2}', 'Two');
    insert into profiles(id, tenant_id, email) values ('${uid1}', '${t1}', 'one@example.com'), ('${uid2}', '${t2}', 'two@example.com');
    insert into clients(id, tenant_id, company_name) values ('${c1}', '${t1}', 'One client'), ('${c2}', '${t2}', 'Secret two');
    insert into catalog_items(tenant_id, name, item_type) values ('${t1}', 'One item', 'product'), ('${t2}', 'Two item', 'product');
    insert into invoices(tenant_id, client_id, invoice_number) values ('${t1}', '${c1}', 'ONE'), ('${t2}', '${c2}', 'TWO');
    grant all on all tables in schema public to anon, authenticated;
    create policy old_permissive_policy on invoices for all using (true) with check (true);
  `)
  await db.exec(await migration('production_hardening'))
})
after(async () => { await db?.close() })
const asRole = async (role, callback, uid = uid1) => {
  await db.exec(`set role ${role}; set request.jwt.claim.sub = '${uid}';`)
  try { return await callback() } finally { await db.exec('reset role') }
}

test('anonymous users cannot read any business table', async () => {
  await asRole('anon', async () => {
    for (const table of ['tenants', 'profiles', 'clients', 'catalog_items', 'invoices']) {
      await assert.rejects(db.query(`select * from ${table}`), /permission denied/)
    }
  })
})
test('authenticated reads isolate all five tables, including tenants', async () => {
  await asRole('authenticated', async () => {
    for (const table of ['tenants', 'profiles', 'clients', 'catalog_items', 'invoices']) {
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 1, table)
    }
    assert.equal((await db.query('select company_name from clients')).rows[0].company_name, 'One client')
  })
})
test('browser roles cannot change tenants, profiles, clients, catalogue or invoice amounts', async () => {
  await asRole('authenticated', async () => {
    for (const query of [
      `delete from tenants`, `update profiles set tenant_id = '${t2}'`,
      `delete from clients`, `update catalog_items set unit_price = -1`,
      `update invoices set total_amount = 99`,
      `insert into invoices(tenant_id, invoice_number) values ('${t1}', 'FORGED')`
    ]) await assert.rejects(db.query(query), /permission denied/)
  })
})
test('even service-role writes cannot link an invoice to another tenant’s client', async () => {
  await asRole('service_role', async () => {
    await assert.rejects(db.query(`insert into invoices(tenant_id, client_id, invoice_number) values ('${t1}', '${c2}', 'CROSS')`), /foreign key/)
  })
})
test('issued invoices keep their amounts and snapshots; only valid status transitions pass', async () => {
  await db.query(`update invoices set status = 'sent', issue_date = '2026-10-22',
    items = '[{"description":"Audit","quantity":1,"unitPrice":10}]', subtotal_amount = 10, total_amount = 10,
    client_snapshot = '{"company_name":"Original client"}', issuer_snapshot = '{"company":"Original issuer"}',
    issued_at = now() where invoice_number = 'ONE'`)
  await assert.rejects(db.query(`update invoices set notes = 'changed' where invoice_number = 'ONE'`), /immutable/)
  await assert.rejects(db.query(`delete from invoices where invoice_number = 'ONE'`), /immutable/)
  await assert.rejects(db.query(`update invoices set status = 'draft' where invoice_number = 'ONE'`), /transition/)
  await assert.rejects(db.query(`delete from clients where id = '${c1}'`), /foreign key/)
  await db.query(`update invoices set status = 'paid', paid_at = now() where invoice_number = 'ONE'`)
  await assert.rejects(db.query(`update invoices set status = 'sent' where invoice_number = 'ONE'`), /transition/)
  const row = (await db.query(`select * from invoices where invoice_number = 'ONE'`)).rows[0]
  assert.equal(row.version, 2)
  assert.equal(row.client_snapshot.company_name, 'Original client')
  await assert.rejects(db.query(`update invoices set paid_at = now() + interval '1 day' where invoice_number = 'ONE'`), /immutable/)
})
test('provisioning is idempotent and executable only by the backend', async () => {
  const newUser = '33333333-3333-4333-8333-333333333333'
  await db.query(`insert into auth.users values ('${newUser}', 'new@example.com')`)
  const count = (await db.query('select count(*)::int as count from tenants')).rows[0].count
  await asRole('authenticated', async () => {
    await assert.rejects(db.query(`select provision_kadi_profile('${newUser}', 'Hijack')`), /permission denied/)
  })
  await asRole('service_role', async () => {
    const first = (await db.query(`select provision_kadi_profile('${newUser}', 'New') as tenant`)).rows[0].tenant
    const second = (await db.query(`select provision_kadi_profile('${newUser}', 'Changed') as tenant`)).rows[0].tenant
    assert.equal(first, second)
  })
  assert.equal((await db.query('select count(*)::int as count from tenants')).rows[0].count, count + 1)
})
test('preflight refuses inconsistent old data and leaves the schema unchanged', async () => {
  const dirty = await bootstrap()
  try {
    await dirty.exec(`
      insert into tenants(id,name) values ('${t1}','One'),('${t2}','Two');
      insert into clients(id,tenant_id,company_name) values ('${c2}','${t2}','Two');
      insert into invoices(tenant_id,client_id,invoice_number) values ('${t1}','${c2}','BAD');
    `)
    await assert.rejects(dirty.exec(await migration('production_hardening')), /Cross-tenant/)
    await dirty.exec('rollback')
    const columns = await dirty.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'version'`)
    assert.equal(columns.rows.length, 0)
  } finally { await dirty.close() }
})

test('invoice search finds a current or archived client while keeping tenant boundaries', async () => {
  await asRole('service_role', async () => {
    const found = await db.query("select invoice_search(i) as value from invoices i where invoice_number = 'ONE'")
    assert.ok(found.rows[0].value.includes('Original client'))
    assert.ok(!found.rows[0].value.includes('Secret two'))
  })
})
