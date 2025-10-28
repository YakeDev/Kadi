# SUPABASE.md – Configuration de la base de données et sécurité RLS

Ce document décrit la configuration complète de **Supabase** pour le projet KADI : création des tables, activation de la sécurité RLS, et définition des politiques d’accès multi-tenant.

---

## 1. Structure de la base de données

KADI utilise 5 tables principales :

| Table       | Rôle                                                   |
| ----------- | ------------------------------------------------------ |
| `tenants`   | Gère les entreprises (espaces de travail indépendants) |
| `profiles`  | Profils utilisateurs liés à Supabase Auth              |
| `clients`   | Clients de chaque entreprise                           |
| `catalog_items` | Produits ou services vendus                        |
| `invoices`  | Factures et montants associés                          |

---

## 2. Création des tables SQL

Copiez et exécutez le script suivant dans l’onglet **SQL Editor** de Supabase :

```sql
-- 1 Table des entreprises (tenants)
create table tenants (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
```

### Mise à jour d’un schéma existant

Si votre table `profiles` a été créée avant l’ajout des champs optionnels (logo, téléphone, site web…), exécutez :

```sql
alter table profiles add column if not exists tagline text;
alter table profiles add column if not exists logo_url text;
alter table profiles add column if not exists manager_name text;
alter table profiles add column if not exists address text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists state text;
alter table profiles add column if not exists national_id text;
alter table profiles add column if not exists rccm text;
alter table profiles add column if not exists nif text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists website text;
```

---

## 5. Sécurité RLS (Row Level Security)

Activez la sécurité par ligne sur chaque table :

```sql
alter table profiles enable row level security;
alter table clients enable row level security;
alter table catalog_items enable row level security;
alter table invoices enable row level security;
```

---

## 4. Politiques multi-tenant

Ces politiques garantissent qu’un utilisateur n’accède qu’aux données de **son propre tenant**.

### Table `profiles`

```sql
create policy "Profil par utilisateur" on profiles
  for select using (id = auth.uid());
```

### Table `clients`

```sql
create policy "Clients par tenant" on clients
  for all using (
    tenant_id = (
      select tenant_id from profiles where profiles.id = auth.uid()
    )
  )
  with check (
    tenant_id = (
      select tenant_id from profiles where profiles.id = auth.uid()
    )
  );
```

### Table `catalog_items`

```sql
create policy "Catalogue par tenant" on catalog_items
  for all using (
    tenant_id = (
      select tenant_id from profiles where profiles.id = auth.uid()
    )
  )
  with check (
    tenant_id = (
      select tenant_id from profiles where profiles.id = auth.uid()
    )
  );
```

### Table `invoices`

```sql
create policy "Factures par tenant" on invoices
  for all using (
    tenant_id = (
      select tenant_id from profiles where profiles.id = auth.uid()
    )
  )
  with check (
    tenant_id = (
      select tenant_id from profiles where profiles.id = auth.uid()
    )
  );
```

---

## 5. Variables d’environnement

Ajoutez ces variables dans vos fichiers `.env.local` :

**Backend :**

```
SUPABASE_URL=...
SUPABASE_KEY=...        # clé service role
```

**Frontend :**

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 6. Bonnes pratiques

- Toujours utiliser la **clé service role** côté serveur (jamais exposée au frontend)
- Tester les **policies RLS** avant le déploiement (avec différents comptes)
- Créer un **tenant par entreprise** lors de l’inscription d’un utilisateur
- Vérifier que chaque table a bien la colonne `tenant_id`

---

**Auteur :** Eric Kay (@EricayStudio)  
**Dernière mise à jour :** Octobre 2025
