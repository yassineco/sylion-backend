/**
 * DEV Seed Script - WhatsApp Channel
 * 
 * Creates a development WhatsApp channel to unblock the message processing pipeline.
 * Safe to run multiple times (idempotent).
 * 
 * Usage: npx tsx scripts/seed-dev-channel.ts
 */

import { db } from '@/db';
import * as schema from '@/db/schema';
import { and, eq } from 'drizzle-orm';

const DEV_PHONE_NUMBER = '+212600000002';

async function main() {
  console.log('🌱 Starting dev channel seed...');

  // 1. Fetch an existing tenant
  const tenants = await db
    .select()
    .from(schema.tenants)
    .limit(1);

  if (tenants.length === 0) {
    console.error('❌ No tenant found in database. Please create a tenant first.');
    process.exit(1);
  }

  const tenant = tenants[0];
  console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})`);

  // 2. Check if an active WhatsApp channel already exists with matching phone number
  const existingChannels = await db
    .select()
    .from(schema.channels)
    .where(
      and(
        eq(schema.channels.type, 'whatsapp'),
        eq(schema.channels.isActive, true)
      )
    );

  for (const channel of existingChannels) {
    const config = channel.config as { phoneNumber?: string; businessPhoneNumber?: string };
    if (config?.phoneNumber === DEV_PHONE_NUMBER || config?.businessPhoneNumber === DEV_PHONE_NUMBER) {
      console.log(`✅ WhatsApp channel already exists: ${channel.name} (${channel.id})`);
      console.log(`   config.phoneNumber: ${config.phoneNumber || 'N/A'}`);
      console.log(`   config.businessPhoneNumber: ${config.businessPhoneNumber || 'N/A'}`);
      process.exit(0);
    }
  }

  // 3. Insert a new WhatsApp channel
  const [newChannel] = await db
    .insert(schema.channels)
    .values({
      tenantId: tenant.id,
      type: 'whatsapp',
      name: 'Dev WhatsApp Channel',
      isActive: true,
      config: {
        phoneNumber: DEV_PHONE_NUMBER,
        provider: '360dialog',
      },
    })
    .returning();

  console.log(`✅ Created new WhatsApp channel: ${newChannel.name} (${newChannel.id})`);
  console.log(`   tenantId: ${newChannel.tenantId}`);
  console.log(`   config.phoneNumber: ${DEV_PHONE_NUMBER}`);
  console.log(`   config.provider: 360dialog`);

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Seed script failed:', error);
  process.exit(1);
});
