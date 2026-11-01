-- Safe, additive, repeatable migration for three PDF layouts.
-- Existing records retain "classic"; API-created rows keep the classic default.
-- The editor chooses minimal by default for new user-created documents.
-- Idempotency is deliberate: managed staging/production migration registries may
-- use different timestamps from the canonical repository migration filename.
begin;

alter table public.invoices
  add column if not exists pdf_template text not null default 'classic';

alter table public.quotes
  add column if not exists pdf_template text not null default 'classic';

do $guard$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_pdf_template_valid' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_pdf_template_valid
      check (pdf_template in ('classic', 'sober', 'minimal'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'quotes_pdf_template_valid' and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_pdf_template_valid
      check (pdf_template in ('classic', 'sober', 'minimal'));
  end if;
end $guard$;

create or replace function public.copy_quote_pdf_template() returns trigger
  language plpgsql security invoker set search_path = '' as $body$
begin
  if new.quote_id is not null then
    select q.pdf_template into new.pdf_template
    from public.quotes q
    where q.id = new.quote_id and q.tenant_id = new.tenant_id;
    if not found then
      raise exception using errcode = 'PT400', message = 'Devis introuvable pour cette entreprise.';
    end if;
  end if;
  return new;
end $body$;

do $guard$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.invoices'::regclass
      and tgname = 'copy_quote_pdf_template_on_invoice'
      and not tgisinternal
  ) then
    create trigger copy_quote_pdf_template_on_invoice
      before insert on public.invoices
      for each row execute function public.copy_quote_pdf_template();
  end if;
end $guard$;

revoke all on function public.copy_quote_pdf_template() from public, anon, authenticated;
grant execute on function public.copy_quote_pdf_template() to service_role;

notify pgrst, 'reload schema';
commit;
