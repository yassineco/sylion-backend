# 🦁 SYLION — PROJECT CONTEXT (Master Architecture Reference)

**Version**: 1.0  
**Maintainer**: SylionTech  
**Last Update**: 2025  
**Scope**: WhatsApp AI Assistant + Multi-tenant backend + RAG + Infrastructure

Ce document sert de **source de vérité** pour tous les outils d’IA (Copilot, Continue, Cursor, ChatGPT, Claude).  
Il résume toute l’architecture technique, les règles d’ingénierie, les modules, et les choix stratégiques documentés dans :

- architecture-whatsapp-v1.md  
- architecture-whatsapp-v2.md  
- rag-architecture.md  
- backend-structure.md  
- infrastructure-plan.md  
- whatsapp-provider-plan.md  
- pricing_whatsapp_assistant.md  
- roadmap-90-days.md  

Aucun outil ou développeur n’est autorisé à contredire ce document.

---

# 1. 🎯 Vision & Objectif

SYLION est une plateforme d’assistants IA multi-tenant orientée **WhatsApp-first**, destinée aux entreprises marocaines et internationales.

Objectifs principaux :

- Réception/envoi automatisé sur WhatsApp
- Moteur IA SYLION (Gemini + RAG)
- Architecture multi-tenant sécurisée
- Administration simple via API + UI
- Coûts maîtrisés (Flash comme modèle principal)
- Scalabilité future (multi-channel, voix, RAG premium)

---

# 2. 🏛️ Architecture Générale

## 2.1. Architecture globale

Client WhatsApp → Provider → Gateway → Queue → Core Services → RAG → LLM → Response → Provider

markdown
Copier le code

## 2.2. Caractéristiques fondamentales

- **Monolithe modulaire** (Node.js + TypeScript strict)
- **Drizzle ORM** (PostgreSQL + pgvector)
- **Queues BullMQ** (Redis)
- **RAG local-first** (Vertex embeddings + pgvector)
- **RAG Vertex Search** en option premium
- **Multi-tenant sécurisé** (isolation stricte par tenant_id)
- **Provider abstrait** (360dialog recommandé)
- **Déploiement VPS + Supabase + GCP**

---

# 3. 🧩 Modules et Bounded Contexts

Tous les modules EXISTENT et doivent être respectés tels quels :

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

markdown
Copier le code

AUCUN nouveau module ne peut être créé sans justification architecturale.

## 3.1. tenant/
- Gestion des entreprises clientes  
- Plans (Starter / Pro / Business / Enterprise)  
- Quotas (messages, tokens, documents)

## 3.2. channel/
- Configuration WhatsApp (360dialog, Meta, Twilio)  
- Mapping numéro → tenant

## 3.3. assistant/
- Configuration LLM, prompts, langues  
- flags : rag_enabled, rag_mode  
- knowledge_base par défaut

## 3.4. whatsapp/
- Validation du webhook  
- Normalisation messages  
- Appel au provider pour envoyer les réponses  
- **Pas d’IA ici**  

## 3.5. conversation/ & message/
- Gestion conversation  
- Historique court (contexte IA)  
- Status (open/closed/agent_handoff)  

## 3.6. knowledge/ & rag/
- Upload documents (PDF/Word)  
- Stockage GCS  
- Indexation (embedding Vertex)  
- pgvector + RAG local  
- Option premium Vertex Search  

## 3.7. usage/
- Tracking tokens  
- Tracking messages  
- Tracking requêtes RAG  
- Gestion des quotas

## 3.8. admin/
- API interne permettant de configurer : assistants, canaux, tenants, documents

---

# 4. 💾 Base de Données (Supabase + pgvector)

Tables principales :

tenants
users
channels
assistants
channel_bindings
conversations
messages
knowledge_bases
knowledge_documents
knowledge_chunks
usage_records
end_users
quotas

yaml
Copier le code

Contraintes obligatoires :

- Tous les SELECT/INSERT/UPDATE doivent filtrer sur `tenant_id`
- Tous les modules doivent utiliser un repository Drizzle dédié
- Jamais d’accès direct à la DB depuis un controller ou gateway

---

# 5. 🔥 Pipeline WhatsApp

1️⃣ Webhook → WhatsAppGateway  
2️⃣ Normalisation + Rate Limit  
3️⃣ Publication queue → `incoming_messages`  
4️⃣ MessageProcessor (worker) :  
   - conversation  
   - message  
   - assistant config  
   - quotas  
   - RAG  
   - LLM  
   - envoi WhatsApp  
   - usage tracking  

**Tous les traitements IA doivent passer par la queue.**

---

# 6. 📚 Pipeline RAG

## 6.1. RAG Local (v1)
- Embeddings Vertex AI  
- Vector store : Supabase + pgvector  
- Recherche : KNN <-> opérateur  

Équation SQL :

```sql
embedding <-> $query_embedding
6.2. RAG Premium (v2)
Vertex AI Search

Configurable par assistant (rag_mode='vertex')

6.3. Documents
Stockage : Google Cloud Storage

Indexation via worker : rag_indexing

7. 🧱 Infrastructure (MVP)
VPS (Hetzner)
4 vCPU / 8 Go RAM

Nginx

Backend Node + Workers

Redis (Docker)

Supabase
PostgreSQL managé

pgvector activé

Migrations via Drizzle

GCP
Vertex AI (LLM + embeddings)

Cloud Storage (RAG docs)

DNS
Cloudflare

api.sylionai.com

admin.sylionai.com

Monitoring
Grafana Cloud (Free)

8. 🔐 Règles de Sécurité Multi-tenant
Aucun accès cross-tenant (11 vulnérabilités déjà corrigées)

Tous les services doivent recevoir Explicit Tenant ID

Vérification systématique avant tout accès DB

Jamais injecter tenantId depuis le client

Toute IA/RAG doit être conditionnée par tenant

9. 💵 Pricing Model
Plans Maroc & Europe : Starter / Pro / Business / Enterprise
Quotas basés sur :

messages

tokens

documents RAG

numéros WhatsApp

Add-ons :

voix WhatsApp

multi-numéros

analytics IA

handoff humain

connecteurs CRM

Marge cible : 70–85%

10. 🛣️ Roadmap produit (90 jours)
Phase 1 (0–30 jours)
MVP WhatsApp complet

Démo pro

Landing page + Pricing

Phase 2 (30–60 jours)
3 clients Maroc

1 client international

Process commercial

Phase 3 (60–90 jours)
Admin Console

RAG V2

Monitoring complet

Automations n8n

11. 🎛️ Conventions de développement
Règles absolues
TypeScript strict

Pas de code IA dans Gateway

Pas de requêtes DB dans controllers

Pas de logique métier dans providers

Pas d’introduction de nouveaux modules non documentés

Respect total des patterns Drizzle + Services + Repositories

Style
Fonctions pures quand possible

Pas de magie : pas de global state hors context

Toujours valider les inputs (zod)

Toujours commenter les flows complexes

12. 🌐 Provider WhatsApp
Provider MVP : 360dialog

meilleur prix

onboarding simple

Webhooks propres

parfait pour Maroc

Providers secondaires :

Meta Cloud API (Scale / EU)

Twilio (Enterprise multi-région, cher)

13. 🧠 Guidelines pour les Agents IA (Copilot, Cursor, ChatGPT)
Chaque outil doit :

Lire et respecter intégralement ce document

Charger tous les .md de référence

Ne jamais contredire l’architecture

Analyser avant de coder

Proposer des alternatives en cas de doute

Préserver la cohérence du projet

Maintenir stricte isolation multi-tenant

Respecter RAG local-first

Utiliser les modules existants

Vérifier l’impact infra et coût avant toute recommandation

14. 📌 Conclusion
Ce document définit :

l’architecture complète

les règles d’ingénierie

la structure backend

le fonctionnement RAG

l’infrastructure

la stratégie

la roadmap

Tout effort de développement SYLION doit s’y conformer.
Toute IA doit l’utiliser comme source de vérité absolue.

