-- Optional administrative references, stored as text to preserve leading zeroes.
-- Existing client records and immutable document snapshots remain untouched.
alter table public.clients
  add column nif text,
  add column national_id text,
  add column rccm text,
  add constraint clients_nif_length check (char_length(nif) <= 160),
  add constraint clients_national_id_length check (char_length(national_id) <= 160),
  add constraint clients_rccm_length check (char_length(rccm) <= 160);

comment on column public.clients.nif is 'Optional client tax identification number.';
comment on column public.clients.national_id is 'Optional client national identification reference.';
comment on column public.clients.rccm is 'Optional client trade and commercial register reference.';
