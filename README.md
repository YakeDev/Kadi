# KADI – MVP SaaS de facturation pour PME locales

KADI est une application de **facturation intelligente** conçue pour les petites entreprises locales. Elle combine **simplicité**, **automatisation** et **modernité** afin d’aider les entrepreneurs à gérer leurs clients, produits et factures depuis une interface web fluide et sécurisée.

---

## Fonctionnalités principales

- Authentification sécurisée via **Supabase** (inscription, connexion, déconnexion)
- Gestion complète des **clients, produits et factures** (CRUD)
- Génération automatique d’une facture à partir d’un **texte libre grâce à OpenAI GPT‑5**
- Export des factures au **format PDF**
- Interface **responsive et minimaliste**, inspirée de Notion et Linear

---

## Stack technique

| Couche         | Technologie                   | Rôle                                                        |
| -------------- | ----------------------------- | ----------------------------------------------------------- |
| Frontend       | React 18 + Vite + TailwindCSS | Interface responsive et intuitive                           |
| Backend        | Node.js 20 + Express          | API REST multi‑tenant, génération PDF, appels OpenAI        |
| Auth & Données | Supabase                      | Authentification + stockage des entités                     |
| IA             | OpenAI GPT‑5 (Codex)          | Analyse de texte et génération de structure JSON de facture |
| PDF            | pdfkit                        | Création de PDF stylisés directement depuis le backend      |
| Déploiement    | Vercel (front) / Render (API) | Plateformes cloud simples et rapides pour le MVP            |

---

## Pré‑requis

Avant de commencer, vous devez disposer de :

- Node.js **v20+**
- Un compte **Supabase** (avec clés `service role` et `public anon`)
- Une **clé API OpenAI** (accès à GPT‑5 ou modèle équivalent Codex)
- (Optionnel) Comptes **Vercel** et **Render** pour le déploiement

---

## Installation rapide

### 1. Cloner le projet

```bash
git clone https://github.com/YakeDev/Kadi.git
cd Kadi
```

### 2. Configurer le backend

```bash
cd backend
cp .env .env.local
# Ajouter vos clés Supabase et OpenAI
npm install
npm run dev
```

### 3. Configurer le frontend

```bash
cd ../frontend
cp .env.example .env.local
# Ajouter VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL
npm install
npm run dev
```

Le frontend se lance sur `http://localhost:5173` et le backend sur `http://localhost:4000`.

---

## Architecture

Le projet est structuré en deux grandes parties :

```
kadi/
├── frontend/   → React + Tailwind + Vite
└── backend/    → Node.js + Express + Supabase + OpenAI
```

 Pour une description détaillée des dossiers, voir **ARCHITECTURE.md**

---

## API REST

L’API REST couvre l’authentification, les clients, les produits, les factures et la génération IA.  
Une documentation complète avec les exemples est disponible dans **API.md**.

---

## Base de données Supabase

Toutes les instructions SQL (création de tables, RLS, policies multi‑tenant) sont regroupées dans **SUPABASE.md**.

---

## Déploiement

Le déploiement recommandé se fait sur :

- **Frontend :** Vercel
- **Backend :** Render
- **Base de données :** Supabase

Guide complet dans **DEPLOYMENT.md**.

---

## Roadmap

Les prochaines étapes d’évolution sont décrites dans **ROADMAP.md** :

- Dashboard analytique (KPI, top clients)
- Intégration d’envoi d’emails de factures
- Paiements en ligne (pawaPay, Paystack)
- PWA + mode hors ligne
- Internationalisation (FR / EN / SW)

---

## Tests

### Backend

```bash
cd backend
npm install            # première fois pour installer jest/supertest
npm test               # exécuter la suite Jest
```

Les tests utilisent `supertest` pour vérifier les routes Express. Les variables de test sont dans `.env.test`.

### Frontend

> Tests unitaires non configurés pour l’instant. Voir `frontend/` si vous souhaitez ajouter Vitest/Testing Library.

---

## Auteur & Licence

Projet imaginé et développé par **Eric Kay (@EricayStudio)**.  
Libre d’utilisation pour le prototypage, merci de créditer la source.
