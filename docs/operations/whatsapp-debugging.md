# WhatsApp Message Processing — Debugging Runbook

This runbook helps diagnose issues where WhatsApp messages are received but not processed.

## Symptoms

- WhatsApp webhook returns HTTP 200
- No conversation is created in the database
- No AI response is sent back to the user
- No error is visible in webhook response
- Application logs may show "No channel found for phone number"

## Debugging Checklist

### Step 1: Verify webhook is receiving messages

Check application logs for incoming webhook requests:

```bash
# Look for webhook entries
grep -i "webhook" /tmp/sylion-dev.log | tail -20
```

If no webhook entries appear, the issue is upstream (provider configuration, DNS, or network).

### Step 2: Check message normalization

Look for normalization logs or errors:

```bash
grep -i "normaliz" /tmp/sylion-dev.log | tail -20
```

If normalization fails, the payload structure from the provider may not match expectations.

### Step 3: Verify channel exists in database

Query the database for active WhatsApp channels:

```sql
SELECT id, name, type, is_active, config
FROM channels
WHERE type = 'whatsapp' AND is_active = true;
```

**Critical**: Check that `config->>'phoneNumber'` or `config->>'businessPhoneNumber'` matches the incoming message's phone number.

### Step 4: Verify phone number format

The channel's phone number must be in E.164 format (e.g., `+212600000002`).

Common mismatches:
- Missing `+` prefix
- Extra spaces or characters
- Different number than configured in WhatsApp provider

### Step 5: Check BullMQ job queue

If messages reach the queue but fail processing:

```bash
# Check Redis for failed jobs
redis-cli LRANGE bull:message-processing:failed 0 -1
```

### Step 6: Run the dev seed script (development only)

If no channel exists, create one:

```bash
npx tsx scripts/seed-dev-channel.ts
```

This script is idempotent and safe to run multiple times.

## Common Root Causes

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| "No channel found for phone number" | Missing or inactive channel | Seed channel or activate existing one |
| Channel exists but not matched | Phone number format mismatch | Ensure E.164 format in `config.phoneNumber` |
| Webhook 200 but no logs | Payload structure mismatch | Check normalizer expectations vs actual payload |
| Job queued but not processed | Worker not running | Restart the application or worker process |

## Channel Resolution Logic

The worker resolves channels using `findChannelByPhoneNumber()`:

1. Queries all channels where `type = 'whatsapp'` AND `isActive = true`
2. Iterates through results checking:
   - `config.phoneNumber === message.channelPhoneNumber`
   - OR `config.businessPhoneNumber === message.channelPhoneNumber`
3. Returns the first match, or `null` if none found

**Key requirement**: `channel.config.phoneNumber` must exactly match the normalized E.164 phone number from the incoming message.

## Quick Fixes

### Create a dev channel

```bash
npx tsx scripts/seed-dev-channel.ts
```

### Manually insert a channel (production)

```sql
INSERT INTO channels (tenant_id, type, name, is_active, config)
VALUES (
  '<tenant-uuid>',
  'whatsapp',
  'WhatsApp Channel',
  true,
  '{"phoneNumber": "+XXXXXXXXXXX", "provider": "360dialog"}'
);
```

Replace `<tenant-uuid>` and phone number with actual values.

## Related Documentation

- [ADR-0003: WhatsApp Ingestion Contract](../architecture/adr/0003-whatsapp-ingestion-contract.md)
- [Dev Onboarding: WhatsApp Seed](../onboarding/dev-seed-whatsapp.md)
