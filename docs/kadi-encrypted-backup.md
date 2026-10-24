# Sauvegarde chiffrée KADI — procédure de préproduction

Projet vérifié : `giksqprkorjbgikprksb` (Supabase `kadi-db`). Dépôt GitHub **public** : ne jamais ajouter ici un mot de passe, un export SQL, une archive non chiffrée, une clé service_role ou des informations clients.

## Conception
- Workflow manuel uniquement : `.github/workflows/kadi-encrypted-backup.yml`, branche `main` exclusivement. Aucun déclenchement automatique, aucune modification de données métier.
- GitHub-hosted runner `ubuntu-24.04` : Docker est fourni par GitHub, non par l'ordinateur de l'utilisateur. L'image `postgres:17` effectue un **unique** `pg_dump` PostgreSQL (format custom), sur les schémas `public`, `auth` et `storage`, sans privilèges ni propriétaires ; `pg_restore --list` valide la lisibilité technique de l'archive.
- Tous les objets du bucket privé `company-logos` sont téléchargés par API authentifiée ; comparaison stricte avec le nombre indiqué dans la base et manifeste SHA-256 inclus.
- Les archives brutes n'existent que dans le répertoire temporaire du runner. **Seul** le TAR GPG/AES-256 chiffré est transféré en artefact GitHub. Un déchiffrement suivi d'un parcours du TAR est réalisé avant le transfert.
- Les secrets ne sont pas enregistrés dans le dépôt ni affichés dans la sortie de la tâche.

Ce processus fournit une sauvegarde logique chiffrée de l'application. Il **ne certifie pas une restauration** : `auth` et `storage` sont gérés par Supabase ; leur rechargement doit être adapté à un environnement compatible. Les réglages des providers Auth/SMTP, clés API, secrets serveur et certains paramètres du projet ne font pas partie de `pg_dump` ; les inventorier séparément, sans jamais commettre de secret dans Git. Ne pas restaurer directement sur la base active.

## Avant l'exécution (opérations manuelles dans l'interface GitHub, idéalement navigateur en mode bureau)
Ouvrir `YakeDev/Kadi` > `Settings` > `Secrets and variables` > `Actions` > `New repository secret`. Définir **trois secrets** :

| Nom exact du secret | Valeur à fournir |
|---|---|
| `KADI_BACKUP_DATABASE_URL` | URL PostgreSQL **de kadi-db**, fournie par `Supabase > Connect > Session pooler` (port 5432, utilisateur `postgres.giksqprkorjbgikprksb`), avec le mot de passe de la base correctement encodé dans l'URL. |
| `KADI_BACKUP_SERVICE_ROLE_KEY` | Clé `service_role` (ancienne clé JWT serveur) de **ce même projet**, depuis `Supabase > Settings > API Keys` ; jamais la clé `anon` ni une clé frontend. |
| `KADI_BACKUP_PASSPHRASE` | Phrase secrète aléatoire **d'au moins 32 caractères**, générée et conservée par le propriétaire dans un gestionnaire de mots de passe, **hors GitHub** également. Sans elle l'archive est irrécupérable. |

**Ne pas envoyer ces trois valeurs dans un chat, dans une issue ou dans une PR.** La connexion doit être SSL ; le workflow refuse l'URL d'un autre projet. Par défaut, les secrets des dépôts publics sont accessibles à certains workflows de l'organisation du dépôt : ne permettre l'utilisation qu'au code relu de `main`, vérifier les permissions GitHub et ne pas approuver de workflow externe non fiable.

## Activation
1. Relire la PR spécifique à la sauvegarde. **Attention :** GitHub exige que le fichier d'un workflow manuel `workflow_dispatch` soit déjà présent sur la branche par défaut avant de permettre son lancement. Sa fusion dans `main` est une opération à planifier **séparément** de la PR de production #14 ; vérifier au préalable le comportement des déploiements Vercel/Render automatiques liés à `main`.
2. Sur GitHub : `Actions` > `KADI - Encrypted Supabase Backup` > `Run workflow` > branche `main`.
3. Confirmer le statut `success` et récupérer l'artefact `kadi-encrypted-backup-<run id>`. Il ne contient que `kadi-backup.tar.gpg`. Les artefacts expirent après **30 jours** ; copier l'archive chiffrée dans un stockage privé indépendant de GitHub.
4. Conserver la phrase secrète séparément, surveiller l'accès aux secrets GitHub et faire tourner les identifiants temporaires utilisés pour la sauvegarde si nécessaire.
5. Sur machine de test fiable (jamais dans un dépôt Git) : déchiffrer l'archive avec GPG et vérifier les fichiers `database.pgdump`, `storage-manifest.json` et `storage/`. Vérifier SHA-256 de chaque objet et la possibilité de restaurer les tables nécessaires dans un **projet de test** avec comptes et paramètres Auth/Storage compatibles. Tester connexion et lecture d'une facture avec logo.
6. Vérifier les nombres attendus avant/après et la cohérence de la restauration. **Tant que ce test de restauration n'est pas réussi, ne pas appliquer la migration `20261022064416_production_hardening.sql` à la production.**

### Limites à ne pas masquer
- Le SQL est un instantané cohérent **interne à PostgreSQL**, mais les téléchargements Storage se produisent ensuite. Éviter les écritures/suppressions pendant le backup ; comparer les métadonnées et les objets. La comparaison du *nombre* d'objets n'exclut pas une modification de contenu concurrente.
- Le dump inclut des identifiants Auth et des documents privés : **seule l'archive chiffrée** doit sortir du runner. Dans un dépôt public, des membres ayant accès aux artefacts peuvent télécharger le chiffrement ; une longue phrase secrète reste indispensable.
- La récupération d'une base Supabase hébergée peut exiger davantage que `pg_restore` (rôles, extensions, configuration, système Storage). Tester et documenter cette procédure.
- Ne pas considérer le seul statut `success` comme une garantie de reprise d'activité. Les comptes utilisateurs, fichiers Storage et configurations externes doivent tous être vérifiés.
- Cette PR n'exécute pas la sauvegarde et ne modifie pas les données hébergées.

Références : [Supabase — backup / restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [Supabase — backup des objets Storage](https://supabase.com/docs/guides/storage/management/download-objects), [GitHub — déclenchement manuel](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
