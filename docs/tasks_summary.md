# Suivi détaillé – Kadi v1.2.0

## 3. Gestion des statuts & relances

### Objectifs UX
- Donner de la visibilité sur l’avancement de chaque facture.
- Automatiser les relances pour réduire le suivi manuel.
- Activer des actions en un clic sur la liste.

### Axes techniques
1. **Timeline de statut**
   - Champ `status_history` (jsonb) ou table dédiée.
   - Composant timeline dans la fiche facture + drawer.
2. **Relances programmées**
   - Champ `reminder_date` + endpoint `/invoices/:id/remind`.
   - Supabase Function / CRON pour envoyer les emails.
3. **Actions rapides**
   - Bouton “Relancer” dans `InvoiceList` (email + log).
   - Filtre “À relancer” dans la liste avec badge.

### UX/Tests
- Copywriting des emails de relance.
- Tests : workflows status → relance → paiement.
- Doc utilisateur : “Automatiser vos relances”.

---

## 4. Modèles & personnalisation

### Objectifs UX
- Permettre aux entreprises d’adapter leur image de marque.
- Offrir des PDF distinctifs (plusieurs styles).

### Axes techniques
1. **Thèmes PDF**
   - Paramètre `theme` stocké dans `profiles`.
   - Générateur PDF supportant plusieurs templates (couleurs, typographies).
2. **Palette / couleurs**
   - Champs `primary_color`, `accent_color` côté profil.
   - Prévisualisation instantanée.
3. **Gestion logo améliorée**
   - Validation du ratio, cropping basique côté front.
   - Regénération automatique des URLs (public + signed).

### UX/Tests
- Maquettes de 2-3 templates.
- Tests PDF : rendu avec / sans logo, police custom, longues descriptions.
- Mise à jour doc : “Personnaliser vos factures”.

---

## 5. Paiement & signature

### Objectifs UX
- Faciliter le paiement pour accélérer les encaissements.
- Capturer les signatures clients pour valider les devis.

### Axes techniques
1. **Paiement en ligne**
   - Intégration Stripe Checkout (ou PayPal) via endpoint `/payments/create`.
   - Lien de paiement dans email + tableau de bord.
   - Tracking `paid_via` et Webhooks Stripe → update Supabase.
2. **Signature client**
   - Générer un lien public sécurisé (token).
   - Interface de signature (canvas ou upload).
   - Stockage image + log `signed_at`.

### UX/Tests
- Flow “Envoyer facture + lien de paiement”.
- Tests : paiement réussi / échoué, signatures multiples.
- Doc : “Encaisser vos factures en ligne”.

---

## 6. Expérience client & catalogue

### Objectifs UX
- Offrir une vision 360° sur chaque client.
- Comprendre quelles prestations performent le mieux.

### Axes techniques
1. **Fiche client enrichie**
   - KPI (montant total, en retard, dernier paiement).
   - Liste des factures + devis + paiements liés.
2. **Analytics produits**
   - Endpoint `/products/stats` (ventes par période, marge).
   - Graphiques sur le dashboard catalogue.
3. **Navigation rapide**
   - Boutons “Créer facture pour ce client” et “Voir documents” dans les fiches.

### UX/Tests
- Maquettes fiche client et catalogue.
- Tests sur gros volumes (pagination, filtres).
- Doc : “Suivre vos clients & produits”.

---

## 7. Micro-interactions & onboarding

### Objectifs UX
- Rendre l’app plus engageante.
- Accompagner les nouveaux utilisateurs dans leurs premiers pas.

### Axes techniques
1. **Feedback enrichi**
   - Confettis / animations sur succès majeurs.
   - Notifications contextualisées (ex. “Envoyer facture maintenant ?”).
2. **Onboarding guidé**
   - `react-joyride` ou équivalent pour un tour produit.
   - Check-list de démarrage (logo, premier client, première facture).
3. **Accessibilité mobile**
   - Ajuster les composants (touch target ≥ 44px).
   - Tables responsives (card view sur mobile).

### UX/Tests
- Scripts du tutoriel, charte animation.
- Tests : parcours onboarding complet, appareils mobiles.
- Documentation : “Commencer avec Kadi”.

---

## Stratégie générale
- **Déploiements incrémentaux** : activer chaque bloc via feature flag.
- **Qualité** : tests unitaires & E2E à chaque lot, QA visuelle (chromatic).
- **Communication** : notes de mise à jour + vidéos courtes pour expliquer les nouveautés.

Ce document complète `docs/releases/v1.2.0.md` en servant de backlog détaillé pour l’équipe.  
Mise à jour continue à mesure des sprints.*** End Patch
