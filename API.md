# API.md – Documentation des endpoints REST de KADI

Ce document décrit toutes les **routes API REST** exposées par le backend de KADI.  
Chaque requête doit être accompagnée d’un **token Bearer** (issu de Supabase) afin de garantir l’isolation multi‑tenant.

---

## Authentification

### `POST /api/auth/signup`
Inscription d’un nouvel utilisateur (email + mot de passe) et création du profil entreprise.

**Body JSON :**
```json
{
  "email": "user@exemple.com",
  "password": "123456",
  "company": "Nom de l'entreprise",
  "manager_name": "Responsable",
  "logo_file": "data:image/png;base64,...",
  "logo_filename": "logo.png"
}
```

**Réponse :**
```json
{
  "user": {"id": "uuid", "email": "user@exemple.com"},
  "profile": {"company": "Nom de l'entreprise"},
  "emailConfirmationRequired": true,
  "emailVerificationSent": true,
  "verificationUrl": "https://example.com/verify",
  "logoUploaded": true,
  "message": "Compte créé. Un email de confirmation vous a été envoyé."
}
```

---

### `POST /api/auth/login`
Connexion utilisateur via Supabase.

**Body JSON :**
```json
{
  "email": "user@exemple.com",
  "password": "123456"
}
```

**Réponse :**
```json
{
  "session": {
    "access_token": "jwt-token",
    "user": {"id": "uuid", "email": "user@exemple.com"}
  }
}
```

---

### `POST /api/auth/logout`
Déconnexion. Répond `204 No Content`.

---

### `POST /api/auth/resend-verification`
Renvoie un email de confirmation si le compte n’est pas encore validé (idempotent).

**Body JSON :**
```json
{
  "email": "user@exemple.com"
}
```

**Réponse :**
```json
{
  "emailVerificationSent": true,
  "verificationUrl": "https://example.com/verify",
  "message": "Un nouvel email de confirmation vous a été envoyé."
}
```

---

### `POST /api/auth/password/forgot`
Déclenche l’envoi d’un email sécurisé pour réinitialiser le mot de passe.

**Body JSON :**
```json
{
  "email": "user@exemple.com"
}
```

**Réponse :**
```json
{
  "resetEmailSent": true,
  "message": "Un email de réinitialisation vient de vous être envoyé."
}
```

---

### `POST /api/auth/profile`
Création ou mise à jour du profil d’entreprise associé à l’utilisateur connecté.

**Body JSON :**
```json
{
  "tenant_id": "uuid",
  "company": "Nom de l'entreprise",
  "email": "user@exemple.com"
}
```

**Réponse :**
```json
{"message": "Profil mis à jour"}
```

---

## Clients

### `GET /api/clients`
Retourne la liste des clients du tenant connecté.

**Headers :** `Authorization: Bearer <token>`

**Réponse :**
```json
[
  {
    "id": "uuid",
    "company_name": "Alpha SARL",
    "contact_name": "Jean Dupont",
    "email": "jean@alpha.com"
  }
]
```

---

### `POST /api/clients`
Ajoute un client.

**Body JSON :**
```json
{
  "company_name": "Alpha SARL",
  "contact_name": "Jean Dupont",
  "email": "jean@alpha.com",
  "phone": "+243...",
  "address": "Lubumbashi, RDC"
}
```

**Réponse :**
```json
{"message": "Client ajouté avec succès"}
```

---

### `PATCH /api/clients/:id`
Met à jour les informations d’un client.

**Body JSON :**
```json
{"phone": "+24390000000"}
```

**Réponse :**
```json
{"message": "Client mis à jour"}
```

---

### `DELETE /api/clients/:id`
Supprime un client par ID.

**Réponse :**
```json
{"message": "Client supprimé"}
```

---

## Produits

### `GET /api/products`
Liste tous les produits du tenant connecté.

### `POST /api/products`
Ajoute un nouveau produit ou service.
```json
{
  "name": "Consultation",
  "description": "Service de conseil",
  "unit_price": 50,
  "currency": "USD"
}
```

### `PATCH /api/products/:id`
Modifie un produit existant.

### `DELETE /api/products/:id`
Supprime un produit.

**Réponse standard :**
```json
{"message": "Produit mis à jour/supprimé avec succès"}
```

---

## Factures

### `GET /api/invoices`
Retourne toutes les factures du tenant.

### `GET /api/invoices/:id`
Retourne une facture spécifique.

### `POST /api/invoices`
Crée une nouvelle facture manuellement.

**Body JSON :**
```json
{
  "client_id": "uuid",
  "items": [
    {"name": "Produit A", "quantity": 2, "unit_price": 15},
    {"name": "Produit B", "quantity": 1, "unit_price": 30}
  ],
  "currency": "USD",
  "notes": "Merci pour votre confiance."
}
```

**Réponse :**
```json
{"message": "Facture créée", "invoice_number": "INV-0001"}
```

---

### `PATCH /api/invoices/:id`
Met à jour une facture existante (statut, notes, items…).

### `DELETE /api/invoices/:id`
Supprime une facture.

### `GET /api/invoices/pdf/:id`
Génère et télécharge le PDF d’une facture.

---

### `GET /api/invoices/summary`
Retourne un résumé des ventes et KPI (pour le dashboard).

**Réponse exemple :**
```json
{
  "total_clients": 5,
  "total_invoices": 23,
  "total_amount": 12450,
  "recent_invoices": [ ... ]
}
```

---

## Intelligence Artificielle

### `POST /api/ai/facture`
Génère automatiquement une facture à partir d’un texte libre.

**Body JSON :**
```json
{
  "prompt": "Créer une facture pour Kivu Coffee : 3 sacs de café à 25 USD et 1 machine à 100 USD"
}
```

**Réponse :**
```json
{
  "client": "Kivu Coffee",
  "items": [
    {"name": "Sac de café", "quantity": 3, "unit_price": 25},
    {"name": "Machine", "quantity": 1, "unit_price": 100}
  ],
  "total": 175,
  "currency": "USD"
}
```

---

## Health Check

### `GET /api/health`
Permet de vérifier l’état du backend.

**Réponse :**
```json
{"status": "ok", "uptime": 12345}
```

---

## Statuts d’erreur

| Code | Signification                |
|------|------------------------------|
| 400  | Requête invalide             |
| 401  | Token manquant ou invalide   |
| 403  | Accès non autorisé           |
| 404  | Ressource non trouvée        |
| 500  | Erreur interne du serveur    |

---

**Auteur :** Eric Kay (@EricayStudio)  
**Dernière mise à jour :** Octobre 2025
