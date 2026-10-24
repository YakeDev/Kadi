-- New/empty databases only. Existing databases: baseline/repair after schema comparison; see SUPABASE.md.
-- 1 Table des entreprises (tenants)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp default now()
);

-- 2 Table des utilisateurs (liés à auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  email text unique not null,
  company text,
  tagline text,
  logo_url text,
  manager_name text,
  address text,
  city text,
  state text,
  national_id text,
  rccm text,
  nif text,
  phone text,
  website text,
  created_at timestamp default now()
);

-- 3 Table des clients (chaque client appartient à un tenant)
create table clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  created_at timestamp default now()
);

-- 4 Table du catalogue
create table catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  item_type text not null check (item_type in ('product', 'service')),
  unit_price numeric default 0,
  currency text default 'USD',
  sku text,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
create unique index catalog_items_tenant_sku_key on catalog_items (tenant_id, sku) where sku is not null;

-- 5 Table des factures
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  invoice_number text unique not null,
  issue_date date,
  due_date date,
  status text default 'draft',
  notes text,
  items jsonb default '[]'::jsonb,
  subtotal_amount numeric default 0,
  total_amount numeric default 0,
  currency text default 'USD',
  created_at timestamp default now()
);

-- 6 Index pour performance
create index on clients (tenant_id);
create index on catalog_items (tenant_id);
create index on invoices (tenant_id);
