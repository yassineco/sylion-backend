Version : 1.0
Projet : SYLION WhatsApp Assistant
Mainteneur : SylionTech
Rôle : Guide de style et bonnes pratiques obligatoires pour tous les développeurs et toutes les IA

1. 🎯 Objectif

Le but de ce document est de garantir :

une cohérence absolue dans tout le code du backend

une maintenabilité long terme

une facilité d'intervention pour les IA (Copilot, ChatGPT, Cursor…)

une architecture stable

un niveau de qualité professionnel

Il complète mais ne remplace PAS :

PROJECT_CONTEXT.md

ARCHITECTURE_RULES.md

Toute contribution doit respecter les trois documents.

2. ▣ Structure du Code — Style Global
2.1. Monolithe modulaire

un dossier par module (tenant, assistant, message, rag, etc.)

structure interne uniforme :

module/
├─ *.entity.ts
├─ *.repository.ts
├─ *.service.ts
└─ index.ts


❌ Interdit :

mélanger .service.ts et .repository.ts

créer des sous-modules non nécessaires

2.2. Découpage vertical strict

Chaque feature traverse les couches suivantes :

Route → Controller → Service → Repository


Jamais sauter une couche.
Jamais mettre de logique dans une mauvaise couche.

3. ▣ TypeScript Style Guide
3.1. Options obligatoires

Le tsconfig.json doit activer :

"strict": true

"noImplicitAny": true"

"strictNullChecks": true

"esModuleInterop": true

"resolveJsonModule": true

"moduleResolution": "node"

3.2. Style TypeScript

✔ Types explicites
✔ Interfaces pour les entités
✔ type pour les aliases
✔ Pas de types implicites
✔ Pas de cast dangereux (as any)

❌ Interdit :

les any

les unknown non contrôlés

les fonctions sans type de retour explicite

les ! (non-null assertion) sauf cas rare

4. ▣ Style de nommage
4.1. Fichiers

*.entity.ts → types métier

*.repository.ts → accès DB

*.service.ts → logique métier

*.controller.ts → HTTP

*.gateway.ts → WhatsApp

*.worker.ts → BullMQ

4.2. Classes

TenantService

AssistantRepository

MessageProcessorWorker

RAGLocalService

4.3. Fonctions

camelCase

verbes en début de fonction

un seul niveau d’abstraction par fonction

Exemples :

✔ createTenant()
✔ getAssistantById()
✔ indexDocumentChunks()

❌ handleTenantStuff()
❌ processData() (trop vague)

4.4. Variables

camelCase pour locaux

UPPER_SNAKE_CASE pour constants

Exemple :

const MAX_CONTEXT_MESSAGES = 12;

5. ▣ Style Drizzle ORM
5.1. Requêtes autorisées

✔ via Drizzle ORM
✔ filtrées systématiquement par tenant_id
✔ jamais dans un controller directement

5.2. Pas de SQL brut sauf :

nécessité de performance vérifiée

besoins de pgvector spécifiques

Dans ce cas → documenter.

5.3. Structure d’un repository
export class AssistantRepository {
  constructor(private db: DrizzleDatabase) {}

  async findById(id: string, tenantId: string) {
    return this.db.query.assistants.findFirst({
      where: and(eq(assistants.id, id), eq(assistants.tenantId, tenantId)),
    });
  }
}

6. ▣ Style Service Layer
6.1. Règles générales

un service = une logique métier cohérente

pas plus de 400 lignes

pas d’appels directs d’un service à un autre : passer par interfaces publiques

6.2. Chaque service doit :

valider les inputs (zod recommandé)

vérifier les permissions tenant

appeler un repository

orchestrer la logique métier

6.3. NE DOIT PAS :

❌ accéder à WhatsApp provider
❌ appeler l’IA
❌ faire de la normalisation métier
❌ gérer la persistence directe

7. ▣ Style Worker (BullMQ)
7.1. Convention de structure
export class MessageProcessorWorker {
  constructor(
    private conversationService: ConversationService,
    private assistantService: AssistantService,
    private ragService: RAGOrchestrator,
    private llm: LLMClient
  ) {}

  async process(job: Job<IncomingMessage>) {
    // ...
  }
}

7.2. Règles

✔ tout message entrant doit passer par la queue
✔ pas de logique dans le webhook
✔ worker = orchestration IA + conversation + usage

❌ jamais envoyer un message WhatsApp depuis le worker directement
→ passer par whatsapp.service.ts

8. ▣ Style RAG
8.1. RAG local (v1)

chunking propre

taille 512–1024 tokens

embeddings Vertex

stockage pgvector

recherche KNN ordonnée par distance

8.2. RAG premium (v2)

Uniquement si :

assistant.rag_mode === 'vertex'

8.3. Interdictions

❌ placer du RAG ailleurs que dans rag/
❌ appels IA dans repository
❌ requêtes sans filtre tenant_id

9. ▣ Style WhatsApp Gateway
9.1. Gateway doit :

✔ valider signature provider
✔ parser correctement message
✔ normaliser structure interne
✔ publier un job dans la queue

9.2. Gateway NE DOIT PAS :

❌ appeler AssistantService
❌ appeler RAG
❌ appeler LLM
❌ toucher la BD
❌ écrire de la logique métier

10. ▣ Style Admin API
10.1. Règles

Endpoints REST JSON simples

Gestion : assistants, channels, tenants, docs, usage

Protéger via auth interne

❌ pas de multi-role complexe dans MVP
❌ pas de GraphQL

11. ▣ Style Logging
11.1. Logger unique

Basé sur Pino

Inclus dans lib/logger.ts

11.2. Règles

logs structurés

pas de console.log

pas d’erreurs silencieuses

logs anonymisés pour end-users

12. ▣ Style Erreurs
12.1. Exception classes
class NotFoundError extends AppError {}
class UnauthorizedError extends AppError {}
class ValidationError extends AppError {}

12.2. Règles

jamais throw directement une chaîne

toujours throw une instance AppError

middleware global d’erreurs dans app/middlewares/errorHandler.ts

13. ▣ Style Config / Env
13.1. Règles

✔ toutes les variables dans config/env.ts
✔ valider via Zod
✔ secrets jamais dans le code

Exemple :

export const env = z.object({
  PORT: z.string(),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  GCP_PROJECT_ID: z.string(),
}).parse(process.env);

14. ▣ Tests
14.1. Types de tests
Unit tests

services

repositories

RAG local

phone normalizer

Integration tests

webhook

gateway parsing

message processor end-to-end

14.2. Règles tests

✔ ne jamais tester le LLM réel
✔ mocker provider WhatsApp
✔ mocker embeddings dans tests RAG
✔ tester isolation tenant

15. ▣ Style Git & Commits
15.1. Convention de commit

feat:

fix:

refactor:

test:

docs:

chore:

Exemples :

feat(assistant): add rag_mode option to assistant config
fix(conversation): prevent cross-tenant retrieval bug
refactor(whatsapp): simplify message normalization
test(rag): add multi-tenant isolation tests

16. ▣ Interaction avec IA (Copilot / ChatGPT / Continue / Claude)
16.1. Tous les outils IA doivent :

charger PROJECT_CONTEXT.md

charger ARCHITECTURE_RULES.md

charger ce guide

analyser avant de coder

16.2. Règles IA

❌ ne jamais générer un nouveau module
❌ ne jamais modifier structure DB
❌ ne jamais ignorer tenantId
❌ ne jamais coder IA directement dans les gateways

✔ proposer des alternatives
✔ respecter les standards
✔ justifier les modifications

17. ▣ Conclusion

Ce guide définit le style officiel de développement SYLION.
La cohérence et l'excellence du code reposent sur son respect strict.

Toute contribution doit être conforme à ce guide.