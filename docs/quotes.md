# Devis, conversion et versements

## Parcours utilisateur

1. Créer un devis depuis **Devis → Nouveau devis**, choisir le client, les prestations, la devise USD/CDF, les remises et la taxe éventuelle. Une date de validité est facultative.
2. Enregistrer puis télécharger le PDF pour le transmettre au client. Le statut **Envoyé** se renseigne manuellement ; un devis envoyé reste modifiable avant conversion.
3. Après les dernières corrections, ouvrir le devis et choisir **Convertir en facture**. Renseigner une référence PO, un acompte réellement reçu, ou les deux. La date du versement est sa date réelle de réception, même antérieure à la conversion. La date de validité du devis n’est pas l’échéance de paiement de la facture.
4. Après conversion, le devis reste consultable mais ne peut plus être modifié, supprimé, téléchargé ou converti à nouveau. Une facture liée garde son propre numéro.
5. Ajouter les versements suivants sur cette même facture depuis **Versements**, puis choisir **Télécharger la facture à jour**. Le PDF présente le total facturé, les versements actifs, le cumul reçu et le solde. Les versements annulés restent dans l’historique KADI avec leur motif et sont exclus du solde et du PDF.

La réception d’un acompte ne déclenche pas automatiquement la conversion. L’utilisateur peut modifier et enregistrer l’offre avant cette action. Un PO seul ne crée aucun encaissement. La référence PO se renseigne pendant la conversion. Cette première version ne contient pas d’envoi automatique d’e-mail ni de stockage de chaque ancien PDF.

## Contrats et protections

- `GET/POST /api/quotes`, `GET/PATCH /api/quotes/:id`, `GET /api/quotes/pdf/:id`, `POST /api/quotes/:id/convert` : authentification et filtrage par entreprise sur toutes les routes.
- Les devis partagent les validations, calculs en centimes, remises, catalogue et présentation des factures. Le statut de conversion et les totaux ne sont jamais fournis librement par le navigateur.
- L’édition exige la version affichée. La conversion verrouille la ligne du devis et copie son contenu final dans une facture émise, avec les coordonnées client/entreprise archivées. La création du versement initial et le verrouillage du devis font partie de la même transaction.
- L’unicité `invoices.quote_id` et la clé de conversion empêchent les doubles factures et encaissements. Une répétition identique retrouve la facture ; une requête différente est refusée après conversion.
- Les fonctions sont `SECURITY INVOKER`, accessibles seulement au serveur. La table Devis active RLS et permet uniquement la lecture des lignes de l’entreprise au rôle navigateur ; les écritures passent par l’API.
- Le téléchargement d’un devis converti est refusé par l’API. Un téléchargement déjà autorisé avant la conversion ou une copie déjà reçue par le client ne peut pas être révoqué.
- Le PDF de facture reçoit sa situation financière et ses versements depuis un seul instantané SQL pour éviter un cumul incohérent pendant un paiement concurrent.

## Déploiement et vérification

Appliquer `20261025074053_quotes_conversion.sql` après sauvegarde, déployer le serveur, vérifier ses routes puis publier le frontend. La migration est additive et laisse les montants, archives et versements des factures existantes inchangés.

Les tests couvrent les PO seuls, acomptes seuls, reprises identiques, changements de requête, révisions avant conversion, versions périmées, rollback sur acompte invalide, deux entreprises, restrictions des rôles navigateur, verrouillage des devis convertis et PDF avec l’historique des versements. La recette navigateur utilise des identités fictives, les vraies routes HTTP et une base PostgreSQL isolée ; aucune facture de test n’est créée dans les comptes de production.
