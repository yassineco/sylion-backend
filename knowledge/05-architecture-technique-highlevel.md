# 05 – Architecture Technique (High-Level)

Ce document résume l'architecture technique globale du produit SylionAI Assistant WhatsApp, dans sa version modernisée (Gateway + Queue + Workers + RAG).

---

# 1. Vue d'ensemble

```
WhatsApp → Provider → SYLION Gateway → Queue → Workers → LLM/RAG → Gateway → WhatsApp
```

Le backend est organisé en **monolithe modulaire** TypeScript, avec :

- **Gateway WhatsApp** (réception / envoi)
- **Core multi-tenant**
- **Message Processor** (worker principal)
- **RAG Service**
- **Usage Service**
- **Admin API**
- **Vector Store (pgvector)**
- **Document Storage (GCS)**

---

# 2. Services principaux

## 2.1. WhatsApp Gateway
- Valide les webhooks
- Normalise les messages
- Mappe :  
  numéro → channel → tenant  
  user → end_user
- Publie dans la queue `incoming_messages`

## 2.2. Message Processor (Workers)
Le cœur de la logique conversationnelle :

1. Récupère message de la queue  
2. Rassemble :
   - conversation
   - historique récent
   - assistant associé  
3. Vérifie quotas  
4. Si RAG activé : recherche de chunks pertinents  
5. Appel LLM (Gemini 1.5 Flash / Pro)  
6. Enregistre message assistant  
7. Envoi via Gateway  
8. Usage tracking  

## 2.3. RAG Service
Deux modes :

### Mode Local (v1)
- Embeddings via Vertex
- pgvector pour stockage
- Similarité cosinus <->

### Mode Vertex AI Search (v2)
- Data Store dédié
- Recherche managée Google
- Premium → Enterprise features

---

# 3. Base de données (Supabase / PostgreSQL)

Tables principales :

```
tenants
channels
assistants
conversations
messages
knowledge_bases
knowledge_documents
knowledge_chunks
usage_records
end_users
quotas
```

---

# 4. Scalabilité

Grâce à la Queue (BullMQ + Redis) :
- Charge répartie
- Workers parallèles
- Tolérance au pic (WhatsApp très bursty)
- Zero-blocking

---

# 5. Multi-tenant

Chaque ressource contient `tenant_id`.  
Des tests de non-fuite cross-tenant sont obligatoires.  
Isolation stricte pour RAG & conversations.

---

# 6. Infra (v1)

- VPS Hetzner / OVH  
- Node.js backend  
- Redis local  
- PostgreSQL Supabase (pgvector)  
- GCP Vertex AI  
- GCS bucket pour documents  
- Reverse proxy Nginx  

---

# 7. Extension future

### v2
- Voix WhatsApp  
- Multi-agents  
- CRM connectors

### v3
- Appels WhatsApp temps réel  
- Agents Vertex  
- Dashboard multi-tenant complet  
