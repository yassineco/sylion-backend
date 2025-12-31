🦁 SYLION Backend — Architecture Contract

Version : 1.1 (Contract-Safe)
Projet : SYLION WhatsApp AI Assistant
Statut : Document normatif absolu

⚠️ Ce document est un contrat d’architecture exécutable.
Toute IA, tout développeur, tout outil d’assistance DOIT s’y conformer.
Toute violation constitue une non-conformité architecturale.

1. 📘 Objectif et portée

Ce document définit les règles d’architecture obligatoires du backend SYLION.

Il constitue la source de vérité unique pour :

la structure du code,

les responsabilités des couches,

les interdits techniques,

les frontières IA / RAG / DB / Provider.

❌ Ce document n’est pas :

une roadmap,

une documentation pédagogique,

une vision future non implémentée.

2. 🏗️ Architecture principale
2.1 Type d’architecture

Le backend SYLION est un monolithe modulaire, structuré en bounded contexts stricts.

✔️ Autorisé :

monolithe modulaire

séparation claire des domaines

orchestration par workers

❌ Interdit :

microservices

architecture distribuée

NestJS opinionated modules

agents IA autonomes non contrôlés

appels LLM hors pipeline central

2.2 Modules VALIDÉS (existants)

Les modules suivants existent physiquement et sont validés contractuellement :

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


⚠️ Aucun autre module ne peut être ajouté sans :

justification explicite,

mise à jour de ce document,

validation formelle (ADR recommandé).

2.2.1 Modules RÉSERVÉS (non implémentés)

Les modules suivants sont réservés par l’architecture, mais NON implémentés à ce stade :

quota/   → enforcement des quotas & plans


❌ Il est interdit d’y placer du code tant qu’ils ne sont pas officiellement créés.
✔️ Leur implémentation future nécessite une mise à jour de ce document.

2.3 Structure dossier (OBLIGATOIRE)
src/
├─ app/           → Entrée HTTP (Fastify)
├─ modules/       → Domaines métiers
├─ jobs/          → Workers BullMQ
├─ db/            → Drizzle ORM + migrations
├─ config/        → Configuration centrale
├─ lib/           → Wrappers (LLM, GCP, logger, errors)
└─ index.ts       → Bootstrap API + workers


❌ Interdit :

mélanger les responsabilités

créer des sous-modules arbitraires

logique métier hors modules

3. 🧩 Règles par couche
3.1 Controllers (HTTP Layer)

✔️ Rôle :

validation input

mapping HTTP → service

❌ Interdit :

logique métier

accès DB

appels IA / RAG

logique tenant

3.2 Services (Business Layer)

✔️ Rôle :

logique métier

validation des règles

orchestration inter-modules

reçoit TOUJOURS tenantId

❌ Interdit :

appels directs IA / LLM

appels DB directs

bypass d’un autre module

3.3 Repositories (Data Layer)

✔️ Rôle :

accès DB

Drizzle ORM

filtrage systématique par tenant_id

❌ Interdit :

exposer des entités brutes aux controllers

requêtes sans tenant_id

⚠️ Exception contrôlée :
SQL brut autorisé uniquement si nécessaire (atomicité, pgvector, performance) et :

documenté,

encapsulé,

jamais exposé hors repo / service DB-critique.

3.4 Gateways WhatsApp

✔️ Rôle exclusif :

validation webhook

normalisation message

publication en queue

❌ Interdit :

DB

IA

RAG

logique métier

3.5 Workers (Queue Processing)

✔️ Rôle :

orchestration runtime

appel aux services

enregistrement usage

aucune logique métier persistante

❌ Interdit :

appels directs provider WhatsApp

logique métier durable

4. 🧠 IA / LLM / RAG
4.1 RAG — règle absolue

✔️ RAG centralisé et orchestré.

❌ Interdit :

RAG inline dans controllers

RAG inline dans workers non dédiés

✔️ Autorisé uniquement via :

rag.orchestrator.ts

rag.worker.ts (query)

knowledge.worker.ts (indexation)

4.2 LLM Calls — règle absolue

❌ Interdit :

tout appel LLM depuis un module métier

tout appel LLM depuis un worker autre que le processor central

✔️ Seul fichier autorisé :

messageProcessor.worker.ts


✔️ Seul point d’entrée LLM :

lib/llm.ts

5. 🔐 Multi-tenant (NON NÉGOCIABLE)

Règle absolue : isolation stricte.

✔️ Obligations :

tenantId partout

DB filtrée par tenant_id

Redis scoped par tenant

aucun document partagé

❌ Interdit :

accès par ID sans tenant

cache global

logs contenant données sensibles

6. 💾 Base de données

✔️ PostgreSQL obligatoire
✔️ pgvector obligatoire
✔️ Drizzle migrations obligatoires
✔️ snake_case partout

⚠️ Le projet est compatible PostgreSQL standard.
Supabase est une option managée recommandée, non exclusive.

7. 📦 Provider WhatsApp

✔️ Abstraction obligatoire :

whatsapp/providers/
  ├─ 360dialog.provider.ts
  ├─ meta.provider.ts
  └─ twilio.provider.ts


❌ Interdit :

appels provider hors service dédié

8. 🚀 Performance & Scalabilité

✔️ Pipeline obligatoire :

Gateway → Queue → Worker → Services → IA → Provider


❌ Interdit :

traitement IA synchrone HTTP

RAG depuis gateway

9. 🌐 Infrastructure

✔️ VPS Hetzner / OVH
✔️ Redis Docker
✔️ Nginx reverse proxy
✔️ Vertex AI + GCS

❌ Interdit :

documents RAG sur VPS

IA hors GCP

10. 🛡️ Qualité & Tests

✔️ Tests multi-tenant obligatoires
✔️ Tests RAG (fuites cross-tenant)
✔️ Tests Gateway & Processor

11. 🧬 Conventions Code

✔️ TypeScript strict
✔️ Types explicites
❌ any interdit

⚠️ Exception unique : interop driver DB localement, justifiée.

✔️ Zod pour validation input
✔️ REST JSON uniquement

12. 🦁 Conclusion

Ce document est la loi d’architecture de SYLION.

Toute IA doit le charger avant génération.

Toute contribution doit y être conforme.

Toute dérogation doit être explicitement validée.

La stabilité, la sécurité et la scalabilité du projet en dépendent.