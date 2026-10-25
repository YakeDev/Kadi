# Administration de la plateforme

L’espace `/administration` présente uniquement des statistiques agrégées sur Kadi. Le lien apparaît dans la barre latérale, le menu mobile et le menu du compte lorsque le serveur confirme le rôle Super administrateur. Les routes métier existantes restent limitées à l’entreprise du compte, y compris pour un Super administrateur.

## Autorisation

Le rôle est une inscription dans `kadi_private.platform_admins`, avec motif, date d’attribution et date de révocation éventuelle. Aucun rôle n’est déduit des métadonnées modifiables de l’utilisateur. Le schéma privé et ses tables ne sont accessibles ni à `anon`, ni à `authenticated`. Le rôle serveur peut lire les attributions mais ne peut pas en écrire : l’attribution initiale se fait par une opération SQL d’administration autorisée, distincte de la migration et ciblée sur un compte confirmé.

`GET /api/platform/overview` exige une session authentifiée, un e-mail confirmé et une attribution active vérifiée à chaque requête. La fonction SQL vérifie aussi l’attribution avant l’agrégation. Une révocation prend donc effet sans attendre l’expiration du JWT. Les fonctions sont `SECURITY INVOKER`, avec `search_path` vide et exécution réservée à `service_role`. Les réponses HTTP sont `private, no-store` et varient selon Authorization. Une indisponibilité de la vérification ne donne aucun accès. Les notices informatives Supabase « RLS Enabled No Policy » sur les trois tables privées sont attendues : aucun accès navigateur n’est accordé et aucune politique ne doit ouvrir ces tables.

`POST /api/platform/session` enregistre une journée d’utilisation et renvoie seulement la capacité administrative du compte authentifié. Les identités fournies dans le corps ne sont pas utilisées. Aucun endpoint ne permet de s’attribuer le rôle, de modifier une autre entreprise ou de consulter ses factures détaillées.

## Définition des chiffres

- Totaux : entreprises (`tenants`), utilisateurs avec profil (`profiles`), factures et devis présents dans Kadi, comptes de test inclus. Ils ne mesurent pas des abonnements payants.
- Inscriptions : date de création du profil ou de l’entreprise.
- Factures créées : `created_at`, brouillons inclus. Factures émises : `issued_at` ; les anciennes factures sans cet horodatage restent dans les totaux et sont signalées comme exclues des émissions quotidiennes.
- Devis créés et convertis : `created_at` et `converted_at`, respectivement. Un devis créé avant la période peut être converti pendant celle-ci.
- Versements enregistrés : date technique `created_at`, annulations comprises, et non date réelle de réception `paid_on`.
- Utilisateurs actifs : comptes ayant ouvert une session visible de la nouvelle interface pendant la période. Un signal est envoyé au chargement, au retour sur l’onglet puis toutes les quinze minutes lorsque l’onglet est visible. Une seule ligne est conservée par utilisateur et jour ; les totaux de période dédupliquent les utilisateurs et entreprises.
- L’activité commence à la date d’application de la migration, affichée dans l’interface. Aucun historique de connexions antérieur n’est inventé.
- Les journées vont de minuit à minuit dans `Africa/Lubumbashi`. Les anciens `timestamp without time zone` sont interprétés en UTC, comme la configuration de la base de production. Le filtre inclut ses deux dates et accepte jusqu’à 366 jours ; les jours sans événement sont présents à zéro.

## Publication et vérification

Appliquer `20261025111428_platform_admin.sql`, attribuer le rôle au compte confirmé autorisé, déployer le serveur puis l’interface. La migration ajoute uniquement un schéma privé, trois tables, trois fonctions et deux index ; les données métier ne sont pas réécrites.

Les tests vérifient les refus anonymes et utilisateurs ordinaires, les métadonnées falsifiées, la révocation, l’échec fermé, les privilèges SQL, l’impossibilité de s’attribuer un rôle, le maintien de RLS métier, les journées à la frontière UTC/Lubumbashi, les jours vides et la déduplication de l’activité. La recette navigateur utilise l’AuthProvider réel, les routes Express réelles et une base PostgreSQL isolée avec une identité d’authentification fictive.
