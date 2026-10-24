-- Read-only review: every returned anomaly requires reconciliation before migration.
-- The owner confirmed "$" = USD on 2026-10-22. The migration normalizes that label only.
-- Never remove/recalculate recorded taxes or totals to make a constraint pass.
select i.id as invoice_id, i.tenant_id, c.tenant_id as client_tenant
from public.invoices i join public.clients c on c.id = i.client_id
where i.tenant_id <> c.tenant_id;

select id, status, currency, issue_date, due_date, total_amount, subtotal_amount
from public.invoices i
where status is null or status not in ('draft','sent','paid','overdue')
   or currency is null or currency not in ('USD','CDF','$')
   or due_date < issue_date
   or total_amount is null or subtotal_amount is null
   or total_amount < 0 or total_amount > 1000000000000
   or subtotal_amount < 0 or subtotal_amount <> round(subtotal_amount, 2)
   or coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0) not between 0 and 100
   or coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0) <> round(coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0), 2)
   or coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0) < 0
   or coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0) <> round(coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0), 2)
   or total_amount <> subtotal_amount + coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0)
   or total_amount <> round(total_amount, 2)
   or items is null or case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) > 100 else true end;

-- Unsupported or mixed line currencies must still block the migration.
select i.id as invoice_id, line->>'currency' as line_currency, i.currency as invoice_currency
from public.invoices i cross join lateral jsonb_array_elements(
  case when jsonb_typeof(i.items) = 'array' then i.items else '[]'::jsonb end) line
where line ? 'currency' and (coalesce(line->>'currency', '') not in ('USD','CDF','$') or
  case when line->>'currency' = '$' then 'USD' else line->>'currency' end <>
  case when i.currency = '$' then 'USD' else i.currency end);

-- Informational: labels approved for canonicalization, without currency conversion.
select count(*) filter (where i.currency = '$') as dollar_headers,
       (select count(*) from public.invoices j cross join lateral jsonb_array_elements(j.items) line
        where line->>'currency' = '$') as dollar_lines
from public.invoices i;

select id, unit_price, currency from public.catalog_items
where unit_price is null or unit_price < 0 or unit_price > 1000000000
   or unit_price <> round(unit_price, 2) or currency is null or currency not in ('USD','CDF');

-- Legacy issued documents without snapshots need originals, not an invented backfill.
select id, invoice_number, status from public.invoices where status <> 'draft';

-- The hosted schema has tax columns absent from the repository's initial schema.
-- to_jsonb also lets this diagnostic run against a fresh installation without them.
select i.id, i.status, i.currency,
       to_jsonb(i)->>'tax_rate' as tax_rate,
       to_jsonb(i)->>'tax_amount' as tax_amount,
       i.total_amount = i.subtotal_amount +
         coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0) as totals_match_stored_tax
from public.invoices i
where coalesce((to_jsonb(i)->>'tax_rate')::numeric, 0) <> 0
   or coalesce((to_jsonb(i)->>'tax_amount')::numeric, 0) <> 0;

select p.id,
       to_jsonb(p)->'default_tax_rate' as default_tax_rate,
       to_jsonb(p)->'tax_rates' as tax_rates
from public.profiles p
where coalesce((to_jsonb(p)->>'default_tax_rate')::numeric, 0) <> 0
   or coalesce(to_jsonb(p)->'tax_rates', '[]'::jsonb) <> '[]'::jsonb;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
and tablename in ('tenants','profiles','clients','catalog_items','invoices');
