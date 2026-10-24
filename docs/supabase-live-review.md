# Contrôle du Supabase hébergé — 22 octobre 2026

Projet : `EricayStudio / kadi-db`, référence `giksqprkorjbgikprksb`.
Lecture du schéma, des politiques, des droits, des métadonnées Storage, des alertes Supabase et des données agrégées. Aucun mot de passe, jeton, contenu client ou montant individuel n'est reproduit dans ce rapport.

**Décision : ne pas déployer la PR avant validation de la sauvegarde, des archives fiables et de la configuration serveur.** L'utilisateur a confirmé `$ = USD` et demandé deux devises uniquement, USD et CDF. La migration a été adaptée pour normaliser cette étiquette et préserver les taxes et totaux existants. Elle reste préparée, sans exécution distante. La configuration Vercel des logos a été corrigée pour les prochains déploiements ; l'application publique n'a pas été redéployée.

## Données et historique

| Contrôle | Observation | Conséquence |
| --- | --- | --- |
| Volume réel | 8 entreprises, 6 profils/utilisateurs, 12 clients, 21 factures, 2 articles | Les estimations de lignes du catalogue système ne suffisent pas ; ces valeurs proviennent de `count(*)`. |
| Migrations | Aucun historique de migrations enregistré | Comparer le schéma réel avant tout baseline ; ne pas rejouer le schéma initial. |
| Devises | 7 factures et 2 lignes avec `$` ; 14 factures avec `USD` | `$ = USD` confirmé par l'utilisateur. La migration prépare uniquement la normalisation du libellé, y compris dans les lignes JSON, sans changement de prix ni conversion. Les nouvelles saisies autorisent uniquement USD/CDF. |
| Fiscalité | 1 facture taxée ; 3 profils avec configuration fiscale | Les 21 factures respectent `total = sous-total + taxe`. La migration conserve les champs et sommes enregistrés ; les paramètres fiscaux des profils ne changent pas. Les nouveaux brouillons permettent un taux facultatif, 0 par défaut, avec calcul serveur en centimes et affichage dans l'aperçu/PDF. |
| Compatibilité de migration | 0 en-tête et 0 ligne incompatibles avec le contrôle adapté, en lecture seule | Les sept libellés attendent toujours la migration. Les devises inconnues, lignes mélangées et montants incohérents restent bloqués avant toute modification de schéma ou de politique. Aucun recalcul historique. |
| Factures émises | 20 documents sans les nouveaux snapshots | Réunir les archives fiables avant activation du nouvel export ; ne pas substituer les coordonnées actuelles aux originaux. |
| Liens entre entreprises | 0 lien facture/client entre entreprises différentes ; 0 profil sans entreprise valide | Pas de correction automatique de rattachement nécessaire d'après ces contrôles. |
| Articles | 0 prix/devise incompatible avec les contraintes préparées | Pas d'anomalie détectée par ce contrôle. |

Le schéma réel diffère aussi sur certains défauts UUID, la nullabilité et les types temporels du catalogue. Une comparaison explicite est nécessaire ; le schéma initial du dépôt n'est pas un export du service hébergé.

## Accès et sécurité

- RLS est activée sur les cinq tables métier. Les deux profils testés, sous le rôle PostgreSQL `authenticated` et leurs propres claims, lisent respectivement 3 clients/8 factures et 5 clients/6 factures. Ils ne lisent aucun profil, entreprise, client ou facture étranger.
- Le rôle `anon` lit zéro ligne dans les cinq tables. Ces essais utilisent des transactions de lecture seule terminées par `ROLLBACK`, sans ouverture de session Auth ni mutation métier.
- Les grants accordent encore des privilèges excessifs aux rôles navigateur, notamment écriture et `TRUNCATE`. RLS ne remplace pas une réduction des grants. Aucune suppression ou écriture intrusive n'a été tentée sur les données réelles. La migration prépare le retrait des écritures directes, à coordonner avec le déploiement du serveur corrigé.
- `catalog_items` n'a aucune politique RLS : les lectures directes de l'utilisateur sont refusées même pour ses articles. La migration prépare une politique de lecture limitée à son entreprise.
- Les anciennes politiques de `tenants` sont redondantes et certaines utilisent `auth.role()`. La migration les remplace par une politique de lecture ciblée.
- Les alertes GraphQL signalent la visibilité des tables dans le schéma pour `anon` et `authenticated` ; elles ne prouvent pas une lecture de lignes étrangères. Révoquer les droits anonymes inutiles ; évaluer l'exposition GraphQL signée selon le besoin réel.
- Les alertes de performance signalent deux clés étrangères non indexées et des appels Auth recalculés par ligne dans les politiques. Les index `profiles(tenant_id)` et `invoices(client_id, tenant_id)` et les politiques utilisant `(select auth.uid())` sont préparés dans la migration. Les index actuellement peu utilisés ne sont pas supprimés sur la base de ce faible volume.
- La protection contre les mots de passe compromis est désactivée. Vérifier son activation et son éligibilité au plan depuis Auth : [documentation de remédiation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Liens de remédiation Supabase : [RLS sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [exposition GraphQL anonyme](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed), [exposition GraphQL authentifiée](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed), [index de clés étrangères](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [appels Auth dans RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [politiques multiples](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

## Logos

| Élément | Constat |
| --- | --- |
| `company-logos` | Privé, 2 objets, limite de 2 Mo, aucun filtre MIME au niveau du bucket. Les chemins appartiennent à des profils existants. Taille maximale observée : 40 204 octets. |
| `kadi-compnies-logo` | Privé, vide, sans politique d'accès aux objets. Était le bucket configuré dans le frontend Vercel. |
| Profils | Un chemin privé référence un objet existant appartenant à l'utilisateur. Une ancienne URL du bon bucket référence un objet absent ; aucun fichier appartenant à ce profil n'est présent. Réimport nécessaire. |
| Politiques actuelles | Lecture et insertion dans `company-logos` limitées au dossier de l'utilisateur. Aucune politique de suppression, pas de remplacement autorisé. |
| Correction effectuée | `VITE_SUPABASE_LOGO_BUCKET=company-logos` enregistré et relu dans Vercel pour production, preview et development. Prise d'effet au prochain déploiement uniquement. |

Le script `docs/sql/logo_storage_review.sql` vise maintenant le bucket vérifié. Ses modifications restent commentées : confidentialité, limite de 1 Mo, formats autorisés et politiques par propriétaire. Une restriction MIME concerne les nouveaux uploads ; l'ancien objet déclaré `application/octet-stream` doit être vérifié par son contenu avant toute suppression ou réimport. Aucun objet ni politique Storage n'a été modifié pendant cet audit.

Il reste à aligner `SUPABASE_LOGO_BUCKET` sur Render et à tester le téléchargement réel d'un logo privé jusqu'au PDF. Le mauvais bucket et le fichier manquant sont deux causes distinctes ; corriger la configuration ne recrée pas un fichier disparu.

## Sauvegarde, moteur et mise en service

La capture du tableau de bord indique « No backups ». Aucune sauvegarde restaurable n'a été confirmée pendant ce contrôle. Avant migration, exporter le schéma et les données, conserver séparément les objets Storage et tester la restauration. Une sauvegarde de la base ne contient pas les fichiers Storage : [documentation Supabase](https://supabase.com/docs/guides/platform/backups).

Le serveur indique PostgreSQL **17.6**. Supabase publie une mise à jour **17.11** comprenant des corrections de sécurité : prévoir sa mise à jour après sauvegarde et vérification de compatibilité, sans lancer de changement du moteur pendant cet audit. Les extensions `ltree` et `btree_gist` ne sont pas installées. `pgcrypto` est installé ; vérifier un éventuel usage de chiffrement historique avant la mise à jour : [avis officiel](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

Ordre restant : établir une sauvegarde restaurable et réunir les archives fiables ; comparer et tester le schéma réel dans un environnement dédié ; contrôler Render, Auth/SMTP et les redirections ; appliquer la migration validée (incluant la normalisation `$` → `USD`) ; déployer API et frontend compatibles ; valider deux comptes et une facture avec logo dans le navigateur.
