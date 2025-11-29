/**
 * ================================
 * WhatsApp Provider - Sylion Backend
 * ================================
 * 
 * Client HTTP pour communiquer avec le provider WhatsApp (360dialog ou équivalent).
 * Envoi de messages et gestion des API calls.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import {
  WhatsAppSendResponse,
  WhatsAppSendResponseSchema,
  SendTextMessageOptions,
  WhatsAppError,
  WhatsAppErrorCodes,
  validateWhatsAppNumber,
  normalizePhoneNumber,
  maskPhoneNumber,
} from './whatsapp.types';

/**
 * ================================
 * WhatsApp Provider Client
 * ================================
 */
export class WhatsAppProvider {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.whatsapp.apiUrl,
      timeout: 30000, // 30 secondes
      headers: {
        'Authorization': `Bearer ${config.whatsapp.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Sylion-Backend/1.0',
      },
    });

    // Intercepteur pour logging des requêtes
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('WhatsApp API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasData: !!config.data,
          // Ne pas logger les headers pour éviter de leak le token
        });
        return config;
      },
      (error) => {
        logger.error('WhatsApp API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Intercepteur pour logging des réponses
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('WhatsApp API Response', {
          status: response.status,
          url: response.config.url,
          hasData: !!response.data,
        });
        return response;
      },
      (error) => {
        logger.error('WhatsApp API Error Response', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.response?.data?.error?.message || error.message,
          code: error.response?.data?.error?.code,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Envoyer un message texte via WhatsApp
   */
  async sendTextMessage(
    to: string,
    text: string,
    options: SendTextMessageOptions = {
      metadata: {},
      previewUrl: false
    }
  ): Promise<WhatsAppSendResponse> {
    try {
      // Validation et normalisation du numéro
      const normalizedTo = normalizePhoneNumber(to);
      if (!validateWhatsAppNumber(normalizedTo)) {
        throw new WhatsAppError(
          `Invalid WhatsApp number: ${maskPhoneNumber(to)}`,
          WhatsAppErrorCodes.INVALID_NUMBER,
          { originalNumber: to }
        );
      }

      // Préparation du payload
      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedTo.replace('+', ''), // API WhatsApp veut le numéro sans +
        type: 'text',
        text: {
          body: text,
          preview_url: options.previewUrl,
        },
        // Contexte pour les réponses
        ...(options.replyToMessageId && {
          context: {
            message_id: options.replyToMessageId,
          },
        }),
      };

      logger.info('Sending WhatsApp message', {
        to: maskPhoneNumber(normalizedTo),
        textLength: text.length,
        tenantId: options.tenantId,
        conversationId: options.conversationId,
        isReply: !!options.replyToMessageId,
      });

      // Appel API
      const response: AxiosResponse = await this.client.post(
        `/messages`, // Endpoint standard WhatsApp Business API
        payload
      );

      // Validation de la réponse
      const validatedResponse = WhatsAppSendResponseSchema.parse(response.data);

      // Vérification du statut du message
      const message = validatedResponse.messages[0];
      if (message?.message_status === 'failed') {
        throw new WhatsAppError(
          'Message send failed',
          WhatsAppErrorCodes.SEND_FAILED,
          { response: validatedResponse }
        );
      }

      logger.info('WhatsApp message sent successfully', {
        messageId: message?.id,
        to: maskPhoneNumber(normalizedTo),
        tenantId: options.tenantId,
      });

      return validatedResponse;

    } catch (error) {
      // Gestion des erreurs
      if (error instanceof WhatsAppError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;

        // Rate limiting
        if (status === 429) {
          throw new WhatsAppError(
            'WhatsApp API rate limit exceeded',
            WhatsAppErrorCodes.RATE_LIMIT_EXCEEDED,
            { 
              retryAfter: error.response?.headers['retry-after'],
              to: maskPhoneNumber(to),
            }
          );
        }

        // Autres erreurs API
        throw new WhatsAppError(
          errorData?.error?.message || 'WhatsApp API error',
          WhatsAppErrorCodes.SEND_FAILED,
          {
            status,
            code: errorData?.error?.code,
            to: maskPhoneNumber(to),
          }
        );
      }

      // Erreur générique
      throw new WhatsAppError(
        'Unexpected error while sending message',
        WhatsAppErrorCodes.SEND_FAILED,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Envoyer un message média (préparation pour futur)
   * Pour l'instant, juste un stub
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    type: 'image' | 'document' | 'audio' | 'video',
    options: SendTextMessageOptions & { caption?: string } = {
      metadata: {},
      previewUrl: false
    }
  ): Promise<WhatsAppSendResponse> {
    // TODO: Implémenter l'envoi de média dans une future phase
    throw new WhatsAppError(
      'Media messages not implemented yet',
      'WHATSAPP_MEDIA_NOT_IMPLEMENTED'
    );
  }

  /**
   * Récupérer les informations sur un contact WhatsApp
   * Stub pour future implémentation
   */
  async getContactInfo(phoneNumber: string): Promise<any> {
    // TODO: Implémenter la récupération des infos contact
    throw new WhatsAppError(
      'Contact info retrieval not implemented yet',
      'WHATSAPP_CONTACT_INFO_NOT_IMPLEMENTED'
    );
  }

  /**
   * Valider la configuration du provider
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      logger.info('Validating WhatsApp provider configuration...');

      // Test simple : récupérer les infos du compte business
      // Cet endpoint varie selon le provider, ici on simule
      const response = await this.client.get('/phone_numbers'); // Endpoint d'exemple

      logger.info('WhatsApp provider configuration validated', {
        hasData: !!response.data,
      });

      return true;
    } catch (error) {
      logger.error('WhatsApp provider configuration validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Obtenir les statistiques d'utilisation (si supporté par le provider)
   */
  async getUsageStats(): Promise<any> {
    try {
      // Endpoint dépendant du provider
      // 360dialog : GET /stats
      const response = await this.client.get('/stats');
      return response.data;
    } catch (error) {
      logger.warn('Could not retrieve WhatsApp usage stats', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

/**
 * Instance singleton du provider WhatsApp
 */
export const whatsAppProvider = new WhatsAppProvider();

/**
 * Helper functions pour utilisation dans les workers
 */

export const sendWhatsAppTextMessage = (
  to: string,
  text: string,
  options?: SendTextMessageOptions
): Promise<WhatsAppSendResponse> => {
  return whatsAppProvider.sendTextMessage(to, text, options);
};

export const validateWhatsAppConfiguration = (): Promise<boolean> => {
  return whatsAppProvider.validateConfiguration();
};