# Kadi Android — version pilote

Application Android hybride avec les écrans React embarqués dans l’APK (Capacitor 8.5.3). Le site, l’application et le serveur utilisent les mêmes règles et les mêmes données. Aucun accès administratif ni secret serveur n’est embarqué.

## Périmètre

- Connexion avec le compte existant et inscription depuis l’application.
- Clients, catalogue, devis, conversion unique en facture, référence PO, acomptes et factures.
- Navigation inférieure sur téléphone ; menu existant pour l’entreprise et l’administration autorisée.
- Partage Android des PDF autorisés par le serveur, notamment vers une messagerie installée.
- Bouton Retour : fermer les fenêtres de saisie avant de revenir ; à l’accueil ou à la connexion, réduire l’application.
- Gestion des barres système, du clavier et d’une interruption de connexion.

Les fonctions métier nécessitent Internet. Aucun enregistrement hors connexion ni notification push n’est ajouté. Les liens de confirmation et de récupération du mot de passe utilisent le site existant : ouvrir l’email dans le navigateur puis revenir se connecter à l’application. Aucun changement des redirections email de production n’est nécessaire.

## Construction

Node 22.22.2 ou ultérieur dans la branche 22, JDK 21, SDK Android 36 et outils de compilation Android. Les versions npm sont verrouillées. La configuration `.env.android` contient uniquement l’URL de l’API, l’URL Supabase et une clé publique de client. La clé publique ne confère aucun droit de contournement des règles d’accès.

```sh
cd frontend
npm ci
npm run android:apk
```

Le fichier est `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions produit aussi l’APK, son SHA-256 et les preuves du test sur émulateur dans l’artefact `kadi-android-pilote`. Les ressources web sont synchronisées à chaque compilation ; un changement du site n’actualise pas automatiquement un APK déjà installé.

L’identifiant réservé à la future version principale est `com.ericaystudio.kadi`. La version de test utilise `com.ericaystudio.kadi.pilot` et le nom « Kadi Pilote » pour permettre leur coexistence. Android 7 / API 24 minimum ; cible Android 16 / API 36. Le premier APK utilise la signature de débogage du constructeur et ne constitue pas une version publique signée pour production. Une autre compilation peut nécessiter la désinstallation du pilote si cette signature diffère. La désinstallation efface les brouillons locaux et la session de l’appareil ; les données déjà enregistrées sur le serveur restent présentes.

Avant une diffusion durable, créer une identité de signature appartenant au propriétaire, la conserver hors Git et configurer la signature sécurisée dans la CI. Ne jamais publier la clé privée. Aucun compte de boutique n’est créé automatiquement et aucune publication publique n’est effectuée par ce workflow.

## Sécurité et vérification

L’API accepte l’origine locale HTTPS exacte `https://localhost` pour les écrans embarqués. Le JWT et les droits par entreprise restent obligatoires. Les versions HTTP ou des domaines ressemblants ne sont pas ajoutés. Les tables, politiques, documents émis et acomptes existants ne changent pas.

Les PDF transitent par les routes authentifiées habituelles. Un devis converti reste interdit au téléchargement. Les exports autorisés sont écrits dans un sous-dossier privé du cache de l’application ; seul ce dossier est partageable via FileProvider, sur action de l’utilisateur. Les exports de plus de 24 heures sont nettoyés à l’export suivant ; la déconnexion nettoie les copies temporaires. Une copie volontairement partagée ou enregistrée par l’utilisateur appartient à sa destination. Sauvegardes cloud et transfert automatique des données de l’application désactivés pour les sessions.

La CI vérifie lint, tests React, dépendances de production, compilation, lint Android, puis sur émulateur Android : ouverture de l’écran de connexion, origine HTTPS, rendu sans débordement, accès API réel, refus 401 d’une route privée sans session, partage d’un PDF synthétique, persistance locale et bouton Retour. Ces tests ne créent aucun compte, devis, facture ou versement en production. Ils ne remplacent pas la recette sur appareil physique avec le propriétaire.

Recette physique : connexion habituelle, navigation, création d’un brouillon de devis de test, saisie et dates, conversion avec PO ou acompte, PDF et partage, ajout d’un versement, rotation du téléphone, clavier, mise en arrière-plan, perte et reprise du réseau, confirmation/récupération par email et déconnexion. Utiliser une entreprise de test pour les écritures métier.
