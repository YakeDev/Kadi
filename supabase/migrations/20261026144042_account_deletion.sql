-- Requests survive Auth deletion so a failed final step can be retried safely.
begin;

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid not null,
  email text,
  status text not null check (status in ('pending_verification', 'pending_review', 'blocked', 'data_erased', 'completed', 'cancelled')),
  verification_hash text,
  verification_expires_at timestamptz,
  verified_at timestamptz,
  requested_at timestamptz not null default now(),
  export_acknowledged boolean not null default false,
  processed_by uuid,
  processed_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  constraint deletion_request_verification_valid check
    ((status = 'pending_verification') = (verification_hash is not null))
);
create unique index account_deletion_active_user on public.account_deletion_requests(user_id)
  where status not in ('completed', 'cancelled');
create index account_deletion_status_requested on public.account_deletion_requests(status, requested_at);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select, insert, update on public.account_deletion_requests to service_role;

create function public.kadi_deletion_email_profile(p_email text)
returns table(id uuid, tenant_id uuid, email text)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.tenant_id, p.email from public.profiles p
  where pg_catalog.lower(p.email) = pg_catalog.lower(p_email)
  limit 2
$$;
revoke all on function public.kadi_deletion_email_profile(text) from public, anon, authenticated;
grant execute on function public.kadi_deletion_email_profile(text) to service_role;

-- Converted quotes and their invoices reference one another. Defer these two
-- foreign keys only within the single transaction that removes both rows.
alter table public.invoices drop constraint invoices_quote_tenant_fk;
alter table public.quotes drop constraint quotes_invoice_tenant_fk;
alter table public.invoices add constraint invoices_quote_tenant_fk
  foreign key (quote_id, tenant_id) references public.quotes(id, tenant_id)
  on delete no action deferrable initially immediate;
alter table public.quotes add constraint quotes_invoice_tenant_fk
  foreign key (converted_invoice_id, tenant_id) references public.invoices(id, tenant_id)
  on delete no action deferrable initially immediate;

-- The three existing guards are replaced below with identical logic except
-- for an internal, transaction-scoped removal path. Ordinary writes stay locked.

create or replace function public.guard_kadi_invoice()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'DELETE' and pg_catalog.current_setting('kadi.account_deletion_tenant', true) = old.tenant_id::text then return old; end if;
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

create or replace function public.guard_kadi_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare bill public.invoices;
begin
  if TG_OP = 'DELETE' and pg_catalog.current_setting('kadi.account_deletion_tenant', true) = old.tenant_id::text then return old; end if;
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

create or replace function public.guard_kadi_quote() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP = 'DELETE' and pg_catalog.current_setting('kadi.account_deletion_tenant', true) = old.tenant_id::text then return old; end if;
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

grant delete on public.invoice_payments to service_role;

-- A single transaction removes a tenant and its linked business records.
-- The Auth identity and Storage objects are separate services; the API retries
-- those steps after this function records data_erased.
create function public.kadi_erase_requested_account(p_request_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item public.account_deletion_requests; profile_count integer; result jsonb;
begin
  if not public.kadi_platform_admin_status(p_actor_id) then
    raise exception using errcode = 'PT403', message = 'Accès réservé au Super administrateur.';
  end if;
  select * into item from public.account_deletion_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'PT404', message = 'Demande introuvable.'; end if;
  if item.user_id = p_actor_id or public.kadi_platform_admin_status(item.user_id) then
    raise exception using errcode = 'PT409', message = 'Ce compte administrateur ne peut pas être supprimé ici.';
  end if;
  if item.status = 'data_erased' then return jsonb_build_object('user_id', item.user_id, 'stage', 'data_erased'); end if;
  if item.status <> 'pending_review' or item.verified_at is null then
    raise exception using errcode = 'PT409', message = 'La demande doit être vérifiée avant traitement.';
  end if;
  select count(*) into profile_count from public.profiles where tenant_id = item.tenant_id;
  if profile_count <> 1 or not exists (
    select 1 from public.profiles where id = item.user_id and tenant_id = item.tenant_id
  ) then
    raise exception using errcode = 'PT409', message = 'Compte partagé ou profil modifié : examen manuel requis.';
  end if;
  -- Allow only this tenant's DELETE rows through the normal immutability guards.
  perform pg_catalog.set_config('kadi.account_deletion_tenant', item.tenant_id::text, true);
  set constraints public.invoices_quote_tenant_fk, public.quotes_invoice_tenant_fk deferred;
  delete from public.invoice_payments where tenant_id = item.tenant_id;
  delete from public.invoices where tenant_id = item.tenant_id;
  delete from public.quotes where tenant_id = item.tenant_id;
  delete from public.clients where tenant_id = item.tenant_id;
  delete from public.catalog_items where tenant_id = item.tenant_id;
  delete from public.tenants where id = item.tenant_id;
  perform pg_catalog.set_config('kadi.account_deletion_tenant', '', true);
  update public.account_deletion_requests set status = 'data_erased', processed_by = p_actor_id,
    processed_at = now(), verification_hash = null, verification_expires_at = null
    where id = p_request_id;
  result := jsonb_build_object('user_id', item.user_id, 'stage', 'data_erased');
  return result;
end $$;
revoke all on function public.kadi_erase_requested_account(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kadi_erase_requested_account(uuid, uuid) to service_role;
notify pgrst, 'reload schema';
commit;
