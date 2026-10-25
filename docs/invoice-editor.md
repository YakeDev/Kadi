# Éditeur de facture compact

La création et la modification d’un brouillon utilisent le même formulaire :

- Client, date d’émission, échéance et devise sont regroupés en haut.
- Les prestations sont présentées en colonnes sur ordinateur et en champs regroupés sur mobile, selon la largeur disponible dans la page.
- Le récapitulatif présente les remises par ligne, la remise globale et la taxe facultative. Il se place à droite lorsque la largeur le permet.
- La barre Aperçu / Enregistrer reste accessible pendant le défilement.
- L’aperçu s’ouvre dans une boîte de dialogue, présente toutes les lignes et restaure le focus à sa fermeture. Échap ferme la boîte de dialogue.
- Les notes, l’aide IA et la taxe sont secondaires. Les notes existantes et une taxe non nulle sont dépliées à l’ouverture.
- Le catalogue s’insère dans une ligne vide ou ajoute une nouvelle ligne. Il ne remplace pas les prestations déjà saisies.

Les calculs existants dans `invoiceMath.js`, les API, les statuts des factures et le stockage des brouillons dans l’onglet sont conservés. Aucun changement de schéma ou migration n’est nécessaire.

## Validation

Les tests frontend couvrent les montants et remises envoyés, le changement de devise, la restauration du brouillon, les erreurs d’enregistrement, l’aperçu de plus de quatre lignes, l’insertion depuis le catalogue et la conservation des remises lors de la suppression d’une ligne.

Le parcours navigateur avec des données fictives couvre la création d’un client sans perte de saisie, les remises avant taxe, la restauration après rechargement, l’aperçu et son focus, le blocage d’une remise excessive et le contenu envoyé à l’API. Largeurs contrôlées : 320, 375, 768, 1024, 1366 et 1536 px. Ce contrôle n’écrit aucune facture dans les comptes réels.
