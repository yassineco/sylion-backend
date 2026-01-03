Version : 1.0
Projet : SYLION WhatsApp AI Assistant
Type : Référence technique officielle de l’API (Admin + Webhook + Provider)

1. 📘 Vue d'ensemble de l’API

L’API du backend SYLION est composée de trois blocs :

Webhook WhatsApp → réception des messages externes

Admin API → gestion tenants / assistants / channels / usage / documents

Internal API (privée) → healthchecks, monitoring, debug contrôlé

Toutes les routes doivent :

être protégées par tenant

valider les permissions

respecter la structure modulaire

ne jamais exposer de données cross-tenant

2. 🔐 Principes généraux
2.1. Format des réponses

Toujours :

{
  "success": true,
  "data": { ... }
}


En cas d’erreur :

{
  "success": false,
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant does not exist."
  }
}

2.2. Authentification Admin API

Header obligatoire :

Authorization: Bearer <admin_jwt_token>
X-Tenant-Id: <tenantId>

2.3. Communication WhatsApp

Webhook → POST JSON venant de 360dialog / Meta.

3. 📩 WhatsApp Webhook API
3.1. POST /whatsapp/webhook
Description

Réception des messages WhatsApp (texte, media, status).
Ne contient AUCUNE logique IA.

Headers (provider → SYLION)
X-Provider-Signature: ...
X-Provider-Timestamp: ...
Content-Type: application/json

Body (exemple simplifié 360dialog)
{
  "messages": [
    {
      "from": "212612345678",
      "id": "ABCD1234",
      "timestamp": "1706445000",
      "text": { "body": "Bonjour" }
    }
  ]
}

Process interne :

Validation signature

Extraction message brut

Normalisation

Mapping numéro → Channel → Tenant

Publish queue incoming-messages

Réponse

Toujours immédiate (200 OK).

4. 🧩 Admin API (REST — JSON)

Toutes les routes suivantes exigent :

Authorization: Bearer <token>
X-Tenant-Id: <tenantId>
Content-Type: application/json

5. 🏢 Tenant Management
5.1. GET /api/admin/tenants

Liste tous les tenants (admin global uniquement).

5.2. POST /api/admin/tenants
Body
{
  "name": "Ecole Al Ihssane",
  "plan": "starter"
}

Response
{
  "success": true,
  "data": {
    "id": "tenant_123",
    "name": "Ecole Al Ihssane",
    "plan": "starter"
  }
}

5.3. GET /api/admin/tenants/:tenantId

Retourne les infos d’un tenant.

5.4. PATCH /api/admin/tenants/:tenantId

Modifie plan / limites / statut.

6. 📱 Channel API (WhatsApp configuration)
6.1. GET /api/admin/channels

Liste les channels du tenant.

6.2. POST /api/admin/channels
Body
{
  "type": "whatsapp",
  "provider": "360dialog",
  "whatsapp_number": "212612345678",
  "credentials": {
    "api_key": "XXX",
    "phone_number_id": "YYYYY"
  }
}

Response

Channel créé pour ce tenant.

6.3. PATCH /api/admin/channels/:channelId

Mise à jour config.

7. 🤖 Assistant API
7.1. GET /api/admin/assistants

Liste les assistants du tenant.

7.2. POST /api/admin/assistants

Créer un assistant IA.

Body
{
  "name": "Reception IA",
  "language": "fr",
  "model": "gemini-1.5-flash",
  "rag_enabled": true,
  "rag_mode": "local",
  "system_prompt": "You are a helpful assistant."
}

7.3. PATCH /api/admin/assistants/:assistantId

Mise à jour config.

7.4. POST /api/admin/assistants/:assistantId/bind

Associer un assistant à un channel.

Body
{
  "channel_id": "ch_xyz"
}

8. 💬 Conversation API
8.1. GET /api/admin/conversations

Liste conversations du tenant.

Query Params
status=open|closed
channel_id=...

8.2. GET /api/admin/conversations/:id

Historique complet.

8.3. POST /api/admin/conversations/:id/close

Ferme une conversation.

9. 📨 Message API
9.1. GET /api/admin/messages?conversation_id=xxx

Liste les messages d’une conversation.

10. 📚 Knowledge Base / RAG API
10.1. GET /api/admin/knowledge/bases

Liste les knowledge bases du tenant.

10.2. POST /api/admin/knowledge/bases

Créer une base documentaire.

Body
{
  "name": "Documents RH",
  "description": "Contrats, FAQ interne"
}

10.3. POST /api/admin/knowledge/documents

Upload document PDF/Word.

Multipart form-data
file: <binary>
knowledge_base_id: kb_123

Response
{
  "success": true,
  "data": {
    "document_id": "doc_987",
    "status": "uploaded"
  }
}

10.4. GET /api/admin/knowledge/documents

Liste les documents.

10.5. GET /api/admin/knowledge/documents/:id

Détails + statut RAG.

### 10.6. Knowledge Admin API (New System)

The new knowledge admin system provides enhanced document management with quota enforcement.

**Full documentation:** [API_KNOWLEDGE_ADMIN.md](./API_KNOWLEDGE_ADMIN.md)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/knowledge/documents` | GET | List documents with pagination |
| `/admin/knowledge/documents` | POST | Upload documents (multipart) |
| `/admin/knowledge/documents/:id` | GET | Get single document |
| `/admin/knowledge/documents/:id` | DELETE | Delete document + chunks |
| `/admin/knowledge/documents/:id/reindex` | POST | Trigger reindexation |
| `/admin/knowledge/stats` | GET | Quota usage statistics |

**Quota Enforcement:**
- Upload: checks `maxDocuments`, `maxStorageMb`, `maxDocSizeMb`
- Indexation: atomic daily limit via `consumeDailyIndexingOrThrow`
- Error code: `QUOTA_EXCEEDED` (HTTP 403)

11. 📊 Usage & Quotas API
11.1. GET /api/admin/usage

Retourne la consommation du tenant :

Exemple réponse
{
  "success": true,
  "data": {
    "messages": 412,
    "tokens_input": 109214,
    "tokens_output": 82311,
    "rag_calls": 64,
    "storage_mb": 41.2
  }
}

# 12. 🧪 Health & Internal API

## 12.1. GET /health

Endpoint de vérification de l'état du backend.

### Réponse (HTTP 200)

```json
{
  "status": "healthy",
  "demoMode": true,
  "timestamp": "2025-12-13T10:30:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "environment": "development",
  "services": {
    "database": "connected",
    "redis": "connected",
    "whatsappProvider": "360dialog"
  },
  "queues": {}
}
```

### Champs retournés

| Champ | Type | Description |
|-------|------|-------------|
| `status` | string | `healthy` ou `degraded` |
| `demoMode` | boolean | `true` si mode démo actif (fallback IA) |
| `services.database` | string | `connected` ou `disconnected` |
| `services.redis` | string | `connected` ou `disconnected` |
| `services.whatsappProvider` | string | Provider actif (`360dialog`, `mock`) |

> **Note** : HTTP 200 = service opérationnel, même si `status` = `degraded`.

---

## 12.2. POST /api/v1/whatsapp/webhook

Réception des messages WhatsApp via 360dialog.

### Payload (exemple anonymisé)

```json
{
  "messages": [
    {
      "id": "wamid.HBgMxxxxxxx",
      "from": "212600000000",
      "to": "212600000001",
      "timestamp": "1702468800",
      "type": "text",
      "text": {
        "body": "Bonjour, quels sont vos tarifs ?"
      }
    }
  ]
}
```

### Réponse (HTTP 200)

```json
{
  "success": true,
  "data": {
    "messageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "queued"
  }
}
```

---

## 12.3. GET /metrics

Exposé Prometheus (metrics serveurs + queues).

13. 🔐 Sécurité API
Obligations

X-Tenant-Id obligatoire pour toutes les routes admin

Vérification tenantId → base de données

Aucune information cross-tenant

JWT ou clé interne pour admin

Logs anonymisés end-user

14. 📦 Erreurs standardisées
Code	Signification
TENANT_NOT_FOUND	Tenant inexistant
CHANNEL_NOT_FOUND	Channel invalid
ACCESS_FORBIDDEN	Permissions insuffisantes
INVALID_WEBHOOK	Payload provider invalide
RAG_DOC_NOT_INDEXED	Document non encore prêt
QUOTA_EXCEEDED	Limite dépassée

Format :

{
  "success": false,
  "error": { "code": "...", "message": "..." }
}

15. 📜 Versioning API

Version actuelle : v1

Pas encore de /v1/... dans les routes (prévu v2)

Breaking changes uniquement annoncés dans roadmap

16. 🦁 Conclusion

Cette référence est la documentation officielle de l’API SYLION.
Elle doit être utilisée pour :

l’intégration des clients

la génération de code admin

la construction de la future UI Admin Console

les outils IA (Copilot, Cursor, ChatGPT)

les tests d’intégration

le monitoring

Toute modification doit être conforme à l’architecture du backend.