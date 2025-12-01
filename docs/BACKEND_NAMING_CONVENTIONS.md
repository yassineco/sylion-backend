# 🦁 BACKEND_NAMING_CONVENTIONS.md
**Version : 1.0**  
**Projet : SYLION WhatsApp Assistant**  
**Rôle : Standard officiel de nommage (fichiers, classes, fonctions, colonnes DB, queues, etc.)**

Ce document définit **toutes les conventions de nommage** pour le backend SYLION.  
Il doit être appliqué par **tous les développeurs** et **tous les outils d’IA**.

---

# 1. 🌍 Principes généraux

1. Noms **clairs, explicites, sans ambiguïté**  
2. Préférer la **lisibilité** à la concision extrême  
3. Alignement strict avec :
   - `PROJECT_CONTEXT.md`
   - `ARCHITECTURE_RULES.md`
   - `ENGINEERING_STYLE_GUIDE.md`
4. Pas de mélange franco-anglais dans le code → **tout en anglais** (sauf commentaires si besoin)

---

# 2. 📁 Nommage des dossiers & modules

## 2.1. Modules métiers (dans `src/modules/`)

Les noms de dossiers sont en **kebab-case** (ou simple nom) et reflètent un **bounded context** :

```text
src/modules/
├─ tenant/
├─ channel/
├─ assistant/
├─ whatsapp/
├─ conversation/
├─ message/
├─ knowledge/
├─ rag/
├─ usage/
├─ admin/
❌ Interdit :

src/modules/whatsApp/

src/modules/Assistant/

src/modules/ragService/

3. 📄 Nommage des fichiers TypeScript
3.1. Fichiers par rôle
Format : <nom>.role.ts en kebab-case.

Rôles acceptés :

*.entity.ts → types métier / entités logiques

*.schema.ts → schémas Drizzle

*.repository.ts → accès DB

*.service.ts → logique métier

*.controller.ts → HTTP

*.gateway.ts → Entrée provider (ex: WhatsApp)

*.worker.ts → BullMQ workers

*.types.ts → types auxiliaires

index.ts → façade de module

Exemples corrects :

text
Copier le code
assistant.entity.ts
assistant.repository.ts
assistant.service.ts

whatsapp.gateway.ts
whatsapp.provider.ts
whatsapp.types.ts

rag.local.service.ts
rag.vertex.service.ts
rag.orchestrator.ts
❌ Faux :

AssistantService.ts

whatsappService.ts

RAGLocal.ts

db.ts (non descriptif dans un module métier)

4. 🧱 Nommage des classes
4.1. Règle générale
PascalCase

suffixe par rôle

un nom = un concept clair

Forme :
<Domaine><Rôle>

Exemples :

TenantService

ChannelService

AssistantRepository

ConversationService

MessageRepository

RAGLocalService

RAGVertexService

RAGOrchestrator

WhatsAppGateway

WhatsAppProvider360Dialog

UsageService

❌ Interdit :

ServiceTenant

MyService

Processor

Helper

5. 🧠 Nommage des fonctions
5.1. Fonctions métiers
Toujours en camelCase, toujours verbales (action).

Forme recommandée :
<verbe><Complément>
ou
getX, createX, updateX, deleteX, findX, listX

Exemples :

ts
Copier le code
createTenant()
getTenantById()
updateChannelConfig()
deleteAssistant()
listConversationsByTenant()
recordUsage()
checkQuotaBeforeLLMCall()
normalizeWhatsAppIncomingMessage()
buildLLMContextFromMessages()
indexDocumentChunks()
searchRelevantChunks()
❌ Interdit :

doTenant()

handleStuff()

processData()

run()

5.2. Fonctions asynchrones
Toujours suffixées d’un verbe explicite, mais pas besoin de Async sauf cas ambigus.

✔ createTenant() (async OK)
✔ fetchEmbeddingsFromVertex()

❌ createTenantAsync() (sauf besoin particulier ou API externe)

6. 🔡 Nommage des variables
6.1. Variables locales & paramètres
camelCase

déclarer avec const par défaut, let si réassignation nécessaire

noms explicites, pas de a, b, res sauf pour des boucles ultra locales

Exemples :

ts
Copier le code
const tenantId = input.tenantId;
const assistantConfig = await this.assistantRepository.findById(id, tenantId);
const messages = await this.messageRepository.listRecent(conversationId, limit);
const ragChunks = await this.ragService.search(question, assistantConfig);
❌ Interdit :

ts
Copier le code
const t = input.tenantId;
let obj = {};
const data2 = await repo.get(id);
6.2. Constantes
UPPER_SNAKE_CASE

Définies dans le module où elles sont pertinentes, ou dans un fichier dédié si partagé

Exemples :

ts
Copier le code
const MAX_CONTEXT_MESSAGES = 12;
const DEFAULT_RAG_TOP_K = 5;
const MAX_MESSAGES_PER_DAY_STARTER = 1000;
7. 🗃️ Nommage des types & interfaces
7.1. Interfaces métier
PascalCase

Préfixe I facultatif → on évite en général

Exemples :

ts
Copier le code
export interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
}

export interface IncomingWhatsAppMessage {
  from: string;
  to: string;
  text: string;
  providerMessageId: string;
  timestamp: Date;
}
7.2. Types alias
PascalCase

pour des unions ou des formes composées

ts
Copier le code
export type SenderType = 'user' | 'assistant' | 'agent';

export type RAGMode = 'local' | 'vertex';
❌ Interdit :

type rag_mode = ...

interface tenantInterface { ... }

8. 🗄️ Nommage de la base de données (Drizzle / PostgreSQL)
8.1. Tables
snake_case

pluriel

cohérent avec les modules

Exemples :

text
Copier le code
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
❌ Interdit :

Tenant

AssistantTable

knowledgeBase

8.2. Colonnes
snake_case

pas d’abréviations opaques

clés étrangères explicites : <table>_id

Exemples :

text
Copier le code
tenant_id
channel_id
assistant_id
conversation_id
message_id
created_at
updated_at
status
rag_mode
embedding
metadata
❌ Interdit :

tenantId dans la DB

id_tenant

ts_created

8.3. Types vectoriels (RAG)
colonne embeddings :

sql
Copier le code
embedding vector(1536)
nom de colonne : embedding (ou embedding_vector si besoin)

9. 📬 Nommage des queues & jobs (BullMQ)
9.1. Noms de queues
kebab-case

explicites

Exemples :

ts
Copier le code
'incoming-messages'
'rag-indexing'
'notifications'
9.2. Noms de jobs
kebab-case

reflètent l’action

Exemples :

ts
Copier le code
'process-whatsapp-message'
'index-document'
'backfill-rag-chunks'
10. 🌐 Nommage des endpoints HTTP
10.1. Endpoints publics API admin
REST, kebab-case, ressources au pluriel

Exemples :

text
Copier le code
GET    /api/admin/tenants
POST   /api/admin/tenants
GET    /api/admin/tenants/:tenantId

GET    /api/admin/assistants
POST   /api/admin/assistants
GET    /api/admin/assistants/:assistantId

POST   /api/admin/knowledge/documents
GET    /api/admin/knowledge/documents
10.2. Webhook WhatsApp
endpoint dédié, fixe :

text
Copier le code
POST /whatsapp/webhook
❌ Interdit :

/wa-hook

/api/whatsappHook

/webhook

11. 🌊 Nommage des configs & variables d’environnement
11.1. Variables d’env
UPPER_SNAKE_CASE

préfixes par domaine utiles (optionnel)

Exemples :

text
Copier le code
NODE_ENV=production
PORT=3000

DATABASE_URL=...

REDIS_URL=...

GCP_PROJECT_ID=...
GCP_LOCATION=...
GCP_VERTEX_MODEL_ID=...

WHATSAPP_PROVIDER=360dialog
WHATSAPP_API_KEY=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_WABA_ID=...
WHATSAPP_VERIFY_TOKEN=...
❌ Interdit :

dbUrl

myKey

token

12. 🧪 Nommage des tests
12.1. Fichiers de test
kebab-case

suffixe .unit.test.ts ou .int.test.ts

Exemples :

text
Copier le code
normalize-phone-number.unit.test.ts
whatsapp-gateway.unit.test.ts
message-processor.int.test.ts
rag-local-service.unit.test.ts
multi-tenant-security.int.test.ts
12.2. Suites & cas
Dans Jest :

ts
Copier le code
describe('normalizePhoneNumber', () => {
  it('should add plus prefix for raw local number', () => { ... });
});
describe → fonction / module

it → comportement explicite

13. 🤖 Nommage côté IA & prompts internes
Même si ce n’est pas du code exécuté, garder la cohérence :

noms d’agents : sylion-backend-architect, sylion-rag-analyst

noms de fichiers prompts : assistant.system_prompt.md, sylion_coding_prompt.md

pas de noms vagues : ai-helper.txt

14. ✅ Résumé des règles clés
Modules : dossiers simples (tenant/, assistant/, whatsapp/)

Fichiers : kebab-case + suffixe par rôle (*.service.ts, *.repository.ts)

Classes : PascalCase + suffixe rôle (TenantService, RAGLocalService)

Fonctions : camelCase + verbe (createTenant, searchChunks)

Variables : camelCase, explicites

Constantes : UPPER_SNAKE_CASE

DB : tables & colonnes en snake_case

Queues/Jobs : kebab-case

Endpoints : REST, /api/admin/..., en kebab-case

Env : UPPER_SNAKE_CASE, explicites

15. 🦁 Conclusion
Ce document fournit le langage commun du backend SYLION.
Il garantit que :

tous les fichiers sont faciles à retrouver

tous les modules sont compréhensibles

les IA (Copilot, ChatGPT, Cursor…) peuvent naviguer efficacement dans le code

la maintenance à long terme est réaliste

Toute nouvelle contribution doit être conforme à ces conventions.