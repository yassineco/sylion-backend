# 📋 Audit du dossier /docs — Sylion Backend

> **Date :** 2025-12-13  
> **Objectif :** Rationaliser la documentation pour un usage production réel

---

## 1️⃣ Audit des fichiers existants

### Légende
- 🟢 **Critique production** — Indispensable pour opérer le système
- 🟡 **Utile secondaire** — Référence, onboarding, ou planification
- 🔴 **Redondant / Archive** — Doublon, obsolète, ou à fusionner

| Fichier | Lignes | Rôle | Statut | Action recommandée |
|---------|--------|------|--------|-------------------|
| **README.md** | 213 | Index /docs, vue d'ensemble architecture | 🟡 | Refondre comme point d'entrée unique |
| **GO_LIVE_CHECKLIST.md** | 220 | Checklist pré-déploiement prod | 🟢 | Garder → `operations/` |
| **INCIDENT_RUNBOOK.md** | 385 | Runbook incidents production | 🟢 | Garder → `operations/` |
| **BACKUP_RESTORE.md** | 179 | Procédures backup PostgreSQL | 🟢 | Garder → `operations/` |
| **SECURITY_GUIDE.md** | 88 | Règles sécurité | 🟢 | Garder → `operations/` |
| **API_REFERENCE.md** | 404 | Documentation API endpoints | 🟢 | Garder → racine |
| **SYLION_DEV_ENV_SETUP.md** | 473 | Setup environnement dev | 🟡 | Garder → `onboarding/` |
| **BACKEND_ONBOARDING.md** | 362 | Guide nouveau développeur | 🟡 | Fusionner avec DEV_ENV_SETUP |
| **BACKEND_NAMING_CONVENTIONS.md** | 489 | Conventions nommage | 🟡 | Garder → `standards/` |
| **ENGINEERING_RULES.md** | 323 | Règles d'ingénierie | 🟡 | Fusionner avec STYLE_GUIDE |
| **ENGINEERING_STYLE_GUIDE.md** | 396 | Style de code | 🟡 | Fusionner → `standards/ENGINEERING.md` |
| **ARCHITECTURE_RULES.md** | 326 | Règles architecture | 🟡 | Garder → `architecture/` |
| **CONTRIBUTING.md** | 327 | Guide contribution | 🟡 | Garder → racine |
| **PROJECT_CONTEXT.md** | 368 | Contexte métier | 🟡 | Garder → `architecture/` |
| **ROADMAP_PHASES.md** | 266 | Roadmap par phases | 🟡 | Garder → `planning/` |
| **TEST_STRATEGY.md** | 533 | Stratégie de tests | 🟡 | Garder → `standards/` |
| **TEST_PLAN_BUSINESS.md** | 141 | Plan tests métier | 🟡 | Fusionner avec TEST_STRATEGY |
| **AUDIT_CHECKLIST.md** | 185 | Checklist audit code | 🟡 | Fusionner avec GO_LIVE |
| **RAG_v1_PLAN.md** | 734 | Plan RAG v1 | 🟡 | Garder → `architecture/` |
| **SYLION_ASSISTANT_IMPLEMENTATION.md** | 163 | Implémentation assistant | 🟡 | Garder → `architecture/` |
| **SYLION_CODING_PROMPT.md** | 242 | Prompt pour IA coding | 🔴 | Archiver (usage interne IA) |
| **assistant.system_prompt.md** | 147 | System prompt assistant | 🔴 | Déplacer → `/prompt/` |
| **how_to_read_docs.md** | 48 | Prompt IA pour lire docs | 🔴 | Supprimer (meta-doc) |
| **what_we_build_next.md** | 26 | Prompt IA next steps | 🔴 | Supprimer (meta-doc) |
| **ADMIN_CONSOLE_COMPONENTS.md** | 684 | Composants UI admin | 🟡 | Garder → `admin-console/` |
| **ADMIN_CONSOLE_FLOW.md** | 401 | Flows UI admin | 🟡 | Garder → `admin-console/` |
| **ADMIN_CONSOLE_ROADMAP.md** | 366 | Roadmap admin console | 🟡 | Garder → `admin-console/` |
| **ADMIN_CONSOLE_WIREFRAMES.md** | 478 | Wireframes UI | 🟡 | Garder → `admin-console/` |
| **SYLION_UI_DESIGN_SYSTEM.md** | 470 | Design system UI | 🟡 | Garder → `admin-console/` |
| **LEARNING_LOG.md** | 207 | Journal apprentissage | 🔴 | Archiver |
| **PROGRESS_REPORT_TEMPLATE.md** | 213 | Template rapports | 🔴 | Archiver |
| **PROGRESS_REPORT_2025-11-30.md** | 247 | Rapport 30/11 (doublon) | 🔴 | Supprimer (doublon) |
| **PROGRESS_REPORT_2025_11_30.md** | 168 | Rapport 30/11 | 🔴 | Archiver |
| **PROGRESS_REPORT_2025_12_02.md** | 235 | Rapport 02/12 | 🔴 | Archiver |
| **PROGRESS_REPORT_2025_12_02_PM.md** | 299 | Rapport 02/12 PM | 🔴 | Archiver |
| **PROGRESS_REPORT_2025_12_11.md** | 352 | Rapport 11/12 | 🔴 | Archiver |
| **PROGRESS_REPORT_2025_12_13.md** | 92 | Rapport 13/12 (récent) | 🟡 | Archiver après consolidation |
| **VERTICAL_SLICE_READY_REPORT.md** | 190 | Rapport vertical slice | 🔴 | Archiver |

---

## 2️⃣ Structure cible proposée

```
docs/
├── README.md                    # Point d'entrée unique (index)
├── API_REFERENCE.md             # Documentation API
├── CONTRIBUTING.md              # Guide contribution
│
├── operations/                  # 🟢 CRITIQUE - Usage production
│   ├── GO_LIVE_CHECKLIST.md
│   ├── INCIDENT_RUNBOOK.md
│   ├── BACKUP_RESTORE.md
│   └── SECURITY_GUIDE.md
│
├── onboarding/                  # 🟡 Nouveaux développeurs
│   └── DEVELOPER_SETUP.md       # Fusion DEV_ENV_SETUP + ONBOARDING
│
├── standards/                   # 🟡 Normes et conventions
│   ├── ENGINEERING.md           # Fusion RULES + STYLE_GUIDE
│   ├── NAMING_CONVENTIONS.md
│   └── TEST_STRATEGY.md
│
├── architecture/                # 🟡 Décisions techniques
│   ├── ARCHITECTURE_RULES.md
│   ├── PROJECT_CONTEXT.md
│   ├── RAG_v1_PLAN.md
│   └── ASSISTANT_IMPLEMENTATION.md
│
├── planning/                    # 🟡 Roadmap et planification
│   └── ROADMAP_PHASES.md
│
├── admin-console/               # 🟡 Documentation frontend admin
│   ├── COMPONENTS.md
│   ├── FLOWS.md
│   ├── WIREFRAMES.md
│   ├── ROADMAP.md
│   └── UI_DESIGN_SYSTEM.md
│
└── archive/                     # 🔴 Historique (read-only)
    ├── progress-reports/
    │   ├── 2025-11-30.md
    │   ├── 2025-12-02.md
    │   ├── 2025-12-11.md
    │   └── 2025-12-13.md
    ├── LEARNING_LOG.md
    ├── PROGRESS_REPORT_TEMPLATE.md
    ├── VERTICAL_SLICE_READY_REPORT.md
    └── CODING_PROMPT.md
```

---

## 3️⃣ Actions détaillées par fichier

### À garder (déplacer si nécessaire)

| Fichier actuel | Destination | Action |
|----------------|-------------|--------|
| GO_LIVE_CHECKLIST.md | `operations/` | Déplacer |
| INCIDENT_RUNBOOK.md | `operations/` | Déplacer |
| BACKUP_RESTORE.md | `operations/` | Déplacer |
| SECURITY_GUIDE.md | `operations/` | Déplacer |
| API_REFERENCE.md | racine | Garder |
| CONTRIBUTING.md | racine | Garder |
| ARCHITECTURE_RULES.md | `architecture/` | Déplacer |
| PROJECT_CONTEXT.md | `architecture/` | Déplacer |
| RAG_v1_PLAN.md | `architecture/` | Déplacer |
| ROADMAP_PHASES.md | `planning/` | Déplacer |
| BACKEND_NAMING_CONVENTIONS.md | `standards/NAMING_CONVENTIONS.md` | Renommer + déplacer |
| TEST_STRATEGY.md | `standards/` | Déplacer |

### À fusionner

| Fichiers sources | Destination | Justification |
|-----------------|-------------|---------------|
| SYLION_DEV_ENV_SETUP.md + BACKEND_ONBOARDING.md | `onboarding/DEVELOPER_SETUP.md` | Contenu redondant |
| ENGINEERING_RULES.md + ENGINEERING_STYLE_GUIDE.md | `standards/ENGINEERING.md` | Même sujet |
| TEST_PLAN_BUSINESS.md | → fusionner dans TEST_STRATEGY.md | Subset |
| AUDIT_CHECKLIST.md | → fusionner dans GO_LIVE_CHECKLIST.md | Overlap |

### À archiver

| Fichier | Destination | Justification |
|---------|-------------|---------------|
| PROGRESS_REPORT_*.md (tous) | `archive/progress-reports/` | Historique |
| LEARNING_LOG.md | `archive/` | Journal obsolète |
| PROGRESS_REPORT_TEMPLATE.md | `archive/` | Template rarement utilisé |
| VERTICAL_SLICE_READY_REPORT.md | `archive/` | Rapport ponctuel |
| SYLION_CODING_PROMPT.md | `archive/` | Usage IA interne |

### À supprimer

| Fichier | Justification |
|---------|---------------|
| how_to_read_docs.md | Meta-prompt IA, pas une doc |
| what_we_build_next.md | Meta-prompt IA, pas une doc |
| PROGRESS_REPORT_2025-11-30.md | Doublon exact (format date différent) |

### À déplacer hors /docs

| Fichier | Destination | Justification |
|---------|-------------|---------------|
| assistant.system_prompt.md | `/prompt/` | Appartient aux prompts système |

---

## 4️⃣ Nouveau docs/README.md (point d'entrée)

```markdown
# 📚 Documentation Sylion Backend

> Point d'entrée unique pour la documentation technique.

## 🚨 En cas d'incident production

→ **[operations/INCIDENT_RUNBOOK.md](operations/INCIDENT_RUNBOOK.md)**

## 🚀 Déploiement production

→ **[operations/GO_LIVE_CHECKLIST.md](operations/GO_LIVE_CHECKLIST.md)**

## 📖 Navigation rapide

| Besoin | Document |
|--------|----------|
| **API endpoints** | [API_REFERENCE.md](API_REFERENCE.md) |
| **Nouveau développeur** | [onboarding/DEVELOPER_SETUP.md](onboarding/DEVELOPER_SETUP.md) |
| **Conventions code** | [standards/ENGINEERING.md](standards/ENGINEERING.md) |
| **Backup/Restore** | [operations/BACKUP_RESTORE.md](operations/BACKUP_RESTORE.md) |
| **Sécurité** | [operations/SECURITY_GUIDE.md](operations/SECURITY_GUIDE.md) |
| **Architecture** | [architecture/](architecture/) |
| **Roadmap** | [planning/ROADMAP_PHASES.md](planning/ROADMAP_PHASES.md) |
| **Admin Console** | [admin-console/](admin-console/) |
| **Contribuer** | [CONTRIBUTING.md](CONTRIBUTING.md) |

## 📁 Structure

| Dossier | Contenu |
|---------|---------|
| `operations/` | Runbooks, checklists, procédures prod |
| `onboarding/` | Setup dev, guides nouveaux arrivants |
| `standards/` | Conventions, règles, tests |
| `architecture/` | Décisions techniques, contexte |
| `planning/` | Roadmap, phases |
| `admin-console/` | Documentation frontend admin |
| `archive/` | Historique (read-only) |
```

---

## 5️⃣ Règles de gouvernance documentaire

### Nomenclature

- **UPPER_SNAKE_CASE.md** pour les docs principales
- **Pas d'espaces** dans les noms de fichiers
- **Pas de dates** dans les noms (sauf archive)
- Préfixe par domaine si nécessaire (`API_`, `ADMIN_`)

### Quand créer une nouvelle doc ?

✅ Créer si :
- Nouvelle procédure opérationnelle (runbook, checklist)
- Nouveau module majeur nécessitant documentation
- Décision d'architecture significative (ADR)

❌ Ne pas créer si :
- L'info peut être ajoutée à un doc existant
- C'est un rapport temporaire (→ archive directement)
- C'est un prompt IA (→ `/prompt/`)

### Quand archiver ?

- Rapports d'avancement : archiver après 30 jours
- Documentation obsolète : archiver avec note `[ARCHIVED]`
- Ne jamais supprimer sans consensus équipe

---

## 📊 Résumé de l'audit

| Catégorie | Avant | Après |
|-----------|-------|-------|
| Fichiers total | 39 | ~25 |
| Fichiers critiques prod | 4 | 4 (mieux organisés) |
| Doublons | 2 | 0 |
| Prompts IA parasites | 3 | 0 |
| Rapports archivés | 0 | 7 |
| Dossiers organisés | 0 | 6 |

---

**Prochaine étape :** Exécuter la réorganisation avec `git mv` et commits atomiques.

---

## 6️⃣ Feature Update: Knowledge Admin + Quotas (2025-12-31)

### Summary

Implementation of DB-driven plans, knowledge document management, and atomic quota enforcement.

### Database Changes

| Table | Change Type | Description |
|-------|-------------|-------------|
| `plans` | NEW | Plan definitions with `limits_json` column |
| `knowledge_documents` | NEW | Document metadata (status, hash, size, chunks) |
| `knowledge_chunks` | NEW | Chunked content with `vector(768)` embedding |
| `usage_counters_daily` | NEW | Daily quota counters per tenant |
| `tenants` | MODIFIED | Added `plan_code`, `documents_count`, `documents_storage_mb` |

### Migration File

`drizzle/0003_add_plans_and_knowledge.sql`

**Idempotency:** All statements use `IF NOT EXISTS` / `ON CONFLICT` guards.

### New Modules

| Module | Files | Purpose |
|--------|-------|---------|
| `quota` | `quota.service.ts`, `quota.types.ts` | Limit validation + atomic consumption |
| `admin/knowledge` | `knowledge.service.ts`, `knowledge.routes.ts` | Document CRUD + upload |

### New Workers

| Worker | Queue | Responsibility |
|--------|-------|----------------|
| `knowledge.worker.ts` | `rag:index-document` | Chunk → Embed → Store |

### API Endpoints Added

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/knowledge/documents` | GET | List with pagination |
| `/admin/knowledge/documents` | POST | Upload (multipart) |
| `/admin/knowledge/documents/:id` | GET | Single document |
| `/admin/knowledge/documents/:id` | DELETE | Delete + chunks |
| `/admin/knowledge/documents/:id/reindex` | POST | Trigger reindex |
| `/admin/knowledge/stats` | GET | Usage statistics |

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Quota exhaustion during peak usage | Atomic PostgreSQL UPDATE prevents over-consumption |
| Race condition on daily counter | Single UPDATE with `RETURNING` pattern |
| Worker failure mid-indexation | Document stays in `error` status, retryable |
| Migration on existing DB | FK created after seed; column guards with `IF EXISTS` |
| Plan limits bypass | Hard check before AND atomic consumption during processing |

### Documentation Updated

- [README.md](README.md) — Added Knowledge & Quotas section
- [API_REFERENCE.md](API_REFERENCE.md) — Added knowledge admin endpoints reference
- [API_KNOWLEDGE_ADMIN.md](API_KNOWLEDGE_ADMIN.md) — Added atomic quota enforcement details
- [API_USE_CASES_EXAMPLES.md](API_USE_CASES_EXAMPLES.md) — Added quota exhaustion example
- [architecture/ARCHITECTURE_RULES.md](architecture/ARCHITECTURE_RULES.md) — Added indexing flow diagram
- [operations/INCIDENT_RUNBOOK.md](operations/INCIDENT_RUNBOOK.md) — Added quota debugging + migration runbook
- [frontend-examples/README.md](frontend-examples/README.md) — Added error handling guide
