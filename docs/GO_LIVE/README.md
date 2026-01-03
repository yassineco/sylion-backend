# GO-LIVE Contract

**Version:** 1.0  
**Date:** 2026-01-03  
**Status:** 🟢 Production Ready  

---

## Scope

This GO-LIVE contract covers:

- WhatsApp text message processing (inbound/outbound)
- BullMQ job queues and workers
- LLM integration (OpenAI/Vertex)
- Tenant quota enforcement
- Rate limiting and idempotence

This GO-LIVE contract does NOT cover:

- WhatsApp media messages (images, audio, documents)
- Voice channels
- Web widget channels
- Admin console UI

---

## Production-Ready Definition

A system is production-ready when:

1. **Observability contract exists and is enforced**
   - All mandatory events are emitted
   - Correlation IDs are present in every log
   - Metrics endpoints are functional

2. **Invariants are tested, not just documented**
   - L1–L6 invariants have unit tests
   - Blocking paths (quota, rate-limit, duplicate) are covered
   - Event contract tests validate required fields

3. **Correlation IDs are exploitable in real incidents**
   - `providerMessageId` traces a message end-to-end
   - `jobId` links queue entry to worker completion
   - `requestId` connects HTTP layer to job layer

4. **Residual technical debt is known and non-blocking**
   - See [Known Gaps](#known-gaps) below
   - No gap prevents incident response
   - No gap causes data loss or cross-tenant leakage

---

## Non-Negotiable Guarantees

| Guarantee | Proof |
|-----------|-------|
| Tenant isolation | RLS policies on all tables |
| No LLM call without quota check | L2 invariant + unit tests |
| No duplicate message processing | Idempotence via Redis + L3 invariant |
| All job failures are observable | `job_failed` event with correlation IDs |
| All LLM calls are trackable | `llm_request` + `llm_request_completed` events |

---

## Test Coverage

| Domain | Tests | Status |
|--------|-------|--------|
| Observability A4/A5 | 23 tests | ✅ |
| Rate limiting | 23 tests | ✅ |
| Quota blocking | 22 tests | ✅ |
| **Total** | **67+ unit tests** | ✅ |

---

## Known Gaps

| Gap | Impact | Mitigation | Blocking? |
|-----|--------|------------|-----------|
| No `llm_error` distinct event | Errors grouped in `job_failed` | Filter by error message | ❌ |
| No Grafana dashboards | Manual log queries | SQL queries documented | ❌ |
| TypeScript errors in integration tests | Test files only, not runtime | No production impact | ❌ |
| No PagerDuty integration | Manual alerting | Team monitors logs | ❌ |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [OBSERVABILITY_EVENTS.md](../standards/OBSERVABILITY_EVENTS.md) | Event contract (source of truth) |
| [GO_LIVE_META_READY.md](../operations/GO_LIVE_META_READY.md) | Original GO-LIVE checklist |
| [whatsapp-pipeline.md](../architecture/whatsapp-pipeline.md) | Pipeline architecture |
| [backend-structure.md](../architecture/backend-structure.md) | Codebase structure |
| [API_REFERENCE.md](../API_REFERENCE.md) | API endpoints |

---

## Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Staff Engineer | — | 2026-01-03 | ✅ Approved |
| SRE | — | 2026-01-03 | ✅ Approved |

---

*This document defines the GO-LIVE contract. Changes require Staff Engineer approval.*
