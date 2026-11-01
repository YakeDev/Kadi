# Export et suppression des comptes Kadi

## Parcours utilisateur

1. Dans **Mon entreprise → Données et suppression du compte**, exporter le fichier JSON et télécharger séparément les PDF à conserver. L’export contient le compte, le profil, l’entreprise, les clients, le catalogue, les devis, les factures, les versements et le logo actuel s’il existe. Il n’est pas un PDF ni une archive comptable certifiée.
2. Saisir le mot de passe actuel et confirmer avoir été informé de la possibilité d’exporter. Kadi vérifie une adresse email confirmée et crée une demande `pending_review`. Le compte reste accessible pendant l’examen. Une demande en attente peut être annulée.
3. Sans accès à l’application, utiliser `/suppression-compte`. Une réponse générique évite de révéler si l’adresse existe. Kadi envoie, si elle existe, un lien à usage unique valable 24 heures. Le lien vérifié place la demande en examen. La page est publique sur web et Android.
4. Le Super administrateur voit les demandes dans `/administration`. Il examine l’identité, le périmètre et toute raison de conserver certains documents. Il peut suspendre la demande avec un motif communiqué par email et visible dans le compte, ou reprendre l’examen.
5. Après validation, l’action de traitement enlève les données de l’entreprise dans une transaction, les logos du stockage, puis l’identité Supabase Auth. La demande est ensuite clôturée sans email ni identifiants du compte dans le journal de demandes. Un email de fin est tenté ; si l’envoi échoue, l’interface le signale à l’administrateur.

## Garanties et reprise

- Seul le serveur, via la clé de service, peut lire et modifier les demandes. Les rôles navigateur n’ont aucun accès direct à la table ni à la fonction SQL de suppression. L’accès administrateur est recontrôlé à chaque action ; un administrateur ne peut pas supprimer son propre compte par ce parcours.
- Le SQL vérifie que la demande est confirmée, que le tenant appartient au compte visé et qu’il n’existe qu’un seul profil dans cette entreprise. Un compte partagé demande un examen manuel spécifique : aucune donnée d’un autre utilisateur n’est effacée automatiquement.
- Les factures émises, les paiements et les devis convertis sont immuables pendant l’usage ordinaire. Une fonction SQL réservée au serveur ne lève leurs gardes de suppression que pour l’entreprise ciblée et dans sa transaction. Les clés étrangères entre devis et factures sont différées uniquement pendant celle-ci.
- Si le stockage ou Auth échoue après la transaction, la demande reste à `data_erased`. L’administrateur relance le traitement ; le serveur reprend le nettoyage et la clôture. Si une suppression Auth est déjà intervenue, son absence (`404`) permet de terminer la reprise.
- L’export JSON et les PDF sauvegardés par l’utilisateur restent sous sa responsabilité. Les copies qu’il a partagées à des tiers et les journaux ou sauvegardes de fournisseurs ne sont pas supprimés par cette opération applicative.

## Mise en service

1. Sauvegarder la base et inspecter les tables et contraintes réelles. Appliquer `supabase/migrations/20261026144042_account_deletion.sql` dans l’environnement de préproduction et exécuter la recette avec un compte de test dédié. Examiner les avis de sécurité Supabase.
2. Déployer le backend avec la migration en place, puis le frontend. Ne pas afficher le parcours avant la disponibilité des routes API. Construire et tester un nouvel APK après déploiement ; l’APK pilote du 25 octobre ne contient pas ces écrans.
3. Vérifier avec une vraie boîte de test : lien public, mauvaise signature/expiration, export, demande authentifiée, suspension et email, annulation, traitement d’un tenant isolé avec facture émise et versement, reprise après incident de stockage, puis absence d’accès avec l’ancien compte.
4. Confirmer l’identité et l’adresse de contact de l’éditeur, les prestataires réellement utilisés et les durées applicables aux copies de sauvegarde ou journaux avant publication générale. Ne pas annoncer une durée légale précise sans validation.

La fonction d’administration réalise une suppression réelle et irréversible pour le tenant visé. Elle ne doit être appelée en production que sur une demande vérifiée après examen des éventuelles obligations de conservation.
