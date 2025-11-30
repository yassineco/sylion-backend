# 🧪 Sylion Backend – Test Strategy

Stratégie de tests complète pour le backend SylionAI - Plateforme multi-tenant WhatsApp AI assistant avec RAG.

---

## 📋 Objectif du document

Cette stratégie de tests vise à garantir :

- **Stabilité du système** : Détection précoce des régressions lors des évolutions
- **Sécurité multi-tenant** : Isolation parfaite des données entre tenants
- **Protection contre les régressions** : Assurance qualité lors des montées de version
- **Justification ROI** : Optimisation du temps de dev ET de la consommation de tokens IA
- **Confiance déploiement** : Zero-downtime et rollback sécurisé en production

Le testing n'est pas un coût mais un **investissement** qui protège la croissance business et la satisfaction client.

---

## 🎯 Périmètre et principes

### Périmètre de tests

Les domaines critiques couverts par notre stratégie :

- **WhatsApp Gateway & provider layer** : Webhook 360dialog, normalisation messages
- **Core multi-tenant** : tenant, channel, assistant, conversation, message
- **IA & RAG integration** : LLM wrapper, RAG local pgvector, migration Vertex Search
- **Usage & quotas** : Tracking consommation + facturation
- **BullMQ workers** : Message processing + RAG indexer
- **Sécurité & isolation** : Fence tests multi-tenant, protection données

### Principes fondamentaux

1. **"Critical-path first"** : Prioriser les flux métier essentiels
2. **"Mock l'IA, pas la logique métier"** : Stubs LLM par défaut, vrais tests business
3. **"No prod without green tests"** : Déploiement bloqué si tests critiques échouent
4. **"Multi-tenant first-class concern"** : Isolation testée systématiquement
5. **"Token conscious"** : 95%+ mocks IA, golden tests limités et contrôlés

---

## 🔬 Types de tests

### Unit Tests
**Objectif :** Tester la logique métier pure, sans dépendances externes.

**Caractéristiques :**
- Pas de réseau, pas de DB, pas d'IA réelle
- Mocks pour toutes les dépendances
- Exécution rapide (< 1s par test)
- Déterministes et reproductibles

**Exemples concrets :**
```typescript
// WhatsApp message normalization
describe('WhatsAppProvider.normalizeMessage', () => {
  it('should extract phone number and text from 360dialog payload')
  it('should handle missing fields gracefully')
  it('should reject invalid signatures')
})

// Business logic tenant resolution  
describe('TenantService.resolveTenantFromPhone', () => {
  it('should map phone to correct tenant via channel')
  it('should throw error for unknown phone number')
})

// Usage quotas
describe('UsageService.checkQuota', () => {
  it('should allow usage when under limits')
  it('should block usage when quota exceeded')
})
```

### Integration Tests
**Objectif :** Tester les interactions entre composants avec vraies dépendances.

**Caractéristiques :**
- Base de données test réelle (PostgreSQL)
- Redis test instance
- BullMQ workers réels
- Mocks IA maintenus

**Exemples concrets :**
```typescript
// Full message processing pipeline
describe('MessageProcessor Integration', () => {
  it('should process WhatsApp webhook to AI response', async () => {
    // 1. Webhook receives message
    // 2. Queue job created
    // 3. Worker processes message
    // 4. Conversation updated
    // 5. AI stub response generated
    // 6. WhatsApp send called (mocked)
    // 7. Usage recorded
  })
})

// Multi-tenant isolation
describe('Multi-tenant Fence Tests', () => {
  it('tenant A cannot access tenant B conversations')
  it('tenant A cannot access tenant B RAG knowledge')
})
```

### Light End-to-End Tests
**Objectif :** Valider les scénarios métier critiques de bout en bout.

**Caractéristiques :**
- Quelques golden scenarios seulement
- Stack complète mais IA mockée
- Focus sur les parcours utilisateur

**Exemples concrets :**
```typescript
// Golden scenario: New WhatsApp conversation
describe('E2E: New Customer Journey', () => {
  it('unknown phone → new conversation → AI welcome → usage tracked')
})

// Golden scenario: Existing conversation
describe('E2E: Returning Customer', () => {
  it('known phone → existing conversation → context retrieval → AI response')
})
```

---

## 🛠 Outils & configuration

### Test Runner
**Choix :** **Jest** (configuré dans package.json)

**Justification :**
- Écosystème mature TypeScript + Node.js
- Mocking puissant pour dépendances externes
- Coverage reporting intégré
- Parallel execution pour performance

### Structure des dossiers
```
test/
├── unit/
│   ├── modules/
│   │   ├── whatsapp/
│   │   ├── tenant/
│   │   ├── channel/
│   │   ├── conversation/
│   │   ├── message/
│   │   └── assistant/
│   ├── jobs/
│   └── lib/
├── integration/
│   ├── workers/
│   ├── database/
│   └── multi-tenant/
├── e2e/
│   └── scenarios/
├── fixtures/
│   ├── webhooks/
│   └── database/
└── helpers/
    ├── db-setup.ts
    ├── redis-setup.ts
    └── mocks/
```

### Commands standardisées
```bash
npm test              # All tests
npm run test:unit     # Unit tests only  
npm run test:integration  # Integration tests
npm run test:e2e      # End-to-end tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Configuration environnement test
```typescript
// test/helpers/test-env.ts
export const TEST_CONFIG = {
  DATABASE_URL: 'postgresql://test:test@localhost:5433/sylion_test',
  REDIS_URL: 'redis://localhost:6380',
  WHATSAPP_API_KEY: 'test-key',
  VERTEX_PROJECT_ID: 'mock-project',
  LOG_LEVEL: 'error', // Silent pendant tests
}
```

---

## 📦 Priorités par module

### WhatsApp Gateway
**Tests obligatoires :**
```typescript
// Webhook parsing + normalisation
✅ Parse 360dialog payload correctly
✅ Handle malformed webhook gracefully  
✅ Verify webhook signature/token
✅ Normalize message to internal format
✅ Extract phone number → channel mapping

// Error handling
✅ Invalid payload returns 400
✅ Invalid signature returns 401
✅ Unknown phone number handled properly
```

### Tenant & Channel Resolution
**Tests obligatoires :**
```typescript
// Mapping logic
✅ Phone number → Channel → Tenant resolution
✅ Channel not found scenarios
✅ Tenant inactive scenarios

// Multi-tenant isolation
✅ No cross-tenant data access
✅ Channel belongs to single tenant only
✅ Phone number unique per tenant
```

### Conversation & Message
**Tests obligatoires :**
```typescript
// Core business logic
✅ findOrCreateConversation logic
✅ Message history retrieval for LLM context
✅ Conversation state management (active/ended/paused)
✅ Message ordering and pagination

// Data integrity
✅ Messages belong to correct conversation
✅ Conversation belongs to correct tenant
✅ Timestamps and metadata consistency
```

### Assistant Configuration
**Tests obligatoires :**
```typescript
// Assistant resolution
✅ Conversation assistant priority over channel default
✅ Channel default assistant over tenant default
✅ Assistant configuration validation
✅ Prompt template rendering with context
```

### Usage & Quotas
**Tests obligatoires :**
```typescript
// Quota management
✅ Message count tracking per tenant
✅ Token usage recording per conversation
✅ Quota limit checks before processing
✅ Usage aggregation by period (hour/day/month)

// Billing integration
✅ Usage records creation for billing
✅ Plan limits enforcement
✅ Overage calculations
```

### RAG Local (pgvector)
**Tests obligatoires :**
```typescript
// Search isolation
✅ All searches filtered by tenant_id AND knowledge_base_id
✅ No cross-tenant knowledge leaks
✅ Embedding search with relevance threshold
✅ Document chunk retrieval with metadata

// Indexing pipeline
✅ Document upload to GCS
✅ Text extraction and chunking
✅ Embedding generation (mocked)
✅ pgvector storage with proper indexes
```

### BullMQ Workers
**Tests obligatoires :**
```typescript
// MessageProcessor Worker
✅ Job consumption from incoming-messages queue
✅ Tenant/conversation/assistant resolution
✅ Message context preparation for LLM
✅ AI response generation (mocked)
✅ WhatsApp response sending (mocked)
✅ Usage recording
✅ Error handling + retry logic

// RAG Indexer Worker (future)
✅ Document processing job consumption
✅ Text extraction from various formats
✅ Chunking strategy validation
✅ Embedding generation pipeline
✅ pgvector storage with metadata
```

---

## 🤖 Stratégie spécifique IA & tokens

### Principe : "Token-conscious testing"

**Objectif :** Préserver les budgets IA tout en garantissant la qualité.

### 95% Stubs/Mocks par défaut
```typescript
// lib/llm.ts - Version test
export class MockLLMService implements LLMService {
  async generateReply(context: LLMContext): Promise<string> {
    // Réponses déterministes basées sur input patterns
    if (context.messages.includes('bonjour')) {
      return 'Bonjour ! Comment puis-je vous aider ?'
    }
    return 'Merci pour votre message. Un conseiller vous recontactera.'
  }
  
  async generateEmbeddings(text: string): Promise<number[]> {
    // Mock embeddings déterministes (hash-based)
    return generateMockEmbedding(text)
  }
}
```

**Avantages :**
- ✅ Tests déterministes et reproductibles
- ✅ Exécution rapide (pas d'appel réseau)
- ✅ Coût token quasi-nul pour le développement quotidien
- ✅ Focus sur la logique métier, pas sur l'IA

### 5% Golden Tests avec vraie IA
```typescript
// test/integration/ai-golden.spec.ts
describe('AI Integration Golden Tests', () => {
  beforeAll(() => {
    // Skip si RUN_VERTEX_GOLDEN_TESTS !== 'true'
    if (!process.env.RUN_VERTEX_GOLDEN_TESTS) {
      test.skip()
    }
  })
  
  it('should generate contextual response with real Vertex AI', async () => {
    // Test avec vraie API Vertex AI
    // Coût : ~10-50 tokens par test
    // Fréquence : avant release uniquement
  })
})
```

**Usage contrôlé :**
- 🔒 **Disabled par défaut** : `RUN_VERTEX_GOLDEN_TESTS=false`
- 🎯 **On-demand uniquement** : CI release ou validation manuelle
- 💰 **Budget tracking** : Monitoring token consumption
- 🧪 **Validation critiques** : Prompts, modèles, breaking changes API

### Configuration smart des tests IA
```typescript
// test/helpers/ai-setup.ts
export function setupAIForTests() {
  if (process.env.NODE_ENV === 'test' && !process.env.RUN_VERTEX_GOLDEN_TESTS) {
    // Mock all AI services
    mockLLMService()
    mockEmbeddingsService()
    mockVertexAIClient()
  } else {
    // Use real services with test project
    setupVertexAITestProject()
  }
}
```

**ROI Golden Tests :**
- **Détection précoce** : Breaking changes Vertex AI API
- **Validation prompts** : Nouveaux templates d'assistant
- **Monitoring qualité** : Dérive des réponses IA dans le temps
- **Acceptance finale** : Validation avant mise en production

---

## 🗺 Intégration à la roadmap

### Alignment avec `docs/ROADMAP_PHASES.md`

**Phase 1 - Squelette Backend** ✅
- ✅ Setup Jest test runner
- ✅ Configuration environnement test
- ✅ Premier test sample validation

**Phase 2 - WhatsApp Gateway + Message Processor** ✅  
- ✅ Tests WhatsApp Gateway (webhook parsing)
- ✅ Tests MessageProcessor Worker
- ✅ Tests mapping phone → tenant
- ✅ Tests multi-tenant fence basiques

**Phase 2.5 - Tests critiques (OBLIGATOIRE)** 🔴
- 🔴 Test suite complète modules core
- 🔴 Integration tests BullMQ pipeline  
- 🔴 Multi-tenant fence tests complets
- 🔴 Quality gate : **100% tests critiques VERTS**

**Phase 3 - RAG System + Vertex AI** 🔴
- 🔴 Tests RAG local pgvector + isolation tenant
- 🔴 Tests migration LLM stub → Vertex AI
- 🔴 Golden tests IA (contrôlés)
- 🔴 Tests embedding pipeline

**Phase 4+ - Production & Analytics** 🔴
- 🔴 Tests monitoring & health checks
- 🔴 Tests analytics & usage reporting
- 🔴 Tests load & performance basiques
- 🔴 Tests backup & restore

### Quality Gate par Phase
**Phase 2.5 → Phase 3 :**
- ✅ All critical unit tests GREEN  
- ✅ Multi-tenant fence tests GREEN
- ✅ MessageProcessor integration GREEN
- ⚠️ Golden tests optionnels (pre-release)

**Phase 3 → Phase 4 :**
- ✅ RAG isolation tests GREEN
- ✅ Vertex AI integration tests GREEN
- ✅ Golden tests IA validation GREEN
- ✅ Performance tests baseline GREEN

---

## 🎯 Quality Gate & KPIs

### Conditions obligatoires avant production

**Tests critiques (bloquants) :**
- [ ] ✅ **All unit tests GREEN** (modules core)
- [ ] ✅ **Multi-tenant fence tests GREEN** (zero cross-tenant access)
- [ ] ✅ **RAG local tests GREEN** (pgvector isolation)
- [ ] ✅ **MessageProcessor integration GREEN** (pipeline complet)
- [ ] ✅ **WhatsApp Gateway tests GREEN** (webhook + mapping)

**Tests validation (recommandés) :**
- [ ] 🟡 **Golden tests IA GREEN** (si activés)
- [ ] 🟡 **Performance tests baseline** (latency < seuils)
- [ ] 🟡 **Load tests light** (charge normale)

### KPIs de monitoring

**Couverture de code :**
- 🎯 **>90% coverage modules critiques** (tenant, channel, conversation, message)
- 🎯 **>80% coverage workers** (messageProcessor)
- 🎯 **>70% coverage global** (hors mocks et fixtures)

**Qualité tests :**
- 📊 **Nombre de prod bugs liés à régressions** (objectif : 0)
- 📊 **Temps d'exécution test suite** (objectif : <2min)
- 📊 **Flakiness rate** (tests instables, objectif : <1%)

**Coût IA :**
- 💰 **Tokens consommés en tests quotidiens** (objectif : <100)
- 💰 **Tokens golden tests par release** (objectif : <1000)
- 💰 **ROI tests vs bugs évités** (tracking business impact)

### Dashboard tests (future)
```typescript
// Métriques à tracker
export interface TestMetrics {
  totalTests: number
  passRate: number
  avgExecutionTime: number
  coveragePercent: number
  flakyTests: string[]
  tokensCostDaily: number
  tokensGoldenTests: number
  lastGreenBuild: Date
}
```

### Alerts & Actions
**Test failures :**
- 🚨 **Critical tests fail** → Block deployment automatiquement
- ⚠️ **Flaky tests detected** → Issue auto-créée pour investigation
- 💰 **Token budget dépassé** → Disable golden tests temporairement

**Performance degradation :**
- 📈 **Test suite >3min** → Investigation performance requise
- 📉 **Coverage <80%** → Review code + tests manquants
- 🐛 **Prod bug from regression** → Post-mortem + renforcement tests

---

## 🚀 Commandes quick start

```bash
# Setup initial
npm install
npm run test:setup  # Create test DBs + Redis

# Development workflow  
npm run test:watch  # Watch mode pendant le dev
npm run test:unit   # Tests rapides avant commit
npm test            # Full suite avant push

# Pre-release validation
RUN_VERTEX_GOLDEN_TESTS=true npm test  # Include AI golden tests
npm run test:coverage                   # Coverage report
npm run test:e2e                        # End-to-end scenarios

# CI/CD integration
npm run test:ci     # Optimisé pour CI (parallel, no watch)
npm run test:report # Génère rapport pour pipeline
```

---

## 📚 Ressources & références

- **Jest Documentation** : https://jestjs.io/docs/getting-started
- **Drizzle Testing** : https://orm.drizzle.team/docs/tests
- **BullMQ Testing** : https://docs.bullmq.io/guide/testing
- **Vertex AI Testing** : https://cloud.google.com/vertex-ai/docs/testing

**Internal docs :**
- `docs/ROADMAP_PHASES.md` - Intégration tests par phase
- `docs/AUDIT_CHECKLIST.md` - Quality gates pré-commit
- `docs/ENGINEERING_RULES.md` - Standards code + tests
- `docs/SECURITY_GUIDE.md` - Tests sécurité multi-tenant

---

> **Next Action :** Implémentation Phase 2.5 - Tests critiques  
> **Priority :** Setup test runner + premiers tests multi-tenant fence  
> **Goal :** Quality gate GREEN avant Phase 3 RAG