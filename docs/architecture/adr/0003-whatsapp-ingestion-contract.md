# ADR-0003: WhatsApp Ingestion Contract

## Status

**Accepted**

## Date

2025-12-25

## Context

WhatsApp message ingestion was observed to silently fail despite the webhook returning HTTP 200. Investigation revealed multiple root causes:

1. **Payload structure mismatch**: The controller-level payload detection logic and the normalizer expected different payload structures. The normalizer expected `{ provider, body.messages[] }` but the controller detected messages using a different pattern.

2. **Missing channel in database**: Message processing failed when no WhatsApp channel existed in the database. The worker requires a channel record to resolve tenant context.

3. **Channel resolution logic**: The `findChannelByPhoneNumber()` function resolves channels by checking:
   - `channel.type === 'whatsapp'`
   - `channel.isActive === true`
   - `channel.config.phoneNumber === message.channelPhoneNumber` OR `channel.config.businessPhoneNumber === message.channelPhoneNumber`

4. **Phone number format**: The `message.channelPhoneNumber` is expected to be a normalized E.164 phone number (e.g., `+212600000002`).

The combination of these factors caused messages to be accepted at the HTTP layer but dropped during processing, with no visible error to the sender.

## Decision

The following contracts are established for WhatsApp message ingestion:

### 1. Channel Configuration Contract

A WhatsApp channel MUST have:
- `type`: `"whatsapp"`
- `isActive`: `true`
- `config.phoneNumber` OR `config.businessPhoneNumber`: A valid E.164 phone number matching the incoming message's `channelPhoneNumber`

### 2. Payload Normalization Contract

The normalizer expects incoming WhatsApp payloads to be structured with:
- `provider`: The WhatsApp provider identifier (e.g., `"360dialog"`)
- `body.messages[]`: Array of message objects from the webhook payload

### 3. Development Environment Contract

Developers MUST seed a WhatsApp channel before testing end-to-end message processing. A dedicated seed script is provided for this purpose.

## Consequences

### What developers must know

1. **HTTP 200 does not guarantee processing**: The webhook returns 200 to acknowledge receipt, but processing may fail silently if:
   - No matching channel exists in the database
   - The channel is inactive
   - The phone number in `channel.config` does not match the incoming message

2. **Channel configuration is critical**: The `config.phoneNumber` field must exactly match the E.164-formatted phone number used by the WhatsApp provider.

3. **Development requires seeding**: A WhatsApp channel must exist in the database before messages can be processed in development.

### Risks

- Silent failures may occur if channel configuration drifts from provider configuration.
- Phone number format mismatches (e.g., missing `+` prefix) will cause resolution failures.

## Mitigations

1. **Dev seed script**: `scripts/seed-dev-channel.ts` creates an idempotent WhatsApp channel for development testing.

2. **Documentation**: 
   - Operations runbook: `docs/operations/whatsapp-debugging.md`
   - Onboarding guide: `docs/onboarding/dev-seed-whatsapp.md`

3. **Logging**: The worker logs channel resolution failures, enabling debugging via application logs.

## References

- `src/jobs/messageProcessor.worker.ts` — `findChannelByPhoneNumber()` implementation
- `scripts/seed-dev-channel.ts` — Development seed script
