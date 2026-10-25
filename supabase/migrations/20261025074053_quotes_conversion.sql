-- Additive quote workflow. Existing invoice amounts, snapshots and receipts stay untouched.
begin;
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  client_id uuid not null,
  quote_number text not null unique check (length(quote_number) between 1 and 80),
  client_label text not null default '',
  quote_search text generated always as (quote_number || ' ' || client_label) stored,
  issue_date date not null,
  valid_until date check (valid_until is null or valid_until >= issue_date),
  status text not null default 'draft' check (status in ('draft','sent','converted')),
  currency text not null check (currency in ('USD','CDF')),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
  notes text check (length(notes) <= 5000),
  subtotal_amount numeric not null check (subtotal_amount between 0 and 1000000000000 and subtotal_amount = round(subtotal_amount,2)),
  tax_rate numeric not null default 0 check (tax_rate between 0 and 100 and tax_rate = round(tax_rate,2)),
  tax_amount numeric not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none','percent','fixed')),
  discount_value numeric not null default 0 check (discount_value between 0 and 1000000000000 and discount_value = round(discount_value,2)),
  line_discount_amount numeric not null default 0 check (line_discount_amount >= 0 and line_discount_amount = round(line_discount_amount,2)),
  discount_amount numeric not null default 0,
  total_amount numeric not null check (total_amount between 0 and 1000000000000 and total_amount = round(total_amount,2)),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_invoice_id uuid unique,
  converted_at timestamptz,
  converted_by uuid,
  conversion_key uuid unique,
  conversion_payload jsonb,
  client_snapshot jsonb,
  issuer_snapshot jsonb,
  constraint quotes_id_tenant_key unique(id,tenant_id),
  constraint quotes_client_tenant_fk foreign key(client_id,tenant_id) references public.clients(id,tenant_id) on delete restrict,
  constraint quotes_totals_valid check (
    discount_amount >= line_discount_amount and discount_amount <= subtotal_amount
    and discount_amount = round(discount_amount,2)
    and (discount_type <> 'none' or discount_value = 0)
    and (discount_type <> 'percent' or discount_value <= 100)
    and discount_amount - line_discount_amount = case discount_type
      when 'none' then 0 when 'fixed' then discount_value
      when 'percent' then round((subtotal_amount-line_discount_amount)*discount_value/100,2) end
    and tax_amount = round((subtotal_amount-discount_amount)*tax_rate/100,2)
    and total_amount = subtotal_amount-discount_amount+tax_amount),
  constraint quotes_conversion_valid check (
    (status <> 'converted' and converted_invoice_id is null and converted_at is null and converted_by is null
      and conversion_key is null and conversion_payload is null and client_snapshot is null and issuer_snapshot is null)
    or (status = 'converted' and converted_invoice_id is not null and converted_at is not null and converted_by is not null
      and conversion_key is not null and conversion_payload is not null and client_snapshot is not null and issuer_snapshot is not null))
);
create index quotes_tenant_created_idx on public.quotes(tenant_id,created_at desc,id);
create index quotes_tenant_client_idx on public.quotes(tenant_id,client_id);
create index quotes_tenant_status_idx on public.quotes(tenant_id,status,created_at desc);
alter table public.quotes enable row level security;
revoke all on public.quotes from public,anon,authenticated;
grant select on public.quotes to authenticated;
grant select,insert,update,delete on public.quotes to service_role;
create policy quotes_read_own on public.quotes for select to authenticated
  using (tenant_id = (select tenant_id from public.profiles where id = (select auth.uid())));

alter table public.invoices add column quote_id uuid, add column quote_number text,
  add column po_reference text check (po_reference is null or length(trim(po_reference)) between 1 and 160);
create unique index invoices_quote_unique on public.invoices(quote_id) where quote_id is not null;
create index invoices_quote_tenant_idx on public.invoices(quote_id,tenant_id) where quote_id is not null;
alter table public.invoices add constraint invoices_quote_tenant_fk foreign key(quote_id,tenant_id)
  references public.quotes(id,tenant_id) on delete restrict;
alter table public.quotes add constraint quotes_invoice_tenant_fk foreign key(converted_invoice_id,tenant_id)
  references public.invoices(id,tenant_id) on delete restrict;

create function public.guard_kadi_quote() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='DELETE' then
    if old.status='converted' then raise exception using errcode='PT409',message='Un devis converti est consultable uniquement.'; end if;
    return old;
  end if;
  if TG_OP='INSERT' and new.status='converted' then
    raise exception using errcode='PT409',message='Utilisez la conversion du devis.';
  end if;
  if TG_OP='UPDATE' then
    if old.status='converted' then raise exception using errcode='PT409',message='Un devis converti est consultable uniquement.'; end if;
    if new.id<>old.id or new.tenant_id<>old.tenant_id or new.quote_number<>old.quote_number or new.created_at<>old.created_at then
      raise exception using errcode='PT409',message='Les références du devis sont immuables.';
    end if;
    if new.status='converted' and not exists(select 1 from public.invoices i
      where i.id=new.converted_invoice_id and i.tenant_id=new.tenant_id and i.quote_id=new.id and i.quote_number=new.quote_number) then
      raise exception using errcode='PT409',message='La facture liée au devis est invalide.';
    end if;
    new.version:=old.version+1;
    new.updated_at:=now();
  end if;
  return new;
end $$;
create trigger guard_kadi_quote before insert or update or delete on public.quotes for each row execute function public.guard_kadi_quote();
revoke all on function public.guard_kadi_quote() from public,anon,authenticated;
grant execute on function public.guard_kadi_quote() to service_role;

create function public.convert_kadi_quote(p_tenant_id uuid,p_quote_id uuid,p_expected_version integer,p_operation_id uuid,
  p_invoice_number text,p_issue_date date,p_due_date date,p_po_reference text,p_payment jsonb,
  p_client_snapshot jsonb,p_issuer_snapshot jsonb,p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare q public.quotes; spec jsonb; invoice_id uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and tenant_id=p_tenant_id) then
    raise exception using errcode='PT403',message='Accès refusé.';
  end if;
  select * into q from public.quotes where id=p_quote_id and tenant_id=p_tenant_id for update;
  if not found then raise exception using errcode='PT404',message='Devis introuvable.'; end if;
  spec:=jsonb_build_object('version',p_expected_version,'issue_date',p_issue_date,'due_date',p_due_date,
    'po_reference',nullif(trim(p_po_reference),''),'payment',p_payment);
  if q.status='converted' then
    if q.conversion_key=p_operation_id and q.conversion_payload=spec then return q.converted_invoice_id; end if;
    raise exception using errcode='PT409',message='Ce devis a déjà été converti en facture.';
  end if;
  if p_expected_version is null or q.version<>p_expected_version then
    raise exception using errcode='PT409',message='Le devis a changé. Rechargez-le avant la conversion.';
  end if;
  if nullif(trim(p_po_reference),'') is null and p_payment is null then
    raise exception using errcode='PT400',message='Un acompte reçu ou une référence PO est obligatoire.';
  end if;
  if p_operation_id is null or p_issue_date is null or p_invoice_number is null or length(p_invoice_number)>80
    or (p_due_date is not null and p_due_date<p_issue_date) or length(trim(p_po_reference))>160 then
    raise exception using errcode='PT400',message='Informations de conversion invalides.';
  end if;
  if not exists(select 1 from public.clients where id=q.client_id and tenant_id=p_tenant_id)
    or jsonb_typeof(p_client_snapshot) is distinct from 'object' or jsonb_typeof(p_issuer_snapshot) is distinct from 'object'
    or (p_client_snapshot->>'id') is distinct from q.client_id::text then
    raise exception using errcode='PT400',message='Informations client ou entreprise invalides.';
  end if;
  invoice_id:=p_operation_id;
  insert into public.invoices(id,tenant_id,client_id,invoice_number,status,issue_date,due_date,notes,items,currency,
    subtotal_amount,tax_rate,tax_amount,total_amount,discount_type,discount_value,line_discount_amount,discount_amount,
    client_snapshot,issuer_snapshot,issued_at,quote_id,quote_number,po_reference)
  values(invoice_id,q.tenant_id,q.client_id,p_invoice_number,'sent',p_issue_date,p_due_date,q.notes,q.items,q.currency,
    q.subtotal_amount,q.tax_rate,q.tax_amount,q.total_amount,q.discount_type,q.discount_value,q.line_discount_amount,q.discount_amount,
    p_client_snapshot,p_issuer_snapshot,now(),q.id,q.quote_number,nullif(trim(p_po_reference),''));
  if p_payment is not null then
    perform public.record_kadi_payment(p_tenant_id,invoice_id,(p_payment->>'idempotency_key')::uuid,
      (p_payment->>'amount')::numeric,(p_payment->>'paid_on')::date,p_payment->>'method',p_payment->>'reference',p_actor_id);
  end if;
  update public.quotes set status='converted',converted_invoice_id=invoice_id,converted_at=now(),converted_by=p_actor_id,
    conversion_key=p_operation_id,conversion_payload=spec,client_snapshot=p_client_snapshot,issuer_snapshot=p_issuer_snapshot where id=q.id;
  return invoice_id;
end $$;
revoke all on function public.convert_kadi_quote(uuid,uuid,integer,uuid,text,date,date,text,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.convert_kadi_quote(uuid,uuid,integer,uuid,text,date,date,text,jsonb,jsonb,jsonb,uuid) to service_role;
-- One SQL snapshot keeps the PDF's cumulative balance consistent with its receipt detail.
create function public.kadi_invoice_pdf_state(p_tenant_id uuid,p_invoice_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('invoice',to_jsonb(i) || jsonb_build_object('client',
    (select to_jsonb(c) from public.clients c where c.id=i.client_id and c.tenant_id=i.tenant_id)),
    'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_on,p.created_at,p.id)
      from public.invoice_payments p where p.invoice_id=i.id and p.tenant_id=i.tenant_id and p.voided_at is null),'[]'::jsonb))
  from public.invoices i where i.id=p_invoice_id and i.tenant_id=p_tenant_id;
$$;
revoke all on function public.kadi_invoice_pdf_state(uuid,uuid) from public,anon,authenticated;
grant execute on function public.kadi_invoice_pdf_state(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
