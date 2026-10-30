# KADI — Prestations détaillées et modèles PDF (30/10/2026)

## Besoin métier

Une prestation se compose d'un **titre court** et d'une **description facultative** du périmètre. Exemple :

- Titre : « LOT 01 — Identité de marque »
- Périmètre : « Recherche et direction artistique (2 pistes), concepts de logo, déclinaisons, palette, typographies, mini-charte de 8 à 12 pages et fichiers PNG/SVG/PDF. »
- Quantité : 1 ; prix : 420 USD.

Ces deux éléments sont affichés dans l'éditeur, l'aperçu et le PDF pour les **factures et devis**. Le calcul monétaire, les remises, les taxes et les paiements restent inchangés.

## Modèles proposés

| Modèle | Intentions graphiques |
| --- | --- |
| Classique | Présentation actuelle, repère bleu en haut, fonds discrets et tableau structuré. |
| Sobre | Pas de bandeau coloré supérieur, palette neutre, tableau simple, fonds gris très discrets. |
| Minimaliste | Aucun bandeau supérieur, beaucoup de blanc, typographie et alignements privilégiés, séparation fine. |

Le choix est stocké par document (`pdf_template`). Il n'affecte **jamais** les montants. Pour les nouveaux documents saisis dans l'interface, le modèle initial est **minimaliste** ; chaque utilisateur peut sélectionner classique ou sobre avant l'enregistrement. Le modèle choisi sur un devis est repris lors de la conversion via un trigger SQL. Les factures et devis historiques restent inchangés et leur modèle est « classique ». Les créations envoyées directement à l'API sans choix explicite restent en modèle classique pour ne pas surprendre les intégrations existantes.

## Compatibilité et sécurité

- Anciens éléments `{ description, quantity, unitPrice }` : toujours acceptés. Dans l'éditeur, la description historique apparaît dans le **titre**, sans inventer de périmètre.
- Nouveaux éléments : `{ title, description, quantity, unitPrice }`. Le titre est limité à 160 caractères, les détails à 500 ; au moins un libellé non vide est obligatoire.
- PDF : en présence d'un logo réel, le nom affiché immédiatement sous le logo est masqué ; en absence de logo, le nom revient. Les coordonnées, NIF et RCCM restent visibles lorsqu'ils existent. **Vérifier avant publication que le logo affiche clairement la dénomination légale de l'émetteur**, au besoin ajouter sa dénomination complète dans les mentions légales pour la conformité.
- La sélection de modèle est soumise à une liste blanche côté serveur et à des contraintes CHECK en base.
- Les documents émis restent immuables ; l'isolation par entreprise et les règles de conversion existantes ne sont pas contournées.

## Déploiement

1. Sauvegarder la base et vérifier l'état des migrations précédentes.
2. Appliquer `supabase/migrations/20261030180000_invoice_pdf_templates.sql` sur **staging**, puis en production **avant** le déploiement du nouveau serveur et de l'interface.
3. Exécuter `npm test` dans `backend`, et `npm test && npm run lint && npm run build` dans `frontend`. La validation réelle en environnement de déploiement reste obligatoire.
4. Effectuer une QA visuelle PDF A4 (USD et CDF) : petites et longues descriptions, plusieurs pages, logo présent/absent, devis converti en facture, taxes, remises, acomptes et mentions.
5. Contrôler l'ergonomie sur Android : saisie au clavier, champs accessibles, cartes de modèles touchables, aperçu consultable sans perte des données.

## Prochaine passe UX de l'application

Prioriser une évaluation transversale, sur des flux réels, sans multiplier les écrans ni modifier les montants :

1. **Hiérarchie visuelle** : une action principale par écran, titres et états cohérents, grille stable et alignement des prix à droite.
2. **Ergonomie cognitive** : regrouper les tâches par intention (client → prestations → montant → aperçu → enregistrement) ; révéler remises, taxes et IA quand utiles.
3. **Gestalt** : proximité entre les champs d'une prestation, séparation claire entre éléments, cohérence entre listes, édition et documents.
4. **Accessibilité** : contraste WCAG AA à mesurer, focus clavier visible, taille tactile >= 44 px, messages d'erreur associés aux champs.
5. **Fiabilité des parcours** : états chargement/vide/erreur/succès ; téléchargement PDF avec retour d'état ; récupération de brouillon ; essais clavier et écran tactile.
6. **Mobile natif** : vérifier l'ergonomie des listes, formulaires, fiches, modales, navigation retour Android et téléchargement ; ne pas traiter l'APK comme un simple site responsive.

Ces principes sont des critères de vérification. Les changements de ce chantier concernent **l'éditeur et les modèles PDF** ; la refonte complète du produit n'est pas déclarée terminée.
