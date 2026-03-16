Plan Global

Je recommande un plan en 6 lots, sur 5 à 8 jours de travail, avec mise en prod seulement après les lots 1 à 4.
L’ordre optimal est : sécurité bloquante → intégrité des données → durcissement backend → simplification auth frontend → tests/docs.
Lot 1 — Blocage immédiat

Supprimer tout renvoi de verificationUrl côté API dans backend/controllers/authController.js:326 et backend/controllers/authController.js:570.
Retirer l’affichage/copie du lien côté UI dans frontend/src/pages/Login.jsx:1110.
Nettoyer la doc publique dans API.md:25 et adapter les tests dans backend/tests/auth.test.js:135.
Critère d’acceptation : aucune réponse HTTP ne contient de lien admin de confirmation ou de reset.
Lot 2 — Intégrité des données

Ajouter une validation stricte des payloads pour auth, clients, products, invoices, ai ; l’allowlist produit déjà un bon modèle dans backend/controllers/productController.js:6.
Bloquer explicitement les champs sensibles tenant_id, invoice_number, subtotal_amount, total_amount, created_at, updated_at.
Corriger les contrôleurs trop permissifs dans backend/controllers/clientController.js:56, backend/controllers/clientController.js:68, backend/controllers/invoiceController.js:207, backend/controllers/invoiceController.js:255.
Remplacer la numérotation fragile de facture dans backend/controllers/invoiceController.js:210 par une séquence robuste.
Lot 3 — Sécurisation logos et PDF

Interdire tout logo_url externe ; n’accepter que des chemins storage internes.
Supprimer le fetch() sur URL arbitraire dans backend/controllers/invoiceController.js:73 et ne signer que des objets du bucket attendu depuis backend/controllers/invoiceController.js:34.
Restreindre aussi la création/mise à jour profil dans backend/controllers/authController.js:6 pour empêcher l’injection d’URL distantes.
Critère d’acceptation : impossible de faire appeler le backend vers une URL tierce via le profil.
Lot 4 — Durcissement backend

Passer CORS en mode fermé par défaut dans backend/app.js:21 ; si ALLOWED_ORIGINS est vide, refuser en production.
Réduire la taille JSON de 10mb dans backend/app.js:105, ajouter helmet, rate limiting auth/IA/PDF et timeouts IA dans backend/package.json:10.
Encadrer l’endpoint OpenAI de backend/controllers/aiController.js:49 avec quotas, longueur max du prompt et gestion d’erreurs propre.
Corriger le KPI de délai de paiement dans backend/controllers/invoiceController.js:453.
Lot 5 — Simplification auth frontend

Clarifier la frontière d’auth : conserver Supabase côté frontend et supprimer les routes backend inutilisées backend/routes/auth.js:16, ou migrer totalement côté backend ; je recommande la première option.
Supprimer la duplication de session en localStorage entre frontend/src/hooks/useAuth.jsx:155 et frontend/src/services/api.js:21, et utiliser une seule source de vérité.
Vérifier les flux logout/login/reset pour éviter les états incohérents.
Lot 6 — Qualité, tests, docs

Étendre les tests backend pour couvrir : mass assignment, absence de verificationUrl, rejet des logo_url externes, validation des champs invoice/client.
Ajouter au minimum une validation frontend sur les flows login/signup et la non-présence du lien de confirmation.
Mettre à jour API.md:25, README.md:90, SUPABASE.md:220 avec le nouveau comportement sécurité.
Ordre d’exécution

Jour 1 : lot 1.
Jours 1–2 : lot 2.
Jours 2–3 : lot 3.
Jours 3–4 : lot 4.
Jour 5 : lot 5.
Jours 5–6 : lot 6 et recette.
Définition de fini

Plus aucun lien admin exposé.
Plus aucun endpoint métier n’accepte de champs système.
Aucun appel serveur sortant piloté par un utilisateur.
Tests backend verts sur les cas critiques.
Docs alignées avec le comportement réel.