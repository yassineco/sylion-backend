# Minimal Runbook

**Version:** 1.0  
**Date:** 2026-01-03  
**Scope:** WhatsApp pipeline incidents only

---

## 1. No WhatsApp Responses

### Symptoms
- Users report bot not responding
- `message_sent` events absent from logs
- WhatsApp shows messages delivered but no reply

### Immediate Checks
1. Check BullMQ queue depth: `redis-cli LLEN bull:incoming-messages:wait`
2. Verify worker is running: `docker ps | grep worker`
3. Search for recent `job_failed` events: filter by `event: 'job_failed'`
4. Check LLM provider status (OpenAI/Vertex status page)
5. Verify Redis connectivity: `redis-cli PING`
6. Check for `quota_exceeded` events (tenant may be blocked)

### First Safe Actions
- Restart worker container: `docker restart sylion-worker`
- If queue depth > 1000: pause new webhooks temporarily
- If LLM errors: check API key validity in env vars
- Do NOT clear the queue (messages would be lost)

---

## 2. LLM Cost Spike

### Symptoms
- Billing alerts from OpenAI/Vertex
- Unusually high `llm_request` event count
- Normal `message_received` count (not a traffic spike)

### Immediate Checks
1. Count `llm_request` events per tenant in last hour
2. Check for missing `quota_exceeded` events (quota not blocking)
3. Verify `rate_limited` events are being emitted
4. Check for duplicate `llm_request` with same `providerMessageId`
5. Verify idempotence Redis keys exist: `redis-cli KEYS idemp:*`
6. Check conversation context length (long contexts = more tokens)

### First Safe Actions
- Identify top tenant by `llm_request` count
- Temporarily lower quota for affected tenant via admin API
- If duplicates found: verify Redis idempotence TTL (should be 24h)
- Do NOT disable LLM globally (all tenants would be affected)

---

## 3. Cross-Tenant Data Risk

### Symptoms
- User reports seeing another tenant's data
- Logs show mismatched `tenantId` values
- Message content appears in wrong conversation

### Immediate Checks
1. Identify affected messages by `providerMessageId`
2. Trace full event chain: `message_received` → `job_added` → `message_sent`
3. Verify `tenantId` consistency across all events for same `providerMessageId`
4. Check channel-to-tenant mapping in database
5. Verify RLS policies are enabled: `SELECT * FROM pg_policies`
6. Check for recent schema migrations that may have affected RLS

### First Safe Actions
- Capture full log chain for affected message (preserve evidence)
- Verify no direct SQL queries bypassing RLS
- Check if affected tenant shares phone number with another tenant
- Do NOT delete data (preserve for forensic analysis)
- Escalate immediately to Staff Engineer if confirmed

---

## Quick Reference

| Scenario | Key Event to Search | Key ID to Trace |
|----------|---------------------|-----------------|
| No responses | `job_failed` | `jobId` |
| Cost spike | `llm_request` | `tenantId` |
| Data leak | All events | `providerMessageId` |

---

*For detailed architecture, see [whatsapp-pipeline.md](../architecture/whatsapp-pipeline.md).*
