# WhatsApp Pipeline v1 - Architecture Technique

> **Statut :** Contractuel  
> **Version :** 1.2  
> **Dernière mise à jour :** 2026-01-03

---

## 1. Vue d'ensemble

Le pipeline WhatsApp v1 traite les messages entrants depuis les webhooks WhatsApp jusqu'à la génération de réponse IA.

### 1.1 Composants principaux

| Composant | Chemin | Rôle |
|-----------|--------|------|
| Endpoint webhook | `POST /api/v1/whatsapp/webhook` | Point d'entrée unique des messages WhatsApp |
| Worker | `src/jobs/messageProcessor.worker.ts` | Traitement asynchrone des messages |
| Queue | `whatsapp:process-incoming` | File BullMQ pour le traitement |
| Messages i18n | `src/lib/messages/quota.ts` | Messages utilisateur quota |
| Messages i18n | `src/lib/messages/rateLimit.ts` | Messages utilisateur rate limit |
| Rate Limiting | `src/lib/rateLimit.ts` | Idempotence + rate limiting Redis |

### 1.2 Flux de traitement

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │     │    Webhook      │     │    BullMQ       │
│   Provider      │────▶│    Handler      │────▶│    Queue        │
│   (360dialog)   │     │   /api/v1/...   │     │   incoming-msg  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │     │    LLM          │     │    Worker       │
│   Reply         │◀────│    Generation   │◀────│    Process      │
│                 │     │   (if allowed)  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 2. Protections Anti-Abus (v1.2)

### 2.1 Idempotence

Détection et drop silencieux des messages dupliqués basé sur le `providerMessageId`.

| Aspect | Détails |
|--------|---------|
| Clé Redis | `idempotence:msg:{tenantId}:{providerMessageId}` |
| TTL | 24 heures |
| Comportement | Drop silencieux + log `event: 'duplicate_message_dropped'` |
| Fail-safe | Fail-open (laisse passer en cas d'erreur Redis) |

### 2.2 Rate Limiting

Limitation du nombre de messages par fenêtre temporelle pour protéger la stabilité.

| Scope | Max Requests | Window | Clé Redis |
|-------|--------------|--------|-----------|
| Conversation (prioritaire) | 5 | 30 secondes | `ratelimit:conv:{tenantId}:{conversationId}` |
| Sender (fallback) | 20 | 5 minutes | `ratelimit:sender:{tenantId}:{senderId}` |

**Comportement si rate limit dépassé :**
- LLM **NON** appelé
- `recordUsage()` **NON** appelé
- Message utilisateur envoyé **une seule fois par fenêtre**
- Log `event: 'rate_limited'`

### 2.3 Message utilisateur (i18n-ready)

```
FR: ⚠️ Trop de messages en peu de temps. Merci de réessayer dans quelques instants.
AR: ⚠️ تم إرسال رسائل كثيرة في وقت قصير. يُرجى المحاولة مرة أخرى بعد قليل.
```

---

## 3. Quota Enforcement (v1.1)

### 3.1 Point de contrôle unique

Le contrôle de quota est effectué **exclusivement** dans le worker `messageProcessor.worker.ts`, via deux mécanismes :

1. **Flag conversationnel** : `conversationService.isQuotaBlocked()` - Vérifie si la conversation est déjà marquée comme bloquée
2. **Quota service** : `checkQuotaBeforeLLM()` - Vérifie le quota auprès du service centralisé

### 3.2 Position dans le pipeline (v1.2)

```
1. resolveMessageContext()              ─── Résolution tenant/channel/conversation
2. checkIdempotence()                   ─── ⚠️ IDEMPOTENCE (drop doublons)
   └── isDuplicate: true ───────────────▶ RETURN (drop silencieux)
3. checkRateLimit()                     ─── ⚠️ RATE LIMIT (protection abus)
   └── isLimited: true ─────────────────▶ sendRateLimitReply() + RETURN
4. saveUserMessage()                    ─── Persistance du message utilisateur
5. conversationService.isQuotaBlocked() ─── ⚠️ CHECK CACHE CONVERSATION
   ├── quotaBlocked: true ──────────────▶ sendFallback() + RETURN (skip quota service)
   └── quotaBlocked: false ─────────────▶ continue
6. checkQuotaBeforeLLM()                ─── ⚠️ QUOTA CHECK (BLOQUANT)
   ├── allowed: false ──────────────────▶ setQuotaBlocked(true) + saveFallback() + RETURN
   └── allowed: true ───────────────────▶ continue
7. generateReply()                      ─── Appel LLM (RAG optionnel)
8. saveAssistantMessage()               ─── Persistance réponse
9. sendReplyToWhatsApp()                ─── Envoi WhatsApp
10. updateStats()                       ─── Mise à jour statistiques
```

### 3.3 Comportement conversationnel (MVP)

Le flag `quotaBlocked` est stocké dans `conversations.context` (JSONB) :

```typescript
{
  quotaBlocked: boolean,
  quotaBlockedAt?: string  // ISO timestamp
}
```

| Premier message | Messages suivants |
|-----------------|-------------------|
| Vérification quota service | Skip quota service (optimisation) |
| Si bloqué: `setQuotaBlocked(true)` | Lecture du flag `isQuotaBlocked()` |
| Log: `event: 'quota_exceeded'` | Log: `event: 'quota_blocked_cached'` |

### 3.4 Comportement en cas de quota dépassé

| Condition | LLM appelé | Message persisté | recordUsage appelé |
|-----------|------------|------------------|-------------------|
| `allowed: true` | OUI | Réponse LLM | OUI |
| `allowed: false` | NON | Message fallback | NON |
| `quotaBlocked: true` (cached) | NON | Message fallback | NON |
| Erreur vérification quota | NON (fail-safe) | Message fallback | NON |

### 2.5 Message utilisateur standardisé

Le message fallback est défini dans `src/lib/messages/quota.ts` :

```typescript
// Structure i18n-ready
export const QUOTA_EXCEEDED_USER_MESSAGE = getQuotaMessage('fr');
```

### 2.6 Garanties

- Le message utilisateur est **toujours** persisté, même si le quota est dépassé.
- Aucun appel LLM n'est effectué si `allowed === false` ou `quotaBlocked === true`.
- Le message fallback est persisté avec `metadata.quotaExceeded: true`.
- Aucune consommation de quota n'est enregistrée si le LLM n'est pas appelé.
- Le flag `quotaBlocked` évite des appels redondants au quota service.

---

## 3. Règles d'architecture

### 3.1 Point de contrôle unique (OBLIGATOIRE)

> **RÈGLE :** Le contrôle de quota pour les messages WhatsApp doit être effectué **uniquement** dans `checkQuotaBeforeLLM()` du worker.

**Interdit :**
- Ajouter un contrôle de quota dans le webhook handler
- Ajouter un contrôle de quota dans le service LLM
- Ajouter un contrôle de quota dans le RAG service
- Dupliquer la logique de quota ailleurs dans le pipeline

**Justification :** Un point unique garantit la cohérence du comportement et facilite l'audit.

### 3.2 Fail-safe (OBLIGATOIRE)

> **RÈGLE :** En cas d'erreur lors de la vérification du quota, le comportement par défaut est de **bloquer** l'appel LLM.

```typescript
// Implémentation attendue
try {
  return await quotaService.checkQuota(tenantId, 'message');
} catch (error) {
  // Fail-safe: bloquer si le check échoue
  return { allowed: false, reason: 'quota_check_error' };
}
```

### 3.3 Ordre des opérations (OBLIGATOIRE)

> **RÈGLE :** Le quota doit être vérifié **après** la persistance du message utilisateur et **avant** tout appel au LLM.

Cette séquence garantit :
1. Traçabilité complète des messages reçus
2. Protection des coûts LLM
3. Cohérence des métriques

---

## 5. Références

| Fichier | Description |
|---------|-------------|
| `src/jobs/messageProcessor.worker.ts` | Worker principal avec idempotence, rate limit et quota check |
| `src/lib/rateLimit.ts` | Service idempotence + rate limiting Redis |
| `src/lib/messages/rateLimit.ts` | Messages rate limit i18n-ready |
| `src/lib/messages/quota.ts` | Messages quota i18n-ready |
| `src/modules/quota/quota.service.ts` | Service de vérification des quotas |
| `src/modules/quota/quota.types.ts` | Types `QuotaCheckResult`, `QuotaError` |
| `src/modules/conversation/conversation.service.ts` | Service conversation avec `isQuotaBlocked()` et `setQuotaBlocked()` |
| `test/unit/whatsapp-quota-blocking.unit.test.ts` | Tests unitaires du comportement quota |
| `test/unit/whatsapp-rate-limiting.unit.test.ts` | Tests unitaires du rate limiting |

---

## 6. Changelog

| Date | Version | Modification |
|------|---------|--------------|
| 2026-01-03 | 1.2 | Ajout idempotence (détection doublons) + rate limiting (5 msg/30s par conv) |
| 2026-01-03 | 1.1 | Ajout flag conversationnel `quotaBlocked`, messages i18n-ready, optimisation skip quota service |
| 2026-01-03 | 1.0 | Création initiale avec quota enforcement v1 |
