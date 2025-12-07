#!/usr/bin/env npx tsx
/**
 * ================================
 * Live Test Send - Sylion Backend
 * ================================
 *
 * Script for sending exactly ONE real WhatsApp message via 360dialog.
 * This is a MANUAL TEST SCRIPT - not for automated use.
 *
 * SAFETY:
 * - Requires WHATSAPP_LIVE_TEST=true environment variable
 * - Uses dedicated sendTextMessageSingleTest() method
 * - Completely isolated from worker/queue pipeline
 *
 * ================================
 * HOW TO RUN A REAL LIVE TEST
 * ================================
 *
 * 1. Get your real 360dialog API key from the 360dialog dashboard
 *
 * 2. Run with the real key (DO NOT commit this key!):
 *
 *    WHATSAPP_LIVE_API_KEY="your_real_360dialog_api_key" npm run test:whatsapp:live
 *
 * 3. To send to a specific phone number:
 *
 *    WHATSAPP_LIVE_API_KEY="your_key" LIVE_TEST_PHONE="+212XXXXXXXXX" npm run test:whatsapp:live
 *
 * 4. To send a custom message:
 *
 *    WHATSAPP_LIVE_API_KEY="your_key" npm run test:whatsapp:live "Your custom message"
 *
 * ================================
 * ENVIRONMENT VARIABLES
 * ================================
 *
 * Required:
 * - WHATSAPP_LIVE_API_KEY: Your real 360dialog API key (highest priority)
 *   OR WHATSAPP_360D_API_KEY / WHATSAPP_API_KEY (lower priority)
 *
 * Optional:
 * - LIVE_TEST_PHONE: Target phone number (default: +212661976863)
 * - WHATSAPP_360D_BASE_URL: API base URL (default: https://waba.360dialog.io/v1)
 *
 * ================================
 */

import dotenv from 'dotenv';

// Load environment BEFORE imports to ensure env vars are available
dotenv.config({ path: '.env.local' });

// Force live test mode for this script ONLY
process.env['WHATSAPP_LIVE_TEST'] = 'true';

import { logger } from '../src/lib/logger';
import { maskPhoneNumber } from '../src/modules/whatsapp/types';
import {
    getResolvedApiKey,
    isDummyApiKey,
    isLiveTestMode,
    whatsApp360dialogProvider
} from '../src/modules/whatsapp/whatsapp.provider.360dialog';

// ================================
// Configuration
// ================================

// Target phone number - CHANGE THIS to your test number
const TARGET_PHONE = process.env['LIVE_TEST_PHONE'] || '+212661976863';

// Test message
const TEST_MESSAGE = process.argv[2] || 'Hello from Sylion Live Test 🚀';

// ================================
// Main Script
// ================================

async function main() {
  console.log('\n');
  console.log('='.repeat(60));
  console.log('  SYLION WHATSAPP LIVE TEST');
  console.log('='.repeat(60));
  console.log('\n');

  // Safety check: ensure live test mode is enabled
  if (!isLiveTestMode()) {
    console.error('❌ ERROR: WHATSAPP_LIVE_TEST is not set to "true"');
    console.error('   This script requires WHATSAPP_LIVE_TEST=true');
    console.error('   Use: npm run test:whatsapp:live');
    process.exit(1);
  }

  console.log('✅ Live test mode confirmed');

  // Check for real API key
  const apiKey = getResolvedApiKey();
  if (!apiKey) {
    console.error('\n❌ ERROR: No WhatsApp API key provided.');
    console.error('\n   Run with a real API key:');
    console.error('   WHATSAPP_LIVE_API_KEY="your_real_key" npm run test:whatsapp:live');
    console.error('\n   The dummy key in .env.local will not work for live tests.');
    process.exit(1);
  }

  if (isDummyApiKey(apiKey)) {
    console.error('\n❌ ERROR: Dummy/placeholder API key detected.');
    console.error(`   Current key starts with: ${apiKey.substring(0, 12)}...`);
    console.error('\n   For live tests, provide a REAL 360dialog API key:');
    console.error('   WHATSAPP_LIVE_API_KEY="your_real_key" npm run test:whatsapp:live');
    console.error('\n   Get your API key from: https://hub.360dialog.com/');
    process.exit(1);
  }

  console.log('✅ Real API key detected');
  console.log(`📱 Target: ${maskPhoneNumber(TARGET_PHONE)}`);
  console.log(`💬 Message: "${TEST_MESSAGE.substring(0, 50)}${TEST_MESSAGE.length > 50 ? '...' : ''}"`);
  console.log('\n');

  // Validate configuration
  const configValid = await whatsApp360dialogProvider.validateConfiguration();
  if (!configValid) {
    console.error('❌ ERROR: 360dialog configuration is invalid');
    console.error('   Check WHATSAPP_360D_API_KEY or WHATSAPP_API_KEY');
    process.exit(1);
  }

  console.log('✅ 360dialog configuration validated');
  console.log('\n');

  // Confirmation prompt (only in interactive mode)
  if (process.stdin.isTTY) {
    console.log('⚠️  WARNING: This will send a REAL WhatsApp message!');
    console.log('   Press ENTER to continue or Ctrl+C to cancel...');
    await waitForEnter();
  }

  console.log('\n📤 Sending message...\n');

  try {
    // Send the test message using the dedicated single-test method
    const response = await whatsApp360dialogProvider.sendTextMessageSingleTest(
      TARGET_PHONE,
      TEST_MESSAGE
    );

    // Log the response (safely)
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  ✅ MESSAGE SENT SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n');

    console.log('Response:');
    console.log(JSON.stringify({
      messaging_product: response.messaging_product,
      contacts: response.contacts?.map(c => ({
        input: maskPhoneNumber(c.input),
        wa_id: maskPhoneNumber(c.wa_id),
      })),
      messages: response.messages?.map(m => ({
        id: m.id,
        message_status: m.message_status,
      })),
    }, null, 2));

    console.log('\n');
    logger.info('[live-test] Test completed successfully', {
      messageId: response.messages?.[0]?.id,
      to: maskPhoneNumber(TARGET_PHONE),
    });

    process.exit(0);

  } catch (error) {
    console.log('\n');
    console.log('='.repeat(60));
    console.log('  ❌ MESSAGE SEND FAILED');
    console.log('='.repeat(60));
    console.log('\n');

    // Safely log the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const safeMessage = errorMessage
      .replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');

    console.error('Error:', safeMessage);

    if (error instanceof Error && 'code' in error) {
      console.error('Code:', (error as { code: string }).code);
    }

    if (error instanceof Error && 'details' in error) {
      console.error('Details:', JSON.stringify((error as { details: unknown }).details, null, 2));
    }

    logger.error('[live-test] Test failed', {
      error: safeMessage,
      to: maskPhoneNumber(TARGET_PHONE),
    });

    process.exit(1);
  }
}

/**
 * Wait for user to press ENTER
 */
function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

// Run the script
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
