#!/usr/bin/env npx tsx
/**
 * ================================
 * Simulate WhatsApp Webhook - Sylion Backend
 * ================================
 * 
 * Script pour simuler un message WhatsApp entrant.
 * Permet de tester le vertical slice complet en local sans 360dialog.
 * 
 * Utilise le pipeline standardisé POST /api/v1/whatsapp/webhook (Boss 1).
 * 
 * Usage:
 *   npx tsx scripts/simulate-webhook.ts
 *   npx tsx scripts/simulate-webhook.ts "Mon message personnalisé"
 *   npx tsx scripts/simulate-webhook.ts --phone +212600000001 --message "Test"
 *   npx tsx scripts/simulate-webhook.ts --count 10 "Message répété"
 *   npx tsx scripts/simulate-webhook.ts --count 5 --delay 200 "Test avec délai"
 */

import axios from 'axios';

// Configuration
const API_URL = process.env['API_URL'] || 'http://localhost:3000';
const WEBHOOK_ENDPOINT = '/api/v1/whatsapp/webhook'; // Pipeline standardisé Boss 1
const DEFAULT_FROM_PHONE = '+212661976863'; // Numéro test par défaut
const DEFAULT_TO_PHONE = '+212661976863';   // Numéro du channel (configuré dans seed)
const DEFAULT_MESSAGE = 'Bonjour, je suis un message de test!';
const DEFAULT_COUNT = 1;
const DEFAULT_DELAY_MS = 100; // Délai entre les messages (ms)

interface SimulateOptions {
  fromPhone: string;
  toPhone: string;
  message: string;
  count: number;
  delayMs: number;
}

/**
 * Générer un payload 360dialog simulé
 * Format attendu par POST /api/v1/whatsapp/webhook :
 * { "messages": [{ "id", "from", "to", "timestamp", "type", "text": { "body" } }] }
 */
function generate360dialogPayload(options: SimulateOptions, index: number = 0) {
  const messageId = `wamid_test_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Format 360dialog simplifié (tel qu'attendu par le webhook)
  return {
    messages: [
      {
        id: messageId,
        from: options.fromPhone.replace('+', ''),
        to: options.toPhone.replace('+', ''),
        timestamp: timestamp,
        type: 'text',
        text: {
          body: options.message,
        },
      },
    ],
  };
}

/**
 * Parser les arguments CLI
 */
function parseArgs(): SimulateOptions {
  const args = process.argv.slice(2);
  
  const options: SimulateOptions = {
    fromPhone: DEFAULT_FROM_PHONE,
    toPhone: DEFAULT_TO_PHONE,
    message: DEFAULT_MESSAGE,
    count: DEFAULT_COUNT,
    delayMs: DEFAULT_DELAY_MS,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--phone' || arg === '-p') {
      options.fromPhone = args[++i] || DEFAULT_FROM_PHONE;
    } else if (arg === '--to' || arg === '-t') {
      options.toPhone = args[++i] || DEFAULT_TO_PHONE;
    } else if (arg === '--message' || arg === '-m') {
      options.message = args[++i] || DEFAULT_MESSAGE;
    } else if (arg === '--count' || arg === '-c' || arg === '-n') {
      const countValue = parseInt(args[++i], 10);
      options.count = isNaN(countValue) || countValue < 1 ? DEFAULT_COUNT : countValue;
    } else if (arg === '--delay' || arg === '-d') {
      const delayValue = parseInt(args[++i], 10);
      options.delayMs = isNaN(delayValue) || delayValue < 0 ? DEFAULT_DELAY_MS : delayValue;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx scripts/simulate-webhook.ts [options] [message]

Options:
  --phone, -p <phone>    Numéro de l'expéditeur (default: ${DEFAULT_FROM_PHONE})
  --to, -t <phone>       Numéro du channel (default: ${DEFAULT_TO_PHONE})
  --message, -m <text>   Contenu du message
  --count, -c, -n <N>    Nombre de messages à envoyer (default: ${DEFAULT_COUNT})
  --delay, -d <ms>       Délai entre les messages en ms (default: ${DEFAULT_DELAY_MS})
  --help, -h             Afficher cette aide

Pipeline: POST ${WEBHOOK_ENDPOINT} (Boss 1 standardisé)

Examples:
  npx tsx scripts/simulate-webhook.ts
  npx tsx scripts/simulate-webhook.ts "Bonjour SYLION!"
  npx tsx scripts/simulate-webhook.ts --phone +212700000001 --message "Test"
  npx tsx scripts/simulate-webhook.ts --count 10 "Message répété 10 fois"
  npx tsx scripts/simulate-webhook.ts --count 5 --delay 200 "Test avec délai 200ms"
      `);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      // Argument positionnel = message
      options.message = arg;
    }
  }

  return options;
}

/**
 * Helper pour attendre un délai
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envoyer un seul webhook
 */
async function sendSingleWebhook(
  options: SimulateOptions,
  index: number,
  total: number
): Promise<{ success: boolean; status?: number; data?: any; error?: string }> {
  const payload = generate360dialogPayload(options, index);
  const webhookUrl = `${API_URL}${WEBHOOK_ENDPOINT}`;

  try {
    const response = await axios.post(
      webhookUrl,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Provider': '360dialog',
        },
        timeout: 10000,
      }
    );

    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        status: error.response?.status,
        error: error.message,
        data: error.response?.data,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Envoyer le webhook simulé (supporte N messages)
 */
async function simulateWebhook(options: SimulateOptions): Promise<void> {
  const webhookUrl = `${API_URL}${WEBHOOK_ENDPOINT}`;
  
  console.log('\n🚀 Simulation de webhook WhatsApp (Pipeline Boss 1)');
  console.log('─'.repeat(60));
  console.log(`📱 De:        ${options.fromPhone}`);
  console.log(`📞 Vers:      ${options.toPhone}`);
  console.log(`💬 Message:   "${options.message}"`);
  console.log(`🔢 Nombre:    ${options.count} message(s)`);
  console.log(`⏱️  Délai:     ${options.delayMs}ms entre chaque`);
  console.log(`🌐 Endpoint:  ${webhookUrl}`);
  console.log('─'.repeat(60));

  console.log('\n📤 Envoi des webhooks...\n');

  const results = {
    success: 0,
    failed: 0,
    responses: [] as any[],
  };

  for (let i = 0; i < options.count; i++) {
    const messageNum = i + 1;
    
    if (options.count > 1) {
      process.stdout.write(`   [${messageNum}/${options.count}] Envoi... `);
    }

    const result = await sendSingleWebhook(options, i, options.count);
    results.responses.push(result);

    if (result.success) {
      results.success++;
      if (options.count > 1) {
        console.log(`✅ Status ${result.status}`);
      } else {
        console.log('✅ Webhook reçu avec succès!');
        console.log(`   Status: ${result.status}`);
        console.log(`   Response:`, JSON.stringify(result.data, null, 2));
      }
    } else {
      results.failed++;
      if (options.count > 1) {
        console.log(`❌ Erreur: ${result.error}`);
      } else {
        console.error('\n❌ Erreur lors de l\'envoi du webhook:');
        console.error(`   Status: ${result.status || 'N/A'}`);
        console.error(`   Message: ${result.error}`);
        if (result.data) {
          console.error('   Response:', JSON.stringify(result.data, null, 2));
        }
      }
    }

    // Délai entre les messages (sauf pour le dernier)
    if (i < options.count - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  // Résumé final
  console.log('\n' + '─'.repeat(60));
  console.log('📊 Résumé:');
  console.log(`   ✅ Succès:  ${results.success}/${options.count}`);
  console.log(`   ❌ Échecs:  ${results.failed}/${options.count}`);
  
  if (results.success > 0) {
    console.log('\n📋 Pipeline Boss 1 utilisé:');
    console.log('   1. Messages dans la queue BullMQ "whatsapp:process-incoming"');
    console.log('   2. Worker processWhatsAppIncoming() les traite');
    console.log('   3. Réponses générées et envoyées via le Provider');
    console.log('   → Vérifiez les logs du serveur pour voir le flow complet');
  }

  if (results.failed > 0) {
    console.log('\n💡 En cas d\'erreur de connexion:');
    console.log('   1. Vérifiez que le serveur est démarré: npm run dev');
    console.log(`   2. Vérifiez l'URL: ${API_URL}`);
    console.log('   3. Vérifiez que le channel WhatsApp est configuré');
  }

  console.log('');

  if (results.failed > 0) {
    process.exit(1);
  }
}

// Exécution
const options = parseArgs();
simulateWebhook(options);
