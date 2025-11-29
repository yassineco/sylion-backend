/**
 * ================================
 * WhatsApp Gateway - Sylion Backend
 * ================================
 * 
 * Gestion des webhooks WhatsApp entrants.
 * Normalisation et push vers la queue BullMQ.
 */

import { logger } from '@/lib/logger';
import { addIncomingMessageJob } from '@/jobs/index';
import {
  WhatsAppRawPayload,
  WhatsAppRawPayloadSchema,
  WhatsAppRawMessage,
  NormalizedIncomingMessage,
  NormalizedContact,
  WhatsAppError,
  WhatsAppErrorCodes,
  normalizePhoneNumber,
  maskPhoneNumber,
} from './whatsapp.types';

/**
 * ================================
 * WhatsApp Gateway Class
 * ================================
 */
export class WhatsAppGateway {
  
  /**
   * Traiter un webhook WhatsApp entrant
   */
  async handleIncomingWebhook(payload: unknown): Promise<void> {
    try {
      logger.info('Processing incoming WhatsApp webhook');

      // 1. Validation du payload
      const validatedPayload = WhatsAppRawPayloadSchema.parse(payload);

      // 2. Extraction et traitement des messages
      const normalizedMessages = await this.extractAndNormalizeMessages(validatedPayload);

      // 3. Push des messages vers la queue
      if (normalizedMessages.length > 0) {
        await this.pushMessagesToQueue(normalizedMessages);
      } else {
        logger.debug('No processable messages found in webhook payload');
      }

      logger.info('WhatsApp webhook processed successfully', {
        messagesCount: normalizedMessages.length,
      });

    } catch (error) {
      logger.error('Error processing WhatsApp webhook', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw pour que le controller puisse renvoyer une erreur HTTP appropriée
      if (error instanceof WhatsAppError) {
        throw error;
      }

      throw new WhatsAppError(
        'Failed to process webhook payload',
        WhatsAppErrorCodes.INVALID_PAYLOAD,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Extraire et normaliser les messages du payload
   */
  private async extractAndNormalizeMessages(
    payload: WhatsAppRawPayload
  ): Promise<NormalizedIncomingMessage[]> {
    const normalizedMessages: NormalizedIncomingMessage[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { value } = change;

        // Ne traiter que les changements de messages
        if (change.field !== 'messages' || !value.messages) {
          continue;
        }

        // Métadonnées du canal
        const channelPhoneNumber = normalizePhoneNumber(
          '+' + value.metadata.display_phone_number
        );

        // Traitement des contacts (pour récupérer les noms)
        const contactsMap = new Map<string, string>();
        if (value.contacts) {
          for (const contact of value.contacts) {
            contactsMap.set(contact.wa_id, contact.profile?.name || '');
          }
        }

        // Traitement des messages
        for (const message of value.messages) {
          try {
            const normalized = await this.normalizeMessage(
              message,
              channelPhoneNumber,
              contactsMap
            );

            if (normalized) {
              normalizedMessages.push(normalized);
            }
          } catch (error) {
            logger.warn('Failed to normalize individual message', {
              messageId: message.id,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue avec les autres messages
          }
        }
      }
    }

    return normalizedMessages;
  }

  /**
   * Normaliser un message individuel
   */
  private async normalizeMessage(
    message: WhatsAppRawMessage,
    channelPhoneNumber: string,
    contactsMap: Map<string, string>
  ): Promise<NormalizedIncomingMessage | null> {
    
    // Pour le MVP, on ne traite que les messages texte
    if (message.type !== 'text' || !message.text) {
      logger.debug('Skipping non-text message', {
        messageId: message.id,
        type: message.type,
        from: maskPhoneNumber(message.from),
      });
      return null;
    }

    // Construction du contact normalisé
    const fromPhoneNumber = normalizePhoneNumber('+' + message.from);
    const contactName = contactsMap.get(message.from);

    const normalizedContact: NormalizedContact = {
      phoneNumber: fromPhoneNumber,
      name: contactName,
      waId: message.from,
    };

    // Construction du message normalisé
    const normalizedMessage: NormalizedIncomingMessage = {
      externalId: message.id,
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      type: 'text',
      text: message.text.body,
      from: normalizedContact,
      channelPhoneNumber,
      isReply: !!message.context,
      replyToMessageId: message.context?.id,
      metadata: {
        originalType: message.type,
        waTimestamp: message.timestamp,
      },
    };

    logger.debug('Message normalized', {
      messageId: message.id,
      from: maskPhoneNumber(fromPhoneNumber),
      textLength: message.text.body.length,
      isReply: normalizedMessage.isReply,
    });

    return normalizedMessage;
  }

  /**
   * Pousser les messages vers la queue BullMQ
   */
  private async pushMessagesToQueue(messages: NormalizedIncomingMessage[]): Promise<void> {
    const pushPromises = messages.map(async (message, index) => {
      try {
        await addIncomingMessageJob(message);
        
        logger.debug('Message pushed to queue', {
          messageId: message.externalId,
          from: maskPhoneNumber(message.from.phoneNumber),
          queuePosition: index + 1,
        });
      } catch (error) {
        logger.error('Failed to push message to queue', {
          messageId: message.externalId,
          from: maskPhoneNumber(message.from.phoneNumber),
          error: error instanceof Error ? error.message : String(error),
        });
        // Re-throw pour interrompre le traitement si la queue ne fonctionne pas
        throw error;
      }
    });

    await Promise.all(pushPromises);

    logger.info('All messages pushed to queue successfully', {
      count: messages.length,
    });
  }

  /**
   * Valider un webhook pour la vérification initiale
   * (GET request avec challenge)
   */
  async validateWebhook(
    mode: string,
    token: string,
    challenge: string
  ): Promise<string | null> {
    try {
      if (mode === 'subscribe' && token === process.env['WHATSAPP_VERIFY_TOKEN']) {
        logger.info('WhatsApp webhook validation successful');
        return challenge;
      }

      logger.warn('WhatsApp webhook validation failed', {
        mode,
        tokenMatch: token === process.env['WHATSAPP_VERIFY_TOKEN'],
      });

      throw new WhatsAppError(
        'Webhook verification failed',
        WhatsAppErrorCodes.WEBHOOK_VERIFICATION_FAILED,
        { mode, expectedToken: !!process.env['WHATSAPP_VERIFY_TOKEN'] }
      );

    } catch (error) {
      logger.error('Error during webhook validation', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Vérifier les signatures des webhooks (si supporté par le provider)
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<boolean> {
    // TODO: Implémenter la vérification de signature si le provider le supporte
    // Ex: HMAC-SHA256 avec un secret partagé
    
    logger.debug('Webhook signature verification skipped (not implemented)');
    return true; // Pour l'instant, on fait confiance au verify token
  }
}

/**
 * Instance singleton du gateway
 */
export const whatsAppGateway = new WhatsAppGateway();

/**
 * Helpers pour utilisation dans les routes
 */
export const handleIncomingWebhook = (payload: unknown): Promise<void> => {
  return whatsAppGateway.handleIncomingWebhook(payload);
};

export const validateWebhook = (
  mode: string,
  token: string,
  challenge: string
): Promise<string | null> => {
  return whatsAppGateway.validateWebhook(mode, token, challenge);
};