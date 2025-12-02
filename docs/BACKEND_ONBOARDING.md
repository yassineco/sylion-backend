Version : 1.0
Objectif : Onboarder un nouveau développeur SYLION en moins de 10 minutes
Cible : Développeurs humains + IA (Copilot, Cursor, ChatGPT, Claude)

1. 🎯 Résumé du projet (90 secondes)

SYLION est un backend TypeScript qui gère :

des assistants IA via WhatsApp

un système multi-tenant strict

un moteur RAG local-first

une architecture modulaire

une communication via queue (BullMQ)

un pipeline complet message WhatsApp → IA → réponse WhatsApp

L’objectif est :
Fournir aux entreprises un assistant IA WhatsApp clé en main (MVP → V1 → Scale).

Le backend est déjà production-ready, avec sécurité multi-tenant renforcée.

2. 🧱 Architecture (2 minutes)
2.1. Type

Monolithe modulaire (Node.js 20+, Fastify, TypeScript strict)

2.2. Structure
src/
├─ app/                → API HTTP (Fastify)
├─ modules/            → modules métiers (assistant, tenant, whatsapp…)
├─ jobs/               → workers BullMQ (incoming messages)
├─ lib/                → LLM, embeddings, logger, errors
├─ db/                 → migrations Drizzle + schemas
└─ index.ts            → bootstrap API + workers

2.3. Modules principaux
tenant/            → gestion multi-tenant
channel/           → configuration WhatsApp
assistant/         → assistant IA (LLM + settings)
whatsapp/          → gateway + provider abstraction
conversation/      → gestion des conversations
message/           → messages internes
knowledge/         → documents RAG
rag/               → RAG local + Vertex options
usage/             → quotas + consommation
admin/             → API interne admin

2.4. 🗄️ Configuration Base de Données

**Démarrer les conteneurs dev :**
```bash
docker-compose -f docker-compose.dev.yml up -d postgres-dev redis-dev
```

**Appliquer les migrations :**
```bash
npm run db:migrate
```

**Seed minimal (dev uniquement) :**
```bash
PGPASSWORD=dev_password psql -h localhost -p 5433 -U sylion_dev -d sylion_dev << 'EOF'
INSERT INTO tenants (id, name, slug, is_active, plan, settings) 
VALUES ('a0000000-0000-0000-0000-000000000001', 'Dev Tenant', 'dev-tenant', true, 'free', '{}');

INSERT INTO assistants (id, tenant_id, name, is_default, system_prompt, conversation_config, rag_config)
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Echo Bot', true, 'Echo bot.', '{}', '{}');

INSERT INTO channels (id, tenant_id, type, name, is_active, config, whatsapp_phone_number)
VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'whatsapp', 'WhatsApp Dev', true, '{}', '+212600000000');
EOF
```

**Vérifier les tables :**
```bash
PGPASSWORD=dev_password psql -h localhost -p 5433 -U sylion_dev -d sylion_dev -c "\dt"
```

3. 🔥 Pipeline WhatsApp (3 minutes)
1. Message reçu via provider

Incoming HTTP → POST /whatsapp/webhook.

2. WhatsApp Gateway

Valide payload

Normalise message

Détecte channel → tenant

Publie dans la queue incoming-messages

3. Worker : MessageProcessor

C’est le cœur du backend. Il fait :

Récupère Thread (conversation)

Enregistre message user

Charge assistant

Vérifie quotas

Récupère connaissances (RAG)

Appelle LLM (via lib/llm.ts)

Génère réponse

Enregistre message assistant

Envoie message WhatsApp via provider abstrait

Enregistre usage

⚠️ Important

AUCUNE IA dans la gateway.
TOUT passe par la queue.

4. 🧬 RAG Pipeline (90 secondes)
RAG Local (défaut)

PDF → chunks → embeddings Vertex → pgvector

recherche vectorielle : embedding <-> query_embedding

orchestrée par rag.orchestrator.ts

RAG Premium

Vertex AI Search

activé par :
assistant.rag_mode = 'vertex'

5. 🧩 Ce que tu peux modifier (et ce que tu ne peux PAS)
✔ Tu peux toucher

services (logique métier)

repositories (requêtes Drizzle)

files .service.ts, .repository.ts, .controller.ts

workers et pipeline

RAG logic dans rag/

schemas Drizzle (avec migrations)

nouveaux endpoints admin

❌ Tu NE PEUX PAS toucher

structure globale src/modules/...

architecture pipeline : webhook → queue → processor

règles multi-tenant (obligatoire tenantId)

logique IA dans gateway

accès DB direct dans controllers

bypass du repository layer

ajout de modules non conformes

logique RAG dans un autre module

Toutes les règles sont définies dans :

ARCHITECTURE_RULES.md

ENGINEERING_STYLE_GUIDE.md

6. 🔡 Conventions (1 minute)
Fichiers
assistant.service.ts
assistant.repository.ts
assistant.entity.ts
assistant.controller.ts

Classes
AssistantService
TenantRepository
MessageProcessorWorker
RAGLocalService

Fonctions
createTenant()
getAssistantById()
normalizeWhatsAppMessage()
searchChunks()

DB (Drizzle)

Tables et colonnes en snake_case :

tenants
assistants
knowledge_documents
tenant_id
assistant_id
created_at

Queues & Jobs
incoming-messages
rag-indexing
process-whatsapp-message

7. 🧪 Tests (60 secondes)
Types de tests
Type	Couvre
unit/	services, repositories
integration/	webhook → queue → processor
special	multi-tenant isolation
Règles obligatoires

Mock WhatsApp provider

Mock embeddings RAG

Pas de vrais appels Vertex AI

Tester cross-tenant (toujours)

8. ⚙️ Setup local (1 minute)
Prérequis

Node.js 20+

Redis (Docker ou local)

PostgreSQL (local ou Supabase)

pnpm / npm

env validé par Zod

Installation
pnpm install
pnpm dev

Migrations
pnpm drizzle:push

Workers

Situés dans src/jobs/

Ils démarrent automatiquement avec l’app.

9. 🛡️ Multi-tenant (1 minute)

Obligatoire partout :

Toujours recevoir tenantId dans les services

Toujours filtrer Drizzle avec eq(table.tenantId, tenantId)

Ne jamais exposer un objet d’un tenant à un autre

Ne jamais mettre un cache global cross-tenant

Ne jamais mélanger documents RAG entre tenants

Les fuites tenant sont les bugs les plus graves.

10. 🧠 Comment contribuer (1 minute)

Lire CONTRIBUTING.md

Créer une branche :

feature/<nom>


Coder en respectant architecture + style

Ajouter tests unitaires + intégration

Vérifier migrations Drizzle

PR avec checklist complète

11. 🤖 Utilisation avec Copilot / Cursor (90 secondes)

Chaque session doit commencer avec :

Please load before coding:
1. PROJECT_CONTEXT.md
2. ARCHITECTURE_RULES.md
3. ENGINEERING_STYLE_GUIDE.md
4. BACKEND_NAMING_CONVENTIONS.md
5. TEST_STRATEGY.md

Follow SYLION_CODING_PROMPT.md


Copilot doit agir comme un senior engineer.

12. 🧩 Scénarios fréquents (prêts à coder)
Ajouter une fonctionnalité dans AssistantService

→ modifier .service.ts + repository + tests

Ajouter un nouvel endpoint admin

→ créer .controller.ts + route + tests
→ PAS de logique métier dans controller

Ajouter un provider WhatsApp

→ créer nouveau fichier dans whatsapp/providers/
→ respecter l’interface provider actuelle

Ajouter un document RAG pour un tenant

→ /api/admin/knowledge/documents
→ indexation automatique via job

13. 🚀 En résumé

En 10 minutes, un développeur doit comprendre :

le pipeline WhatsApp complet

l’architecture modulaire

le système multi-tenant

comment le RAG fonctionne

où coder une feature

où NE PAS coder

comment utiliser l’API admin

14. 📎 Ressources complémentaires

API_REFERENCE.md → endpoints complet

API_USE_CASES_EXAMPLES.md → cas réels

CONTRIBUTING.md → règles strictes de PR

SYLION_CODING_PROMPT.md → prompt AI master

15. 🦁 Conclusion

Bienvenue dans le backend SYLION !
Tu as maintenant tout ce qu'il faut pour coder, contribuer et évoluer dans le projet en respectant les standards haut niveau.

La priorité : stabilité + sécurité + cohérence.