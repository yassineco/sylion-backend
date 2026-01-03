Version : 1.0
Projet : SYLION WhatsApp AI Assistant
Rôle : Document normatif – Doit être respecté par tout code et toute IA

1. 📘 Objectif

Ce document définit les règles d’architecture obligatoires du backend SYLION.
Aucun module, service, fichier ou logique de développement ne peut y déroger.

C’est la référence absolue pour :

les développeurs

GitHub Copilot

ChatGPT

Cursor

Continue AI

Claude

Toute contribution au code doit être conforme à ces règles.

2. 🏗️ Architecture Principale
2.1. Type d’architecture

Le backend SYLION est un monolithe modulaire, structuré en bounded contexts.

❌ Prohibé : microservices, architectures distribuées, NestJS opinionated modules, LLM agents autonomes non contrôlés.

2.2. Modules autorisés

Les modules VALIDÉS et NON modifiables sont :

tenant/
channel/
assistant/
whatsapp/
conversation/
message/
knowledge/
rag/
usage/
admin/


Aucun autre module ne peut être ajouté sans raison justifiée et validée.

2.3. Structure dossier (obligatoire)
src/
├─ app/           → Entrée HTTP
├─ modules/       → Domaines métiers
├─ jobs/          → Workers (BullMQ)
├─ db/            → Drizzle + migrations
├─ config/        → Config centrale
├─ lib/           → Wrappers GCP, logger, errors
└─ index.ts       → Bootstrap API + workers


❌ Prohibé : mélanger les modules, créer des sous-modules complexes, rangement arbitraire.

3. 🧩 Règles de développement par module
3.1. Controllers (HTTP Layer)

Doivent être minces

Ne contiennent aucune logique métier

Appellent uniquement les services

❌ Prohibé : accès DB, logique tenant, appels IA, logique conversationnelle.

3.2. Services (Business Layer)

Contiennent la logique métier du module

Toujours recevoir un tenantId

Valider les permissions

Appeler les repositories

❌ Prohibé : bypass d’un autre module, appels DB directs, faire des appels IA.

3.3. Repositories (Data Layer)

Un repository par module

Utiliser Drizzle ORM

Jamais exposer les entities brutes au contrôleur

Filtrer systématiquement par tenant

❌ Prohibé : SQL brut non justifié, mélanger plusieurs tables dans un seul repo.

3.4. Gateways (WhatsApp Layer)

Doivent uniquement :

valider webhook

normaliser message

publier dans la queue

Ne contiennent aucune logique IA ni métier

❌ Prohibé : RAG, IA, conversation, DB.

3.5. Workers (Queue Processing)

Traitement de messages entrants

Appel à ConversationService, RAGService, AssistantService

Appel au LLM

Enregistrement usage

❌ Prohibé : appels directs à WhatsApp provider (via Services uniquement).

4. 🧠 Règles IA / LLM / RAG
4.1. Local-first RAG

Le RAG par défaut est :

Vertex AI Embeddings

PostgreSQL + pgvector

Requête vectorielle embedding <-> $query

❌ Prohibé : RAG direct dans les workers ou controllers
✔ Obligatoire : passer par rag.orchestrator.ts

4.2. RAG Premium

Vertex AI Search = option premium.

Paramètre obligatoire :

assistants.rag_mode = 'vertex'

4.3. LLM Calls

Doivent toujours passer par lib/llm.ts

Jamais directement depuis un module métier

Appel uniquement depuis messageProcessor.worker.ts

5. 🔐 Sécurité & Multi-tenant

Règle absolue :
Aucun accès cross-tenant ne doit être possible.

Obligations :

Tous les services reçoivent un tenantId

Toutes les queries Drizzle incluent tenant_id

Pas de données partagées entre tenants

Pas de fuseau commun de documents RAG

Logs anonymisés

❌ Prohibé :

requête DB sans tenant_id

récupération d’un objet par ID sans filtre tenant

accès global dans cache Redis (doit être scoped par tenant)

6. 💾 Base de données
6.1. Règles DB

PostgreSQL obligatoire

Extensions obligatoires : pgvector

Migrations Drizzle obligatoires

Noms de tables : snake_case

6.2. Pas de relations implicites

Toute relation doit être :

explicite

normalisée

contrôlée via un service

7. 📦 Provider WhatsApp
7.1. Abstraction obligatoire

Structure :

whatsapp/providers/360dialog.provider.ts
whatsapp/providers/meta.provider.ts
whatsapp/providers/twilio.provider.ts


❌ Prohibé : appeler directement l’API d’un provider depuis un worker.

7.2. Provider recommandé

MVP → 360dialog

Scale → Meta Cloud direct

Enterprise → Twilio

8. 🚀 Performance & Scalabilité
8.1. Queue obligatoire

Tout message entrant doit suivre :

Gateway → Queue → Processor → Services → IA → Provider

8.2. Pas de traitement synchrone

❌ Prohibé :

logique IA dans le thread HTTP

traitement RAG direct depuis la Gateway

9. 🌐 Infrastructure Rules
9.1. VPS

Hetzner/OVH obligatoire pour API

Redis sur VPS (Docker)

Nginx reverse proxy obligatoire

9.2. Supabase

PostgreSQL managé

Connexion sécurisée

pgvector activé

9.3. GCP

Vertex AI LLM

Vertex embeddings

GCS pour les documents

❌ Prohibé : héberger tes documents RAG sur le VPS.

10. 🛡️ Qualité & Tests
10.1. Tests obligatoires

Tests multi-tenant

Tests RAG (fuites cross-tenant)

Tests Gateway

Tests MessageProcessor

10.2. Conventions tests

unit/ pour services, repos

integration/ pour Gateway et Processor

11. 🧩 Conventions Code
TypeScript

strict mode obligatoire

types explicites partout

jamais utiliser any

Style

Pas de logique dans index.ts

Utilitaires dans lib/

Inputs validés avec Zod

APIs

REST JSON uniquement

Pas de GraphQL pour l’instant
---

## 11.5 Knowledge Indexing Flow

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KNOWLEDGE INDEXING FLOW                       │
└─────────────────────────────────────────────────────────────────────┘

  Admin UI / API
       │
       ▼
┌──────────────────┐      ┌─────────────────────┐
│ POST /documents  │ ───▶ │ knowledge.routes.ts │
│ (multipart)      │      │                     │
└──────────────────┘      └──────────┬──────────┘
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
            ┌────────────────┐              ┌────────────────┐
            │ Quota Check    │              │ File Storage   │
            │ assertCanUpload│              │ (local/GCS)    │
            └───────┬────────┘              └───────┬────────┘
                    │                               │
                    │       ┌───────────────────────┘
                    ▼       ▼
            ┌────────────────────────┐
            │ knowledge_documents    │ status: 'uploaded'
            │ (PostgreSQL)           │
            └───────────┬────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │ BullMQ Queue           │ job: 'rag:index-document'
            │ (Redis)                │
            └───────────┬────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │ knowledge.worker.ts    │
            │                        │
            │  1. consumeDaily       │◀──── ATOMIC QUOTA CHECK
            │     IndexingOrThrow()  │      (PostgreSQL UPDATE)
            │                        │
            │  2. chunkText()        │
            │                        │
            │  3. generateBatch      │◀──── Vertex AI Embeddings
            │     Embeddings()       │
            │                        │
            │  4. INSERT chunks      │──▶ knowledge_chunks (pgvector)
            │                        │
            └───────────┬────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │ knowledge_documents    │ status: 'indexed' | 'error'
            └────────────────────────┘
```

### Quota Enforcement Point

The quota is enforced **atomically** at step 1 in the worker, BEFORE any processing begins.

```
consumeDailyIndexingOrThrow(tenantId)
    │
    ├──▶ INSERT ... ON CONFLICT DO NOTHING  (create counter if absent)
    │
    └──▶ UPDATE ... WHERE count + 1 <= limit RETURNING count
              │
              ├── 1 row  ──▶ Credit consumed, proceed with indexation
              │
              └── 0 rows ──▶ Throw QuotaError, document stays in 'error'
```

### Worker Responsibilities

| Worker | File | Queue | Responsibility |
|--------|------|-------|----------------|
| Knowledge Indexer | `knowledge.worker.ts` | `rag:index-document` | Chunk, embed, store vectors |
| RAG Query | `rag.worker.ts` | `rag:query` | Similarity search, context retrieval |
| Message Processor | `messageProcessor.worker.ts` | `incoming-messages` | Orchestrate AI + RAG |

---
12. 🧬 Évolution future
v2

Appels vocaux

Analytics IA

Agents humains

v3

Vertex Search pour gros clients

Admin Console complète

Autoscale par modules dans Docker

13. 🦁 Conclusion

Ce document est le contrat d’architecture de SYLION.
Toute contribution doit le respecter.
Toute IA doit le charger avant de générer du code.
Toute dérogation doit être validée explicitement.

L’intégrité du projet dépend du respect strict de ces règles.