# Observability Contract

**Version:** 1.0  
**Date:** 2026-01-03  
**Source of Truth:** [OBSERVABILITY_EVENTS.md](../standards/OBSERVABILITY_EVENTS.md)

---

## Mandatory Correlation Identifiers

Every log event in the pipeline MUST include applicable identifiers:

| Identifier | Format | When Required |
|------------|--------|---------------|
| `tenantId` | UUID v4 | After tenant resolution |
| `channelId` | UUID v4 | After channel resolution |
| `conversationId` | UUID v4 | After conversation resolution |
| `messageId` | UUID v4 | After message persistence |
| `jobId` | BullMQ ID | In worker context |
| `providerMessageId` | WhatsApp WAMID | From webhook payload |
| `requestId` | UUID v4 | In HTTP handler (optional in worker) |

---

## Mandatory Log Events

### Reception & Queue

| Event | Component | Trigger |
|-------|-----------|---------|
| `message_received` | `whatsapp.routes.ts` | Webhook POST received |
| `job_added` | `whatsapp_service.ts` | Job enqueued in BullMQ |

### Protection Layer

| Event | Component | Trigger |
|-------|-----------|---------|
| `duplicate_message_dropped` | `rateLimit.ts` | Message already processed |
| `rate_limited` | `rateLimit.ts` | Sender exceeded rate limit |
| `quota_exceeded` | `messageProcessor.worker.ts` | Tenant quota exhausted |
| `quota_blocked_cached` | `messageProcessor.worker.ts` | Conversation already blocked |

### Processing

| Event | Component | Trigger |
|-------|-----------|---------|
| `llm_request` | `messageProcessor.worker.ts` | Before `generateReply()` call |
| `llm_request_completed` | `messageProcessor.worker.ts` | After `generateReply()` success |
| `message_sent` | `messageProcessor.worker.ts` | After DB persist + provider send |

### Errors

| Event | Component | Trigger |
|-------|-----------|---------|
| `job_failed` | `jobs/index.ts` | BullMQ job failure |
| `job_retry_scheduled` | `jobs/index.ts` | Retry scheduled after failure |

---

## Minimal Required Metrics

| Metric | Intent | How to Compute |
|--------|--------|----------------|
| `end_to_end_latency` | User experience | `message_sent.timestamp - message_received.timestamp` |
| `provider_error_rate` | WhatsApp API health | `count(job_failed where error contains 'provider')` / `count(job_added)` |
| `queue_backlog_depth` | System saturation | BullMQ `getWaitingCount()` |
| `llm_error_rate` | LLM API health | `count(job_failed) - count(llm_request_completed)` / `count(llm_request)` |
| `quota_rejection_rate` | Tenant billing health | `count(quota_exceeded)` / `count(job_added)` |
| `llm_latency_p95` | Cost & performance | `p95(llm_request_completed.durationMs)` |

---

## Event Field Requirements

### `message_received`
```
event: 'message_received'
provider: string          # '360dialog' | 'meta'
providerMessageId: string # WAMID
from: string              # masked phone
timestamp: string         # ISO 8601
requestId: string         # HTTP request ID
```

### `job_added`
```
event: 'job_added'
queue: string
jobId: string
tenantId: string
channelId: string
conversationId: string
messageId: string
providerMessageId: string
requestId?: string
```

### `llm_request`
```
event: 'llm_request'
jobId: string
providerMessageId: string
conversationId: string
tenantId: string
channelId: string
reason: string
requestId?: string
```

### `llm_request_completed`
```
event: 'llm_request_completed'
jobId: string
providerMessageId: string
conversationId: string
tenantId: string
channelId: string
durationMs: number
replyLength: number
ragUsed: boolean
requestId?: string
```

### `message_sent`
```
event: 'message_sent'
direction: 'outbound'
jobId: string
providerMessageId: string
conversationId: string
tenantId: string
channelId: string
messageId: string
botPhone: string
to: string
replyLength: number
requestId?: string
```

### `job_failed`
```
event: 'job_failed'
jobId: string
jobName: string
queue: string
workerName: string
attemptsMade: number
attemptsMax: number
willRetry: boolean
error: string
providerMessageId?: string
tenantId?: string
channelId?: string
conversationId?: string
requestId?: string
```

---

## Known Monitoring Gaps

| Gap | Status | Plan |
|-----|--------|------|
| No distinct `llm_error` event | Not blocking | P2: Add post-prod |
| No `rag_called` event | Not blocking | Add when RAG in scope |
| No real-time dashboards | Not blocking | P3: Grafana setup |
| No automated alerting | Not blocking | P3: PagerDuty integration |
| No distributed tracing (OpenTelemetry) | Not blocking | Future iteration |

---

*This contract is enforced by unit tests in `test/unit/whatsapp-observability.unit.test.ts`.*
