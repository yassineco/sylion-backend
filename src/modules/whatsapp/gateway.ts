/**
 * ================================
 * WhatsApp Gateway - Sylion Backend (Boss 1)
 * ================================
 *
 * Gateway pur pour la normalisation des payloads WhatsApp.
 * Fonction pure sans DB, sans queue, sans Fastify.
 */

import { logger } from '@/lib/logger';
import type { NormalizedIncomingMessage, RawWhatsAppPayload } from './types';
import { normalizePhoneNumber } from './types';

/**
 * Interface pour le payload 360dialog (format attendu)
 */
interface Dialog360Message {
  from: string;
  to: string;
  id: string;
  timestamp: string; // Unix timestamp en secondes (string)
  text?: {
    body?: string;
  };
  type: string;
}

interface Dialog360Webhook {
  messages?: Dialog360Message[];
}

/**
 * Erreur de normalisation WhatsApp
 */
export class WhatsAppNormalizationError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'WhatsAppNormalizationError';
  }
}

/**
 * Normaliser un payload WhatsApp brut vers le format interne unifié
 *
 * @param payload - Payload brut du provider WhatsApp
 * @returns Message normalisé au format interne
 * @throws WhatsAppNormalizationError si le payload est invalide ou non supporté
 */
export function normalizeIncomingWhatsApp(
  payload: RawWhatsAppPayload,
): NormalizedIncomingMessage {
  logger.debug('[Gateway] Starting message normalization', {
    provider: payload.provider,
    hasBody: !!payload.body,
  });

  // 1. Vérification du provider supporté
  if (payload.provider !== '360dialog') {
    logger.warn('[Gateway] Unsupported provider rejected', { provider: payload.provider });
    throw new WhatsAppNormalizationError(
      `Provider non supporté: ${payload.provider}. Seul '360dialog' est supporté pour le MVP.`,
      { provider: payload.provider },
    );
  }

  // 2. Validation de la structure du payload 360dialog
  if (!payload.body || typeof payload.body !== 'object') {
    throw new WhatsAppNormalizationError('Payload body manquant ou invalide', {
      body: payload.body,
    });
  }

  const webhookData = payload.body as Dialog360Webhook;

  // 3. Vérification de la présence des messages
  if (
    !webhookData.messages ||
    !Array.isArray(webhookData.messages) ||
    webhookData.messages.length === 0
  ) {
    throw new WhatsAppNormalizationError('Aucun message trouvé dans le payload 360dialog', {
      messagesFound: webhookData.messages?.length || 0,
    });
  }

  // On sait qu'il y a au moins 1 message → non-null assertion
  const message = webhookData.messages[0]!;
  // 4. Validation des champs obligatoires
  if (!message.from) {
    throw new WhatsAppNormalizationError('Champ "from" manquant dans le message', {
      message,
    });
  }

  if (!message.to) {
    throw new WhatsAppNormalizationError('Champ "to" manquant dans le message', {
      message,
    });
  }

  if (!message.id) {
    throw new WhatsAppNormalizationError('Champ "id" manquant dans le message', {
      message,
    });
  }

  if (!message.timestamp) {
    throw new WhatsAppNormalizationError('Champ "timestamp" manquant dans le message', {
      message,
    });
  }

  // 5. Extraction du texte (peut être vide pour les messages non-texte)
  let messageText = '';
  if (message.text && typeof message.text.body === 'string') {
    messageText = message.text.body;
  }

  // 6. Normalisation des numéros de téléphone
  const fromPhone = normalizePhoneNumber(message.from);
  const toPhone = normalizePhoneNumber(message.to);

  if (!fromPhone) {
    throw new WhatsAppNormalizationError(
      'Impossible de normaliser le numéro "from"',
      { originalFrom: message.from },
    );
  }

  if (!toPhone) {
    throw new WhatsAppNormalizationError(
      'Impossible de normaliser le numéro "to"',
      { originalTo: message.to },
    );
  }

  // 7. Conversion du timestamp (Unix seconds → Date)
  let timestamp: Date;
  try {
    const timestampSeconds = parseInt(message.timestamp, 10);
    if (Number.isNaN(timestampSeconds)) {
      throw new Error('Timestamp non numérique');
    }
    timestamp = new Date(timestampSeconds * 1000);
  } catch (error) {
    throw new WhatsAppNormalizationError('Format de timestamp invalide', {
      originalTimestamp: message.timestamp,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 8. Construction du message normalisé
  const normalizedMessage: NormalizedIncomingMessage = {
    // Champs Boss 1 (nouveaux)
    provider: '360dialog',
    providerMessageId: message.id,
    fromPhone,
    toPhone,
    text: messageText,
    timestamp,

    // Alias compatibilité worker legacy
    externalId: message.id,
    from: { phoneNumber: fromPhone },
    channelPhoneNumber: toPhone,

    // Reply context (optionnel, false par défaut)
    isReply: false,
    replyToMessageId: undefined,
  };

  logger.info('[Gateway] Message normalized successfully', {
    providerMessageId: normalizedMessage.providerMessageId,
    fromPhone: normalizedMessage.fromPhone.replace(/\d{6}$/, '******'),
    toPhone: normalizedMessage.toPhone.replace(/\d{6}$/, '******'),
    textLength: normalizedMessage.text.length,
    timestamp: normalizedMessage.timestamp.toISOString(),
  });

  return normalizedMessage;
}
