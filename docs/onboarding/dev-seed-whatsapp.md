# Dev Onboarding: WhatsApp Channel Seeding

## Why is this necessary?

WhatsApp message processing requires an active channel to exist in the database. Without it, incoming messages are silently dropped because the worker cannot resolve the tenant context.

The webhook will return HTTP 200 (acknowledging receipt), but no processing occurs.

## How channel resolution works

The message processor (`src/jobs/messageProcessor.worker.ts`) resolves channels using `findChannelByPhoneNumber()`:

```
channel.type === 'whatsapp'
AND channel.isActive === true
AND (
  channel.config.phoneNumber === message.channelPhoneNumber
  OR channel.config.businessPhoneNumber === message.channelPhoneNumber
)
```

Where `message.channelPhoneNumber` is the normalized E.164 phone number from the incoming webhook (e.g., `+212600000002`).

## Running the seed script

To create a development WhatsApp channel:

```bash
npx tsx scripts/seed-dev-channel.ts
```

### What the script does

1. Fetches the first tenant from the database (fails if no tenant exists)
2. Checks if an active WhatsApp channel already exists with phone number `+212600000002`
3. If found, logs that it exists and exits
4. If not found, creates a new channel with:
   - `type`: `"whatsapp"`
   - `isActive`: `true`
   - `name`: `"Dev WhatsApp Channel"`
   - `config.phoneNumber`: `"+212600000002"`
   - `config.provider`: `"360dialog"`

### Idempotency

The script is **safe to run multiple times**. It checks for existing channels before inserting and will not create duplicates.

### Expected output (first run)

```
🌱 Starting dev channel seed...
✅ Found tenant: <tenant-name> (<tenant-id>)
✅ Created new WhatsApp channel: Dev WhatsApp Channel (<channel-id>)
   tenantId: <tenant-id>
   config.phoneNumber: +212600000002
   config.provider: 360dialog
```

### Expected output (subsequent runs)

```
🌱 Starting dev channel seed...
✅ Found tenant: <tenant-name> (<tenant-id>)
✅ WhatsApp channel already exists: Dev WhatsApp Channel (<channel-id>)
   config.phoneNumber: +212600000002
   config.businessPhoneNumber: N/A
```

## Prerequisites

- A tenant must exist in the database
- Database must be running and accessible
- Environment variables must be configured (`.env` or equivalent)

## Customizing the phone number

If you need a different phone number for testing, modify the `DEV_PHONE_NUMBER` constant in `scripts/seed-dev-channel.ts`:

```typescript
const DEV_PHONE_NUMBER = '+212600000002';  // Change this
```

Ensure the phone number matches what your WhatsApp provider sends in webhook payloads.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No tenant found in database" | Create a tenant first, or run the tenant seed script |
| Database connection error | Check `DATABASE_URL` in your environment |
| Script not found | Run from project root directory |

## Related Documentation

- [ADR-0003: WhatsApp Ingestion Contract](../architecture/adr/0003-whatsapp-ingestion-contract.md)
- [WhatsApp Debugging Runbook](../operations/whatsapp-debugging.md)
