# ARCHITECTURE.md – Structure technique du projet KADI

Ce document décrit la **structure complète** du projet KADI, ses **dossiers principaux**, et la **logique de communication** entre les différentes couches (Frontend, Backend, Supabase, et OpenAI).

---

## Vue d’ensemble

KADI suit une architecture **MERN simplifiée** (React + Node.js/Express + Supabase) organisée autour de deux dossiers principaux :

```
kadi/
├── frontend/     → Interface utilisateur (React, Vite, TailwindCSS)
└── backend/      → API REST (Node.js, Express, Supabase, OpenAI)
```

- **Frontend** : assure l’expérience utilisateur, la navigation, la saisie et la visualisation des factures.  
- **Backend** : traite les requêtes API, gère les données via Supabase et la génération IA/PDF.  
- **Supabase** : stocke toutes les entités (utilisateurs, clients, produits, factures).  
- **OpenAI GPT‑5** : génère des factures automatiquement à partir d’un texte libre.

---

## FRONTEND – React + Vite + TailwindCSS

**Dossier :** `/frontend`

### Structure
```
frontend/
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── components/
    │   ├── Navbar.jsx
    │   ├── InvoiceForm.jsx
    │   ├── InvoiceList.jsx
    ├── hooks/
    │   └── useAuth.jsx
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── Clients.jsx
    │   ├── Facture.jsx
    └── services/
        ├── api.js
        └── supabase.js
```

### Rôle des principaux éléments
- **App.jsx** : point d’entrée principal avec le routing.
- **components/** : éléments réutilisables (navbar, formulaires, listes).
- **pages/** : vues principales du site (Login, Dashboard, Facture, etc.).
- **hooks/useAuth.jsx** : gestion de l’authentification et du contexte utilisateur.
- **services/api.js** : gestion centralisée des appels API backend.
- **services/supabase.js** : configuration du client Supabase (auth + stockage).

### Flux utilisateur
1. L’utilisateur se connecte via Supabase (email/mot de passe).
2. Le token JWT est stocké et utilisé pour chaque appel à l’API backend.
3. Les pages Dashboard, Clients et Facture affichent les données liées au tenant de l’utilisateur.

---

## BACKEND – Node.js + Express

**Dossier :** `/backend`

### Structure
```
backend/
├── package.json
├── server.js
├── .env (exemple)
├── models/
│   └── supabaseClient.js
├── controllers/
│   ├── authController.js
│   ├── clientController.js
│   ├── productController.js
│   ├── invoiceController.js
│   └── aiController.js
└── routes/
    ├── auth.js
    ├── clients.js
    ├── products.js
    ├── invoices.js
    └── ai.js
```

### Logique générale
- **server.js** : initialise le serveur Express, gère le CORS, le parsing JSON et la configuration des routes.
- **controllers/** : contiennent la logique métier (authentification, création client, génération IA, etc.).
- **routes/** : définissent les endpoints REST et appellent les contrôleurs correspondants.
- **supabaseClient.js** : établit la connexion sécurisée à Supabase (clé service role).

### Middleware
- Vérification du **token JWT** envoyé par le frontend.
- Contrôle du **tenant_id** pour isoler les données par utilisateur.

### Génération IA et PDF
- `/api/ai/facture` : envoie un texte libre à GPT‑5 → renvoie un objet JSON structuré de facture.
- `/api/invoices/pdf/:id` : génère un PDF stylisé via **pdfkit** à partir des données de facture.

---

## SUPABASE – Base de données et Auth

Supabase gère :
- **Authentification** : via email/password.
- **Stockage** : tables `tenants`, `profiles`, `clients`, `products`, `invoices`.
- **RLS (Row Level Security)** : garantit que chaque utilisateur ne voit que ses propres données.

 Détails complets dans **SUPABASE.md** (tables SQL + policies).

---

## OPENAI – Génération IA de facture

- Utilise **GPT‑5 Codex** pour interpréter un texte libre (ex : « Facture pour Jean Dupont, 3 produits A à 10 USD ») et produire une structure JSON exploitable.
- Le backend transforme cette structure en une facture enregistrée dans Supabase.

Exemple d’appel interne :
```js
POST /api/ai/facture
{
  "prompt": "Facture pour Jean Dupont, 2 sacs de riz à 25 USD et 1 huile à 10 USD"
}
```
Réponse :
```json
{
  "client": "Jean Dupont",
  "items": [
    { "name": "Sac de riz", "quantity": 2, "unit_price": 25 },
    { "name": "Huile", "quantity": 1, "unit_price": 10 }
  ],
  "total": 60
}
```

---

## Flux global de données

1. **Frontend (React)** → requêtes utilisateur (login, création facture...)
2. **Backend (Express)** → vérifie le token et le tenant
3. **Supabase** → stockage et récupération des données
4. **OpenAI GPT‑5** → génération automatique d’une facture à partir d’un texte
5. **Backend → Frontend** → retour des données + génération PDF si demandé

---

## Bonnes pratiques

- Séparer strictement les environnements (`.env.local`, `.env.prod`)
- Toujours valider les entrées utilisateur côté backend
- Utiliser la dernière version stable des dépendances (`npm install --legacy-peer-deps` si conflit)
- Conserver une structure claire pour faciliter la montée en version future

---

**Auteur :** Eric Kay (@EricayStudio)  
**Dernière mise à jour :** Octobre 2025

