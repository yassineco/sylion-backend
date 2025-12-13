# 🦁 SYLION_DEV_ENV_SETUP.md
**Version : 1.0**  
**Projet : SYLION Backend — WhatsApp AI Assistant**  
**Objet : Setup complet environnement de développement (local)**  
**Audience : Développeurs, IA (Copilot/Cursor/Continue), DevOps**

---

# 1. 🎯 Objectif du document

Ce guide explique comment :

- installer et configurer l’environnement de développement complet  
- lancer le backend local avec DB & Redis  
- configurer VS Code + Continue + Cursor + Copilot  
- préparer les fichiers `.env`  
- exécuter les migrations Drizzle  
- démarrer workers + Fastify  
- vérifier l’intégration WhatsApp provider  
- travailler proprement dans le monolith modulaire SYLION

Ce document est essentiel pour toute nouvelle personne qui rejoint le projet.

---

# 2. 🧱 Prérequis système

Minimum recommandé :

| Outil | Version |
|-------|---------|
| **Node.js** | 20.x (LTS) |
| **npm ou pnpm** | npm 10+ ou pnpm 9+ |
| **Docker** | latest |
| **Docker Compose** | latest |
| **Git** | latest |
| **VS Code** | latest |
| **Redis** | géré via Docker |
| **PostgreSQL** | géré via Docker ou Supabase |

---

# 3. 📁 Structure projet (rappel)

sylion-backend/
├─ src/
│ ├─ app/ # Fastify HTTP
│ ├─ modules/ # modules métier
│ ├─ jobs/ # workers BullMQ
│ ├─ lib/ # LLM, embeddings, utils
│ ├─ db/ # drizzle schema + migrations
│ └─ index.ts # entrypoint
├─ test/ # tests unit + integration
├─ docker/
│ ├─ postgres/
│ └─ redis/
├─ .env.example
└─ package.json

yaml
Copier le code

---

# 4. 🔧 Setup Docker (DB + Redis)

## 4.1. Lancer l’environnement local

Fichier `docker-compose.yml` recommandé :

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:15
    container_name: sylion_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: sylion
      POSTGRES_PASSWORD: sylion_pass
      POSTGRES_DB: sylion_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: sylion_redis
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
4.2. Commande lancement
nginx
Copier le code
docker compose up -d
4.3. Vérifier
powershell
Copier le code
docker ps
Tu dois voir :

sylion_postgres

sylion_redis

5. 🧪 Préparation du .env
Copier le .env.example :

bash
Copier le code
cp .env.example .env
Remplir les clés nécessaires :

ini
Copier le code
DATABASE_URL=postgres://sylion:sylion_pass@localhost:5432/sylion_db
REDIS_URL=redis://localhost:6379

# Vertex AI / Gemini
VERTEX_PROJECT_ID=xxxx
VERTEX_LOCATION=europe-west1
VERTEX_API_KEY=xxxx

# WhatsApp
WHATSAPP_PROVIDER=360dialog
DIALOG_API_KEY=xxxx
DIALOG_PHONE_NUMBER_ID=xxxx

# JWT Admin
ADMIN_API_KEY=supersecret
⚠️ Important :
Le backend valide le .env via Zod.
Si un paramètre est manquant : le serveur refuse de démarrer.

6. 🔥 Installation Node.js & dépendances
Avec pnpm (recommandé)
nginx
Copier le code
pnpm install
Avec npm
nginx
Copier le code
npm install
7. 🗃️ Migrations Drizzle

### Commandes Database

| Commande | Description |
|----------|-------------|
| `npm run db:migrate` | Appliquer migrations |
| `npm run db:push` | Push schéma direct |
| `npm run db:studio` | Drizzle Studio UI |
| `npm run db:generate` | Générer nouvelles migrations |

### Connexion psql directe (dev)
```bash
PGPASSWORD=dev_password psql -h localhost -p 5433 -U sylion_dev -d sylion_dev
```

### Appliquer les migrations
```bash
npm run db:migrate
```

Générer les migrations si nécessaires :

```bash
npm run db:generate
```

Pousser les migrations vers Postgres :

```bash
npm run db:push
```

Vérifier :

nginx
Copier le code
pnpm drizzle:studio
→ Ouvre Drizzle Studio (local)
→ Permet de voir tables, colonnes, données.

8. 🚀 Lancement du backend
Mode développement :
nginx
Copier le code
pnpm dev
Tu dois voir Fastify démarré sur http://localhost:3000.

Lancement workers (automatique)
Les workers BullMQ démarrent automatiquement car src/index.ts lance :

HTTP server

queues

process jobs

9. 🔥 Test Webhook WhatsApp
Endpoint
bash
Copier le code
POST http://localhost:3000/whatsapp/webhook
Payload exemple :
css
Copier le code
{
  "messages": [
    {
      "from": "212612345678",
      "text": "Bonjour",
      "id": "wamid.HBg..."
    }
  ]
}
Test :
nginx
Copier le code
curl -X POST http://localhost:3000/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d @payload.json
Si tout fonctionne :

message est normalisé

queue incoming-messages reçoit job

worker génère réponse

message sortant est loggé (pas envoyé en vrai)

10. 🧰 Setup VS Code (recommandé)
Extensions essentielles :

TypeScript Hero (auto imports)

ESLint (respect conventions)

Prettier (formatting)

Docker

REST Client (tester API via .http)

Continue (assistant local)

Copilot

Error Lens

GitLens

Fichiers recommandés :

.vscode/settings.json :

json
Copier le code
{
  "editor.formatOnSave": true,
  "files.eol": "\n",
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.tabSize": 2,
  "editor.renderWhitespace": "all",
  "editor.useTabStops": true
}
11. 🤖 Setup Continue + Cursor + Copilot
11.1. Continue (VS Code)
Dans .continue/config.json :

json
Copier le code
{
  "models": [
    {
      "title": "Ollama Mistral",
      "model": "ollama:mistral",
      "provider": "ollama"
    },
    {
      "title": "OpenAI GPT-5.1",
      "model": "gpt-5.1",
      "provider": "openai"
    }
  ]
}
Pour chaque session Continue :
markdown
Copier le code
Load these documents:
1. PROJECT_CONTEXT.md
2. ARCHITECTURE_RULES.md
3. ENGINEERING_STYLE_GUIDE.md
4. BACKEND_NAMING_CONVENTIONS.md
5. TEST_STRATEGY.md
11.2. Cursor
Création du “Workspace Context” :

yaml
Copier le code
Read and follow these documents:
PROJECT_CONTEXT.md
ARCHITECTURE_RULES.md
ENGINEERING_STYLE_GUIDE.md
BACKEND_NAMING_CONVENTIONS.md
TEST_STRATEGY.md
SYLION_CODING_PROMPT.md
11.3. Copilot
Prompt initial :

diff
Copier le code
You are Senior Engineer SYLION.  
Follow strictly:
- PROJECT_CONTEXT.md
- ARCHITECTURE_RULES.md
- ENGINEERING_STYLE_GUIDE.md
- TEST_STRATEGY.md  
Write complete, safe and production-ready code.
12. 🧪 Lancer les tests
Unit tests
bash
Copier le code
pnpm test:unit
Integration tests
bash
Copier le code
pnpm test:integration
Full suite
bash
Copier le code
pnpm test
Résultat attendu (actuel Phase 2)
Tous les tests doivent passer, y compris :

normalisation téléphone

multi-tenant isolation

webhook

pipeline queue → processor

13. 🔄 Workflow Git
Branches
css
Copier le code
main        → production
dev         → staging
feature/*   → nouvelles features
fix/*       → corrections
Commit style
makefile
Copier le code
feat: add assistant binding logic
fix: normalize phone number + regression test
refactor: extract provider adapter
docs: update onboarding
test: add integration test for webhook
14. 🛡️ Règles Dev essentielles
Ne jamais coder de logique métier dans les controllers.

Toujours passer par repository/service.

Toujours valider tenantId dans chaque méthode.

Jamais d’appel direct LLM dans la gateway.

Jamais de lecture DB directe hors repository Drizzle.

Structure .service.ts obligatoire.

Respect strict ARCHITECTURE_RULES.md.

Ne jamais contourner le système de queue.

À chaque PR : ajouter tests.

15. 🩺 Debug & Observabilité
Logs (local)
Fastify + workers log → terminal.

Queue UI (via bull-board)
Optionnel :

cpp
Copier le code
pnpm queue:ui
Drizzle Studio
nginx
Copier le code
pnpm drizzle:studio
16. 🚀 Checklist de démarrage (5 minutes)
docker compose up -d

cp .env.example .env

remplir .env

pnpm install

pnpm drizzle:push

pnpm dev

tester /whatsapp/webhook

ouvrir Drizzle Studio

17. 🦁 Conclusion
Avec ce document, n'importe quel développeur (ou agent IA) peut :

installer l'environnement

comprendre la structure

lancer le backend

exécuter les tests

contribuer proprement

respecter l'architecture SYLION

C'est un vrai document "Ready-to-Work".

---

# 18. 📌 Addendum - Configuration Dev 2025

> **Mise à jour Décembre 2025** : Cette section remplace les sections 4 et 5 obsolètes.

## 18.1. Ports de développement

| Service | Port local | Port container | Notes |
|---------|-----------|----------------|-------|
| **API Fastify** | 3000 | - | Backend principal |
| **PostgreSQL** | 5433 | 5432 | Évite conflit avec Postgres local |
| **Redis** | 6380 | 6379 | Évite conflit avec Redis local |
| **Redis Commander** | 8081 | 8081 | UI Web pour Redis |

## 18.2. Lancer l'environnement Docker

```bash
docker compose -f docker-compose.dev.yml up -d
```

> Utiliser `docker compose` (avec espace) et non `docker-compose` (deprecated).

## 18.3. Connexion PostgreSQL

```bash
psql -h localhost -p 5433 -U sylion_dev -d sylion_dev
```

**Password** : Voir `POSTGRES_PASSWORD` dans `docker-compose.dev.yml`

## 18.4. Variables .env recommandées

```ini
DATABASE_URL=postgres://sylion_dev:dev_password@localhost:5433/sylion_dev
REDIS_URL=redis://localhost:6380
DEMO_MODE=true
WHATSAPP_PROVIDER=360dialog
```

> **⚠️ Production** : `DEMO_MODE=false` nécessite GCP/Vertex AI.  
> DB et Redis sont **obligatoires** (pas de fallback).