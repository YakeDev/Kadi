# ROADMAP.md – Plan d’évolution du projet KADI

Ce document présente la **feuille de route** du projet KADI, de la version MVP actuelle vers une plateforme SaaS complète, performante et orientée utilisateurs PME.

---

## Schéma d’architecture de déploiement

Voici comment les différents services communiquent entre eux :

```
[ Utilisateur ]
       │
       ▼
[ Frontend (Vercel) ]  ←→  [ Backend (Render) ]  ←→  [ Supabase (Base + Auth) ]
       │                           │
       │                           └── Appels à OpenAI GPT‑5 pour génération IA
       │
       └── Requêtes HTTP sécurisées (Bearer Token Supabase)
```

## Phase 1 – MVP (livrée)

 Objectif : livrer un prototype fonctionnel complet pour test utilisateur.

**Fonctionnalités livrées :**

- Authentification (signup, login, logout) via Supabase.
- CRUD complet : clients, produits, factures.
- Génération IA de facture à partir d’un texte libre (OpenAI GPT‑5).
- Export PDF automatique via `pdfkit`.
- Interface responsive (React + TailwindCSS).
- Architecture multi‑tenant avec isolation des données.

**Livrables :**

- Backend Express sur Render.
- Frontend React sur Vercel.
- Base de données Supabase + policies RLS.

---

## Phase 2 – Amélioration UX & Dashboard analytique

Objectif : offrir une meilleure visibilité sur les ventes et la performance client.

**Nouvelles fonctionnalités prévues**

- [ ] Implémenter un tableau de bord avec graphiques (ventes mensuelles, top clients, produits les plus vendus).
- [ ] Intégrer **Recharts** ou **Chart.js** pour la visualisation des données.
- [ ] Ajouter un filtrage par période (jour / mois / année).
- [ ] Ajouter des notifications visuelles (toasts, loaders, états de succès/erreur).

**Livrables**

- Composant `DashboardChart.jsx`
- Composant `StatsCard.jsx`
- Endpoint enrichi `/api/invoices/summary` pour les KPI

**Notes techniques**

- Prévoir un design responsive et clair (hiérarchie visuelle des KPI).
- Les données doivent être récupérées dynamiquement depuis l’API.
- Les toasts et loaders doivent être intégrés avec le système d’état global existant.

**Critères d’acceptation**

- Les graphiques se chargent correctement avec les données réelles.
- Le filtrage par période met à jour les graphiques dynamiquement.
- Les notifications s’affichent selon les actions utilisateur (succès, erreur, chargement).
- Le design respecte la charte UX globale de l’application.

---

## Phase 3 – Automatisation & Intégrations externes

 Objectif : rendre la facturation plus dynamique et interconnectée.

**Fonctionnalités prévues :**

- [ ] Envoi automatique de la facture PDF par **email** après création.
- [ ] Intégration SMTP (ex. SendGrid, Resend ou Supabase Functions).
- [ ] Génération de lien public de visualisation facture (`/invoice/:id/view`).
- [ ] Ajout d’un logo d’entreprise dans les PDF (upload depuis profil).

**Livrables :**

- Nouvelle table `settings` par tenant.
- Route `/api/invoices/send` pour email automatique.

---

## Phase 4 – Paiements & compatibilité locale

 Objectif : permettre le règlement en ligne et la compatibilité régionale.

**Fonctionnalités prévues :**

- [ ] Intégration des passerelles de paiement africaines : **pawaPay**, **Paystack**, **Flutterwave**.
- [ ] Suivi des paiements (partiel / complet / en attente).
- [ ] Envoi automatique de reçu après paiement.

**Livrables :**

- Table `payments` liée à `invoices`.
- Routes `/api/payments` et `/api/invoices/:id/pay`.

---

## Phase 5 – Internationalisation & Offline Mode

 Objectif : élargir la portée de KADI et améliorer l’expérience utilisateur.

**Fonctionnalités prévues :**

- [ ] Traduction FR / EN / SW.
- [ ] Sélecteur de langue dynamique.
- [ ] Version **PWA (Progressive Web App)**.
- [ ] Accès partiel **hors ligne** : cache local des factures et clients.

**Livrables :**

- i18n via `react-intl` ou `react-i18next`.
- Service Worker pour mode offline.

---

## Phase 6 – IA avancée & reporting intelligent

 Objectif : faire évoluer KADI vers un assistant de gestion intelligent.

**Fonctionnalités prévues :**

- [ ] Assistant IA contextuel (chatbot intégré).
- [ ] Génération automatique de rapports mensuels (PDF + email).
- [ ] Suggestions de relance client ou d’optimisation tarifaire.

**Livrables :**

- Endpoint `/api/ai/report`.
- Tableau de bord enrichi avec insights automatiques.

---

## Vision long terme (2026+)

> KADI ambitionne de devenir une solution SaaS complète et locale pour les PME africaines.

**Axes stratégiques :**

- Hébergement 100 % régional (Afrique de l’Est / Afrique Centrale).
- Paiement multi‑devises + taux de change automatique.
- API publique pour intégration avec ERP ou CRM externes.
- Version mobile native (React Native ou Flutter).
- Tableau de bord analytique avec IA prédictive (ventes, retards, saisonnalité).

---

## Suivi & priorisation

| Phase | Titre                      | Statut      | Priorité |
| ----- | -------------------------- | ----------- | -------- |
| 1     | MVP initial                |  Terminé  | Haute    |
| 2     | Dashboard analytique       | En cours | Haute    |
| 3     | Emails automatisés         |  À venir  | Moyenne  |
| 4     | Paiements locaux           |  À venir  | Élevée   |
| 5     | Internationalisation / PWA |  À venir  | Moyenne  |
| 6     | IA avancée                 |  À venir  | Basse    |

---

**Auteur :** Eric Kay (@EricayStudio)  
**Dernière mise à jour :** Octobre 2025
