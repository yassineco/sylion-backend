#!/usr/bin/env npx tsx
/**
 * ================================
 * Simulate WhatsApp Webhook - Sylion Backend
 * ================================
 * 
 * Script pour simuler un message WhatsApp entrant.
 * Permet de tester le vertical slice complet en local sans 360dialog.
 * 
 * Usage:
 *   npx tsx scripts/simulate-webhook.ts
 *   npx tsx scripts/simulate-webhook.ts "Mon message personnalisé"
 *   npx tsx scripts/simulate-webhook.ts --phone +212600000001 --message "Test"
 */

import axios from 'axios';

// Configuration
const API_URL = process.env['API_URL'] || 'http://localhost:3000';
const DEFAULT_FROM_PHONE = '+212661976863'; // Numéro test par défaut
const DEFAULT_TO_PHONE = '+212661976863';   // Numéro du channel (configuré dans seed)
const DEFAULT_MESSAGE = 'Bonjour, je suis un message de test!';

interface SimulateOptions {
  fromPhone: string;
  toPhone: string;
  message: string;
}

/**
 * Générer un payload 360dialog simulé
 * Format attendu par POST /whatsapp/webhook :
 * { "messages": [{ "id", "from", "to", "timestamp", "type", "text": { "body" } }] }
 */
function generate360dialogPayload(options: SimulateOptions) {
  const messageId = `wamid_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--phone' || arg === '-p') {
      options.fromPhone = args[++i] || DEFAULT_FROM_PHONE;
    } else if (arg === '--to' || arg === '-t') {
      options.toPhone = args[++i] || DEFAULT_TO_PHONE;
    } else if (arg === '--message' || arg === '-m') {
      options.message = args[++i] || DEFAULT_MESSAGE;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx scripts/simulate-webhook.ts [options] [message]

Options:
  --phone, -p <phone>    Numéro de l'expéditeur (default: ${DEFAULT_FROM_PHONE})
  --to, -t <phone>       Numéro du channel (default: ${DEFAULT_TO_PHONE})
  --message, -m <text>   Contenu du message
  --help, -h             Afficher cette aide

Examples:
  npx tsx scripts/simulate-webhook.ts
  npx tsx scripts/simulate-webhook.ts "Bonjour SYLION!"
  npx tsx scripts/simulate-webhook.ts --phone +212700000001 --message "Test"
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
 * Envoyer le webhook simulé
 */
async function simulateWebhook(options: SimulateOptions): Promise<void> {
  console.log('\n🚀 Simulation de webhook WhatsApp');
  console.log('─'.repeat(50));
  console.log(`📱 De:      ${options.fromPhone}`);
  console.log(`📞 Vers:    ${options.toPhone}`);
  console.log(`💬 Message: "${options.message}"`);
  console.log(`🌐 API:     ${API_URL}/whatsapp/webhook`);
  console.log('─'.repeat(50));

  const payload = generate360dialogPayload(options);

  try {
    console.log('\n📤 Envoi du webhook...\n');

    const response = await axios.post(
      `${API_URL}/whatsapp/webhook`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Provider': '360dialog',
        },
        timeout: 10000,
      }
    );

    console.log('✅ Webhook reçu avec succès!');
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));

    console.log('\n📊 Prochaines étapes:');
    console.log('   1. Le message est dans la queue BullMQ "incoming-messages"');
    console.log('   2. Le worker va le traiter et générer une réponse');
    console.log('   3. La réponse sera envoyée via le Mock Provider');
    console.log('   → Vérifiez les logs du serveur pour voir le flow complet\n');

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('\n❌ Erreur lors de l\'envoi du webhook:');
      console.error(`   Status: ${error.response?.status || 'N/A'}`);
      console.error(`   Message: ${error.message}`);
      
      if (error.response?.data) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }

      if (error.code === 'ECONNREFUSED') {
        console.error('\n💡 Le serveur ne répond pas. Assurez-vous que:');
        console.error('   1. Le serveur est démarré: npm run dev');
        console.error('   2. L\'URL est correcte: ' + API_URL);
      }
    } else {
      console.error('\n❌ Erreur inattendue:', error);
    }
    process.exit(1);
  }
}

// Exécution
const options = parseArgs();
simulateWebhook(options);
