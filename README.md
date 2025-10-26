# 🧾 KADI – SaaS de Facturation pour PME Locales

## 🎯 Objectif

**KADI** est un SaaS simple et moderne qui permet aux PME locales de créer, gérer et envoyer leurs factures en ligne, avec génération automatique par IA (Codex / GPT-5).  
Il vise à digitaliser la facturation dans les entreprises africaines, en proposant une interface intuitive et adaptée aux usages locaux.

---

## 🧩 Stack technique

| Côté               | Techno                               | Description                         |
| ------------------ | ------------------------------------ | ----------------------------------- |
| **Frontend**       | React + TailwindCSS                  | Interface rapide et responsive      |
| **Backend**        | Node.js (Express)                    | API REST principale                 |
| **DB/Auth**        | Supabase                             | Stockage + Authentification         |
| **IA**             | OpenAI (GPT-5 / Codex)               | Génération automatique des factures |
| **PDF**            | pdfkit                               | Export et téléchargement            |
| **Déploiement**    | Vercel (Frontend) + Render (Backend) | Gratuits pour le MVP                |
| **Gestion d'état** | React Query / Zustand                | Simplicité et performance           |

---

## 📁 Structure du projet

```
kadi/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Facture.jsx
│   │   │   └── Clients.jsx
│   │   ├── components/
│   │   │   ├── InvoiceForm.jsx
│   │   │   ├── InvoiceList.jsx
│   │   │   └── Navbar.jsx
│   │   ├── hooks/
│   │   └── services/api.js
│   ├── tailwind.config.js
│   └── package.json
└── backend/
    ├── server.js
    ├── routes/
    │   ├── invoices.js
    │   └── ai.js
    ├── controllers/
    ├── models/
    ├── .env
    └── package.json
```

---

## 🧠 Modules fonctionnels MVP

| Module               | Description                         | API                     |
| -------------------- | ----------------------------------- | ----------------------- |
| **Authentification** | Login / Signup via Supabase         | `/api/auth`             |
| **Clients**          | CRUD clients                        | `/api/clients`          |
| **Produits**         | CRUD produits / services            | `/api/products`         |
| **Factures**         | Créer / Lister / Supprimer          | `/api/invoices`         |
| **Génération AI**    | Générer une facture depuis un texte | `/api/ai/facture`       |
| **PDF Export**       | Télécharger facture PDF             | `/api/invoices/pdf/:id` |

---

## 🧾 Exemple d'appel IA (Codex)

```js
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateInvoiceFromText(req, res) {
	const { texte } = req.body
	const response = await openai.chat.completions.create({
		model: 'gpt-5',
		messages: [
			{
				role: 'system',
				content: 'Tu es un assistant qui crée des factures JSON.',
			},
			{
				role: 'user',
				content: `Analyse ce texte et renvoie une facture JSON : ${texte}`,
			},
		],
		response_format: { type: 'json_object' },
	})
	res.json(JSON.parse(response.choices[0].message.content))
}
```

---

## ⚙️ Configuration des variables d'environnement

Ajouter un fichier `.env` à la racine du backend :

```
SUPABASE_URL=
SUPABASE_KEY=
OPENAI_API_KEY=
```

---

## 📦 Déploiement (gratuit)

| Composant           | Plateforme                       | Action                                      |
| ------------------- | -------------------------------- | ------------------------------------------- |
| **Frontend**        | [Vercel](https://vercel.com)     | Déploiement du client React                 |
| **Backend**         | [Render](https://render.com)     | API Express (free tier)                     |
| **Base de données** | [Supabase](https://supabase.com) | Créer le projet et configurer Auth + Tables |

Une fois le tout connecté, tu obtiens un MVP SaaS 100 % fonctionnel et gratuit.

---

## 🚀 Objectifs futurs

- Ajout de **paiement pawaPay / Stripe**
- Ajout de **tableau de bord analytique** (CA, clients, produits)
- Intégration multilingue (FR / SW / EN)
- Version mobile PWA

---

## 🧠 Auteur

**Eric Kay (@EricayStudio)** – Concepteur du projet **KADI**  
Projet de démonstration SaaS basé sur React, Node.js, Supabase et OpenAI Codex.
