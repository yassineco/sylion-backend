/**
 * ================================
 * WhatsApp Mock Provider - Sylion Backend
 * ================================
 * 
 * Mock provider pour développement local.
 * Simule les réponses 360dialog sans appel réseau.
 * Permet de tester le vertical slice complet en local.
 */

import { logger } from '@/lib/logger';
import {
    maskPhoneNumber,
    normalizePhoneNumber,
    SendTextMessageOptions,
    validateWhatsAppNumber,
    WhatsAppError,
    WhatsAppErrorCodes,
    WhatsAppSendResponse,
} from './types';

/**
 * Interface commune pour tous les providers WhatsApp
 */
export interface IWhatsAppProvider {
  sendTextMessage(
    to: string,
    text: string,
    options?: SendTextMessageOptions
  ): Promise<WhatsAppSendResponse>;
  
  sendMediaMessage(
    to: string,
    mediaUrl: string,
    type: 'image' | 'document' | 'audio' | 'video',
    options?: SendTextMessageOptions & { caption?: string }
  ): Promise<WhatsAppSendResponse>;
  
  validateConfiguration(): Promise<boolean>;
}

/**
 * ================================
 * Mock WhatsApp Provider
 * ================================
 * 
 * Simule le comportement du provider 360dialog pour le dev local.
 * - Génère des IDs de message uniques
 * - Log tous les appels pour debugging
 * - Simule des délais réalistes
 */
export class WhatsAppMockProvider implements IWhatsAppProvider {
  private messageCounter = 0;
  private sentMessages: Array<{
    id: string;
    to: string;
    text: string;
    timestamp: Date;
    options?: SendTextMessageOptions;
  }> = [];

  constructor() {
    logger.info('[MockProvider] WhatsApp Mock Provider initialized (local dev mode)');
  }

  /**
   * Générer un ID de message mock unique
   */
  private generateMessageId(): string {
    this.messageCounter++;
    return `mock_wamid_${Date.now()}_${this.messageCounter}`;
  }

  /**
   * Simuler un délai réseau réaliste
   */
  private async simulateNetworkDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 200) + 100; // 100-300ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Envoyer un message texte (mock)
   */
  async sendTextMessage(
    to: string,
    text: string,
    options: SendTextMessageOptions = { metadata: {}, previewUrl: false }
  ): Promise<WhatsAppSendResponse> {
    logger.debug('[MockProvider] Processing sendTextMessage request', {
      to: maskPhoneNumber(to),
      textLength: text.length,
    });

    // Defensive: validate inputs
    if (!to) {
      logger.error('[MockProvider] Missing "to" parameter');
      throw new WhatsAppError('Missing "to" parameter', WhatsAppErrorCodes.INVALID_NUMBER);
    }

    if (!text) {
      logger.warn('[MockProvider] Empty text message, proceeding anyway');
    }

    // Simulation du délai réseau
    await this.simulateNetworkDelay();

    // Validation et normalisation du numéro
    const normalizedTo = normalizePhoneNumber(to);
    if (!validateWhatsAppNumber(normalizedTo)) {
      throw new WhatsAppError(
        `Invalid WhatsApp number: ${maskPhoneNumber(to)}`,
        WhatsAppErrorCodes.INVALID_NUMBER,
        { originalNumber: to }
      );
    }

    const messageId = this.generateMessageId();
    const waId = normalizedTo.replace('+', '');

    // Stocker le message pour inspection/debugging
    this.sentMessages.push({
      id: messageId,
      to: normalizedTo,
      text,
      timestamp: new Date(),
      options,
    });

    logger.info('[MockProvider] WhatsApp message sent successfully', {
      messageId,
      to: maskPhoneNumber(normalizedTo),
      textLength: text.length,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      tenantId: options.tenantId,
      conversationId: options.conversationId,
    });

    // Retourner une réponse simulée au format 360dialog
    const response: WhatsAppSendResponse = {
      messaging_product: 'whatsapp',
      contacts: [
        {
          input: normalizedTo,
          wa_id: waId,
        },
      ],
      messages: [
        {
          id: messageId,
          message_status: 'accepted',
        },
      ],
    };

    return response;
  }

  /**
   * Envoyer un message média (mock - stub)
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    type: 'image' | 'document' | 'audio' | 'video',
    options: SendTextMessageOptions & { caption?: string } = { metadata: {}, previewUrl: false }
  ): Promise<WhatsAppSendResponse> {
    await this.simulateNetworkDelay();

    const normalizedTo = normalizePhoneNumber(to);
    const messageId = this.generateMessageId();

    logger.info('[MockProvider] Media message sent successfully', {
      messageId,
      to: maskPhoneNumber(normalizedTo),
      type,
      mediaUrl,
    });

    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: normalizedTo, wa_id: normalizedTo.replace('+', '') }],
      messages: [{ id: messageId, message_status: 'accepted' }],
    };
  }

  /**
   * Valider la configuration (mock - toujours OK)
   */
  async validateConfiguration(): Promise<boolean> {
    logger.info('[MockProvider] Configuration validated successfully');
    return true;
  }

  /**
   * Récupérer tous les messages envoyés (pour les tests)
   */
  getSentMessages(): typeof this.sentMessages {
    return [...this.sentMessages];
  }

  /**
   * Récupérer le dernier message envoyé (pour les tests)
   */
  getLastSentMessage(): typeof this.sentMessages[0] | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  /**
   * Réinitialiser les messages envoyés (pour les tests)
   */
  clearSentMessages(): void {
    this.sentMessages = [];
    this.messageCounter = 0;
  }
}

/**
 * Instance singleton du mock provider
 */
export const whatsAppMockProvider = new WhatsAppMockProvider();
