# KADI – MVP SaaS de facturation pour PME locales

KADI est une solution de facturation moderne pour petites entreprises.  
⚡️ Fonctionnalités principales :

- authentification sécurisée via Supabase (signup, login, logout) ;
- gestion clients, produits et factures (CRUD complet) ;
- génération automatique d’une facture à partir d’un texte grâce à OpenAI GPT‑5 ;
- export des factures au format PDF ;
- interface responsive minimaliste inspirée des SaaS contemporains (Notion, Linear).

---

## Stack technique

| Couche         | Technologie                   | Rôle                                                                           |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Frontend       | React 18 + Vite + TailwindCSS | UI responsive, routing client‐side, toasts et formulaires intuitifs            |
| Backend        | Node.js 20 + Express          | API REST multi-tenant, génération PDF, appels OpenAI, proxy vers Supabase      |
| Auth & Données | Supabase                      | Authentification email/mot de passe, stockage des entités (clients, produits…) |
| IA             | OpenAI GPT‑5 (Codex)          | Parsing d’un texte libre en structure JSON de facture                          |
| PDF            | pdfkit                        | Génération d’un PDF stylisé directement depuis le backend                      |
| Déploiement    | Vercel (front) / Render (API) | Plateformes gratuites/rapides adaptées à un MVP                                |

---

## Architecture

```
kadi/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── components/
│       │   ├── InvoiceForm.jsx
│       │   ├── InvoiceList.jsx
│       │   └── Navbar.jsx
│       ├── hooks/
│       │   └── useAuth.jsx
│       ├── pages/
│       │   ├── Clients.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Facture.jsx
│       │   └── Login.jsx
│       └── services/
│           ├── api.js
│           └── supabase.js
└── backend/
    ├── package.json
    ├── server.js
    ├── .env (exemple)
    ├── models/
    │   └── supabaseClient.js
    ├── controllers/
    │   ├── aiController.js
    │   ├── authController.js
    │   ├── clientController.js
    │   ├── invoiceController.js
    │   └── productController.js
    └── routes/
        ├── ai.js
        ├── auth.js
        ├── clients.js
        ├── invoices.js
        └── products.js
```

---

## Pré‑requis

- Node.js 20+
- Compte Supabase (clé service role + clé publique)
- Clé API OpenAI (accès au modèle GPT‑5 / Codex)
- (Optionnel) comptes Vercel et Render pour le déploiement

---

## Lancer le projet en local

### 1. Configuration Supabase

1. Créer un projet Supabase.
2. Activer l’authentification Email/Password.
3. Créer les tables suivantes (SQL simplifié) :

```sql
-- 1️ Table des entreprises (tenants)
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp default now()
);

-- 2️ Table des utilisateurs (liés à auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  email text unique not null,
  company text,
  created_at timestamp default now()
);

-- 3️ Table des clients (chaque client appartient à un tenant)
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

-- 4️ Table des produits
create table products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  unit_price numeric default 0,
  currency text default 'USD',
  created_at timestamp default now()
);

-- 5️ Table des factures
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

-- 6️ Index pour les perfs
create index on clients (tenant_id);
create index on products (tenant_id);
create index on invoices (tenant_id);
```

> Pour un vrai mode multi‑client, activez la Row Level Security et faites dépendre les policies du tenant associé à l’utilisateur connecté.

### Exemple de policies RLS

```sql
alter table clients enable row level security;
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

alter table products enable row level security;
create policy "Produits par tenant" on products
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

alter table invoices enable row level security;
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

alter table profiles enable row level security;
create policy "Profil par tenant" on profiles
  for select using (id = auth.uid());
```

> Les policies sont un exemple : adaptez-les selon que vous souhaitiez autoriser des rôles backoffice.

### 2. Backend

```bash
cd backend
cp .env .env.local
# Compléter .env.local :
# SUPABASE_URL=...
# SUPABASE_KEY=... (clé service role)
# OPENAI_API_KEY=...
# PORT=4000
# ALLOWED_ORIGINS=http://localhost:5173

npm install   # utilise automatiquement les dernières versions stables
# Si un conflit ERESOLVE apparaît, relancer avec : npm install --legacy-peer-deps
# Pour forcer une mise à jour : npm install <package>@latest
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local   # créer ce fichier si besoin
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...
# VITE_BACKEND_URL=http://localhost:4000

npm install   # installe les versions stables les plus récentes
# En cas d'erreur de peer deps : npm install --legacy-peer-deps
# Mise à jour ciblée : npm install <package>@latest
npm run dev

# Le frontend transmet automatiquement le jeton Supabase dans l'en-tête Authorization (Bearer) pour garantir l'isolation multi-tenant.
```

Le proxy Vite redirige automatiquement `/api` vers `http://localhost:4000`.

---

## API REST disponible

| Méthode | Endpoint                | Description                                                            |
| ------- | ----------------------- | ---------------------------------------------------------------------- |
| GET     | `/api/health`           | Ping santé du backend                                                  |
| POST    | `/api/auth/signup`      | Création utilisateur Supabase (admin)                                  |
| POST    | `/api/auth/login`       | Connexion (retourne session Supabase)                                  |
| POST    | `/api/auth/logout`      | Invalidation de session côté backend                                   |
| POST    | `/api/auth/profile`     | Création/MAJ du profil entreprise                                      |
| GET     | `/api/clients`          | Liste des clients _(requires Bearer token)_                            |
| POST    | `/api/clients`          | Création client _(requires Bearer token)_                              |
| PATCH   | `/api/clients/:id`      | Mise à jour client _(requires Bearer token)_                           |
| DELETE  | `/api/clients/:id`      | Suppression client _(requires Bearer token)_                           |
| GET     | `/api/products`         | Liste produits/services _(requires Bearer token)_                      |
| POST    | `/api/products`         | Création produit _(requires Bearer token)_                             |
| PATCH   | `/api/products/:id`     | Mise à jour produit _(requires Bearer token)_                          |
| DELETE  | `/api/products/:id`     | Suppression produit _(requires Bearer token)_                          |
| GET     | `/api/invoices`         | Liste des factures _(requires Bearer token)_                           |
| GET     | `/api/invoices/summary` | KPI tableau de bord _(requires Bearer token)_                          |
| POST    | `/api/invoices`         | Création facture _(requires Bearer token)_                             |
| PATCH   | `/api/invoices/:id`     | Mise à jour facture _(requires Bearer token)_                          |
| DELETE  | `/api/invoices/:id`     | Suppression facture _(requires Bearer token)_                          |
| GET     | `/api/invoices/pdf/:id` | Téléchargement du PDF _(requires Bearer token)_                        |
| POST    | `/api/ai/facture`       | Génération de facture depuis un prompt texte _(requires Bearer token)_ |

---

## Expérience utilisateur & multi-tenant

- Palette neutre (gris clair), bleu nuit et accent orange.
- Layout responsive : navbar fixe, sections en cartes, formulaires arrondis.
- Feedback immédiat : loaders basiques, toasts succès/erreur via `react-hot-toast`.
- Facturation rapide : formulaire manuel + bouton de génération IA.
- Gestion clients simple : formulaire compact + liste filtrable.
- Mode multi-client : chaque utilisateur dispose de son propre espace de données (isolation par `tenant_id`).

---

## Déploiement conseillé

1. **Frontend (Vercel)**
   - Ajouter les variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_URL`.
   - Construire via `npm run build`.
2. **Backend (Render)**
   - Service Web Node sur `server.js`, commande `npm install && npm run start`.
   - Variables d’environnement Supabase + OpenAI + `ALLOWED_ORIGINS`.
3. **Supabase**
   - Préparer les tables (SQL ci-dessus) et ajuster les politiques RLS.

---

## Roadmap MVP -> Produit

- [ ] CRUD produits côté frontend (sélection rapide dans le formulaire facture)
- [ ] Tableau de bord analytique (courbes, top clients, ventes)
- [ ] Intégration emails (envoi automatique de facture)
- [ ] Passerelles de paiement locales (pawaPay, Paystack)
- [ ] Internationalisation FR / EN / SW
- [ ] PWA + mode hors ligne

---

## 👨🏾 Auteur & Licence

Projet imaginé par **Eric Kay (@EricayStudio)**.  
Code libre d’utilisation pour prototypage, merci de créditer la source.
