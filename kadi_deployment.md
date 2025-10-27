# DEPLOYMENT.md – Guide de déploiement du projet KADI

Ce document explique comment **déployer KADI** (frontend, backend et base de données) sur des plateformes cloud gratuites et stables : **Vercel**, **Render** et **Supabase**.

---

## Vue d’ensemble

| Composant  | Plateforme | Rôle |
|-------------|-------------|------|
| Frontend (React/Vite) | **Vercel** | Hébergement de l’interface web (HTTPS, CDN) |
| Backend (Node.js/Express) | **Render** | Hébergement de l’API REST (PDF, IA, CRUD) |
| Base de données | **Supabase** | Authentification, stockage et politiques RLS |

---

## Prérequis

- Compte **Vercel** (https://vercel.com)
- Compte **Render** (https://render.com)
- Compte **Supabase** (https://supabase.com)
- **Clé OpenAI** (pour GPT-5)

---

## 1. Déploiement Supabase

1. Créer un **nouveau projet Supabase**.
2. Exécuter le script SQL contenu dans **SUPABASE.md** pour créer les tables.
3. Activer la **Row Level Security (RLS)**.
4. Copier les **clés d’API** :
   - `service_role` → pour le backend (dans `.env`)
   - `anon_key` → pour le frontend (dans `.env.local`)
5. Copier l’URL Supabase du projet (`https://xyzcompany.supabase.co`).

---

## 2. Déploiement du Backend sur Render

1. Aller sur [Render.com > New > Web Service](https://render.com).
2. Connecter le dépôt GitHub (`Kadi`).
3. Choisir le dossier `/backend`.
4. Configurer les variables d’environnement :
   ```env
   SUPABASE_URL=...
   SUPABASE_KEY=...        # clé service role
   OPENAI_API_KEY=...
   ALLOWED_ORIGINS=https://kadi.vercel.app
   PORT=4000
   ```
5. Commande de build : `npm install`
6. Commande de lancement : `npm start`
7. Noter l’URL de déploiement (ex: `https://kadi-api.onrender.com`).

### Vérifier le backend
Ouvrir : `https://kadi-api.onrender.com/api/health` → doit renvoyer `{ "status": "ok" }`

---

## 3. Déploiement du Frontend sur Vercel

1. Aller sur [Vercel.com > New Project](https://vercel.com/new).
2. Importer le dépôt GitHub (`Kadi`).
3. Sélectionner le dossier `/frontend`.
4. Ajouter les variables d’environnement :
   ```env
   VITE_SUPABASE_URL=https://xyzcompany.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   VITE_BACKEND_URL=https://kadi-api.onrender.com
   ```
5. Lancer le build (`npm run build`).

### Vérifier le frontend
L’application doit être accessible à l’adresse :  
`https://kadi.vercel.app`

---

## 4. Connexion Frontend ↔ Backend

- Le frontend utilise un **proxy Vite** ou un appel direct à `VITE_BACKEND_URL`.
- Les requêtes incluent automatiquement le **Bearer token Supabase**.
- Assurez-vous que la variable `ALLOWED_ORIGINS` du backend inclut l’URL Vercel (pour CORS).

---

## 5. Variables d’environnement récapitulatives

| Fichier | Variable | Description |
|----------|-----------|--------------|
| `.env` (backend) | `SUPABASE_URL` | URL du projet Supabase |
|  | `SUPABASE_KEY` | Clé service role (serveur uniquement) |
|  | `OPENAI_API_KEY` | Clé API GPT‑5 |
|  | `ALLOWED_ORIGINS` | Domaine du frontend (CORS) |
| `.env.local` (frontend) | `VITE_SUPABASE_URL` | URL publique Supabase |
|  | `VITE_SUPABASE_ANON_KEY` | Clé anonyme Supabase |
|  | `VITE_BACKEND_URL` | URL Render du backend |

---

## 6. Optimisations post‑déploiement

- **Monitoring Render :** activez les logs pour suivre les erreurs serveur.
- **Monitoring Supabase :** utilisez l’onglet “Logs” pour observer les requêtes SQL et policies RLS.
- **Sécurité :**
  - N’exposez jamais la `service_role_key` côté frontend.
  - Limitez les origines CORS à votre domaine Vercel.
- **Performance :**
  - Utilisez `npm ci` au lieu de `npm install` pour des builds reproductibles.
  - Activez la mise en cache automatique des assets sur Vercel.

---

## 7. Déploiement alternatif (optionnel)

- **Docker Compose** : configuration possible pour un hébergement unifié (API + Front).
- **Railway.app** : alternative à Render avec meilleure latence.
- **Supabase Self‑hosted** : possible via Docker, pour usage interne.

---

## Résumé rapide

| Étape | Plateforme | Commande clé |
|-------|-------------|---------------|
| 1 Créer la base | Supabase | Exécuter le SQL de `SUPABASE.md` |
| 2 Déployer API | Render | `npm start` |
| 3 Déployer Front | Vercel | `npm run build` |
| 4 Configurer CORS | Backend | `ALLOWED_ORIGINS=https://kadi.vercel.app` |
| 5 Vérifier | URL Render/Vercel | `/api/health` + interface frontend |

---

**Auteur :** Eric Kay (@EricayStudio)  
**Dernière mise à jour :** Octobre 2025

