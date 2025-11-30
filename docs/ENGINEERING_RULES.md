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

# 11. Vision long terme

Cette architecture doit pouvoir évoluer vers :

- multi-channel complet (WhatsApp + Web widget + Voice)
- multi-tenant complet
- séparation future en micro-services (si besoin)

Toute décision d’aujourd’hui doit garder cette trajectoire en tête.
