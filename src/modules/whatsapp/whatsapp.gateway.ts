/**
 * ================================
 * WhatsApp Legacy Gateway - Sylion Backend
 * ================================
 *
 * Helpers pour :
 *  - la validation du webhook (GET /whatsapp/webhook)
 *  - la vérification optionnelle de signature (stub pour l'instant)
 *
 * NOTE :
 *  - La normalisation des payloads est gérée par `gateway.ts` (Boss 1).
 *  - Ce fichier ne touche pas à la DB ni aux queues.
 */

import { logger } from '@/lib/logger';
import { WhatsAppError, WhatsAppErrorCodes } from './whatsapp.legacy_types';

/**
 * Valider un webhook pour la vérification initiale
 * (GET /whatsapp/webhook).
 *
 * Si tout est OK :
 *   → retourne le `challenge` à renvoyer tel quel à WhatsApp.
 * Si la vérification échoue :
 *   → lève un `WhatsAppError` avec code WEBHOOK_VERIFICATION_FAILED.
 */
export async function validateWebhook(
  mode: string,
  token: string,
  challenge: string,
): Promise<string> {
  const expectedToken = process.env['WHATSAPP_VERIFY_TOKEN'];

  logger.info('Validating WhatsApp webhook', {
    mode,
    hasToken: !!token,
    hasChallenge: !!challenge,
    hasExpectedToken: !!expectedToken,
  });

  if (mode === 'subscribe' && token === expectedToken && !!challenge) {
    logger.info('WhatsApp webhook validation successful', {
      mode,
    });
    return challenge;
  }

  logger.warn('WhatsApp webhook validation failed', {
    mode,
    tokenMatch: token === expectedToken,
    hasExpectedToken: !!expectedToken,
  });

  throw new WhatsAppError(
    'Webhook verification failed',
    WhatsAppErrorCodes.WEBHOOK_VERIFICATION_FAILED,
    {
      mode,
      tokenMatch: token === expectedToken,
      hasExpectedToken: !!expectedToken,
    },
  );
}

/**
 * Vérifier la signature d'un webhook (si supporté par le provider).
 *
 * Pour l’instant, c’est un stub en prévision d’une implémentation future
 * (ex : HMAC-SHA256 avec secret partagé).
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean> {
  // TODO: Implémenter la vérification réelle de signature
  logger.debug('Webhook signature verification skipped (not implemented)', {
    hasPayload: !!payload,
    hasSignature: !!signature,
  });

  return true;
}
