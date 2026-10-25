-- Additive migration. Back up first; retain original invoice amounts and archives.
begin;

alter table public.invoices add column paid_amount numeric not null default 0;
create unique index invoices_id_tenant_key on public.invoices(id, tenant_id);
alter table public.invoices drop constraint invoices_status_valid;
alter table public.invoices add constraint invoices_status_valid check
  (status is not null and status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue'));
alter table public.invoices add constraint invoices_paid_amount_valid check
  (paid_amount >= 0 and paid_amount <= total_amount and paid_amount = round(paid_amount, 2));
alter table public.invoices add constraint invoices_partial_status_valid check
  (status <> 'partially_paid' or (paid_amount > 0 and paid_amount < total_amount));

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  tenant_id uuid not null,
  amount numeric not null check (amount > 0 and amount <= 1000000000000 and amount = round(amount, 2)),
  currency text not null check (currency in ('USD', 'CDF')),
  paid_on date not null,
  method text not null default 'other' check (method in ('cash', 'bank_transfer', 'mobile_money', 'other', 'legacy')),
  reference text check (length(reference) <= 160),
  recorded_by uuid,
  created_at timestamptz not null default now(),
  is_legacy boolean not null default false,
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  constraint invoice_payments_invoice_tenant_fk foreign key (invoice_id, tenant_id)
    references public.invoices(id, tenant_id) on delete restrict,
  constraint invoice_payments_void_valid check (
    (voided_at is null and voided_by is null and void_reason is null) or
    (voided_at is not null and voided_by is not null and void_reason is not null and length(trim(void_reason)) between 3 and 500))
);
create index invoice_payments_invoice_tenant_idx on public.invoice_payments(invoice_id, tenant_id, created_at, id);
create index invoice_payments_receipts_idx on public.invoice_payments(tenant_id, currency, paid_on, id) where voided_at is null;
alter table public.invoice_payments enable row level security;
revoke all on public.invoice_payments from public, anon, authenticated;
grant select on public.invoice_payments to authenticated;
grant select, insert, update on public.invoice_payments to service_role;
create policy invoice_payments_read_own on public.invoice_payments for select to authenticated
  using (tenant_id = (select tenant_id from public.profiles where id = (select auth.uid())));

-- Old "paid" meant a manually declared full settlement, not a bank transaction.
-- Import it explicitly as legacy; do not invent individual historic instalments.
drop trigger guard_kadi_invoice on public.invoices;
insert into public.invoice_payments(invoice_id, tenant_id, amount, currency, paid_on, method, reference, is_legacy)
select id, tenant_id, total_amount, currency,
  coalesce((paid_at at time zone 'Africa/Lubumbashi')::date, issue_date, created_at::date, current_date),
  'legacy', case when paid_at is null then 'Ancien statut payé ; date estimée depuis la facture'
    else 'Règlement repris de l’ancien statut payé' end, true
from public.invoices where status = 'paid' and total_amount > 0;
update public.invoices set paid_amount = total_amount where status = 'paid';

create or replace function public.guard_kadi_invoice()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'draft' then raise exception using errcode = '23514', message = 'Issued invoice is immutable'; end if;
    return old;
  end if;
  if TG_OP = 'INSERT' and new.paid_amount <> 0 then
    raise exception using errcode = '23514', message = 'Payments must be recorded in the ledger';
  end if;
  if TG_OP = 'UPDATE' then
    if new.paid_amount is distinct from old.paid_amount and pg_trigger_depth() < 2 then
      raise exception using errcode = '23514', message = 'Payments must be recorded in the ledger';
    end if;
    if old.status <> 'draft' then
      if (to_jsonb(new) - 'status' - 'paid_at' - 'version' - 'paid_amount') is distinct from
         (to_jsonb(old) - 'status' - 'paid_at' - 'version' - 'paid_amount') then
        raise exception using errcode = '23514', message = 'Issued invoice is immutable';
      end if;
      if not (
        (old.status = 'paid' and new.status = 'paid') or
        (old.status in ('sent', 'overdue', 'partially_paid') and new.status in ('sent', 'overdue', 'partially_paid', 'paid')) or
        (old.status = 'paid' and new.status in ('sent', 'overdue', 'partially_paid') and pg_trigger_depth() >= 2)
      ) then raise exception using errcode = '23514', message = 'Invalid invoice status transition'; end if;
      if old.status = 'paid' and new.paid_at is distinct from old.paid_at and pg_trigger_depth() < 2 then
        raise exception using errcode = '23514', message = 'Payment date is immutable';
      end if;
    end if;
    new.version := old.version + 1;
  end if;
  if new.paid_amount > 0 and new.paid_amount < new.total_amount and new.status not in ('partially_paid', 'paid') then
    raise exception using errcode = '23514', message = 'Partial settlement must retain its partial status';
  end if;
  if new.status <> 'draft' and (TG_OP = 'INSERT' or old.status = 'draft') then
    if new.client_snapshot is null or jsonb_typeof(new.client_snapshot) <> 'object' or
       new.issuer_snapshot is null or jsonb_typeof(new.issuer_snapshot) <> 'object' or
       new.issued_at is null or new.client_id is null or new.issue_date is null or jsonb_array_length(new.items) = 0 then
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

create function public.guard_kadi_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare bill public.invoices;
begin
  if TG_OP = 'DELETE' then
    raise exception using errcode = '23514', message = 'Payment history cannot be deleted';
  end if;
  if TG_OP = 'UPDATE' then
    if (to_jsonb(new) - 'voided_at' - 'voided_by' - 'void_reason') is distinct from
       (to_jsonb(old) - 'voided_at' - 'voided_by' - 'void_reason') or
       old.voided_at is not null or new.voided_at is null then
      raise exception using errcode = '23514', message = 'Payment history is immutable; void it with a reason';
    end if;
  end if;
  -- Serialize every receipt and correction on its invoice, including direct server writes.
  select * into bill from public.invoices where id = new.invoice_id and tenant_id = new.tenant_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Facture introuvable.'; end if;
  if TG_OP = 'INSERT' then
    if bill.status = 'draft' then raise exception using errcode = 'PT409', message = 'Émettez la facture avant d’enregistrer un versement.'; end if;
    if new.currency <> bill.currency then raise exception using errcode = 'PT409', message = 'Le versement doit utiliser la devise de la facture.'; end if;
    if new.amount > bill.total_amount - bill.paid_amount then
      raise exception using errcode = 'PT409', message = 'Le versement dépasse le solde restant. Actualisez la facture.';
    end if;
    if new.is_legacy or new.method = 'legacy' or new.voided_at is not null then
      raise exception using errcode = 'PT400', message = 'Nouveau versement invalide.';
    end if;
    if new.paid_on > (current_timestamp at time zone 'Africa/Lubumbashi')::date then
      raise exception using errcode = 'PT400', message = 'La date de réception ne peut pas être dans le futur.';
    end if;
  end if;
  return new;
end $$;
create trigger guard_kadi_payment before insert or update or delete on public.invoice_payments
  for each row execute function public.guard_kadi_payment();

create function public.refresh_kadi_invoice_payments()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare received numeric; settled_on date;
begin
  select coalesce(sum(amount), 0), max(paid_on) into received, settled_on
  from public.invoice_payments where invoice_id = new.invoice_id and tenant_id = new.tenant_id and voided_at is null;
  update public.invoices set paid_amount = received,
    status = case when received = total_amount then 'paid'
      when received > 0 then 'partially_paid'
      when due_date < (current_timestamp at time zone 'Africa/Lubumbashi')::date then 'overdue' else 'sent' end,
    paid_at = case when received = total_amount then settled_on::timestamp at time zone 'Africa/Lubumbashi' else null end
  where id = new.invoice_id and tenant_id = new.tenant_id;
  return new;
end $$;
create trigger refresh_kadi_invoice_payments after insert or update on public.invoice_payments
  for each row execute function public.refresh_kadi_invoice_payments();

-- Keep old clients' "mark paid" action compatible during a rolling deployment.
-- It now records the remaining full balance instead of bypassing payment history.
create function public.capture_kadi_paid_status()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'paid' and new.paid_amount < new.total_amount then
    insert into public.invoice_payments(invoice_id, tenant_id, amount, currency, paid_on, method, reference)
    values (new.id, new.tenant_id, new.total_amount - new.paid_amount, new.currency,
      (coalesce(new.paid_at, current_timestamp) at time zone 'Africa/Lubumbashi')::date,
      'other', 'Règlement intégral déclaré via le statut payé');
  end if;
  return new;
end $$;
create trigger capture_kadi_paid_status after insert or update on public.invoices
  for each row execute function public.capture_kadi_paid_status();

create function public.record_kadi_payment(p_tenant_id uuid, p_invoice_id uuid, p_payment_id uuid,
  p_amount numeric, p_paid_on date, p_method text, p_reference text, p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare bill public.invoices; previous public.invoice_payments;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and tenant_id = p_tenant_id) then
    raise exception using errcode = 'PT403', message = 'Accès refusé.';
  end if;
  select * into bill from public.invoices where id = p_invoice_id and tenant_id = p_tenant_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Facture introuvable.'; end if;
  select * into previous from public.invoice_payments where id = p_payment_id;
  if found then
    if previous.tenant_id = p_tenant_id and previous.invoice_id = p_invoice_id and previous.amount = p_amount
      and previous.paid_on = p_paid_on and previous.method = p_method and previous.reference is not distinct from p_reference then
      return previous.id;
    end if;
    raise exception using errcode = 'PT409', message = 'Cette clé de versement a déjà été utilisée pour une autre saisie.';
  end if;
  insert into public.invoice_payments(id, tenant_id, invoice_id, amount, currency, paid_on, method, reference, recorded_by)
  values (p_payment_id, p_tenant_id, p_invoice_id, p_amount, bill.currency, p_paid_on, p_method, p_reference, p_actor_id);
  return p_payment_id;
end $$;

create function public.void_kadi_payment(p_tenant_id uuid, p_invoice_id uuid, p_payment_id uuid,
  p_reason text, p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare receipt public.invoice_payments;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and tenant_id = p_tenant_id) then
    raise exception using errcode = 'PT403', message = 'Accès refusé.';
  end if;
  perform 1 from public.invoices where id = p_invoice_id and tenant_id = p_tenant_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Facture introuvable.'; end if;
  select * into receipt from public.invoice_payments
    where id = p_payment_id and invoice_id = p_invoice_id and tenant_id = p_tenant_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Versement introuvable.'; end if;
  if receipt.voided_at is not null then return receipt.id; end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 500 then
    raise exception using errcode = 'PT400', message = 'Un motif de 3 à 500 caractères est requis.';
  end if;
  update public.invoice_payments set voided_at = current_timestamp, voided_by = p_actor_id, void_reason = trim(p_reason)
    where id = receipt.id;
  return receipt.id;
end $$;

revoke all on function public.guard_kadi_invoice(), public.guard_kadi_payment(),
  public.refresh_kadi_invoice_payments(), public.capture_kadi_paid_status() from public, anon, authenticated;
revoke all on function public.record_kadi_payment(uuid, uuid, uuid, numeric, date, text, text, uuid),
  public.void_kadi_payment(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.guard_kadi_invoice(), public.guard_kadi_payment(),
  public.refresh_kadi_invoice_payments(), public.capture_kadi_paid_status(),
  public.record_kadi_payment(uuid, uuid, uuid, numeric, date, text, text, uuid),
  public.void_kadi_payment(uuid, uuid, uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
