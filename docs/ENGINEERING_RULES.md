# 🧱 Sylion Backend – Règles d’Ingénierie

Ce document définit les standards d’ingénierie appliqués au projet **sylion-backend**, le backend central de la plateforme SylionAI.  
Il s’agit de la référence technique à respecter pour préserver la qualité, la cohérence et l’évolution long terme du système.

---

# 1. Objectifs du backend

Le projet **sylion-backend** gère :

- la logique métier multi-tenant
- les assistants (prompting, configs IA, quotas)
- les channels (WhatsApp, prochainement Web & Voice)
- les messages, conversations, jobs asynchrones
- l’intégration RAG (pgvector + Vertex Embeddings)
- la gouvernance usage / quotas / plans pricing

Le backend doit être **simple, robuste, modulaire et scalable**.

---

# 2. Architecture globale

```
src/
  app/         → serveur, routes, middlewares
  modules/     → logique domaine (tenant, channel…)
  lib/         → outils génériques (logger, redis, http)
  db/          → Drizzle ORM, migrations, connexions
  jobs/        → workers BullMQ
  config/      → gestion stricte des env
```

### Principes clés

1. **Separation of Concerns**
   - app = wiring + serveur
   - modules = business logic
   - lib = outils génériques
   - db = accès persistant
   - jobs = taches async / IA / RAG

2. **Domain-Driven Design léger**
   - chaque module = routes → controller → service → types

3. **API versionnée**
   - /api/v1/…

4. **Pas de logique dans les routes**
   - routes → controllers → services

5. **Pas de dépendance circulaire**
   - modules ne se connaissent pas directement
   - importer via services uniquement

---

# 3. Technologies standardisées

- **Node 20+**
- **Fastify**
- **TypeScript strict**
- **Drizzle ORM**
- **Redis + BullMQ**
- **PostgreSQL Supabase**
- **pgvector**
- **GCP Vertex AI (LLM + Embeddings)**

Pas d’autre ORM, pas de Sequelize, pas de Mongoose, pas d’introduction de libs “one-shot”.

---

# 4. Code Style & Qualité

- ESLint + Prettier obligatoires
- Pas de `any`
- Typage via Zod pour entrée utilisateur
- Pas de logique dans les controllers
- Chaque service doit être testable
- **OBLIGATOIRE : Multi-tenant security**
  - Toute méthode `getXXXById`, `updateXXX`, `deleteXXX` doit inclure `tenantId`
  - Aucune requête DB sans filtrage par tenant
  - Validation ownership avant modification/suppression

# 5. Sécurité Multi-Tenant (CRITIQUE)

**Règles absolument obligatoires :**

1. **Isolation des données**
   - Toute méthode d'accès aux ressources DOIT filtrer par `tenantId`
   - Pattern : `getXXXById(id: string, tenantId: string)`
   - Pattern : `updateXXX(id: string, tenantId: string, input: UpdateInput)`

2. **Validation ownership**
   ```typescript
   // ✅ CORRECT
   const channel = await db.select()
     .from(channels)
     .where(and(eq(channels.id, id), eq(channels.tenantId, tenantId)));
   
   // ❌ INTERDIT 
   const channel = await db.select()
     .from(channels)
     .where(eq(channels.id, id)); // Pas de filtre tenant !
   ```

3. **Controllers sécurisés**
   - Extraction `tenantId` obligatoire depuis `request.query` ou context
   - Validation présence tenantId (erreur si manquant)
   - Aucune opération sans vérification tenant

4. **Cache sécurisé**
   - Validation tenant même pour données en cache
   - Invalidation cache cohérente avec tenant

---

# 6. Fichiers `.env` & Secrets

Voir `SECURITY_GUIDE.md` pour les règles strictes.

---

# 7. Logs & Observabilité

- Logger : **Pino JSON**
- Pas de données sensibles dans les logs (numéros de téléphone → masked)
- Healthcheck obligatoire (`/health`)
- Plus tard : Prometheus + Grafana Cloud

---

# 8. Jobs & Workers

- Toute logique IA/RAG/WhatsApp passe via **BullMQ**
- Chaque worker dans `jobs/`
- Pas de traitement lourd dans le thread HTTP

---

# 9. RAG

- RAG local v1 = pgvector
- Embeddings = Vertex
- Pas de fichiers locaux : tous les documents → Cloud Storage
- Indexation = job dédié

---

# 10. Qualité & Roadmap Engineering

- PR obligatoires (même en solo)
- Commits clairs
- Refactor léger autorisé si lisibilité → +++

---

# 11. TypeScript Configuration Rules

## Architecture 4-Configs

Le projet utilise une architecture TypeScript en 4 configurations séparées :

```
tsconfig.base.json          ← STRICT config partagée (core rules)
    ↓
    ├── tsconfig.json       ← VS Code IntelliSense (src + test, noEmit)
    ├── tsconfig.build.json ← Production build (src only, STRICT)
    └── tsconfig.test.json  ← Jest tests (src + test, relaxed rules)
```

## Fichiers et leurs rôles

### `tsconfig.base.json` – Trunk STRICT

Configuration de base partagée avec **toutes les règles strictes activées** :

```jsonc
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true
}
```

**Ne jamais modifier ce fichier** pour relâcher les règles. Il représente le standard production.

### `tsconfig.build.json` – Build Production

- Hérite de `tsconfig.base.json`
- Compile uniquement `src/**/*`
- Utilisé par `npm run build` et CI/CD
- **STRICT** : aucune relaxation permise

```jsonc
{
  "extends": "./tsconfig.base.json",
  "include": ["src/**/*", "types/**/*"],
  "exclude": ["test", "node_modules", "dist"]
}
```

### `tsconfig.test.json` – Tests Relaxed

- Hérite de `tsconfig.base.json`
- **Relaxe** les règles pour les tests :
  - `noImplicitAny: false`
  - `strictNullChecks: false`
  - `noUnusedLocals: false`
  - `noUnusedParameters: false`
  - `strictPropertyInitialization: false`
- Utilisé par Jest via `ts-jest`

**Justification** : Les tests utilisent des mocks, fixtures et données partielles qui ne nécessitent pas la rigueur du code production.

### `tsconfig.json` – Editor VS Code

- Hérite de `tsconfig.base.json`
- Inclut `src/**/*` + `test/**/*` pour IntelliSense complet
- `noEmit: true` (pas de compilation)
- Configuration par défaut utilisée par VS Code

**Objectif** : Zéro erreur dans l'onglet Problems, IntelliSense fonctionnel partout.

## Guidelines

### ✅ DO

- Utiliser `npm run build` (tsconfig.build.json) pour valider le code production
- Utiliser `npm run type-check` pour CI/CD
- Utiliser `npm run test:ts` pour valider les types des tests
- Garder les règles strictes dans `tsconfig.base.json`

### ❌ DON'T

- Ne pas modifier `tsconfig.base.json` pour relâcher les règles
- Ne pas ajouter `@ts-ignore` ou `@ts-nocheck` dans `src/`
- Ne pas contourner les erreurs de build avec des casts `as any`
- Ne pas mélanger les configurations (ex: hériter de test dans build)

## Scripts associés

```json
{
  "build": "tsc -p tsconfig.build.json",
  "type-check": "tsc -p tsconfig.build.json --noEmit",
  "type-check:test": "tsc -p tsconfig.test.json --noEmit",
  "test:ts": "tsc -p tsconfig.test.json --noEmit"
}
```

---

# 12. Vision long terme

Cette architecture doit pouvoir évoluer vers :

- multi-channel complet (WhatsApp + Web widget + Voice)
- multi-tenant complet
- séparation future en micro-services (si besoin)

Toute décision d'aujourd'hui doit garder cette trajectoire en tête.

---

### 🔒 Environment File Safety Rule

Never copy `.env.test` into `.env`.  
Test environments must ALWAYS load their variables explicitly using dotenv with `-e .env.test`.  
Production `.env` must NEVER be overwritten or polluted with test credentials.

### 🔒 Environment Test Migration Rule

- `dotenv-cli` MUST be used for all test-only migrations.  
- Test migrations must ALWAYS use `.env.test`.  
- Production migrations MUST NEVER rely on test env files.  
- No script should auto-load `.env.test` unless explicitly invoked by a test command.

### 🧱 Infra Bug Fixes Triggered by Tests

- When a unit or integration test reveals a REAL bug in shared infrastructure code
  (database client, env loader, logger, custom type mapping, etc.),
  it is ALLOWED to patch the production file that contains the bug.
- Such changes MUST:
  - Be minimal and backward-compatible
  - Be documented in a short comment near the fix
  - Be added to ENGINEERING_RULES.md in this section
- Tests MUST NOT introduce "test-only hacks" into production code.
  The fix must make sense for both tests and production.

### 🧠 Test Mocks for External Services

- Any external service (Redis, HTTP clients, queues, etc.) used in production **MUST** have a consistent Jest mock.
- When a new cache key or helper (ex: `cacheKeys.assistantsByTenant`) is added in production:
  - The corresponding Jest mock **MUST** be updated in `test/setup.ts`.
  - The mock must mirror the same shape (functions vs strings, parameters, return types).
- Infra bugs found by tests can be fixed by:
  - Patching the infra layer in a backward-compatible way.
  - Updating the central Jest mock instead of patching each test file.
- This rule prevents "TypeError: xxx is not a function" style failures from hiding real business regressions.

### 🧩 Array vs Scalar Safety (PostgreSQL)

- Any use of `ANY(...)`, `IN (...)` or array types in PostgreSQL MUST clearly distinguish between:
  - scalar IDs (single UUID),
  - and arrays of IDs.
- If a service accepts a single ID, queries should use scalar equality (`eq(...)`) instead of array operators.
- If array operators are required:
  - the service MUST normalize the input to an array (`[id]`) before calling the query,
  - tests MUST cover both single-ID and multi-ID scenarios.
- Prefer Drizzle's `inArray(...)` over raw SQL `ANY(...)` to avoid custom type serialization issues.
- Infra fixes for "malformed array literal" errors MUST:
  - be minimal,
  - be documented in this file,
  - and NEVER hide real access control bugs.
