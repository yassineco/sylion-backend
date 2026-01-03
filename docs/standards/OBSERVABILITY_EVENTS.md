# 📊 Contrat d'Observabilité - Events Structurés

**Version:** 1.0  
**Date:** 2026-01-03  
**Statut:** 🟢 Actif  
**Propriétaire:** Équipe Backend  

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Events Officiels](#2-events-officiels)
3. [Invariants Contractuels](#3-invariants-contractuels)
4. [Champs Communs Obligatoires](#4-champs-communs-obligatoires)
5. [Anti-patterns Interdits](#5-anti-patterns-interdits)
6. [Historique des Versions](#6-historique-des-versions)

---

## 1. Introduction

### 1.1 Rôle des Events

Les events structurés constituent le **contrat runtime** entre le code applicatif et les systèmes d'observabilité (monitoring, alerting, audit, GO-LIVE).

Chaque event est une **assertion vérifiable** sur l'état du système à un instant donné.

### 1.2 Principe Fondamental

> **"If it's not logged, it didn't happen."**

Un comportement métier critique **DOIT** être accompagné d'un event structuré. L'absence d'event implique l'absence de comportement.

### 1.3 Documents Liés

| Document | Relation |
|----------|----------|
| [GO_LIVE_META_READY.md](../operations/GO_LIVE_META_READY.md) | Les critères GO/NO-GO reposent sur ces events |
| [whatsapp-pipeline.md](../architecture/whatsapp-pipeline.md) | Architecture du pipeline utilisant ces events |

---

## 2. Events Officiels

### 2.1 Pipeline WhatsApp - Réception & Queue

| Event | Composant | Moment | Description |
|-------|-----------|--------|-------------|
| `message_received` | `whatsapp.routes.ts` | Début du handler POST webhook | Un message WhatsApp entrant a été reçu par l'API |
| `job_added` | `whatsapp_service.ts` | Après succès `addJob()` BullMQ | Le job de traitement a été ajouté à la queue |

#### `message_received`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'message_received'` |
| `provider` | `string` | Provider source (`'360dialog'`, `'meta'`, `'unknown'`) |
| `providerMessageId` | `string` | ID message côté provider |
| `from` | `string` | Numéro expéditeur (masqué) |
| `timestamp` | `string` | ISO 8601 |
| `requestId` | `string` | ID de la requête HTTP |

#### `job_added`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'job_added'` |
| `queue` | `string` | Nom de la queue (`'whatsapp:process-incoming'`) |
| `jobId` | `string` | ID du job BullMQ (A4 corrélation) |
| `tenantId` | `string` | ID du tenant |
| `channelId` | `string` | ID du channel |
| `conversationId` | `string` | ID de la conversation |
| `messageId` | `string` | ID du message en DB |
| `providerMessageId` | `string` | ID message côté provider |

**Champs optionnels:**
| Champ | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | ID de la requête HTTP (A4 corrélation webhook→job) |

---

### 2.2 Pipeline WhatsApp - Protection Anti-abus

| Event | Composant | Moment | Description |
|-------|-----------|--------|-------------|
| `duplicate_message_dropped` | `rateLimit.ts` | Après détection doublon Redis | Message en double ignoré (idempotence) |
| `idempotence_no_id` | `rateLimit.ts` | Check idempotence sans ID | Pas d'ID provider fourni, check ignoré |
| `idempotence_check_error` | `rateLimit.ts` | Erreur Redis idempotence | Échec du check, fail-open appliqué |
| `rate_limited` | `rateLimit.ts` | Limite dépassée | Message bloqué par rate limiting |
| `rate_limit_check_error` | `rateLimit.ts` | Erreur Redis rate limit | Échec du check, fail-open appliqué |
| `rate_limit_reply_sent` | `messageProcessor.worker.ts` | Après envoi message rate limit | Message utilisateur de rate limit envoyé |

#### `duplicate_message_dropped`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'duplicate_message_dropped'` |
| `providerMessageId` | `string` | ID du message dupliqué |
| `tenantId` | `string` | ID du tenant |

#### `rate_limited`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'rate_limited'` |
| `tenantId` | `string` | ID du tenant |
| `conversationId` | `string` | ID de la conversation (si scope conversation) |
| `senderId` | `string` | ID du sender (si scope sender) |
| `scope` | `string` | `'conversation'` ou `'sender'` |
| `currentCount` | `number` | Nombre de messages dans la fenêtre |
| `limit` | `number` | Limite configurée |
| `windowSeconds` | `number` | Taille de la fenêtre en secondes |
| `alreadyNotified` | `boolean` | Utilisateur déjà notifié dans cette fenêtre |

#### `idempotence_no_id`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'idempotence_no_id'` |
| `tenantId` | `string` | ID du tenant |

#### `idempotence_check_error`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'idempotence_check_error'` |
| `providerMessageId` | `string` | ID du message |
| `tenantId` | `string` | ID du tenant |
| `error` | `string` | Message d'erreur |

#### `rate_limit_check_error`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'rate_limit_check_error'` |
| `tenantId` | `string` | ID du tenant |
| `conversationId` | `string` | ID de la conversation |
| `senderId` | `string` | ID du sender |
| `error` | `string` | Message d'erreur |

#### `rate_limit_reply_sent`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'rate_limit_reply_sent'` |
| `conversationId` | `string` | ID de la conversation |
| `tenantId` | `string` | ID du tenant |
| `to` | `string` | Numéro destinataire (masqué) |

---

### 2.3 Pipeline WhatsApp - Quota

| Event | Composant | Moment | Description |
|-------|-----------|--------|-------------|
| `quota_exceeded` | `messageProcessor.worker.ts` | Service quota retourne `allowed: false` | Premier dépassement de quota détecté |
| `quota_blocked_cached` | `messageProcessor.worker.ts` | Flag `quotaBlocked` déjà présent | Quota bloqué via cache conversationnel |
| `quota_exceeded_handled` | `messageProcessor.worker.ts` | Après envoi message fallback quota | Message utilisateur de quota envoyé |

#### `quota_exceeded`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'quota_exceeded'` |
| `jobId` | `string` | ID du job BullMQ |
| `tenantId` | `string` | ID du tenant |
| `conversationId` | `string` | ID de la conversation |
| `reason` | `string` | Raison du dépassement |

**Champs optionnels:**
| Champ | Type | Description |
|-------|------|-------------|
| `currentUsage` | `number` | Usage actuel |
| `limit` | `number` | Limite configurée |

#### `quota_blocked_cached`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'quota_blocked_cached'` |
| `jobId` | `string` | ID du job BullMQ |
| `tenantId` | `string` | ID du tenant |
| `conversationId` | `string` | ID de la conversation |

#### `quota_exceeded_handled`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'quota_exceeded_handled'` |
| `jobId` | `string` | ID du job BullMQ |
| `tenantId` | `string` | ID du tenant |
| `conversationId` | `string` | ID de la conversation |
| `quotaBlocked` | `boolean` | Flag mis à jour |

**Champs optionnels:**
| Champ | Type | Description |
|-------|------|-------------|
| `fallbackMessageId` | `string` | ID du message fallback créé |

---

### 2.4 Pipeline WhatsApp - Traitement IA

| Event | Composant | Moment | Description |
|-------|-----------|--------|-------------|
| `llm_request` | `messageProcessor.worker.ts` | Juste AVANT `generateReply()` | Appel LLM initié (tentative) |
| `llm_request_completed` | `messageProcessor.worker.ts` | Juste APRÈS `generateReply()` (succès) | Appel LLM terminé avec succès (confirmation L1) |
| `message_sent` | `messageProcessor.worker.ts` | Après persistance DB + envoi provider réussi | Réponse assistant persistée (L4) et envoyée |

#### `llm_request`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'llm_request'` |
| `jobId` | `string` | ID du job BullMQ (A4 corrélation) |
| `providerMessageId` | `string` | ID message WhatsApp provider (A4 corrélation) |
| `conversationId` | `string` | ID de la conversation |
| `tenantId` | `string` | ID du tenant |
| `channelId` | `string` | ID du channel |
| `reason` | `string` | Raison de l'appel (`'normal'`) |

**Champs optionnels:**
| Champ | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | ID de la requête HTTP (A4 corrélation) |

#### `llm_request_completed`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'llm_request_completed'` |
| `jobId` | `string` | ID du job BullMQ (A4 corrélation) |
| `providerMessageId` | `string` | ID message WhatsApp provider (A4 corrélation) |
| `conversationId` | `string` | ID de la conversation |
| `tenantId` | `string` | ID du tenant |
| `channelId` | `string` | ID du channel |
| `durationMs` | `number` | Durée de l'appel LLM en millisecondes |
| `replyLength` | `number` | Longueur de la réponse LLM |
| `ragUsed` | `boolean` | `true` si RAG a été utilisé |

**Champs optionnels:**
| Champ | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | ID de la requête HTTP (A4 corrélation) |

#### `message_sent`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'message_sent'` |
| `direction` | `string` | `'outbound'` — indique explicitement un message sortant |
| `jobId` | `string` | ID du job BullMQ (A4 corrélation) |
| `providerMessageId` | `string` | ID message provider original (A4 corrélation) |
| `conversationId` | `string` | ID de la conversation |
| `tenantId` | `string` | ID du tenant |
| `channelId` | `string` | ID du channel |
| `messageId` | `string` | ID du message assistant persisté en DB (preuve L4) |
| `botPhone` | `string` | Numéro du bot/channel (masqué) — émetteur de la réponse |
| `to` | `string` | Numéro destinataire de la réponse (= utilisateur inbound, masqué) |
| `replyLength` | `number` | Longueur du message envoyé |

**Champs optionnels:**
| Champ | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | ID de la requête HTTP (A4 corrélation) |

---

### 2.5 Pipeline BullMQ - Gestion des Erreurs (A5)

| Event | Composant | Moment | Description |
|-------|-----------|--------|-------------|
| `job_failed` | `jobs/index.ts` | Handler BullMQ `worker.on('failed')` | Un job a échoué (peut être retryé) |
| `job_retry_scheduled` | `jobs/index.ts` | Handler BullMQ `worker.on('failed')` si retry prévu | Retry planifié pour un job échoué |

#### `job_failed`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'job_failed'` |
| `jobId` | `string` | ID du job BullMQ |
| `jobName` | `string` | Nom/type du job (ex: `'whatsapp:process-incoming'`) |
| `queue` | `string` | Nom de la queue |
| `workerName` | `string` | Nom du worker |
| `attemptsMade` | `number` | Nombre de tentatives effectuées |
| `attemptsMax` | `number` | Nombre max de tentatives configurées |
| `willRetry` | `boolean` | `true` si un retry est planifié |
| `error` | `string` | Message d'erreur |

**Champs optionnels (si disponibles dans job.data):**
| Champ | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | ID de la requête HTTP (A4 corrélation) |
| `providerMessageId` | `string` | ID message WhatsApp provider (A4 corrélation) |
| `tenantId` | `string` | ID du tenant |
| `channelId` | `string` | ID du channel |
| `conversationId` | `string` | ID de la conversation |

#### `job_retry_scheduled`

**Champs obligatoires:**
| Champ | Type | Description |
|-------|------|-------------|
| `event` | `string` | `'job_retry_scheduled'` |
| `jobId` | `string` | ID du job BullMQ |
| `jobName` | `string` | Nom/type du job |
| `queue` | `string` | Nom de la queue |
| `attemptsMade` | `number` | Nombre de tentatives déjà effectuées |
| `attemptsMax` | `number` | Nombre max de tentatives |
| `nextAttempt` | `number` | Numéro de la prochaine tentative |

**Champs optionnels (si disponibles dans job.data):**
| Champ | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | ID de la requête HTTP (A4 corrélation) |
| `providerMessageId` | `string` | ID message WhatsApp provider (A4 corrélation) |
| `tenantId` | `string` | ID du tenant |
| `channelId` | `string` | ID du channel |
| `conversationId` | `string` | ID de la conversation |

---

## 3. Invariants Contractuels

Cette section définit les **règles absolues** qui ne doivent jamais être violées.

### 3.1 Lois d'Émission des Events

| ID | Invariant | Conséquence si violé |
|----|-----------|---------------------|
| **L1** | `llm_request` indique une **tentative** d'appel LLM ; `llm_request_completed` confirme le **succès** | Métriques faussées, coûts non trackés |
| **L2** | Si `quota_exceeded` OU `rate_limited` ⇒ `llm_request` NE DOIT PAS exister | Gaspillage de tokens LLM |
| **L3** | Si `duplicate_message_dropped` ⇒ aucun autre event de traitement ne suit | Traitement en double |
| **L4** | `message_sent` DOIT correspondre à un message persisté en DB | Incohérence données/logs |
| **L5** | `recordUsage()` NE DOIT JAMAIS être appelé sans `llm_request` préalable | Compteurs corrompus |
| **L6** | `job_failed` DOIT exister pour chaque échec de job BullMQ | Erreurs non observables |

### 3.2 Ordre des Events (Pipeline Normal)

```
message_received → job_added → llm_request → llm_request_completed → message_sent
```

### 3.3 Ordre des Events (Quota Bloqué)

```
message_received → job_added → quota_exceeded → quota_exceeded_handled
                                    OU
message_received → job_added → quota_blocked_cached → quota_exceeded_handled
```

### 3.4 Ordre des Events (Rate Limited)

```
message_received → job_added → rate_limited → [rate_limit_reply_sent]
```

### 3.5 Ordre des Events (Doublon)

```
message_received → job_added → duplicate_message_dropped
```

### 3.6 Ordre des Events (Job Failed + Retry)

```
message_received → job_added → llm_request → [error] → job_failed + job_retry_scheduled
                                                      ↓ (retry)
                                              llm_request → message_sent
```

### 3.7 Ordre des Events (Job Failed - Max Attempts)

```
message_received → job_added → llm_request → [error] → job_failed (willRetry: false)
```

---

## 4. Champs Communs Obligatoires

Lorsqu'ils sont disponibles dans le contexte, les champs suivants DOIVENT être inclus :

| Champ | Type | Quand inclure |
|-------|------|---------------|
| `tenantId` | `string` | Toujours après résolution tenant |
| `channelId` | `string` | Toujours après résolution channel |
| `conversationId` | `string` | Toujours après résolution conversation |
| `providerMessageId` | `string` | Dès que disponible (webhook/job) |
| `requestId` | `string` | Dans les routes HTTP |
| `jobId` | `string` | Dans les workers BullMQ |

### 4.1 Format des Champs

| Champ | Format | Exemple |
|-------|--------|---------|
| `timestamp` | ISO 8601 | `2026-01-03T14:30:00.000Z` |
| `to` / `from` | Masqué via `maskPhoneNumber()` | `33612****78` |
| `tenantId` | UUID v4 | `a1b2c3d4-...` |

---

## 5. Anti-patterns Interdits

### 5.1 Violations Strictement Interdites

| Anti-pattern | Pourquoi c'est interdit |
|--------------|------------------------|
| Créer un nouvel event sans mise à jour de ce document | Contrat non synchronisé avec le code |
| Renommer un event existant | Cassure des dashboards et alertes |
| Émettre un event sans `tenantId` quand il est connu | Impossible de filtrer par tenant |
| Émettre `llm_request` sans appel LLM réel | Métriques de coût faussées |
| Omettre `event` dans un log structuré critique | Non détectable par les systèmes d'observabilité |
| Utiliser un niveau de log incorrect (`debug` au lieu de `info`) | Event non visible en production |

### 5.2 Processus d'Ajout d'un Nouvel Event

1. Créer une PR avec la modification de ce document
2. Obtenir l'approbation d'un Staff Engineer
3. Implémenter le code émettant l'event
4. Ajouter un test validant l'émission
5. Mettre à jour les dashboards/alertes si nécessaire

---

## 6. Example — WhatsApp End-to-End Trace

Cette section montre comment les events se corrèlent dans un traitement réel.

### 6.1 Identifiants de Corrélation

| Identifiant | Rôle | Portée | Obligatoire |
|-------------|------|--------|-------------|
| `providerMessageId` | **Identifiant métier principal** — relie message WhatsApp au traitement complet | Webhook → DB → LLM → Réponse | ✅ Oui |
| `jobId` | Identifiant technique BullMQ — permet de suivre le job dans la queue | Queue → Worker → Error handlers | ✅ Oui (worker) |
| `requestId` | Identifiant HTTP — orienté debug des requêtes API | Webhook handler uniquement | ❌ Optionnel |

### 6.2 Trace Complète — Scénario Normal

```json
// 1️⃣ message_received (webhook entry)
{
  "event": "message_received",
  "provider": "360dialog",
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "from": "33612****78",
  "requestId": "req-abc-123",
  "timestamp": "2026-01-03T14:30:00.000Z"
}

// 2️⃣ job_added (queue entry)
{
  "event": "job_added",
  "queue": "whatsapp:process-incoming",
  "jobId": "bullmq-job-456",
  "tenantId": "tenant-uuid",
  "channelId": "channel-uuid",
  "conversationId": "conv-uuid",
  "messageId": "msg-uuid",
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "requestId": "req-abc-123"
}

// 3️⃣ llm_request (LLM attempt)
{
  "event": "llm_request",
  "jobId": "bullmq-job-456",
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "conversationId": "conv-uuid",
  "tenantId": "tenant-uuid",
  "channelId": "channel-uuid",
  "requestId": "req-abc-123",
  "reason": "normal"
}

// 4️⃣ llm_request_completed (LLM success confirmation)
{
  "event": "llm_request_completed",
  "jobId": "bullmq-job-456",
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "conversationId": "conv-uuid",
  "tenantId": "tenant-uuid",
  "channelId": "channel-uuid",
  "durationMs": 1234,
  "replyLength": 256,
  "ragUsed": true,
  "requestId": "req-abc-123"
}

// 5️⃣ message_sent (response sent + persisted)
{
  "event": "message_sent",
  "direction": "outbound",
  "jobId": "bullmq-job-456",
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "conversationId": "conv-uuid",
  "tenantId": "tenant-uuid",
  "channelId": "channel-uuid",
  "messageId": "assistant-msg-uuid",
  "botPhone": "33698****32",
  "to": "33612****78",
  "replyLength": 256,
  "requestId": "req-abc-123"
}
```

### 6.3 Trace — Scénario Job Failed + Retry

```json
// ... message_received, job_added, llm_request ...

// ❌ job_failed (error occurred)
{
  "event": "job_failed",
  "jobId": "bullmq-job-456",
  "jobName": "whatsapp:process-incoming",
  "queue": "incoming-messages",
  "workerName": "Incoming Messages",
  "attemptsMade": 1,
  "attemptsMax": 3,
  "willRetry": true,
  "error": "LLM provider timeout",
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "requestId": "req-abc-123",
  "tenantId": "tenant-uuid"
}

// 🔄 job_retry_scheduled (retry planned)
{
  "event": "job_retry_scheduled",
  "jobId": "bullmq-job-456",
  "jobName": "whatsapp:process-incoming",
  "queue": "incoming-messages",
  "attemptsMade": 1,
  "attemptsMax": 3,
  "nextAttempt": 2,
  "providerMessageId": "wamid.HBgLMzM2XXXXXXXXXXXX==",
  "requestId": "req-abc-123",
  "tenantId": "tenant-uuid"
}
```

### 6.4 Clarifications Importantes

| Concept | Explication |
|---------|-------------|
| `llm_request` | **Tentative** d'appel LLM — émis AVANT `generateReply()` |
| `llm_request_completed` | **Confirmation de succès** — émis APRÈS `generateReply()` réussit. Absent si erreur LLM. |
| `providerMessageId` | **Clé de corrélation principale** — permet de retracer tout le cycle de vie d'un message WhatsApp |
| `requestId` | **Optionnel, orienté debug HTTP** — utile pour corréler avec les logs du reverse proxy/API gateway |

### 6.5 Requêtes d'Analyse Typiques

```sql
-- Trouver tous les events d'un message WhatsApp spécifique
SELECT * FROM logs 
WHERE data->>'providerMessageId' = 'wamid.HBgLMzM2XXXXXXXXXXXX=='
ORDER BY timestamp;

-- Vérifier que llm_request_completed suit toujours llm_request
SELECT 
  job_id,
  COUNT(*) FILTER (WHERE event = 'llm_request') as llm_attempts,
  COUNT(*) FILTER (WHERE event = 'llm_request_completed') as llm_successes
FROM logs
WHERE event IN ('llm_request', 'llm_request_completed')
GROUP BY job_id
HAVING COUNT(*) FILTER (WHERE event = 'llm_request') > 
       COUNT(*) FILTER (WHERE event = 'llm_request_completed');

-- Jobs échoués sans retry (max attempts reached)
SELECT * FROM logs 
WHERE event = 'job_failed' AND data->>'willRetry' = 'false';
```

---

## 7. Historique des Versions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | 2026-01-03 | Équipe Backend | Création initiale avec 13 events officiels |
| 1.1 | 2026-01-03 | Staff SRE | Ajout section End-to-End Trace + clarifications corrélation |

---

*Ce document est la source de vérité pour tous les events structurés du pipeline WhatsApp.*
