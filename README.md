# KADI

Application de facturation multi-entreprise : React/Vite, API Express, Supabase Auth/Postgres/Storage, PDF et préparation optionnelle de brouillons par IA.

## Développement

Utiliser Node.js 22 LTS (`.nvmrc`, version minimale 22.13). Les clés service role, SMTP et OpenAI restent exclusivement sur le serveur.

```bash
cd backend
cp .env.example .env
npm ci
npm run dev
```

Dans un autre terminal :

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Renseigner les valeurs du **projet de test** avant démarrage. `dotenv` charge `backend/.env` ; Vite charge `frontend/.env.local`. Aligner les variables du bucket logo sur les deux services. La préparation IA est facultative et désactivable ; la facturation manuelle ne dépend pas d’une clé IA.

## Vérifications

```bash
npm --prefix backend ci
npm --prefix backend test
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix backend audit --omit=dev --audit-level=moderate
npm --prefix frontend audit --omit=dev --audit-level=moderate
```

Les tests backend combinent Vitest, des requêtes HTTP de test, le vrai SDK Supabase sur un transport simulé, PostgreSQL local via PGlite et l’analyse des PDF produits. Ils n’utilisent aucune donnée ni clé de production. Les tests frontend couvrent sessions, récupération du mot de passe, logos privés et devise. GitHub Actions exécute ces contrôles sans secrets de production.

## Règles métier

- Une facture utilise USD ou CDF, sans conversion automatique. Le tableau de bord filtre explicitement la devise. Un changement de devise dans l’éditeur remet les prix à zéro.
- Prix à deux décimales et quantités à trois décimales maximum ; arrondi de chaque ligne au centime, puis somme. Prix unitaire ≤ 1 milliard, quantité ≤ 1 million, facture ≤ 1 000 milliards, 100 lignes maximum. Ce modèle ne gère ni taxes ni taux de change.
- Un brouillon est modifiable et supprimable. Après émission, ses montants, lignes, coordonnées et logo sont archivés et verrouillés. Les statuts « envoyée/en retard → payée » restent possibles ; une facture payée ne revient pas en brouillon. La création d’avoirs et un journal comptable complet restent à développer.
- Les comptes browser ne peuvent pas écrire directement dans les tables métier ; l’API applique les validations et l’isolation de l’entreprise. Les logos suivent des politiques Storage distinctes.

## Mise en service

Lire [SUPABASE.md](SUPABASE.md) et [docs/production-readiness.md](docs/production-readiness.md) avant déploiement. La version du serveur de cette branche nécessite la migration SQL **avant** son démarrage. Les anciens documents émis sans archive fiable ne sont pas réinventés à partir des données actuelles.

Frontend Vercel : répertoire racine `frontend`, commande `npm run build`, sortie `dist`, Node 22.x. API Render : répertoire `backend`, installation `npm ci --omit=dev`, démarrage `npm start`, Node 22. Configurer `ALLOWED_ORIGINS` et le proxy réel ; éviter de connecter les aperçus à une base de production pour les essais de création/modification.

Tailwind 4 cible des navigateurs modernes ; vérifier les appareils mobiles réellement utilisés avant ouverture. Les routes SPA, notamment `/reset-password`, sont réécrites vers `index.html` dans la configuration Vercel du frontend.
