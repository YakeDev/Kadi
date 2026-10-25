# Remises sur les factures

Chaque ligne peut recevoir une remise facultative en pourcentage ou en montant fixe dans la devise de la facture. Une remise globale, également facultative, s’applique au montant restant après les remises par ligne. La taxe éventuelle est calculée ensuite. Aucun taux de taxe n’est activé automatiquement.

Par exemple, une prestation de 350 USD avec 15 % de remise par ligne revient à 297,50 USD. Une remise globale supplémentaire de 10 % donne 267,75 USD avant taxe. Si une taxe de 16 % est explicitement renseignée, le total est 310,59 USD. Après un versement de 150 USD, le solde est 160,59 USD.

Les arrondis se font au centime, au plus proche avec demi supérieur, à chaque étape : ligne brute, remise de ligne, remise globale, taxe. Le serveur recalcule tous les montants. Les valeurs négatives, pourcentages au-delà de 100 %, précisions supérieures à deux décimales et remises fixes supérieures à leur base sont refusés. Les moteurs de calcul du formulaire et du serveur appliquent les mêmes règles et sont comparés dans les tests.

Le PDF et l’aperçu indiquent les remises de ligne, le récapitulatif des remises et le total net. Les statistiques de produits répartissent la remise globale proportionnellement aux lignes, au centime. Les versements et soldes portent sur le total après remises et taxe.

Une facture émise reste immuable. Les remises peuvent être ajoutées ou modifiées dans les brouillons ; les anciennes factures conservent leurs montants, taxes, archives et versements. Un changement USD/CDF remet les prix et remises fixes à zéro ; les pourcentages restent inchangés et aucune conversion automatique n’est effectuée.

## Déploiement

Sauvegarder les données applicatives et les définitions du schéma. Tester `20261025045018_invoice_discounts.sql` sur staging, puis l’appliquer en production avant le nouveau serveur. Les quatre colonnes ajoutées ont des valeurs par défaut neutres ; aucun montant historique n’est recalculé.

`subtotal_amount` reste la somme brute des lignes. `line_discount_amount` est la somme des remises de ligne ; `discount_amount` comprend les remises de ligne et la remise globale. La base avant taxe est `subtotal_amount - discount_amount`. `discount_type` et `discount_value` décrivent uniquement la remise globale. Les remises des lignes sont archivées dans les éléments `items` sous `discountType` et `discountValue`.

Après migration, comparer les factures et versements aux sauvegardes en ignorant uniquement les quatre colonnes nouvelles, vérifier les contraintes, les droits des rôles navigateur et la cohérence du journal des versements. Faire la recette USD/CDF avec remises, taxe facultative, acomptes et PDF.
