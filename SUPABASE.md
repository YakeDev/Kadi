# Supabase — installation et migration de KADI

Les changements SQL de cette branche sont préparés et testés localement. Ils n’ont pas été appliqués au Supabase de production. Ne pas déployer cette version du serveur avant sa migration.

Le projet hébergé `kadi-db` a pu être inspecté le 22 octobre 2026. Le [contrôle de l'existant](docs/supabase-live-review.md) identifie huit factures bloquant cette migration : sept devises `$` et une facture taxée. Ne pas remplacer ces devises, supprimer les taxes ni recalculer l'historique automatiquement. Le schéma réel contient également des colonnes fiscales absentes du schéma initial du dépôt ; cette différence doit être conservée et traitée avant de baseliner l'existant.

## Nouveau projet vide

Les deux fichiers dans `supabase/migrations/`, créés par `supabase migration new`, sont ordonnés : schéma initial, puis protections. Ils supposent les rôles Supabase `anon`, `authenticated`, `service_role` et le schéma `auth` existants. Exécuter les deux dans un environnement de test dédié avant toute ouverture de l’application.

## Projet existant

1. Exporter le schéma réel et une sauvegarde restaurable. Comparer les cinq tables avec `20261022064406_initial_schema.sql`. Cette migration initiale ne doit pas être rejouée sur des tables existantes. Résoudre les différences avant de marquer sa version comme déjà appliquée.
2. Exécuter `docs/sql/preflight.sql` en lecture seule. La migration refuse les liens entre entreprises, devises/statuts invalides, dates incohérentes et montants incompatibles. Ne pas effacer ces anomalies pour contourner le contrôle : les rapprocher des documents originaux.
3. Sur une copie de test, vérifier l’historique des migrations (`npx supabase@2.121.0 migration list`). Après comparaison du schéma uniquement, le baseliner avec `npx supabase@2.121.0 migration repair 20261022064406 --status applied`. Utiliser la liaison au bon projet ; ne jamais réparer un projet au hasard.
4. Examiner `npx supabase@2.121.0 db push --dry-run --skip-vault`, puis appliquer uniquement les migrations attendues dans l’environnement choisi. La migration de protection est transactionnelle. Aucun lien erroné ni historique n’est réécrit automatiquement.
5. Vérifier avec deux comptes réels les lectures et refus décrits ci-dessous, puis répéter après mise en production. L’exécution de ces commandes reste une opération d’administration distincte.

## Protections ajoutées

- RLS activée sur **tenants, profiles, clients, catalog_items, invoices**. Toutes les anciennes politiques de ces tables sont remplacées afin de retirer les permissions permissives résiduelles.
- `anon` n’a aucun accès aux tables métier. `authenticated` peut uniquement lire ses propres lignes ; toutes les écritures passent par l’API. Aucun secret serveur ne doit être injecté dans une variable `VITE_*`.
- Clé étrangère composite `(client_id, tenant_id)` : une facture ne peut pas référencer le client d’une autre entreprise. Un client lié à une facture ne peut pas être supprimé ; ses coordonnées archivées restent disponibles.
- Provisionnement atomique et idempotent par `provision_kadi_profile`, accessible uniquement à `service_role`. La vérification des sessions n’effectue aucune création de profil ni d’entreprise.
- Une facture émise conserve `issuer_snapshot`, `client_snapshot`, `issued_at` et un PNG du logo. Les déclencheurs bloquent sa suppression ou la modification de son contenu. `paid_at` est enregistré lors du passage à « payée ». `version` protège les écritures simultanées.

Les anciennes factures déjà émises restent verrouillées. Leur historique ne peut pas être reconstitué à partir des coordonnées actuelles : l’API refuse leur nouvel export tant qu’aucune archive fiable n’a été rapprochée de l’original. Ne pas remplir les snapshots avec les valeurs du jour pour masquer cette absence.

## Logos privés

Configurer **`company-logos`** dans `SUPABASE_LOGO_BUCKET` (Render) et `VITE_SUPABASE_LOGO_BUCKET` (Vercel). L'inspection du projet hébergé a confirmé que ce bucket privé contient les deux objets existants. `kadi-compnies-logo`, auparavant configuré sur Vercel, est vide et n'a pas de politiques d'accès aux objets. La variable Vercel a été corrigée ; elle prendra effet dans les prochains déploiements. La configuration Render reste à vérifier.

Un profil référence un ancien objet de `company-logos` qui n'existe plus. Un autre référence un chemin privé existant et lui appartenant. La correction du nom du bucket ne recrée pas le fichier manquant : le propriétaire devra réimporter son logo. Aucun profil ni objet existant n'a été réécrit pendant le contrôle.

Le bucket peut rester privé. L’interface garde les URL signées ; le serveur télécharge uniquement un chemin appartenant à l’utilisateur, sur son propre Supabase. Les anciennes URL de ce projet et de ce bucket sont reconnues. Les URL externes, autres buckets et chemins d’un autre utilisateur sont refusés. PNG, JPEG, WebP et SVG sont convertis en PNG borné pour le PDF. Le PDF signale un logo configuré mais introuvable au lieu de l’omettre silencieusement.

`docs/sql/logo_storage_review.sql` est un script de préparation à examiner avec les politiques réelles. Il n’est pas exécuté par les migrations : une politique Storage permissive préexistante doit être identifiée et remplacée séparément. Tester qu’un utilisateur ne peut pas lire, remplacer ou supprimer le logo d’un autre utilisateur.

## Auth et vérifications avant ouverture

Ajouter les URL exactes `/login?confirmed=1` et `/reset-password` à la liste des redirections autorisées de Supabase Auth, pour chaque environnement. Aligner `APP_URL`, les deux variables de redirection et SMTP. Le lien historique `/login?reset=1` reste pris en charge par l’interface. Tester réception, lien expiré et lien déjà utilisé dans un environnement de test avec messagerie dédiée.

Contrôles indispensables : anonyme refusé ; compte A incapable de lire/écrire B ; écritures directes du navigateur refusées ; inscription attribuant un seul tenant ; profil non réassigné lors d’une erreur ; import et export PDF du logo privé ; facture émise inchangée après modification d’un client ou de l’entreprise.

Les tests PGlite exécutent les migrations et les politiques PostgreSQL réelles sur des données synthétiques. Ils ne prouvent pas la configuration des grants, Auth et Storage du service hébergé.
