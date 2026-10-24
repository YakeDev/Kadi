#!/usr/bin/env bash
# Verify the fixed PR14 migration on the already-restored, disposable PostgreSQL 17 container.
# Do not contact the real Supabase API/database. Do not print production business data.
set -euo pipefail
umask 077
dir="$KADI_RESTORE_DIR"
test -d "$dir/plain"
docker container inspect kadi-restore-sandbox >/dev/null

cat > "$dir/stubs.sql" <<'SQL'
create role anon;
create role authenticated;
create role service_role bypassrls;
create table auth.users(id uuid primary key, email text);
insert into auth.users(id,email) select id,email from public.profiles;
create function auth.uid() returns uuid language sql stable as
  'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
SQL
if ! docker exec -i kadi-restore-sandbox psql -X -q -v ON_ERROR_STOP=1 -U postgres -d kadi_restore_sandbox < "$dir/stubs.sql" >"$dir/stubs.log" 2>&1; then
  echo "::error::Could not prepare isolated Auth stubs (details withheld to avoid exposing user data)."
  exit 1
fi

# Restore real production indexes/foreign keys/policies and grants in isolated PG.
# --no-acl strips hosted Supabase grants because this is a disposable bare PostgreSQL instance.
if ! docker exec kadi-restore-sandbox pg_restore --no-owner --no-acl --exit-on-error \
  --section=post-data --schema=public -U postgres -d kadi_restore_sandbox \
  /tmp/database.pgdump >"$dir/postdata.log" 2>&1; then
  echo "::error::Restoring production post-data constraints failed in sandbox; no production changes."
  exit 1
fi

cat > "$dir/baseline.sql" <<'SQL'
create schema kadi_audit;
create table kadi_audit.original_invoices as
  select id, currency, items, to_jsonb(i) - 'currency' - 'items' as stable
  from public.invoices i;
SQL
if ! docker exec -i kadi-restore-sandbox psql -X -q -v ON_ERROR_STOP=1 -U postgres -d kadi_restore_sandbox < "$dir/baseline.sql" >"$dir/baseline.log" 2>&1; then
  echo "::error::Could not create isolated comparison baseline."
  exit 1
fi

# Pinned commit is reviewed PR14, NEVER fetch from a mutable branch for a security test.
curl --fail --silent --show-error --location \
  "https://raw.githubusercontent.com/YakeDev/Kadi/d74d56130819e0a60c3a7a758b8536791cbb4f8a/supabase/migrations/20261022064416_production_hardening.sql" \
  -o "$dir/production_hardening.sql"
if ! docker exec -i kadi-restore-sandbox psql -X -q -v ON_ERROR_STOP=1 -U postgres -d kadi_restore_sandbox < "$dir/production_hardening.sql" >"$dir/migration.log" 2>&1; then
  echo "::error::Production snapshot migration was rejected inside sandbox. No production changes."
  exit 1
fi

cat > "$dir/check.sql" <<'SQL'
do $audit$
declare
  dollar_before integer;
  dollar_after integer;
begin
  if (select count(*) from public.invoices) <> 21 then raise exception 'invoice count changed'; end if;
  if (select count(*) from public.profiles) <> 6 then raise exception 'profile count changed'; end if;
  if (select count(*) from public.clients) <> 12 then raise exception 'client count changed'; end if;
  if (select count(*) from public.catalog_items) <> 2 then raise exception 'catalog count changed'; end if;
  if exists (
    select 1 from kadi_audit.original_invoices b full join public.invoices i using(id)
    where b.id is null or i.id is null or
      b.stable is distinct from (
        to_jsonb(i) - 'currency' - 'items' - 'version' -
        'client_snapshot' - 'issuer_snapshot' - 'issued_at' - 'paid_at'
      )
  ) then raise exception 'a historical invoice field changed unexpectedly'; end if;
  if exists (
    select 1 from kadi_audit.original_invoices b join public.invoices i using(id)
    where i.items is distinct from
      coalesce((select jsonb_agg(
         case when entry->>'currency' = '$'
           then jsonb_set(entry, '{currency}', '"USD"'::jsonb)
           else entry end order by n)
         from jsonb_array_elements(b.items) with ordinality as elements(entry,n)),
         '[]'::jsonb)
  ) then raise exception 'historical invoice line items changed unexpectedly'; end if;
  select count(*) into dollar_before from kadi_audit.original_invoices where currency = '$';
  select count(*) into dollar_after from public.invoices where currency = '$';
  if dollar_before <> 7 or dollar_after <> 0 then raise exception 'USD label normalization failed'; end if;
  if exists (
    select 1 from kadi_audit.original_invoices b join public.invoices i using(id)
    where i.currency is distinct from
      case when b.currency = '$' then 'USD' else b.currency end
  ) then raise exception 'historical currency label changed unexpectedly'; end if;
  if (select count(*) from public.invoices
      where status <> 'draft' and issuer_snapshot is null and client_snapshot is null) <> 20
    then raise exception 'missing archives were invented or invoice count changed'; end if;
  if (select count(*) from pg_policies where schemaname='public'
      and tablename in ('tenants','profiles','clients','catalog_items','invoices')) <> 5
    then raise exception 'expected RLS policies missing'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('tenants','profiles','clients','catalog_items','invoices')
      and c.relrowsecurity) <> 5
    then raise exception 'RLS disabled on a business table'; end if;
  if (select count(*) from pg_trigger where tgname='guard_kadi_invoice' and not tgisinternal) <> 1
    then raise exception 'issued-invoice guard missing'; end if;
end
$audit$;
SQL
if ! docker exec -i kadi-restore-sandbox psql -X -q -v ON_ERROR_STOP=1 -U postgres -d kadi_restore_sandbox < "$dir/check.sql" >"$dir/check.log" 2>&1; then
  echo "::error::Historical financial integrity or security assertions failed (details withheld)."
  exit 1
fi
{
  echo ""
  echo "### PR14 migration against real production backup (isolated)"
  echo "- PostgreSQL 17 sandbox: PASS"
  echo "- Restore archived production indexes, FKs and policies: PASS"
  echo "- Apply reviewed PR14 hardening migration: PASS"
  echo "- Original invoice identities, totals, taxes, dates, status, notes: preserved"
  echo "- Line items: preserved except confirmed dollar-to-USD labels"
  echo "- Seven dollar invoice headers normalized to USD without conversion: PASS"
  echo "- Five RLS tables/policies and issued-invoice trigger: PASS"
  echo "- Twenty issued invoices still have NO snapshots; **not safe to re-export as originals**"
  echo "- Production Supabase / Auth / Storage: NOT modified, NOT tested end-to-end"
} >>"$GITHUB_STEP_SUMMARY"
echo "PASS: isolated production snapshot migration, historical invoice integrity and RLS."
