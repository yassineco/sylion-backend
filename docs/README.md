# 🦁 Sylion Backend  
### The Core Engine Behind SylionAI – Multi-tenant Conversational AI Assistant (WhatsApp-first)

Ce repository contient le backend principal de la plateforme **SylionAI**, une solution d’assistance IA multi-tenant destinée aux entreprises marocaines & internationales.

Objectif : fournir une architecture **scalable, fiable et extensible**, démarrant par un seul canal (WhatsApp) mais prête pour le multi-canal (Web, Voice).

---

# 🚀 1. Fonctionnalités principales (MVP)

- **Webhook WhatsApp** (360dialog)  
- **Traitement IA via Vertex Gemini**  
- **Conversations & Messages persistés**  
- **Assistants personnalisés par tenant**  
- **RAG local (pgvector + Vertex embeddings)**  
- **Queue Processing via BullMQ**  
- **Gestion de quotas (plans Starter/Pro/Business)**  
- **Multi-tenant complet**  
- **Observabilité basique (logs, healthcheck)**

---

# 🧱 2. Architecture Technique

```
src/
  app/
    server.ts          → serveur Fastify
    routes.ts          → registres de routes
    middlewares/       → log, erreurs, 404
  modules/
    tenant/            → gestion multi-tenant
    channel/           → WhatsApp, futur Web/Voice
    assistant/         → config des bots
    conversation/
    message/
  lib/
    logger.ts          → Pino
    redis.ts           → Connexion Redis/BullMQ
    http.ts            → client HTTP générique
  db/
    drizzle/           → migrations + schema
    index.ts           → connexion Supabase
  jobs/
    incomingMessages.worker.ts  → pipeline IA
  config/
    env.ts             → validation Zod
    index.ts           → configuration centralisée
```

---

# 🏗️ 3. Technologies utilisées

| Domaine | Stack |
|--------|--------|
| Serveur | Fastify (Node 20+) |
| Langage | TypeScript strict |
| Base de données | Supabase PostgreSQL |
| ORM | Drizzle |
| IA | Vertex AI (Gemini / Embeddings) |
| Queue | BullMQ + Redis |
| RAG | pgvector + GCS |
| Déploiement | VPS (Hetzner/OVH) |
| Reverse Proxy | Nginx ou Cloudflare |

---

# 🔧 4. Installation & Lancement

## Prérequis

- Node.js 20+
- Docker + Docker Compose
- Compte Supabase (DB + pgvector)
- Accès Vertex AI (GCP)
- Compte WhatsApp Business API (360dialog)

---

## 1. Installer les dépendances

```
npm install
```

## 2. Configurer l’environnement

Créer un fichier `.env` :

```
PORT=3000
DATABASE_URL=...
REDIS_URL=...
WHATSAPP_API_KEY=...
WHATSAPP_VERIFY_TOKEN=...
GCP_PROJECT_ID=...
GCP_LOCATION=europe-west1
GCP_SERVICE_ACCOUNT=... (JSON base64)
GCS_BUCKET=sylion-docs
NODE_ENV=development
```

⚠️ **Ne jamais committer ce fichier.**

---

## 3. Lancer l’environnement de développement

```
docker-compose up -d
npm run dev
```

API disponible sur :  
👉 `http://localhost:3000/health`

---

# 📡 5. Workflow message → IA → WhatsApp

```
WhatsApp User
    ↓
  Webhook (360dialog)
    ↓
Gateway WhatsApp
    ↓
BullMQ → incoming_messages
    ↓
Message Processor
    ↓
RAG (si activé)
    ↓
Vertex Gemini
    ↓
Enregistrement DB
    ↓
Réponse WhatsApp
```

---

# 📚 6. Documentation interne

- [Règles d’ingénierie](./docs/ENGINEERING_RULES.md)  
- [Guide de sécurité](./docs/SECURITY_GUIDE.md)  
- [Learning Log](./docs/LEARNING_LOG.md)

---

# 🧪 7. Tests

```
npm run test
```

(Tu ajouteras Jest/Vitest dans la Phase 3)

---

# 🌍 8. Roadmap

### ✅ Phase 1 — Structure & Core backend  
- Squelette Fastify  
- Drizzle ORM  
- Redis + BullMQ  
- Multi-tenant  
- Documentation interne

### 🔄 Phase 2 — WhatsApp Gateway  
- Webhook + Provider 360dialog  
- Normalisation des messages  
- Envoi + réception WhatsApp  

### 🔄 Phase 3 — IA + Usage  
- Vertex Gemini wrapper  
- Message processor complet  
- Quotas & plans  
- Traces & logs structurés  

### 🔄 Phase 4 — RAG v1  
- Upload + indexation documents  
- Embeddings Vertex  
- Recherche pgvector  

### 🔄 Phase 5 — Monitoring  
- Prometheus / Grafana  
- Alerting  
- Slow queue detection  

### 🧭 Phase 6 — V2 (Web Widget + Voice)  
- Web Chat SDK  
- Appels vocaux IA  
- Multi-channel orchestrator  

---

# 🤝 9. Contribution

1. Créer une branche :  
   `feat/xxx`, `fix/xxx`, `chore/xxx`
2. PR obligatoire avec description claire  
3. Pas de commit contenant des secrets  

---

# 🦁 10. Licence

Propriété exclusive **SylionTech SARL AU**.  
Aucune redistribution non autorisée.

