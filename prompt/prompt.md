You are my senior backend engineer.  
Generate the complete skeleton of the project **sylion-backend**, following an architecture clean, modular, multi-tenant and ready for WhatsApp + RAG.

## GLOBAL REQUIREMENTS
- Language: TypeScript
- Runtime: Node.js 20+
- Framework: Fastify (preferred) OR Express (if required for stability)
- Style: clean architecture → `app/`, `modules/`, `lib/`, `config/`, `jobs/`, `db/`
- ORM: Drizzle ORM (PostgreSQL)
- Queue system: BullMQ with Redis
- Strict TypeScript config
- Environment config via dotenv + typed config loader
- Prettier + ESLint included
- API ready for future multi-channel messaging (WhatsApp, Web, Voice)
- Testing ready (Jest or Vitest)

## GENERATE THE FOLLOWING STRUCTURE:

sylion-backend/
  package.json
  tsconfig.json
  .env.example
  .gitignore
  docker-compose.yml
  Dockerfile
  README.md

  src/
    app/
      server.ts
      routes.ts
      middlewares/
        errorHandler.ts
        notFoundHandler.ts
        requestLogger.ts
    config/
      index.ts
      env.ts        // strict env loader
    lib/
      logger.ts
      http.ts
      redis.ts
    db/
      drizzle/
        schema.ts
        migrations/
      index.ts
    modules/
      tenant/
        tenant.controller.ts
        tenant.service.ts
        tenant.routes.ts
        tenant.types.ts
      channel/
        channel.controller.ts
        channel.service.ts
        channel.routes.ts
        channel.types.ts
      assistant/
        assistant.controller.ts
        assistant.service.ts
        assistant.routes.ts
        assistant.types.ts
      conversation/
        conversation.controller.ts
        conversation.service.ts
        conversation.routes.ts
        conversation.types.ts
      message/
        message.controller.ts
        message.service.ts
        message.routes.ts
        message.types.ts
    jobs/
      incomingMessages.worker.ts
      index.ts

## CONTENT TO GENERATE

### 1. package.json
Include dependencies:
- fastify
- fastify-cors
- fastify-helmet
- drizzle-orm
- pg
- ioredis
- bullmq
- zod
- pino (for logging)
- dotenv
- ts-node-dev (dev)

Include scripts:
- "dev": "ts-node-dev --respawn src/app/server.ts"
- "build": "tsc"
- "start": "node dist/app/server.js"

### 2. tsconfig.json
- strict mode
- rootDir: src
- outDir: dist
- allowJs: false

### 3. docker-compose.yml
Services:
- api (Dockerfile)
- postgres (15)
- redis (latest)

### 4. server.ts
- Create Fastify instance
- Load middlewares
- Register global routes
- Export start() function

### 5. routes.ts
- Register routes from modules
- Route GET /health

### 6. env.ts
Typed config using Zod:
- PORT
- DATABASE_URL
- REDIS_URL
- NODE_ENV

### 7. logger.ts
- Pino logger configured for dev/prod

### 8. db/index.ts
- connect drizzle ORM to PostgreSQL

### 9. Jobs system (BullMQ)
- incomingMessages.worker.ts
- connection reuse via lib/redis.ts

### 10. Boilerplate for each module
- routes
- controller (req/res)
- service (business logic)
- types (zod)

Each route must be REST-like:
GET /tenants
POST /tenants
GET /channels
POST /channels
etc.

## GOAL
Generate all files with real code, not placeholders.  
The resulting project must run with:
npm install
docker-compose up -d
npm run dev

Start generating the complete project now.



PROMPT PHASE 2 – WhatsApp Gateway + Message Processor


Tu es l’Ingénieur Lead Senior du projet **sylion-backend**.

Le backend est déjà structuré et compile correctement.  
Tu dois maintenant implémenter la **Phase 2 : WhatsApp Gateway + Message Processor**, SANS casser l’architecture existante.

Avant toute chose, lis et respecte strictement les règles documentées dans :
- docs/ENGINEERING_RULES.md
- docs/SECURITY_GUIDE.md
- CONTRIBUTING.md
- docs/LEARNING_LOG.md
- docs/PROGRESS_REPORT_TEMPLATE.md

Ces fichiers sont CONTRAIGNANTS (pas des suggestions).

----------------------------------------------------
🎯 Objectif de la Phase 2
----------------------------------------------------

Mettre en place un flux complet :

1. Réception webhook WhatsApp (provider 360dialog ou équivalent)
2. Normalisation du message dans un format interne
3. Poussée du message dans une file BullMQ `incomingMessages`
4. Worker `messageProcessor` qui :
   - résout le tenant / channel à partir du numéro WhatsApp
   - crée ou retrouve la conversation
   - enregistre le message utilisateur en base
   - appelle un service IA (stub pour l’instant, ex: lib/llm.ts)
   - enregistre le message assistant
   - envoie la réponse vers WhatsApp via un provider HTTP

RAG n’est PAS encore implémenté ici (ce sera la phase suivante) mais l’architecture doit être prête à l’intégrer.

----------------------------------------------------
🧱 Contexte technique à respecter
----------------------------------------------------

- Stack existante :
  - Fastify + TypeScript strict
  - Drizzle ORM + PostgreSQL (Supabase)
  - BullMQ + Redis
  - Aliases TypeScript "@/*" configurés et FONCTIONNELS
- Modules déjà présents :
  - tenant, channel, assistant, conversation, message
- Jobs déjà structurés dans `src/jobs/`
- Fichiers `env.ts`, `logger.ts`, `http.ts`, `errors.ts` déjà en place ou à compléter

IMPORTANT :
❗ Tu NE DOIS PAS :
- modifier la structure globale du projet
- casser les imports alias "@/*"
- réécrire entièrement des fichiers qui fonctionnent déjà
- introduire des “solutions de contournement”

Tu DOIS :
- étendre l’architecture en douceur
- respecter les signatures existantes des services/controllers
- garder le projet compilant à la fin

----------------------------------------------------
📁 Fichiers à créer / compléter
----------------------------------------------------

1) Nouveau module WhatsApp

Créer le dossier :
- src/modules/whatsapp/

Et les fichiers suivants :

a) `src/modules/whatsapp/whatsapp.types.ts`
   - Types pour :
     - payload webhook brut provenant du provider
     - message normalisé interne, ex:
       - NormalizedIncomingMessage
       - NormalizedContact
       - Channel identifiers (phone, wabaId, etc.)

b) `src/modules/whatsapp/whatsapp.provider.ts`
   - Client HTTP vers le provider (360dialog-like)
   - Fonctions :
     - sendTextMessage(to: string, text: string, options?: { tenantId?: string; ... })
     - éventuellement sendMediaMessage(...)
   - Utiliser `lib/http.ts` pour les appels HTTP si pertinent
   - Les URLs, tokens, etc. viennent UNIQUEMENT des variables d’environnement typées dans `config/env.ts`.

c) `src/modules/whatsapp/whatsapp.gateway.ts`
   - Fonction principale :
     - handleIncomingWebhook(payload: WhatsAppRawPayload): Promise<void>
   - Rôle :
     - parser le payload webhook brut
     - extraire les messages valides (texte uniquement pour le MVP)
     - normaliser dans un `NormalizedIncomingMessage`
     - pousser un job dans BullMQ (`incomingMessages` queue)

d) `src/modules/whatsapp/whatsapp.routes.ts`
   - Plugin Fastify qui expose :
     - `POST /whatsapp/webhook`
   - Vérification d’un `VERIFY_TOKEN` (ou signature header selon provider)
   - Appelle `handleIncomingWebhook` et renvoie 200 JSON si tout se passe bien.

2) Mise à jour des routes globales

Dans `src/app/routes.ts` :
- enregistrer le plugin `whatsapp.routes` pour monter `/whatsapp/webhook`.

3) Queue & Worker

a) Dans `src/jobs/index.ts`
   - Déclarer explicitement une queue BullMQ :
     - `incomingMessagesQueue`
   - Exporter un helper pour ajouter un job :
     - addIncomingMessageJob(message: NormalizedIncomingMessage)

b) Nouveau worker :
   - `src/jobs/messageProcessor.worker.ts`
   - Consommer la queue `incomingMessagesQueue`
   - Pour chaque job :
     1. Résoudre le channel / tenant à partir du numéro WhatsApp (via le module `channel` et/ou config)
     2. Créer ou retrouver une conversation (module `conversation`)
     3. Enregistrer le message utilisateur (module `message`)
     4. Appeler un service `generateAssistantReply` (stub) dans `src/lib/llm.ts`
     5. Enregistrer le message assistant en base
     6. Appeler `whatsapp.provider.sendTextMessage(...)` pour renvoyer la réponse

4) Service IA stub

Créer / compléter `src/lib/llm.ts` :
- fonction :
  - generateAssistantReply(options: { tenantId: string; assistantId: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }): Promise<string>
- Pour l’instant, cette fonction peut :
  - soit retourner une réponse statique “TODO: IA non encore branchée”
  - soit lire un simple prompt de base
- Elle doit être conçue pour être facilement remplacée ensuite par un appel Vertex AI.

5) Variables d’environnement

Mettre à jour `src/config/env.ts` pour ajouter, avec Zod :

- WHATSAPP_API_URL
- WHATSAPP_API_KEY
- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_SENDER_NUMBER (ou équivalent)
- INCOMING_MESSAGES_QUEUE_NAME (optionnel, sinon valeur par défaut dans le code)

Assurer :
- Typage strict
- Valeurs requises en production

----------------------------------------------------
🔐 Contraintes de sécurité
----------------------------------------------------

- Ne jamais loguer le contenu complet des tokens ou secrets
- Masquer les numéros de téléphone dans les logs si besoin
- Vérifier et sécuriser l’accès au webhook (token de vérification / signature)
- Respecter `SECURITY_GUIDE.md` à chaque ajout

----------------------------------------------------
✅ Résultat attendu
----------------------------------------------------

À la fin de ton travail, je veux :

1. Un module WhatsApp complet :
   - types, provider, gateway, routes
2. Une queue BullMQ `incomingMessages` fonctionnelle
3. Un worker `messageProcessor` fonctionnel (même avec une IA stub)
4. Une intégration propre dans `routes.ts`, `jobs/index.ts`, `env.ts`
5. Le projet qui :
   - compile avec `npm run build` ou `npm run type-check`
   - démarre avec `np

