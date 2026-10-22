# Correctifs de préparation à la production — 22 octobre 2026

Base auditée : `8c303f4452cf69d9e1d5bdf5ffd5edeba79cba53`.

Cette branche corrige les problèmes reproductibles du dépôt. Le Supabase réel de KADI a maintenant été inspecté : voir [le contrôle de l'existant](supabase-live-review.md). Les factures historiques, les sauvegardes et la configuration Render empêchent encore la mise en service de cette version. Aucune migration distante, fusion dans `main` ni promotion en production n’a été effectuée. Le nom du bucket des logos a été corrigé dans Vercel pour les prochains déploiements.

## Corrections et preuves

| Observation | Changement | Vérification locale |
| --- | --- | --- |
| Isolation des entreprises | RLS sur les cinq tables, navigateur en lecture seule, FK client/tenant composite, garde sur les jointures API | PostgreSQL/PGlite, rôles anonymes et deux entreprises |
| Rattachement des profils | Middleware sans écritures, erreur de lecture refusée, provisionnement explicite par RPC avec verrou transactionnel | Erreur DB et profil absent sans création ; RPC idempotent |
| Identité du serveur | Client admin séparé des connexions par mot de passe, logout authentifié | Vrai SDK sur transport simulé : deux connexions ne changent pas le Bearer serveur |
| Sessions React | Callback Supabase synchrone, hydratation en effet séparé, réponses anciennes ignorées | Rafraîchissement de token et changement de compte |
| Logos | URL signées conservées, anciens chemins du bucket reconnu, conversion bornée en PNG, échec d’upload bloquant | PNG/JPEG/WebP/SVG intégrés dans les PDF ; références externes et chemins étrangers refusés |
| PDF longs | Police Inter embarquée, mesure des lignes, sauts de page, en-têtes répétés et pieds de page protégés | Documents de 1, 15, 30 et 100 lignes ; descriptions et notes longues |
| Devises | Une seule devise par facture, catalogue cohérent, tableau de bord filtré USD/CDF | Rejet des mélanges et des PATCH incohérents ; aperçu et payload frontend |
| Historique des factures | Snapshots client/émetteur/logo, verrouillage après émission, horodatage du paiement, contrôle de version | Refus des modifications/suppressions émises et conflits simultanés ; transitions valides |
| Mot de passe oublié | Écran de saisie du nouveau mot de passe, événement de récupération et anciens liens pris en charge | Session valide, lien absent/expiré et refus du fournisseur simulés |
| Validation | Dates calendaires strictes, limites et arrondi des montants, prix/catalogue/booléens contrôlés | Débordements numériques, dates impossibles, prix négatifs et types invalides |
| Abus | Limiteur basé sur `req.ip` et proxy configuré ; quotas IA/PDF par utilisateur conservés | Modification de X-Forwarded-For incapable de réinitialiser le quota local |
| IA | SDK construit à la demande, fonction désactivable, réponse structurée et revalidée, brouillon obligatoire, limite de tokens, pas de retry automatique | Normalisation du brouillon ; démarrage sans clé IA |
| Livraison | Lockfiles réparés, Node 22, exemples d’environnement, CI, dépendances actualisées, tests Vitest et PostgreSQL/PDF | Installation `npm ci`, tests, lint, compilation et audit npm |
| Recherche et volumétrie | Filtre SQL calculé sur numéro/client courant ou archivé ; statistiques paginées ; listes À faire limitées en SQL | Recherche PostgreSQL et statistiques au-delà de 500 factures |

Les mises à jour comprennent Supabase JS 2.118.0 (épinglé), React Router 7, Tailwind 4, Vitest 5, Nodemailer 10 Sharp 0.35.5 et PDFKit 0.20.2. Les API utilisées ont été vérifiées ; les scénarios ci-dessus et la compilation ont été relancés après mises à jour. Le SDK OpenAI existant est conservé, sans ajout d’un service ou d’une passerelle externe.

## Résultats de vérification

Exécution sur Node 22.23.4 avec données synthétiques :

- Backend : 43 tests Vitest et 22 tests natifs Node (PostgreSQL, PDF, SDK et démarrage), dont deux scénarios ajoutés après le contrôle hébergé : devise historique ambiguë et facture taxée laissées intactes après refus de migration.
- Frontend : 12 tests de composants/parcours ; lint sans avertissement ; build réussi.
- `npm ci` réussi indépendamment dans les deux répertoires.
- `npm audit` complet : aucune vulnérabilité connue signalée dans les deux lockfiles au moment du contrôle. Ce résultat ne constitue pas une preuve d’absence de faille dans l’application.
- GitHub Actions : jobs backend et frontend réussis sur la pull request #14. Aperçu Vercel construit et READY.
- Inspection du navigateur sur cet aperçu : page de connexion lisible et route `/reset-password` avec message de lien invalide et retour à la connexion. L’accès temporaire Vercel créé pour cette inspection a été révoqué. Aucun parcours avec un véritable compte Supabase hébergé n’a été validé.
- Supabase hébergé : les cinq tables ont RLS activée. Les lectures SQL sous les rôles de deux utilisateurs existants voient leurs propres clients/factures et aucune ligne étrangère ; le rôle anonyme voit zéro ligne métier. Ces contrôles en transaction de lecture seule ne sont pas un test de connexion dans le navigateur.

## Ordre de mise en service

1. Sauvegarder le Supabase réel, comparer son schéma et examiner `docs/sql/preflight.sql`. Baseline de l’existant et migration : voir `SUPABASE.md`. Ne pas rejouer le schéma initial sur une base déjà remplie.
2. Vérifier les politiques du bucket réel, sa confidentialité, les limites de fichiers et la propriété des chemins. Aligner le nom du bucket entre Vercel et Render. Ne pas rendre le bucket public pour contourner une erreur d’URL.
3. Configurer Auth/SMTP et les URL autorisées de confirmation/récupération pour un environnement de test dédié. Vérifier une inscription réelle, le courriel reçu, la confirmation, la connexion, le rafraîchissement et la récupération du mot de passe. Les doubles de tests ne vérifient pas les services hébergés.
4. Appliquer les protections SQL testées, puis déployer l’API et le frontend correspondants. Réaliser les tests A/B d’isolation et une facture complète avec logo privé avant ouverture au public. Les aperçus Vercel actuels partagent les variables de production : ne pas y saisir de vraies données de test tant que l’environnement n’est pas séparé.
5. Configurer les vérifications GitHub comme obligatoires avant fusion ; faire vérifier sauvegarde/restauration, collecte d’erreurs et journaux. Les workflows du dépôt sont préparés, sans modification automatique des règles de branche.

## Limites à prendre en compte

- Les factures anciennes sans snapshot fiable nécessitent leurs originaux avant nouvel export. Aucun historique n’a été inventé ou corrigé automatiquement.
- Les calculs n’intègrent ni taxes, ni conversion, ni avoirs, ni journal comptable complet. Les statistiques sélectionnent la date d’émission ; `paid_at` est la date d’enregistrement du statut payé, pas une preuve de paiement bancaire.
- Les limiteurs en mémoire conviennent à un processus unique. Plusieurs instances exigent un compteur partagé. Configurer le proxy selon la topologie réelle.
- La sortie IA reste un brouillon à contrôler. Les plafonds de tokens/requêtes et les logs d’usage ne remplacent pas un budget fournisseur et une mesure du coût réel.
- Tailwind 4 cible des navigateurs modernes : vérifier les appareils mobiles visés. Le build conserve un avertissement de taille du bundle JavaScript (~643 Ko avant compression) ; le découpage des pages peut être traité ensuite.
- RLS et les métadonnées Storage ont été inspectées sur le service réel ; les protections supplémentaires ne sont pas encore appliquées. Les tests hébergés des écritures, d'Auth, SMTP, des fichiers eux-mêmes, des secrets Render et de la restauration restent à réaliser.

