-- Add optional PDF layout selection. Existing documents keep their classic layout.
-- The quote-to-invoice trigger preserves the chosen model during conversion
-- without changing the public RPC signature or the payment workflow.
begin;

alter table public.invoices
  add column pdf_template text not null default 'classic'
  constraint invoices_pdf_template_valid check (pdf_template in ('classic', 'sober', 'minimal'));

alter table public.quotes
  add column pdf_template text not null default 'classic'
  constraint quotes_pdf_template_valid check (pdf_template in ('classic', 'sober', 'minimal'));

create function public.copy_quote_pdf_template() returns trigger
  language plpgsql security invoker set search_path = '' as $$
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
end $$;

create trigger copy_quote_pdf_template_on_invoice
  before insert on public.invoices
  for each row execute function public.copy_quote_pdf_template();

revoke all on function public.copy_quote_pdf_template() from public, anon, authenticated;
grant execute on function public.copy_quote_pdf_template() to service_role;

notify pgrst, 'reload schema';
commit;
