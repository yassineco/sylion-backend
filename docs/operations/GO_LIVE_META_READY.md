# 🚀 GO-LIVE Meta-Ready Checklist

**Version:** 1.0  
**Date:** 2025-12-13  
**Pipeline:** WhatsApp v1 avec protections anti-abus  
**Statut:** ⏳ En préparation

> **📊 Contrat d'Observabilité:** Les critères GO/NO-GO de ce document reposent sur les events structurés définis dans [OBSERVABILITY_EVENTS.md](../standards/OBSERVABILITY_EVENTS.md). Tout event référencé ici (`message_received`, `job_added`, `llm_request`, `message_sent`, etc.) est contractuellement défini dans ce document de référence.

---

## Table des matières

1. [Pré-requis Infrastructure](#1-pré-requis-infrastructure)
2. [Webhook Meta / Provider](#2-webhook-meta--provider)
3. [Scénarios Fonctionnels Critiques](#3-scénarios-fonctionnels-critiques)
4. [Observabilité & Alerting Day-1](#4-observabilité--alerting-day-1)
5. [Sécurité & Conformité](#5-sécurité--conformité)
6. [Plan de Rollback](#6-plan-de-rollback)
7. [Critères GO / NO-GO](#7-critères-go--no-go)

---

## 1. Pré-requis Infrastructure

### 1.1 Base de données PostgreSQL

| Check | Description | Commande de validation | Critère ✅ |
|:-----:|-------------|------------------------|------------|
| ☐ | PostgreSQL accessible | `docker exec -it sylion-postgres pg_isready -U sylion` | `accepting connections` |
| ☐ | Extension pgvector installée | `docker exec -it sylion-postgres psql -U sylion -c "SELECT extname FROM pg_extension WHERE extname='vector';"` | `vector` retourné |
| ☐ | Migrations appliquées | `npm run db:migrate` | Exit code 0 |
| ☐ | Données seed présentes | `npm run db:seed` ou vérifier via script | Plans & demo assistant créés |

**Validation globale PostgreSQL:**
```bash
# Test connexion depuis l'application
npx tsx scripts/test-db-connection.ts
# Attendu: "Database connection successful"
```

### 1.2 Redis

| Check | Description | Commande de validation | Critère ✅ |
|:-----:|-------------|------------------------|------------|
| ☐ | Redis accessible | `docker exec -it sylion-redis redis-cli ping` | `PONG` |
| ☐ | Mémoire suffisante | `docker exec -it sylion-redis redis-cli info memory \| grep used_memory_human` | < 80% de maxmemory |
| ☐ | Politique d'éviction configurée | `docker exec -it sylion-redis redis-cli config get maxmemory-policy` | `volatile-lru` ou `allkeys-lru` |

**Clés Redis critiques utilisées:**
- `idempotence:msg:{tenantId}:{providerMessageId}` - TTL 24h
- `ratelimit:conv:{conversationId}` - TTL 30s
- `ratelimit:sender:{tenantId}:{senderId}` - TTL 5min
- `ratelimit:notified:{conversationId}` - TTL 30s

### 1.3 Workers BullMQ

| Check | Description | Commande de validation | Critère ✅ |
|:-----:|-------------|------------------------|------------|
| ☐ | Worker `messageProcessor` actif | Logs: `[MessageProcessor] Worker started` | Présent au démarrage |
| ☐ | Worker `rag` actif | Logs: `[RAG] Worker started` | Présent au démarrage |
| ☐ | Worker `knowledge` actif | Logs: `[Knowledge] Worker started` | Présent au démarrage |
| ☐ | Queues créées dans Redis | `docker exec -it sylion-redis redis-cli keys "bull:*"` | Lister les queues actives |

### 1.4 Variables d'environnement

**Variables requises (validées par Zod au démarrage):**

| Variable | Description | Validation |
|----------|-------------|------------|
| `DATABASE_URL` | URL PostgreSQL | Format `postgres://...` |
| `REDIS_URL` | URL Redis | Format `redis://...` |
| `WHATSAPP_API_KEY` | Clé API WhatsApp | Non vide |
| `WHATSAPP_VERIFY_TOKEN` | Token de vérification webhook | Non vide |
| `GCP_PROJECT_ID` | ID projet Google Cloud | Non vide |
| `GOOGLE_APPLICATION_CREDENTIALS` | Chemin credentials GCP | Fichier existant |
| `GCS_BUCKET_NAME` | Nom bucket GCS | Non vide |
| `JWT_SECRET` | Secret JWT (min 32 chars) | Min 32 caractères |

**Variables optionnelles (avec defaults):**

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environnement d'exécution | `development` |
| `PORT` | Port du serveur | `3000` |
| `HOST` | Adresse d'écoute | `0.0.0.0` |
| `WHATSAPP_API_URL` | URL API WhatsApp provider | `https://waba-v2.360dialog.io` |
| `WHATSAPP_WEBHOOK_URL` | URL callback webhook (optionnel) | - |
| `VERTEX_AI_LOCATION` | Région Vertex AI | `us-central1` |
| `VERTEX_AI_MODEL` | Modèle LLM | `gemini-1.5-pro` |
| `VERTEX_EMBEDDING_MODEL` | Modèle embeddings | `text-embedding-004` |
| `INCOMING_MESSAGES_QUEUE_NAME` | Nom queue BullMQ | `incomingMessages` |
| `JWT_EXPIRES_IN` | Durée validité JWT | `7d` |
| `RATE_LIMIT_MAX` | Max requêtes par fenêtre | `100` |
| `RATE_LIMIT_WINDOW` | Fenêtre rate limit | `1m` |
| `LOG_LEVEL` | Niveau de log | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_PRETTY` | Logs formatés (dev) | `false` |
| `ENABLE_SWAGGER` | Activer Swagger UI | `false` |
| `ENABLE_CORS` | Activer CORS | `true` |
| `ENABLE_HELMET` | Activer Helmet | `true` |

**Vérification rapide:**
```bash
# Le serveur refuse de démarrer si une variable requise manque
npm run start
# Vérifier: "Server listening on port ${PORT}"
```

### 1.5 Services externes

| Check | Description | Commande de validation | Critère ✅ |
|:-----:|-------------|------------------------|------------|
| ☐ | GCP Vertex AI accessible | `npx tsx scripts/test-gcp-auth.ts` | `Authentication successful` |
| ☐ | GCS Bucket accessible | Via script ou console GCP | Permissions read/write |
| ☐ | API WhatsApp Provider | Ping endpoint santé | HTTP 200 |

---

## 2. Webhook Meta / Provider

### 2.1 Configuration endpoint

| Paramètre | Valeur | Notes |
|-----------|--------|-------|
| **URL Webhook** | `POST /api/v1/whatsapp/webhook` | **Seul endpoint actif** |
| **Legacy URL** | `/whatsapp/webhook` | Retourne **410 Gone** |
| **Méthode** | `POST` | + `GET` pour vérification Meta |
| **Content-Type** | `application/json` | Obligatoire |

### 2.2 Vérification webhook (GET)

Meta envoie une requête GET pour vérifier le webhook :

```bash
curl -X GET "https://your-domain.com/api/v1/whatsapp/webhook?\
hub.mode=subscribe&\
hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&\
hub.challenge=test_challenge_123"
```

**Réponse attendue:** `test_challenge_123` (echo du challenge)

### 2.3 Réception message (POST)

**Payload type Meta/provider:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15551234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "John Doe" },
          "wa_id": "15559876543"
        }],
        "messages": [{
          "from": "15559876543",
          "id": "wamid.UNIQUE_MESSAGE_ID",
          "timestamp": "1699999999",
          "type": "text",
          "text": { "body": "Hello!" }
        }]
      }
    }]
  }]
}
```

### 2.4 Codes de réponse HTTP

| Code | Signification | Action côté provider |
|------|---------------|---------------------|
| **200** | Message accepté et mis en queue | OK, pas de retry |
| **400** | Payload invalide | Pas de retry |
| **401** | Non authentifié | Pas de retry |
| **410** | Endpoint legacy déprécié | Mettre à jour l'URL |
| **429** | *(Réservé - non utilisé)* | *(Phase future)* |
| **500** | Erreur serveur | Retry automatique |

> **Note:** Le webhook retourne toujours **200** même si le rate limit est atteint. La limitation est appliquée de manière asynchrone dans le worker. Le code **429** est réservé pour une phase future (rate limit synchrone au webhook).

### 2.5 Test de bout en bout

```bash
# Simulation webhook (utilise le script existant)
npx tsx scripts/simulate-webhook.ts "Test GO-LIVE message"

# Ou via curl direct
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "field": "messages",
        "value": {
          "messages": [{
            "from": "33612345678",
            "id": "wamid.test-golive-'$(date +%s)'",
            "type": "text",
            "text": { "body": "Test GO-LIVE" }
          }]
        }
      }]
    }]
  }'
```

**Réponse attendue:** `{ "status": "ok" }` avec HTTP 200

---

## 3. Scénarios Fonctionnels Critiques

### Scénario A: Message normal (quota OK, pas de rate limit)

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1 | Envoyer message via webhook | HTTP 200 | `event: 'message_received'` |
| 2 | Vérifier queue | Job ajouté | `event: 'job_added'` |
| 3 | Traitement worker | LLM appelé | `event: 'llm_request'` |
| 4 | Réponse envoyée | Message sauvé | `event: 'message_sent'` |

**Commande test:**
```bash
npx tsx scripts/simulate-webhook.ts "Bonjour, ceci est un test"
# Observer logs: info, event: 'message_sent'
```

---

### Scénario B: Quota dépassé (premier message après dépassement)

**Condition:** Tenant a épuisé son quota mensuel

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1 | Envoyer message | HTTP 200 | `event: 'message_received'` |
| 2 | Check quota | Quota épuisé détecté | `event: 'quota_exceeded'` |
| 3 | Flag posé | `quotaBlocked: true` dans conversation | DB updated |
| 4 | Message fallback | Envoyé à l'utilisateur | `event: 'quota_exceeded_handled'` |
| 5 | **LLM NON appelé** | Économie de ressources | Pas de `llm_request` |

**Message utilisateur (FR):**
> ⚠️ Ce service a atteint sa limite de messages pour ce mois. Nous ne pouvons pas répondre pour l'instant. Veuillez réessayer le mois prochain ou contacter l'administrateur. Merci de votre compréhension.

---

### Scénario C: Message après quotaBlocked (flag déjà posé)

**Condition:** `quotaBlocked: true` déjà présent dans la conversation

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1 | Envoyer message | HTTP 200 | `event: 'message_received'` |
| 2 | Check flag | `quotaBlocked` détecté | `event: 'quota_exceeded_handled'` |
| 3 | **Quota service NON appelé** | Économie de ressources | Pas d'appel DB quota |
| 4 | Message fallback | Envoyé à l'utilisateur | Message identique |

---

### Scénario D: Rate limiting (6 messages < 30 secondes)

**Condition:** Même conversation, 6ème message en moins de 30 secondes

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1-5 | Envoyer 5 messages rapidement | HTTP 200 x5 | Traitement normal |
| 6 | Envoyer 6ème message | HTTP 200 | `event: 'rate_limited'` |
| 7 | Message fallback | Envoyé 1 fois | `reason: 'conversation limit exceeded'` |
| 8 | Messages 7-10 | HTTP 200 | `alreadyNotified: true` (pas de re-notification) |

**Message utilisateur (FR):**
> ⚠️ Trop de messages en peu de temps. Merci de réessayer dans quelques instants.

**Test rapide rate limiting:**
```bash
# Envoyer 6 messages rapidement
for i in {1..6}; do
  npx tsx scripts/simulate-webhook.ts "Message rapide $i" &
done
wait
# Vérifier logs: event: 'rate_limited' au 6ème message
```

---

### Scénario E: Idempotence (même message ID)

**Condition:** Retry webhook avec le même `providerMessageId`

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1 | Premier message ID=X | HTTP 200, traitement normal | `event: 'message_received'` |
| 2 | Retry message ID=X | HTTP 200, **DROP silencieux** | `event: 'duplicate_message_dropped'` |
| 3 | **Aucun traitement** | Pas de doublon en DB | Pas de `saveUserMessage` |

**Test idempotence:**
```bash
# Envoyer le même message 2 fois avec le même ID
MSG_ID="wamid.test-idempotence-$(date +%s)"
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"messages":[{"from":"33612345678","id":"'$MSG_ID'","type":"text","text":{"body":"Test idempotence"}}]}}]}]}'

# Attendre 1 seconde
sleep 1

# Renvoyer exactement le même
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"field":"messages","value":{"messages":[{"from":"33612345678","id":"'$MSG_ID'","type":"text","text":{"body":"Test idempotence"}}]}}]}]}'

# Vérifier logs: event: 'duplicate_message_dropped' au 2ème appel
```

---

### Scénario F: Redis indisponible (fail-open)

**Condition:** Redis down ou timeout

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1 | Redis down | - | - |
| 2 | Envoyer message | HTTP 200 | `event: 'message_received'` |
| 3 | Check idempotence | **SKIP** (fail-open) | `warn: Redis error, skipping idempotence` |
| 4 | Check rate limit | **SKIP** (fail-open) | `warn: Redis error, skipping rate limit` |
| 5 | Traitement continue | LLM appelé normalement | `event: 'llm_request'` |

**⚠️ Important:** Le système est conçu pour être **fail-open** - la protection anti-abus est dégradée mais le service reste fonctionnel.

**Test (destructif, à faire en staging):**
```bash
# Arrêter Redis
docker stop sylion-redis

# Envoyer un message
npx tsx scripts/simulate-webhook.ts "Test sans Redis"

# Vérifier: message traité malgré Redis down
# Redémarrer Redis
docker start sylion-redis
```

---

### Scénario G: PostgreSQL indisponible

**Condition:** PostgreSQL down ou timeout

| Étape | Action | Attendu | Log pattern |
|-------|--------|---------|-------------|
| 1 | PostgreSQL down | - | - |
| 2 | Envoyer message | HTTP 200 (queue accepte) | `event: 'job_added'` |
| 3 | Worker traite | **FAIL** au saveUserMessage | `error: Database connection error` |
| 4 | Job retry | BullMQ retry automatique | `event: 'job_retry'` |
| 5 | PostgreSQL revient | Job traité au retry | Traitement normal |

**⚠️ Important:** Les jobs sont persistés dans Redis, donc survivent à un redémarrage du worker.

---

## 4. Observabilité & Alerting Day-1

### 4.1 Métriques clés à monitorer

| Métrique | Source | Seuil alerte | Action |
|----------|--------|--------------|--------|
| Latence P95 webhook | Logs/APM | > 2s | Investiguer queue backlog |
| Taux erreur 5xx | Nginx/Logs | > 1% | Vérifier PostgreSQL/Redis |
| Queue backlog | Redis `bull:*:waiting` | > 100 jobs | Scale workers |
| Taux `quota_exceeded` | Logs | > 20% / heure | Vérifier quotas clients |
| Taux `rate_limited` | Logs | > 5% / heure | Possible attaque ou bot |
| Taux `duplicate_message_dropped` | Logs | > 10% | Vérifier config provider |

### 4.2 Patterns de logs critiques (alerting)

```bash
# Rechercher erreurs critiques
grep -E "level\":\"error|event\":\"job_failed" /var/log/sylion/*.log

# Patterns à alerter immédiatement:
# - "Database connection error"
# - "Redis connection error" 
# - "WhatsApp API error"
# - "LLM error"
# - "event: 'job_failed'"

# Patterns informatifs (monitoring):
# - "event: 'quota_exceeded'"
# - "event: 'rate_limited'"
# - "event: 'duplicate_message_dropped'"
```

### 4.3 Dashboard minimal Day-1

| Widget | Query/Source | Refresh |
|--------|--------------|---------|
| Messages traités / heure | `count(event='message_sent')` | 1 min |
| Erreurs / heure | `count(level='error')` | 1 min |
| Queue depth | `redis-cli llen bull:messageProcessor:waiting` | 30s |
| Latence moyenne | `avg(duration) WHERE event='message_sent'` | 1 min |
| Top 5 tenants actifs | `group by tenantId, count(*)` | 5 min |

### 4.4 Commandes de diagnostic

```bash
# Santé générale
curl http://localhost:3000/health

# Queue status (via redis-cli)
docker exec -it sylion-redis redis-cli <<EOF
echo "=== Queue Status ==="
llen bull:messageProcessor:waiting
llen bull:messageProcessor:active
llen bull:messageProcessor:failed
EOF

# Logs temps réel avec filtre
docker logs -f sylion-backend 2>&1 | grep -E "error|warn|quota_exceeded|rate_limited"

# Derniers jobs échoués
docker exec -it sylion-redis redis-cli lrange bull:messageProcessor:failed 0 5
```

---

## 5. Sécurité & Conformité

### 5.1 Protection des données personnelles

| Check | Implémentation | Validation |
|:-----:|----------------|------------|
| ☐ | Numéros masqués dans logs | `maskPhoneNumber()` utilisé (20+ occurrences) |
| ☐ | Pas de PII en clair dans Redis | Vérifier clés Redis |
| ☐ | Messages chiffrés at-rest (PostgreSQL) | Encryption disque |
| ☐ | TLS en transit | HTTPS uniquement |

**Vérification masquage:**
```bash
# Chercher des numéros en clair dans les logs (ne devrait rien retourner)
grep -E "\+?[0-9]{10,15}" /var/log/sylion/*.log | grep -v "XXX"
# Attendu: aucun résultat (numéros masqués en XXX)
```

### 5.2 Gestion des secrets

| Secret | Stockage | Rotation |
|--------|----------|----------|
| `JWT_SECRET` | Env var / Secret manager | Annuelle |
| `WHATSAPP_API_KEY` | Env var / Secret manager | Selon provider |
| `GOOGLE_APPLICATION_CREDENTIALS` | Fichier service account | Annuelle |
| `DATABASE_URL` | Env var | Selon politique |

**⚠️ Jamais en clair dans:**
- Code source
- Logs
- Réponses API
- Messages d'erreur

### 5.3 Protection des endpoints admin

| Endpoint | Protection | Vérification |
|----------|------------|--------------|
| `/api/v1/admin/*` | JWT + rôle admin | Token requis |
| `/api/v1/tenants/*` | JWT + super-admin | Token requis |
| `/health` | Public | OK (pas de données sensibles) |
| `/api/v1/whatsapp/webhook` | Authentification webhook (selon provider) | Voir détails ci-dessous |

**Authentification webhook - selon provider:**
- **A) Meta direct:** Vérifier header `X-Hub-Signature-256` (HMAC SHA-256 du payload)
- **B) Provider (ex: 360dialog):** Signature/header provider ou token partagé. *Statut actuel: N/A / à confirmer selon implémentation.*

### 5.4 Rate limiting (protection DDoS)

| Couche | Protection | Config |
|--------|------------|--------|
| Nginx | Limite connexions | `limit_conn_zone`, `limit_req_zone` |
| Application | Rate limit par conversation | 5 msg / 30s |
| Application | Rate limit par sender | 20 msg / 5 min |
| Redis | Fail-open (dégradé) | Service continue sans protection |

---

## 6. Plan de Rollback

### 6.1 Rollback immédiat (< 5 minutes)

**Scénario:** Bug critique détecté en production

```bash
# 1. Désactiver le webhook côté Meta/Provider
# (via console provider - priorité absolue)

# 2. Stopper le backend (arrête API + workers)
# Option A: Docker Compose (recommandé)
docker-compose -f docker-compose.prod.yml stop sylion-backend

# Option B: Si service systemd
# sudo systemctl stop sylion-backend

# Note: Adapter selon votre mode d'exécution (Docker, PM2, systemd, etc.)

# 3. Vérifier que la queue ne traite plus
docker exec -it sylion-redis redis-cli llen bull:messageProcessor:active
# Attendu: 0

# 4. Les messages sont en attente dans Redis (pas perdus)
docker exec -it sylion-redis redis-cli llen bull:messageProcessor:waiting
```

### 6.2 Rollback code (< 15 minutes)

```bash
# 1. Identifier le commit stable précédent
git log --oneline -10

# 2. Revert au commit stable
git checkout <commit-stable>

# 3. Rebuild et redéployer
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 4. Vérifier santé
curl http://localhost:3000/health

# 5. Réactiver webhook côté provider
```

### 6.3 Rollback données (si corruption)

```bash
# 1. Restaurer depuis backup PostgreSQL
./scripts/restore_postgres.sh backups/postgres/backup_YYYYMMDD.sql

# 2. Vérifier intégrité
npm run db:migrate

# 3. Redémarrer services
docker-compose -f docker-compose.prod.yml restart
```

### 6.4 Contacts escalade

| Niveau | Qui | Quand |
|--------|-----|-------|
| L1 | DevOps on-call | Toute alerte |
| L2 | Backend lead | Erreur non résolue > 15 min |
| L3 | CTO | Indisponibilité > 30 min |

---

## 7. Critères GO / NO-GO

### ✅ Critères GO (tous requis)

| # | Critère | Validation |
|---|---------|------------|
| 1 | **PostgreSQL opérationnel** | `pg_isready` + migrations OK |
| 2 | **Redis opérationnel** | `redis-cli ping` = PONG |
| 3 | **Workers actifs** | Logs de démarrage présents |
| 4 | **Webhook répond 200** | Test curl réussi |
| 5 | **Scénarios A, B, D, E validés** | Tests manuels passés |
| 6 | **Logs visibles** | Accès au système de logging |
| 7 | **Rollback testé** | Procédure exécutée 1 fois en staging |

**Recommandé (non bloquant):**
- Scénario F (Redis down / fail-open) validé en staging

### 🛑 Critères NO-GO (bloquants)

| # | Critère | Impact |
|---|---------|--------|
| 1 | PostgreSQL inaccessible | Aucun message traitable |
| 2 | Variables env manquantes | Serveur refuse de démarrer |
| 3 | Webhook retourne 5xx | Provider va retry en boucle |
| 4 | Rate limiting non fonctionnel | Risque d'abus/surcharge |
| 5 | Pas de procédure rollback | Risque en cas d'incident |

---

## Checklist finale pré-GO-LIVE

```
Date prévue GO-LIVE: ____________________
Responsable: ____________________

INFRASTRUCTURE
☐ PostgreSQL: pg_isready OK
☐ Redis: ping PONG
☐ Workers: 3 workers actifs dans logs
☐ Env vars: toutes présentes (Zod valide)
☐ GCP: authentification OK

WEBHOOK
☐ GET verification: challenge retourné
☐ POST message: HTTP 200, job créé
☐ Legacy endpoint: HTTP 410

SCENARIOS
☐ A - Message normal: réponse LLM reçue
☐ B - Quota exceeded: message fallback, pas de LLM
☐ D - Rate limit: notification unique
☐ E - Idempotence: doublon droppé silencieusement

RECOMMANDE (staging uniquement)
☐ F - Redis down: fail-open validé

OBSERVABILITE
☐ Logs accessibles en temps réel
☐ Alertes configurées (erreurs critiques)
☐ Dashboard minimal opérationnel

SECURITE
☐ Masquage numéros validé
☐ Secrets non exposés
☐ HTTPS configuré

ROLLBACK
☐ Procédure documentée
☐ Testée en staging
☐ Contacts escalade à jour

DECISION
☐ GO - Tous les critères remplis
☐ NO-GO - Critère(s) bloquant(s): ____________________

Signature: ____________________
Date: ____________________
```

---

*Document généré le 2025-12-13 - Pipeline WhatsApp v1.2*
