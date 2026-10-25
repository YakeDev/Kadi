-- Additive defaults preserve all historical invoice amounts, archives and receipts.
begin;

alter table public.invoices
  add column discount_type text not null default 'none',
  add column discount_value numeric not null default 0,
  add column line_discount_amount numeric not null default 0,
  add column discount_amount numeric not null default 0;

alter table public.invoices add constraint invoices_discount_valid check (
  discount_type in ('none', 'percent', 'fixed')
  and discount_value >= 0 and discount_value <= 1000000000000
  and discount_value = round(discount_value, 2)
  and (discount_type <> 'none' or discount_value = 0)
  and (discount_type <> 'percent' or discount_value <= 100)
  and line_discount_amount >= 0 and line_discount_amount = round(line_discount_amount, 2)
  and discount_amount >= line_discount_amount and discount_amount <= subtotal_amount
  and discount_amount = round(discount_amount, 2)
  and discount_amount - line_discount_amount = case discount_type
    when 'none' then 0
    when 'fixed' then discount_value
    when 'percent' then round((subtotal_amount - line_discount_amount) * discount_value / 100, 2)
  end
);

alter table public.invoices drop constraint invoices_totals_valid;
alter table public.invoices add constraint invoices_totals_valid check (
  total_amount is not null and subtotal_amount is not null
  and subtotal_amount >= 0 and subtotal_amount <= 1000000000000
  and subtotal_amount = round(subtotal_amount, 2)
  and total_amount >= 0 and total_amount <= 1000000000000
  and total_amount = subtotal_amount - discount_amount + coalesce(tax_amount, 0)
  and total_amount = round(total_amount, 2)
);

notify pgrst, 'reload schema';
commit;
