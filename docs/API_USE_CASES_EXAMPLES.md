# 🦁 SYLION — API_USE_CASES_EXAMPLES.md
**Version : 1.0**  
**Objet : Exemples concrets d’utilisation de l’API pour des cas clients (WhatsApp + Admin API)**  

Ce document montre **comment utiliser l’API SYLION** dans des scénarios réels :

- École privée
- Clinique / Cabinet médical
- Restaurant / Snack
- Agence immobilière
- Boutique e-commerce
- Cabinet juridique

Pour chaque cas :
1. Objectif business
2. Setup via Admin API (tenants, channels, assistants, RAG)
3. Exemple de messages WhatsApp
4. Comportement interne du backend

> ⚠️ Tous les exemples supposent que le backend suit les règles définies dans :  
> `PROJECT_CONTEXT.md`, `ARCHITECTURE_RULES.md`, `API_REFERENCE.md`.

---

# 1. 🏫 Cas d’usage : École privée

## 1.1. Objectif
- Répondre aux parents sur :
  - horaires
  - frais de scolarité
  - inscription
  - vacances
- En français / Darija.

## 1.2. Étapes API principales

### 1) Créer le tenant

```bash
POST /api/admin/tenants
Authorization: Bearer <admin_token>

{
  "name": "Ecole Al Ihssane",
  "plan": "starter"
}
Réponse → récupérer tenant_id.

2) Créer le channel WhatsApp
bash
Copier le code
POST /api/admin/channels
Authorization: Bearer <admin_token>
X-Tenant-Id: tenant_ihssane

{
  "type": "whatsapp",
  "provider": "360dialog",
  "whatsapp_number": "212612345678",
  "credentials": {
    "api_key": "DIALOG_WHATSAPP_API_KEY",
    "phone_number_id": "PHONE_NUMBER_ID"
  }
}
3) Créer l’assistant “Accueil École”
bash
Copier le code
POST /api/admin/assistants
Authorization: Bearer <admin_token>
X-Tenant-Id: tenant_ihssane

{
  "name": "Accueil Ecole",
  "language": "fr",
  "model": "gemini-1.5-flash",
  "rag_enabled": true,
  "rag_mode": "local",
  "system_prompt": "Tu es l'assistant officiel de l'école Al Ihssane. Tu réponds aux questions des parents sur les horaires, les frais, les inscriptions, en français simple et parfois en Darija si besoin."
}
4) Lier l’assistant au channel
bash
Copier le code
POST /api/admin/assistants/<assistant_id>/bind
Authorization: Bearer <admin_token>
X-Tenant-Id: tenant_ihssane

{
  "channel_id": "<channel_id>"
}
5) Uploader le règlement intérieur (RAG)
bash
Copier le code
POST /api/admin/knowledge/documents
Authorization: Bearer <admin_token>
X-Tenant-Id: tenant_ihssane
Content-Type: multipart/form-data

file: reglement_interieur_2025.pdf
knowledge_base_id: <kb_ecole_id>
Le document est indexé → l’assistant peut citer les bonnes règles aux parents.

1.3. Exemple de conversation WhatsApp
Parent → WhatsApp :

Bonjour, c’est combien les frais d’inscription pour la 3ème année primaire ?

Flow interne :

Webhook /whatsapp/webhook reçoit le message (provider 360dialog).

Gateway normalise → envoie dans la queue incoming-messages.

messageProcessor.worker :

retrouve tenant_ihssane via le numéro WhatsApp

récupère l’assistant lié

effectue une recherche RAG dans la KB “Règlement 2025”

envoie la question + contexte RAG au LLM

génère réponse

enregistre message assistant dans DB

appelle whatsapp.service → provider → réponse au parent

Parent reçoit :

Les frais d’inscription pour la 3ème année primaire sont de 6500 MAD pour l’année 2025–2026, payables en deux échéances. Si vous voulez, je peux vous envoyer le détail des frais.

2. 🏥 Cas d’usage : Clinique / Cabinet médical
2.1. Objectif
Gérer :

horaires des médecins

prise de rendez-vous basique

infos pré-consultation

2.2. Setup spécifique
Même flow que l’école, avec :

Tenant “Clinique Anfa Santé”

Assistant avec system prompt orienté médical administratif

Documents RAG : “Liste médecins.pdf”, “Tarifs consultation.pdf”

2.3. Exemple de messages
Patient :

Salam, est-ce que le Dr Benali est là demain matin ?

Flow :

RAG sur la grille horaires PDF

Réponse contextualisée :

Le Dr Benali est présent demain matin de 9h à 12h. Voulez-vous un rendez-vous ?

3. 🍽️ Cas d’usage : Restaurant / Snack
3.1. Objectif
Répondre :

menu du jour

horaires

livraison

promotions

3.2. Setup
Tenant : “Snack BurgerTime”

Channel WhatsApp configuré

Assistant en FR + Darija
System prompt : “Tu es l’assistant WhatsApp de BurgerTime à Casablanca…”

RAG → “menu.pdf”, “promotions_mars_2025.pdf”.

3.3. Exemple conversation
Client :

Vous faites la livraison à Dar Bouazza ? combien ?

Réponse via RAG :

Oui, nous livrons à Dar Bouazza. Les frais de livraison sont de 25 MAD, offerts à partir de 250 MAD de commande.

4. 🏡 Cas d’usage : Agence immobilière
4.1. Objectif
Répondre aux leads :

biens disponibles

prix

localisation

prise de contact avec un agent

4.2. Setup
Tenant : “ImmoNouvelle”

Assistant “Conseiller Immo”

RAG avec fiches de biens (“villa_tamaris.pdf”, “appartement_centre.pdf”)

4.3. Exemple conversation
Prospect :

Je cherche une villa à Tamaris, budget 2.5M, vous avez quoi ?

Flow :

IA analyse l’intention et les critères (zone, budget, type bien)

RAG filtre les fiches correspondantes

Réponse :

Nous avons 2 villas à Tamaris dans votre budget :

Villa “Océane” à 2.45M MAD (3 chambres, piscine).

Villa “Jasmin” à 2.6M MAD (4 chambres).
Voulez-vous parler à un agent pour organiser une visite ?

Si handoff humain activé (add-on) → API interne pour tag “handled_by_agent”.

5. 🛒 Cas d’usage : Boutique e-commerce
5.1. Objectif
Automatiser :

Questions produits

Disponibilités

Infos livraison / retour

Suivi commande (via intégration future)

5.2. Setup
Tenant : “Boutique MyBeautyShop”

Assistant en FR

RAG → “FAQ Livraison.pdf”, “Catalogue produits.xlsx converti PDF”

5.3. Exemple conversation
Client :

Est-ce que la crème hydratante peau sèche est dispo ? j’ai une peau sensible.

Flow :

RAG → section produit + conseils

Réponse :

Oui, la crème hydratante “HydraCare Peau Sèche” est disponible. Elle est adaptée aux peaux sensibles et sans parfum. Livraison sur Casablanca en 24h, reste du Maroc en 48–72h.

6. ⚖️ Cas d’usage : Cabinet juridique / Notaire
6.1. Objectif
Répondre aux questions fréquentes :

démarches

pièces à fournir

rendez-vous

PAS de conseil juridique personnalisé (limites légales).

6.2. Setup
Tenant : “Cabinet JurisPlus”

RAG → “Procédure création SARL.pdf”, “Pièces vente immobilière.pdf”

6.3. Exemple conversation
Client :

Quelles pièces il faut pour créer une SARL au Maroc ?

Réponse :

Pour créer une SARL au Maroc, il faut généralement :

Copie CIN ou passeport des associés

Certificat négatif du nom commercial

Projet de statuts

Attestation de blocage de capital (selon le cas)
etc.
Pour un conseil détaillé, je peux vous proposer un rendez-vous avec le cabinet.

7. 🧪 Exemples d’appels API côté intégrateur
Ces exemples montrent comment un intégrateur peut piloter SYLION pour un nouveau client.

7.1. Onboarding automatisé (extrait de pseudo-code)
ts
Copier le code
async function onboardNewSchoolClient(apiToken: string, schoolData: SchoolInput) {
  const tenant = await http.post('/api/admin/tenants', {
    name: schoolData.name,
    plan: 'starter',
  }, {
    headers: { Authorization: `Bearer ${apiToken}` }
  });

  const tenantId = tenant.data.data.id;

  const channel = await http.post('/api/admin/channels', {
    type: 'whatsapp',
    provider: '360dialog',
    whatsapp_number: schoolData.whatsappNumber,
    credentials: schoolData.dialogCredentials
  }, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'X-Tenant-Id': tenantId
    }
  });

  const assistant = await http.post('/api/admin/assistants', {
    name: 'Accueil Ecole',
    language: 'fr',
    model: 'gemini-1.5-flash',
    rag_enabled: true,
    rag_mode: 'local',
    system_prompt: schoolData.systemPrompt
  }, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'X-Tenant-Id': tenantId
    }
  });

  await http.post(`/api/admin/assistants/${assistant.data.data.id}/bind`, {
    channel_id: channel.data.data.id
  }, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'X-Tenant-Id': tenantId
    }
  });

  // Upload de documents RAG via endpoint multipart côté backoffice ou script CLI séparé
}
8. 🧩 Utilisation côté Dashboard Admin futur
Dans l’Admin Console, ces endpoints seront consommés pour :

Liste des conversations → /api/admin/conversations

Détails conversation → /api/admin/conversations/:id

Liste des messages → /api/admin/messages?conversation_id=...

Usage & quotas → /api/admin/usage

Gestion assistants → /api/admin/assistants

9. 🧠 Bonnes pratiques pour nouveaux cas d’usage
Pour tout nouveau secteur :

Clarifier :

questions fréquentes

informations figées (PDF, FAQ)

contraintes légales / ton de la marque

Créer :

1 tenant

1 channel WhatsApp

1 assistant avec system prompt contextualisé

1 knowledge base avec documents structurés

Tester :

quelques conversations réelles via WhatsApp

vérifier les réponses RAG

ajuster le prompt / les documents

Optionnel :

activer handoff humain

activer add-ons : multi-numéros, analytics, connecteurs CRM

---

# 10. 🚫 Cas d'usage : Atteindre la limite d'indexation quotidienne

## 10.1. Contexte

Un tenant sur le plan **Starter** (5 documents/jour) tente d'indexer un 6ème document.

## 10.2. Séquence

### 1) Les 5 premiers documents sont uploadés et indexés

```bash
# Document 1-5 : succès
curl -X POST http://localhost:3000/admin/knowledge/documents \
  -H "X-Tenant-ID: tenant_starter" \
  -F "files=@doc1.txt"

# Réponse HTTP 200
{
  "success": true,
  "data": {
    "successful": [{ "id": "uuid-1", "status": "uploaded" }],
    "totalUploaded": 1
  }
}
```

### 2) Le 6ème document : upload réussit, mais indexation bloquée

```bash
# Upload réussit (ne consomme pas de quota d'indexation)
curl -X POST http://localhost:3000/admin/knowledge/documents \
  -H "X-Tenant-ID: tenant_starter" \
  -F "files=@doc6.txt"

# HTTP 200 - le document est uploadé avec status "uploaded"
```

### 3) Le worker tente l'indexation → quota bloqué

Le worker BullMQ appelle `consumeDailyIndexingOrThrow(tenantId)`.
L'UPDATE atomique renvoie 0 rows (limit atteinte).

**Le document reste en status `error` avec:**

```json
{
  "status": "error",
  "errorReason": "Daily indexing limit reached: 5/5"
}
```

### 4) Vérification via GET /stats

```bash
curl http://localhost:3000/admin/knowledge/stats \
  -H "X-Tenant-ID: tenant_starter"
```

```json
{
  "success": true,
  "data": {
    "documentsCount": 6,
    "limits": {
      "maxDailyIndexing": 5
    },
    "dailyUsage": {
      "docsIndexedCount": 5
    },
    "planCode": "starter"
  }
}
```

### 5) Le lendemain : reindex réussit

```bash
# Le compteur quotidien est reset à minuit
curl -X POST http://localhost:3000/admin/knowledge/documents/uuid-6/reindex \
  -H "X-Tenant-ID: tenant_starter"

# HTTP 200 - indexation démarre
```

## 10.3. Points clés

| Aspect | Comportement |
|--------|--------------|
| Upload | Toujours autorisé si quotas documents/storage OK |
| Indexation | Bloquée atomiquement si quota journalier atteint |
| Status | Document passe en `error` avec raison explicite |
| Reset | Quotas journaliers reset à minuit (UTC) |
| Retry | `POST /documents/:id/reindex` le jour suivant |

---

11. 🦁 Conclusion
Ce document donne des scénarios réalistes + recettes API pour déployer SYLION WhatsApp Assistant dans plusieurs secteurs.

Il peut être utilisé :

comme base pour tes futures démos clients

comme guide pour les intégrateurs techniques

comme support pour la future Admin Console

comme documentation interne pour ton équipe ou tes freelances.