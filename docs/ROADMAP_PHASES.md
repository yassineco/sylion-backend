# 🦁 Sylion Backend – Roadmap Phases (MVP → V1)

Ce document est la **source officielle** de l’état d’avancement du backend SylionAI.  
Il permet de suivre, phase par phase, la progression du MVP vers une version stable et évolutive.

Statuts possibles :  
- 🟢 **Done**  
- 🟡 **In Progress**  
- 🔴 **Not Started**  

---

# 🧩 Hypothèses Fondamentales (MVP)

- Canal principal : **WhatsApp texte uniquement**
- Architecture : **Monolithe Node/TS**, Fastify, Drizzle ORM, Supabase, Redis + BullMQ
- IA : **Vertex AI** (LLM + embeddings)
- RAG : **Local pgvector v1**
- Infra : **1 VPS Hetzner**, Cloudflare DNS, GCS bucket
- Provider WhatsApp : **360dialog**
- Multi-tenant : **Oui**
- Objectif business : **Offres Starter / Pro / Business**

---

# 🔵 Phase 1 — Squelette backend  
**Objectif :** Avoir un backend fonctionnel, compilant, avec une arborescence propre et un /health OK.

| Tâche | Statut |
|------|--------|
| Création du repo `sylion-backend` | 🟢 Done |
| Structure `src/app`, `src/modules`, `src/lib`, `src/db`, `src/jobs` | 🟢 Done |
| Fastify + TS strict + alias `@/*` | 🟢 Done |
| docker-compose (db + redis + api) | 🟢 Done |
| /health opérationnel | 🟢 Done |
| Standards d’ingénierie (docs) | 🟢 Done |

**Phase 1 : 🟢 Done**

---

# 🔵 Phase 2 — Schéma DB & Modules Core  
**Objectif :** Multi-tenant complet + modules tenant, channel, assistant, conversation, message, usage.

| Tâche | Statut |
|------|--------|
| Tables tenants / channels / assistants / conversations / messages | 🟢 Done |
| Table `usage_records` | 🔴 Not Started |
| Table `channel_bindings` (WhatsApp → assistant) | 🔴 Not Started |
| Module tenant (routes + service) | 🟢 Done |
| Module channel | 🟢 Done |
| Module assistant | 🟡 In Progress |
| Module conversation | 🟡 In Progress |
| Module message | 🟡 In Progress |
| Module usage | 🔴 Not Started |
| API admin minimal | 🟡 In Progress |

**Phase 2 : 🟡 In Progress**

---

# 🔵 Phase 3 — Infrastructure Réelle (VPS + Supabase + GCP)  
**Objectif :** Déploiement réel HTTPS en production (MVP).

| Tâche | Statut |
|------|--------|
| VPS Hetzner (Docker + Compose + Sécurité) | 🔴 Not Started |
| Nginx reverse proxy (ou Traefik) | 🔴 Not Started |
| Supabase projet SylionAssistant | 🔴 Not Started |
| Activation pgvector | 🔴 Not Started |
| GCP : projet sylion-core | 🔴 Not Started |
| GCP : Vertex AI + GCS bucket | 🔴 Not Started |
| DNS Cloudflare → backend | 🔴 Not Started |
| Déploiement dockerisé du backend | 🔴 Not Started |
| /health en production | 🔴 Not Started |

**Phase 3 : 🔴 Not Started**

---

# 🔵 Phase 4 — Provider WhatsApp (360dialog)  
**Objectif :** Réception et envoi WhatsApp réels.

| Tâche | Statut |
|------|--------|
| Compte 360dialog + numéro lié | 🔴 Not Started |
| Env vars WHATSAPP_API_KEY / WABA_ID / PHONE_ID | 🔴 Not Started |
| Module whatsapp.provider.ts | 🔴 Not Started |
| Module whatsapp.gateway.ts (webhook) | 🔴 Not Started |
| Route `/whatsapp/webhook` | 🔴 Not Started |
| Config webhook côté provider | 🔴 Not Started |
| Test inbound → logs → enregistrement DB | 🔴 Not Started |

**Phase 4 : 🔴 Not Started**

---

# 🔵 Phase 5 — Queue & Message Processor (IA pipeline)  
**Objectif :** Flow complet “message WhatsApp → IA → réponse”.

| Tâche | Statut |
|------|--------|
| Queue `incoming_messages` | 🔴 Not Started |
| Worker `messageProcessor.worker.ts` | 🔴 Not Started |
| Résolution tenant/channel → conversation | 🔴 Not Started |
| Enregistrement message utilisateur | 🔴 Not Started |
| IA (stub) via `lib/llm.ts` | 🔴 Not Started |
| Enregistrement message assistant | 🔴 Not Started |
| Retour WhatsApp provider | 🔴 Not Started |
| UsageService.checkQuota + recordUsage | 🔴 Not Started |

**Phase 5 : 🔴 Not Started**

---

# 🔵 Phase 6 — RAG v1 (pgvector + GCS)  
**Objectif :** Activation du RAG (indexation + recherche).

| Tâche | Statut |
|------|--------|
| Tables : knowledge_bases, knowledge_documents, knowledge_chunks | 🔴 Not Started |
| Upload vers GCS + statut | 🔴 Not Started |
| Queue rag_indexing | 🔴 Not Started |
| Worker ragIndexer.worker.ts | 🔴 Not Started |
| Embeddings Vertex | 🔴 Not Started |
| RAG.local.service.ts | 🔴 Not Started |
| Intégration messageProcessor | 🔴 Not Started |

**Phase 6 : 🔴 Not Started**

---

# 🔵 Phase 7 — Usage, quotas & pricing  
**Objectif :** Alignement avec business Starter/Pro/Business.

| Tâche | Statut |
|------|--------|
| Définition quotas par plan | 🔴 Not Started |
| UsageService.checkQuota | 🔴 Not Started |
| UsageService.recordUsage | 🔴 Not Started |
| Dashboard minimum usage | 🔴 Not Started |

**Phase 7 : 🔴 Not Started**

---

# 🔵 Phase 8 — Monitoring & Observabilité  
**Objectif :** Monitoring basique dès MVP.

| Tâche | Statut |
|------|--------|
| Logger structuré Pino | 🟢 Done |
| Route /metrics | 🔴 Not Started |
| Grafana Cloud dashboard | 🔴 Not Started |
| Alertes (5xx / queue delay) | 🔴 Not Started |

**Phase 8 : 🔴 Not Started**

---

# 🔵 Phase 9 — Durcissement & Préparation v2 (multi-channel + voice)  
**Objectif :** Base prête pour Web + Voice.

| Tâche | Statut |
|------|--------|
| Validation stricte webhooks | 🔴 Not Started |
| Rate limiting gateway | 🔴 Not Started |
| Préparer WebWidgetGateway | 🔴 Not Started |
| Préparer endpoints voix | 🔴 Not Started |

**Phase 9 : 🔴 Not Started**

---

# 🧭 Synthèse d’avancement global

| Phase | Statut |
|-------|--------|
| Phase 1 – Squelette | 🟢 Done |
| Phase 2 – Core multi-tenant | 🟡 In Progress |
| Phase 3 – Infra réelle | 🔴 Not Started |
| Phase 4 – Provider WhatsApp | 🔴 Not Started |
| Phase 5 – Message Processor | 🔴 Not Started |
| Phase 6 – RAG v1 | 🔴 Not Started |
| Phase 7 – Usage/Pricing | 🔴 Not Started |
| Phase 8 – Monitoring | 🔴 Not Started |
| Phase 9 – Durcissement | 🔴 Not Started |

---

# 🦁 Vision MVP

Une fois les **Phases 1 → 5** terminées :  
➡️ Tu as un backend capable de recevoir un message WhatsApp, traiter, répondre avec une IA, et gérer les conversations multi-tenant.  
➡️ C’est le MVP commercialisable.

---

# 🧠 Notes du Tech Lead

- On reste parfaitement aligné avec l’architecture prévue.  
- La Phase 2 doit être verrouillée AVANT la Phase 4 (WhatsApp).  
- Cette roadmap doit être mise à jour après chaque sprint / milestone (cf. PROGRESS_REPORT_TEMPLATE.md).  

