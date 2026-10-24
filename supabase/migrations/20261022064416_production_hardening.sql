-- Run only after the preflight and backup described in SUPABASE.md.
-- The owner confirmed on 2026-10-22 that historical "$" means USD.
-- Only that currency label is normalized; historical amounts and taxes stay intact.
begin;

do $$
begin
  if exists (
    select 1 from public.invoices i join public.clients c on c.id = i.client_id
    where i.tenant_id <> c.tenant_id
  ) then
    raise exception 'Cross-tenant invoice/client links exist. Reconcile before migrating.';
  end if;
  if exists (
    select 1 from public.invoices i
    where status is null or status not in ('draft', 'sent', 'paid', 'overdue')
       or currency is null or currency not in ('USD', 'CDF', '$')
       or due_date < issue_date
       or total_amount is null or subtotal_amount is null
       or total_amount < 0 or total_amount > 1000000000000
       or subtotal_amount < 0 or subtotal_amount <> round(subtotal_amount, 2)
       or coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0) not between 0 and 100
       or coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0) <>
         round(coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0), 2)
       or coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0) < 0
       or coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0) <>
         round(coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0), 2)
       or total_amount <> subtotal_amount + coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0)
       or total_amount <> round(total_amount, 2)
       or items is null or case when jsonb_typeof(items) = 'array'
         then jsonb_array_length(items) > 100 else true end
  ) then
    raise exception 'Historical invoices require reconciliation before migrating. Review docs/sql/preflight.sql; do not recalculate historical amounts or taxes.';
  end if;
  if exists (
    select 1 from public.invoices i cross join lateral jsonb_array_elements(i.items) line
    where line ? 'currency' and (
      coalesce(line->>'currency', '') not in ('USD', 'CDF', '$') or
      case when line->>'currency' = '$' then 'USD' else line->>'currency' end <>
      case when i.currency = '$' then 'USD' else i.currency end
    )
  ) then
    raise exception 'Historical invoice lines use an unsupported or mixed currency. Reconcile before migrating.';
  end if;
  if exists (
    select 1 from public.catalog_items
    where unit_price is null or unit_price < 0 or unit_price > 1000000000
       or unit_price <> round(unit_price, 2)
       or currency is null or currency not in ('USD', 'CDF')
  ) then
    raise exception 'Historical catalog items require reconciliation before migrating. Review docs/sql/preflight.sql.';
  end if;
end $$;

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists website text;
alter table public.invoices add column if not exists version integer not null default 0;
alter table public.invoices add column if not exists client_snapshot jsonb;
alter table public.invoices add column if not exists issuer_snapshot jsonb;
alter table public.invoices add column if not exists issued_at timestamptz;
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists tax_rate numeric default 0;
alter table public.invoices add column if not exists tax_amount numeric default 0;

-- Preserve array order, all other JSON keys, totals and recorded tax amounts.
update public.invoices i set
  currency = case when i.currency = '$' then 'USD' else i.currency end,
  items = coalesce((select jsonb_agg(
    case when line->>'currency' = '$' then jsonb_set(line, '{currency}', '"USD"'::jsonb) else line end
    order by ordinal)
    from jsonb_array_elements(i.items) with ordinality as lines(line, ordinal)), '[]'::jsonb)
where i.currency = '$' or exists (select 1 from jsonb_array_elements(i.items) line where line->>'currency' = '$');

create unique index clients_id_tenant_key on public.clients(id, tenant_id);
create index profiles_tenant_id_idx on public.profiles(tenant_id);
create index invoices_client_tenant_idx on public.invoices(client_id, tenant_id);
-- Replace any existing single-column client FK, whatever its original name.
do $$
declare fk record;
begin
  for fk in select conname from pg_constraint
    where conrelid = 'public.invoices'::regclass and confrelid = 'public.clients'::regclass and contype = 'f'
  loop execute format('alter table public.invoices drop constraint %I', fk.conname); end loop;
end $$;
alter table public.invoices add constraint invoices_client_same_tenant
  foreign key (client_id, tenant_id) references public.clients(id, tenant_id) on delete restrict;
alter table public.invoices add constraint invoices_status_valid
  check (status is not null and status in ('draft', 'sent', 'paid', 'overdue'));
alter table public.invoices add constraint invoices_currency_valid
  check (currency is not null and currency in ('USD', 'CDF'));
alter table public.invoices add constraint invoices_dates_valid
  check (issue_date is null or due_date is null or due_date >= issue_date);
alter table public.invoices add constraint invoices_totals_valid
  check (total_amount is not null and subtotal_amount is not null and
    subtotal_amount >= 0 and subtotal_amount = round(subtotal_amount, 2) and
    total_amount >= 0 and total_amount <= 1000000000000 and
    total_amount = subtotal_amount + coalesce(tax_amount, 0) and total_amount = round(total_amount, 2));
alter table public.invoices add constraint invoices_tax_valid
  check (coalesce(tax_rate, 0) between 0 and 100 and coalesce(tax_rate, 0) = round(coalesce(tax_rate, 0), 2)
    and coalesce(tax_amount, 0) >= 0 and coalesce(tax_amount, 0) = round(coalesce(tax_amount, 0), 2));
alter table public.invoices add constraint invoices_items_valid
  check (items is not null and jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100);
alter table public.invoices add constraint invoices_line_currency_valid
  check (not jsonb_path_exists(items,
    '$[*] ? (exists(@.currency) && (@.currency.type() != "string" || @.currency != $currency))',
    jsonb_build_object('currency', currency)));
alter table public.catalog_items add constraint catalog_price_valid
  check (unit_price is not null and unit_price >= 0 and unit_price <= 1000000000 and unit_price = round(unit_price, 2));
alter table public.catalog_items add constraint catalog_currency_valid
  check (currency is not null and currency in ('USD', 'CDF'));

-- API is the sole business writer. The browser can only read its own rows.
-- Drop all previous policies: a forgotten permissive policy would otherwise stay active.
do $$
declare item record;
begin
  for item in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('tenants', 'profiles', 'clients', 'catalog_items', 'invoices')
  loop execute format('drop policy %I on %I.%I', item.policyname, item.schemaname, item.tablename); end loop;
end $$;
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.catalog_items enable row level security;
alter table public.invoices enable row level security;
revoke all on public.tenants, public.profiles, public.clients, public.catalog_items, public.invoices from anon, authenticated;
grant select on public.tenants, public.profiles, public.clients, public.catalog_items, public.invoices to authenticated;
grant all on public.tenants, public.profiles, public.clients, public.catalog_items, public.invoices to service_role;

create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy tenants_read_own on public.tenants for select to authenticated
  using (id = (select tenant_id from public.profiles where id = (select auth.uid())));
create policy clients_read_own on public.clients for select to authenticated
  using (tenant_id = (select tenant_id from public.profiles where id = (select auth.uid())));
create policy catalog_read_own on public.catalog_items for select to authenticated
  using (tenant_id = (select tenant_id from public.profiles where id = (select auth.uid())));
create policy invoices_read_own on public.invoices for select to authenticated
  using (tenant_id = (select tenant_id from public.profiles where id = (select auth.uid())));

-- Only the backend can call this. Serialize provisioning for a user within the transaction.
create or replace function public.provision_kadi_profile(p_user_id uuid, p_company text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare tenant uuid; user_email text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0::bigint));
  select tenant_id into tenant from public.profiles where id = p_user_id;
  if tenant is not null then return tenant; end if;
  select email into user_email from auth.users where id = p_user_id;
  if user_email is null or length(trim(coalesce(p_company, ''))) = 0 or length(p_company) > 160 then
    raise exception 'Invalid user or company';
  end if;
  insert into public.tenants(name) values (p_company) returning id into tenant;
  insert into public.profiles(id, tenant_id, email, company) values (p_user_id, tenant, user_email, p_company)
    on conflict (id) do update set tenant_id = excluded.tenant_id;
  return tenant;
end $$;
revoke all on function public.provision_kadi_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.provision_kadi_profile(uuid, text) to service_role;

-- Computed column for PostgREST filtering: local columns, archived client and current draft client.
-- Service-role callers still explicitly check the tenant in the client lookup.
create or replace function public.invoice_search(invoice_row public.invoices)
returns text language sql stable set search_path = '' as $$
  select concat_ws(' ', (invoice_row).invoice_number, (invoice_row).status,
    (invoice_row).client_snapshot->>'company_name', (invoice_row).client_snapshot->>'contact_name',
    (select concat_ws(' ', c.company_name, c.contact_name) from public.clients c
      where c.id = (invoice_row).client_id and c.tenant_id = (invoice_row).tenant_id))
$$;
revoke all on function public.invoice_search(public.invoices) from public, anon, authenticated;
grant execute on function public.invoice_search(public.invoices) to service_role;

create or replace function public.guard_kadi_invoice()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'draft' then raise exception using errcode = '23514', message = 'Issued invoice is immutable'; end if;
    return old;
  end if;
  if TG_OP = 'UPDATE' then
    if old.status <> 'draft' then
      if (to_jsonb(new) - 'status' - 'paid_at' - 'version') is distinct from
         (to_jsonb(old) - 'status' - 'paid_at' - 'version') then
        raise exception using errcode = '23514', message = 'Issued invoice is immutable';
      end if;
      if not ((old.status = 'paid' and new.status = 'paid') or
              (old.status in ('sent', 'overdue') and new.status in ('sent', 'overdue', 'paid'))) then
        raise exception using errcode = '23514', message = 'Invalid invoice status transition';
      end if;
      if old.status = 'paid' and new.paid_at is distinct from old.paid_at then
        raise exception using errcode = '23514', message = 'Payment date is immutable';
      end if;
    end if;
    new.version := old.version + 1;
  end if;
  -- Legacy issued invoices stay locked; never invent an historical snapshot.
  if new.status <> 'draft' and (TG_OP = 'INSERT' or old.status = 'draft') then
    if new.client_snapshot is null or jsonb_typeof(new.client_snapshot) <> 'object' or
       new.issuer_snapshot is null or jsonb_typeof(new.issuer_snapshot) <> 'object' or
       new.issued_at is null or new.client_id is null or new.issue_date is null or
       jsonb_array_length(new.items) = 0 then
      raise exception using errcode = '23514', message = 'Issuing an invoice requires complete snapshots';
    end if;
  end if;
  if new.status = 'paid' and (TG_OP = 'INSERT' or old.status <> 'paid') and new.paid_at is null then
    raise exception using errcode = '23514', message = 'Payment date required';
  end if;
  return new;
end $$;
create trigger guard_kadi_invoice before insert or update or delete on public.invoices
  for each row execute function public.guard_kadi_invoice();

notify pgrst, 'reload schema';
commit;
