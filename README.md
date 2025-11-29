# 🦁 Sylion Backend

Backend principal de la plateforme **SylionAI** - Architecture multi-tenant WhatsApp-first avec IA et RAG.

## 🚀 Démarrage Rapide

### Prérequis

- **Node.js** 20+
- **Docker** & **Docker Compose**
- **PostgreSQL** avec extension `pgvector`
- **Redis** pour le cache et les queues

### Installation

1. **Cloner le projet**
   ```bash
   git clone https://github.com/SylionTech/sylion-backend.git
   cd sylion-backend
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configuration environnement**
   ```bash
   cp .env.example .env.local
   # Éditer .env.local avec vos configurations
   ```

4. **Démarrer les services Docker**
   ```bash
   # Environnement de développement
   npm run docker:dev
   
   # Ou en production
   npm run docker:prod
   ```

5. **Lancer les migrations**
   ```bash
   npm run db:migrate
   ```

6. **Démarrer le serveur de développement**
   ```bash
   npm run dev
   ```

Le serveur sera accessible sur `http://localhost:3000`

### Vérification

- **Health Check** : `GET http://localhost:3000/health`
- **Swagger Documentation** (dev) : `http://localhost:3000/docs`
- **Admin Stats** : `GET http://localhost:3000/admin/queues/stats`

## 📋 Variables d'Environnement Requises

Créez un fichier `.env.local` avec les variables suivantes :

```env
# Application
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/sylion_dev

# Redis
REDIS_URL=redis://localhost:6379

# WhatsApp API (360dialog)
WHATSAPP_API_KEY=your_360dialog_api_key
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token

# Google Cloud Platform
GCP_PROJECT_ID=your_gcp_project_id
GCP_SERVICE_ACCOUNT_KEY=your_service_account_json
GCS_BUCKET_NAME=your_storage_bucket

# Vertex AI
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=gemini-1.5-pro
VERTEX_EMBEDDING_MODEL=text-embedding-004

# Authentication
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters

# Features
ENABLE_SWAGGER=true
ENABLE_CORS=true
ENABLE_HELMET=true
LOG_LEVEL=info
LOG_PRETTY=true
```

## 🏗️ Architecture

```
src/
├── app/          # Serveur Fastify, routes, middlewares
├── modules/      # Logique métier (tenant, channel, assistant...)
├── lib/          # Utilitaires (logger, redis, http)
├── db/           # Drizzle ORM, migrations, schémas
├── jobs/         # Workers BullMQ
└── config/       # Configuration environnement
```

### Principes d'Architecture

- **Domain-Driven Design** léger
- **Multi-tenant** avec isolation des données
- **API versionnée** (`/api/v1/`)
- **Jobs asynchrones** avec BullMQ
- **Cache Redis** pour les performances
- **RAG local** avec pgvector
- **Logging structuré** avec Pino
- **Validation stricte** avec Zod

## 📡 API Endpoints

### Core Resources

- **Tenants** : `GET|POST|PUT|DELETE /api/v1/tenants`
- **Channels** : `GET|POST|PUT|DELETE /api/v1/channels`
- **Assistants** : `GET|POST|PUT|DELETE /api/v1/assistants`
- **Conversations** : `GET|POST|PUT|DELETE /api/v1/conversations`
- **Messages** : `GET|POST|PUT|DELETE /api/v1/messages`

### Webhooks

- **WhatsApp** : `POST /webhooks/whatsapp/message`
- **Verification** : `GET /webhooks/whatsapp/verify`

### Admin

- **System Info** : `GET /admin/system/info`
- **Queue Stats** : `GET /admin/queues/stats`
- **Health Check** : `GET /health`

## 🔧 Scripts Disponibles

```bash
# Développement
npm run dev              # Serveur avec hot-reload
npm run build            # Compilation TypeScript
npm run start            # Serveur production

# Qualité du code
npm run lint             # Vérification ESLint
npm run lint:fix         # Correction automatique
npm run format           # Formatage Prettier
npm run type-check       # Vérification TypeScript

# Base de données
npm run db:generate      # Générer migration Drizzle
npm run db:push          # Push schema vers DB
npm run db:migrate       # Exécuter migrations
npm run db:studio        # Interface graphique Drizzle

# Docker
npm run docker:dev       # Services de développement
npm run docker:prod      # Services de production

# Tests
npm run test             # Tests Jest
npm run test:watch       # Tests en mode watch

# Utilitaires
npm run health           # Test health endpoint
```

## 🔐 Sécurité

### Règles Strictes

- ❌ **Jamais de secrets dans le code**
- ❌ **Jamais de commit de `.env`**
- ❌ **Jamais de logs avec données sensibles**
- ✅ **Validation Zod sur toutes les entrées**
- ✅ **Masquage des numéros de téléphone**
- ✅ **Chiffrement des clés API**
- ✅ **Rate limiting actif**

### Headers de Sécurité

Le serveur configure automatiquement :
- `Helmet.js` pour les headers de sécurité
- `CORS` configuré selon l'environnement
- `Rate Limiting` par IP
- `Request ID` unique pour le tracking

## 🗄️ Base de Données

### Schéma Principal

- **tenants** : Configuration multi-tenant
- **channels** : Canaux de communication (WhatsApp, Web, Voice)
- **assistants** : Configuration des assistants IA
- **conversations** : Sessions de chat
- **messages** : Messages individuels
- **documents** : Stockage RAG
- **document_chunks** : Embeddings pour recherche
- **quota_usage** : Suivi d'usage détaillé

### Extensions Requises

```sql
CREATE EXTENSION IF NOT EXISTS vector;        -- pgvector pour RAG
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Full-text search
```

## 🚀 Workers & Jobs

### Types de Jobs

- **WhatsApp** : `whatsapp:send-message`, `whatsapp:process-incoming`
- **IA** : `ai:process-message`, `ai:generate-response`
- **RAG** : `rag:index-document`, `rag:search-similar`
- **Système** : `system:cleanup-conversations`, `system:update-quotas`

### Queues Configurées

- **whatsapp** : Messages temps réel (priorité élevée)
- **ai** : Traitement IA avec rate limiting
- **rag** : Indexation de documents
- **system** : Tâches de maintenance

## 📊 Monitoring & Logs

### Logs Structurés (Pino)

```typescript
logger.info('Message processed', {
  tenantId: 'xxx',
  conversationId: 'xxx',
  phoneNumber: '+2126xxxxxxx', // Masqué automatiquement
  aiModel: 'gemini-1.5-pro',
  tokensUsed: 150,
  duration: 1200
});
```

### Métriques Disponibles

- Statistiques des queues en temps réel
- Usage par tenant (messages, IA, stockage)
- Performance par endpoint
- Santé des services (DB, Redis, Workers)

## 🧪 Tests

```bash
npm run test                # Tous les tests
npm run test:watch         # Mode watch
npm run test:coverage      # Avec coverage
```

### Structure des Tests

```
tests/
├── unit/           # Tests unitaires des services
├── integration/    # Tests d'intégration
├── e2e/           # Tests end-to-end
└── fixtures/      # Données de test
```

## 🚀 Déploiement

### Docker Production

```bash
# Build et déploiement
docker-compose up -d

# Logs en temps réel
docker-compose logs -f api

# Scaling des workers
docker-compose up -d --scale api=3
```

### Variables de Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:***@prod_host:5432/sylion_prod
REDIS_URL=redis://prod_redis:6379
LOG_LEVEL=warn
ENABLE_SWAGGER=false
```

## 📚 Documentation

### Règles d'Ingénierie

Voir `docs/ENGINEERING_RULES.md` pour les standards techniques complets.

### Sécurité

Voir `docs/SECURITY_GUIDE.md` pour les règles de sécurité strictes.

### Contributions

Voir `docs/CONTRIBUTING.md` pour le workflow Git et les standards qualité.

## 🆘 Support & Troubleshooting

### Problèmes Courants

1. **Erreur de connexion DB**
   ```bash
   npm run docker:dev  # Vérifier que PostgreSQL est lancé
   ```

2. **Workers ne démarrent pas**
   ```bash
   docker-compose logs redis-dev  # Vérifier Redis
   ```

3. **Migrations échouent**
   ```bash
   npm run db:push  # Push du schéma direct
   ```

### Logs de Debug

```bash
LOG_LEVEL=debug npm run dev
```

## 📞 Contact

- **Email** : dev@sylion.tech
- **Documentation** : [docs.sylion.tech](https://docs.sylion.tech)
- **Issues** : [GitHub Issues](https://github.com/SylionTech/sylion-backend/issues)

---

**SylionTech** - Plateforme IA multi-tenant pour l'automatisation WhatsApp 🦁