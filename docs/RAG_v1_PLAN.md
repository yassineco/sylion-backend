# 🧠 RAG v1 - Plan Technique Détaillé

> **Phase 3 : Retrieval-Augmented Generation pour WhatsApp**  
> **Date** : 2 décembre 2025  
> **Statut** : En cours de développement  
> **Dépendance** : Phase 2.5 (Boss 1) ✅ Complétée

---

## 📋 Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture RAG v1](#2-architecture-rag-v1)
3. [Schéma de Base de Données](#3-schéma-de-base-de-données)
4. [Nouveaux Fichiers](#4-nouveaux-fichiers)
5. [Modifications Fichiers Existants](#5-modifications-fichiers-existants)
6. [Workflow Complet](#6-workflow-complet)
7. [Jobs BullMQ](#7-jobs-bullmq)
8. [Plan de Tests](#8-plan-de-tests)
9. [Commandes d'Initialisation](#9-commandes-dinitialisation)
10. [Checklist de Livraison](#10-checklist-de-livraison)

---

## 1. Vue d'ensemble

### 1.1 Objectif

Permettre aux assistants IA Sylion de répondre aux messages WhatsApp en s'appuyant sur une base documentaire propre à chaque tenant. Le système recherche automatiquement les informations pertinentes dans les documents indexés et les injecte dans le contexte du LLM.

### 1.2 Principes de Design

| Principe | Description |
|----------|-------------|
| **Minimaliste** | MVP fonctionnel, pas d'over-engineering |
| **Compatible** | S'intègre dans l'existant sans casser |
| **pgvector natif** | SQL simple, pas d'ORM exotique |
| **Multi-tenant strict** | Isolation totale des documents par tenant |
| **Asynchrone** | Jobs BullMQ pour l'indexation (non-bloquant) |

### 1.3 Décisions Techniques

| Composant | Choix | Justification |
|-----------|-------|---------------|
| Embeddings | Vertex AI `text-embedding-004` | 768 dimensions, multilingue, GCP natif |
| Vector DB | PostgreSQL + pgvector | Déjà en place, pas de service externe |
| Index | IVFFLAT | Bon compromis performance/simplicité pour MVP |
| Chunking | 500 tokens, overlap 50 | Standard efficace pour RAG |
| Seuil similarité | Configurable par assistant (défaut 0.7) | Flexibilité par use case |

---

## 2. Architecture RAG v1

### 2.1 Diagramme de Flux

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE RAG v1                                    │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════╗     ╔═══════════════════╗     ╔═══════════════════╗
║  INDEXATION       ║     ║  RETRIEVAL        ║     ║  GENERATION       ║
║  (Async Job)      ║     ║  (Sync)           ║     ║  (Sync)           ║
╠═══════════════════╣     ╠═══════════════════╣     ╠═══════════════════╣
║                   ║     ║                   ║     ║                   ║
║  Document Upload  ║     ║  User Message     ║     ║  RAG Context      ║
║       ↓           ║     ║       ↓           ║     ║       +           ║
║  Text Extraction  ║     ║  Query Embedding  ║     ║  User Message     ║
║       ↓           ║     ║       ↓           ║     ║       ↓           ║
║  Chunking         ║     ║  Vector Search    ║     ║  LLM Prompt       ║
║  (500 tokens)     ║     ║  (cosine sim)     ║     ║       ↓           ║
║       ↓           ║     ║       ↓           ║     ║  AI Response      ║
║  Embedding        ║     ║  Score & Filter   ║     ║       ↓           ║
║  (Vertex AI)      ║     ║  (threshold)      ║     ║  WhatsApp Send    ║
║       ↓           ║     ║       ↓           ║     ║                   ║
║  Store in DB      ║     ║  Build Context    ║     ║                   ║
║                   ║     ║                   ║     ║                   ║
╚═══════════════════╝     ╚═══════════════════╝     ╚═══════════════════╝
        │                         │                         │
        └─────────────────────────┴─────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │    PostgreSQL + pgvector   │
                    │    (document_chunks)       │
                    └───────────────────────────┘
```

### 2.2 Composants

```
src/
├── lib/
│   ├── embedding.ts              # Service Vertex AI embeddings
│   └── llm.ts                    # (modifié) Support contexte RAG
├── modules/
│   └── rag/
│       ├── index.ts              # Export centralisé
│       ├── rag.types.ts          # Types et interfaces
│       ├── rag.service.ts        # Logique RAG (search, score, context)
│       ├── document.service.ts   # Gestion documents
│       └── chunker.ts            # Chunking intelligent
├── jobs/
│   ├── index.ts                  # (modifié) Import handlers RAG
│   ├── messageProcessor.worker.ts # (modifié) Intégration RAG
│   └── rag.worker.ts             # Handlers jobs RAG
drizzle/
└── 0002_add_vector_column.sql    # Migration pgvector
```

---

## 3. Schéma de Base de Données

### 3.1 Table `documents` (existante)

```sql
-- Déjà en place, pas de modification
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,              -- pdf, docx, txt, html
  size INTEGER NOT NULL,                   -- bytes
  hash VARCHAR(64) NOT NULL UNIQUE,        -- SHA-256
  storage_url TEXT NOT NULL,               -- GCS URL
  status VARCHAR(50) DEFAULT 'pending',    -- pending, processing, indexed, failed
  chunk_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 Table `document_chunks` (à migrer)

```sql
-- Migration: Conversion embedding TEXT → VECTOR(768)
ALTER TABLE document_chunks 
  DROP COLUMN IF EXISTS embedding;

ALTER TABLE document_chunks 
  ADD COLUMN embedding vector(768);

-- Index IVFFLAT pour recherche rapide
CREATE INDEX document_chunks_embedding_idx 
  ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Index composite pour filtrage tenant
CREATE INDEX document_chunks_tenant_embedding_idx 
  ON document_chunks (tenant_id);
```

### 3.3 Table `assistants` (champs RAG existants)

```sql
-- Déjà en place
enable_rag BOOLEAN DEFAULT FALSE,
rag_threshold DECIMAL(3,2) DEFAULT 0.7,
rag_max_results INTEGER DEFAULT 5,
rag_config JSONB DEFAULT '{}'
```

---

## 4. Nouveaux Fichiers

### 4.1 `src/lib/embedding.ts`

**Responsabilité** : Génération d'embeddings via Vertex AI

```typescript
// Fonctions exportées :
generateEmbedding(text: string): Promise<number[]>
generateBatchEmbeddings(texts: string[]): Promise<number[][]>

// Configuration :
- Model: text-embedding-004
- Dimensions: 768
- Batch size max: 250 textes
- Rate limiting intégré
```

### 4.2 `src/modules/rag/rag.types.ts`

**Responsabilité** : Types et interfaces RAG

```typescript
// Types principaux :
interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata: Record<string, any>;
}

interface RagSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

interface RagContext {
  chunks: RagSearchResult[];
  totalTokens: number;
  documentsUsed: string[];
  searchQuery: string;
}

interface ChunkingOptions {
  chunkSize: number;      // défaut: 500
  overlap: number;        // défaut: 50
  minChunkSize: number;   // défaut: 100
}

interface RagSearchOptions {
  maxResults: number;     // défaut: 5
  threshold: number;      // défaut: 0.7
  maxContextTokens: number; // défaut: 2000
}
```

### 4.3 `src/modules/rag/chunker.ts`

**Responsabilité** : Découpage intelligent du texte

```typescript
// Fonctions exportées :
chunkText(text: string, options?: ChunkingOptions): TextChunk[]
estimateTokenCount(text: string): number

// Algorithme :
1. Split par paragraphes/sections
2. Regroupe jusqu'à chunkSize tokens
3. Ajoute overlap avec chunk précédent
4. Filtre chunks < minChunkSize
```

### 4.4 `src/modules/rag/document.service.ts`

**Responsabilité** : Gestion du cycle de vie des documents

```typescript
// Fonctions exportées :
uploadDocument(tenantId, file, metadata): Promise<Document>
processDocument(documentId): Promise<void>
getDocumentsByTenant(tenantId): Promise<Document[]>
getDocumentById(documentId, tenantId): Promise<Document | null>
deleteDocument(documentId, tenantId): Promise<void>
reindexDocument(documentId): Promise<void>

// Workflow interne :
1. Sauvegarde fichier (GCS ou local pour MVP)
2. Calcul hash SHA-256 (déduplication)
3. Création entrée DB status='pending'
4. Ajout job 'rag:index-document' à la queue
```

### 4.5 `src/modules/rag/rag.service.ts`

**Responsabilité** : Cœur du système RAG

```typescript
// Fonctions exportées :
searchSimilarChunks(tenantId, queryEmbedding, options): Promise<RagSearchResult[]>
buildRagContext(chunks, maxTokens): RagContext
getRelevantContext(tenantId, assistantId, userMessage): Promise<RagContext | null>
formatContextForPrompt(context: RagContext): string

// Requête pgvector :
SELECT 
  dc.id,
  dc.document_id,
  dc.content,
  dc.metadata,
  d.name as document_name,
  1 - (dc.embedding <=> $1::vector) as similarity
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE dc.tenant_id = $2
  AND d.status = 'indexed'
ORDER BY dc.embedding <=> $1::vector
LIMIT $3;
```

### 4.6 `src/modules/rag/index.ts`

**Responsabilité** : Export centralisé

```typescript
export * from './rag.types';
export * from './rag.service';
export * from './document.service';
export * from './chunker';
```

### 4.7 `src/jobs/rag.worker.ts`

**Responsabilité** : Handlers des jobs RAG

```typescript
// Handlers :
processRagIndexDocument(job): Promise<void>
  - Récupère document par ID
  - Extrait texte (selon type)
  - Découpe en chunks
  - Génère embeddings (batch)
  - Insère dans document_chunks
  - Met à jour document.status='indexed'

processRagUpdateEmbeddings(job): Promise<void>
  - Supprime anciens chunks
  - Relance indexation complète
```

---

## 5. Modifications Fichiers Existants

### 5.1 `src/jobs/index.ts`

```typescript
// Ajouter import :
import { processRagIndexDocument, processRagUpdateEmbeddings } from './rag.worker';

// Modifier jobHandlers :
const jobHandlers = {
  // ... existants ...
  
  // RAG jobs - IMPLÉMENTÉS
  'rag:index-document': processRagIndexDocument,
  'rag:update-embeddings': processRagUpdateEmbeddings,
  'rag:search-similar': async () => {
    // Non utilisé directement (appel sync dans le worker)
    throw new Error('rag:search-similar is not a queued job');
  },
};
```

### 5.2 `src/jobs/messageProcessor.worker.ts`

```typescript
// Dans generateReply() :

async function generateReply(context: MessageProcessorContext): Promise<string> {
  // ... code existant pour récupérer l'historique ...

  // NOUVEAU : Récupération contexte RAG si activé
  let ragContext: RagContext | null = null;
  const assistant = await assistantService.getAssistantById(context.assistantId, context.tenantId);
  
  if (assistant?.enableRag) {
    ragContext = await ragService.getRelevantContext(
      context.tenantId,
      context.assistantId,
      context.message.text || ''
    );
    
    if (ragContext && ragContext.chunks.length > 0) {
      logger.info('RAG context found', {
        conversationId: context.conversationId,
        chunksFound: ragContext.chunks.length,
        documentsUsed: ragContext.documentsUsed,
      });
    }
  }

  // Générer la réponse avec contexte RAG
  const reply = await generateAssistantReply({
    tenantId: context.tenantId,
    assistantId: context.assistantId,
    messages,
    ragContext: ragContext ? ragService.formatContextForPrompt(ragContext) : undefined,
  });

  return reply;
}
```

### 5.3 `src/lib/llm.ts`

```typescript
// Modifier interface GenerateReplyOptions :
export interface GenerateReplyOptions {
  tenantId: string;
  assistantId: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  ragContext?: string;  // NOUVEAU
}

// Dans generateAssistantReply() :
// Ajouter le contexte RAG au prompt système si présent
if (options.ragContext) {
  const ragPromptSection = `

## Contexte Documentaire (RAG)
Les informations suivantes proviennent de la base documentaire du client.
Utilisez-les pour répondre de manière précise et factuelle.

${options.ragContext}

---
`;
  systemPrompt = ragPromptSection + systemPrompt;
}
```

---

## 6. Workflow Complet

### 6.1 Indexation de Document

```
1. Admin upload document (API future ou seed)
       ↓
2. documentService.uploadDocument()
   - Sauvegarde fichier
   - Calcul hash
   - Création entrée DB (status=pending)
       ↓
3. Queue job 'rag:index-document'
       ↓
4. rag.worker.processRagIndexDocument()
   - Lecture fichier
   - Extraction texte
   - chunker.chunkText()
   - embedding.generateBatchEmbeddings()
   - Insert document_chunks
   - Update document.status='indexed'
       ↓
5. Document prêt pour recherche
```

### 6.2 Message WhatsApp avec RAG

```
1. Webhook WhatsApp reçu
       ↓
2. gateway.normalizeIncomingWhatsApp()
       ↓
3. Queue 'incoming-message'
       ↓
4. messageProcessor.processIncomingMessage()
       ↓
5. resolveMessageContext()
   - Trouve tenant, channel, conversation
   - Résout assistant (avec config RAG)
       ↓
6. generateReply()
   │
   ├─ [Si assistant.enableRag = true]
   │      ↓
   │  ragService.getRelevantContext()
   │      ↓
   │  embedding.generateEmbedding(userMessage)
   │      ↓
   │  ragService.searchSimilarChunks()
   │      ↓
   │  ragService.buildRagContext()
   │      ↓
   │  ragService.formatContextForPrompt()
   │
   └─→ llm.generateAssistantReply(messages, ragContext)
       ↓
7. saveAssistantMessage() + ragResults
       ↓
8. sendReplyToWhatsApp()
       ↓
9. Message livré avec contexte documentaire
```

---

## 7. Jobs BullMQ

### 7.1 Définition des Jobs

```typescript
// Dans src/jobs/index.ts

export interface JobTypes {
  // ... existants ...

  'rag:index-document': {
    tenantId: string;
    documentId: string;
    documentUrl: string;
    metadata: {
      name: string;
      type: string;
      size: number;
      uploadedBy: string;
    };
  };

  'rag:update-embeddings': {
    tenantId: string;
    documentId: string;
  };
}
```

### 7.2 Configuration Queue RAG

```typescript
// Déjà en place dans src/jobs/index.ts
rag: new Queue(QueueNames.RAG, {
  ...baseQueueConfig,
  defaultJobOptions: {
    priority: 3,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
}),
```

---

## 8. Plan de Tests

### 8.1 Tests Unitaires

| Fichier | Couverture |
|---------|------------|
| `test/unit/chunker.unit.test.ts` | chunkText(), estimateTokenCount(), edge cases |
| `test/unit/embedding.unit.test.ts` | generateEmbedding() mock, batch, erreurs |
| `test/unit/rag-scoring.unit.test.ts` | buildRagContext(), formatContextForPrompt() |

### 8.2 Tests Intégration

| Fichier | Couverture |
|---------|------------|
| `test/integration/rag-index.int.test.ts` | Pipeline complet indexation |
| `test/integration/rag-search.int.test.ts` | Recherche pgvector, scoring |
| `test/integration/rag-tenant-fence.int.test.ts` | Isolation multi-tenant |

### 8.3 Test E2E

| Fichier | Scénario |
|---------|----------|
| `test/integration/whatsapp-rag.e2e.test.ts` | Message WhatsApp → RAG → Réponse contextualisée |

### 8.4 Scénarios de Test Détaillés

#### Test Unitaire : Chunker
```typescript
describe('chunker', () => {
  it('should chunk text into 500-token segments with 50 overlap');
  it('should handle short texts (< minChunkSize)');
  it('should preserve paragraph boundaries when possible');
  it('should count tokens accurately (UTF-8)');
  it('should handle empty text gracefully');
});
```

#### Test Intégration : RAG Search
```typescript
describe('RAG Search', () => {
  it('should find relevant chunks for a query');
  it('should respect threshold filtering');
  it('should limit results to maxResults');
  it('should order by similarity score DESC');
  it('should only search within tenant documents');
});
```

#### Test E2E : WhatsApp + RAG
```typescript
describe('WhatsApp RAG E2E', () => {
  beforeAll(async () => {
    // Seed: tenant, assistant (enableRag=true), document indexé
  });

  it('should respond with document context to WhatsApp message', async () => {
    // 1. Envoyer webhook WhatsApp avec question
    // 2. Vérifier réponse contient info du document
    // 3. Vérifier message.ragUsed = true
    // 4. Vérifier message.ragResults contient chunks utilisés
  });
});
```

---

## 9. Commandes d'Initialisation

### 9.1 Migration Base de Données

```bash
# Créer le fichier de migration
cat > drizzle/0002_add_vector_column.sql << 'EOF'
-- Migration: Add vector column to document_chunks
-- Required: pgvector extension already installed

-- Remove old text-based embedding column
ALTER TABLE document_chunks 
  DROP COLUMN IF EXISTS embedding;

-- Add vector column (768 dimensions for text-embedding-004)
ALTER TABLE document_chunks 
  ADD COLUMN embedding vector(768);

-- Create IVFFLAT index for fast similarity search
-- lists=100 is good for up to ~1M vectors
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
  ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Ensure tenant filtering is fast
CREATE INDEX IF NOT EXISTS document_chunks_tenant_idx 
  ON document_chunks (tenant_id);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS document_chunks_tenant_doc_idx 
  ON document_chunks (tenant_id, document_id);
EOF

# Appliquer la migration
npm run db:push
```

### 9.2 Installation Dépendances

```bash
# Aucune nouvelle dépendance requise
# @google-cloud/vertexai déjà installé
# pg (via postgres) supporte pgvector nativement
```

### 9.3 Variables d'Environnement

```bash
# Vérifier .env.local contient :
VERTEX_AI_LOCATION=us-central1
VERTEX_EMBEDDING_MODEL=text-embedding-004
GCP_PROJECT_ID=<your-project>
GCP_SERVICE_ACCOUNT_KEY=<json-key>
```

### 9.4 Seed de Test

```bash
# Créer un script de seed pour test RAG
cat > scripts/seed-rag-test.ts << 'EOF'
// Script pour seeder un document de test
// Usage: npx tsx scripts/seed-rag-test.ts
EOF
```

### 9.5 Lancer les Tests

```bash
# Tests unitaires RAG
npm run test:unit -- --grep "chunker|embedding|rag"

# Tests intégration RAG
npm run test:integration -- --grep "rag"

# Tous les tests
npm test
```

---

## 10. Checklist de Livraison

### Phase 3.1 : Infrastructure (Semaine 1)

- [ ] Migration pgvector (colonne vector)
- [ ] `src/lib/embedding.ts` implémenté
- [ ] `src/modules/rag/chunker.ts` implémenté
- [ ] `src/modules/rag/rag.types.ts` implémenté
- [ ] Tests unitaires chunker ✅
- [ ] Tests unitaires embedding ✅

### Phase 3.2 : Services RAG (Semaine 1-2)

- [ ] `src/modules/rag/rag.service.ts` implémenté
- [ ] `src/modules/rag/document.service.ts` implémenté
- [ ] `src/jobs/rag.worker.ts` implémenté
- [ ] Tests intégration index ✅
- [ ] Tests intégration search ✅

### Phase 3.3 : Intégration Pipeline (Semaine 2)

- [ ] `messageProcessor.worker.ts` modifié
- [ ] `llm.ts` modifié (support ragContext)
- [ ] `jobs/index.ts` modifié (handlers RAG)
- [ ] Test E2E WhatsApp + RAG ✅

### Phase 3.4 : Validation Finale

- [ ] Test multi-tenant isolation ✅
- [ ] Documentation mise à jour
- [ ] Code review
- [ ] Merge main

---

## 📝 Notes Importantes

### Limitations MVP

1. **Pas d'API upload** : Documents seedés manuellement ou via script
2. **Extraction texte basique** : Supporte .txt, .md pour le MVP
3. **Pas de PDF/DOCX** : Sera ajouté en Phase 3.5
4. **Un seul modèle embedding** : text-embedding-004 uniquement

### Évolutions Futures (Phase 3.5+)

1. API REST upload documents
2. Extraction PDF/DOCX (pdf-parse, mammoth)
3. Reranking avec cross-encoder
4. Hybrid search (vector + BM25)
5. Interface admin console pour gestion docs

---

**Document créé le** : 2 décembre 2025  
**Auteur** : GitHub Copilot (Claude Opus 4.5)  
**Validé par** : En attente validation finale
