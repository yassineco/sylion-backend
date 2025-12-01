/**
 * ================================
 * WhatsApp Controller - Sylion Backend
 * ================================
 * 
 * Controller simplifié pour le vertical slice WhatsApp.
 * Gère la réception de webhooks et retourne les réponses pour tests locaux.
 */

import { ErrorCodes, sendError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { whatsappService } from '../../modules/whatsapp/whatsapp.service';

/**
 * ================================
 * Interfaces
 * ================================
 */

export interface WebhookPayload {
  from: string;
  to: string;
  text: string;
  timestamp?: string;
}

export type WebhookRequest = FastifyRequest<{ Body: WebhookPayload }>;

/**
 * ================================
 * Controller Principal
 * ================================
 */

export class WhatsAppController {
  /**
   * Gestionnaire principal du webhook WhatsApp
   */
  async handleWebhook(request: WebhookRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const payload = request.body;

      // Validation simple du payload
      if (!payload || typeof payload !== 'object') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid WhatsApp payload: body is required.',
          },
        });
      }

      if (typeof payload.from !== 'string' || typeof payload.to !== 'string' || typeof payload.text !== 'string') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid WhatsApp payload: "from", "to" and "text" are required as strings.',
          },
        });
      }

      logger.info('WhatsApp webhook received', {
        from: payload.from,
        to: payload.to,
        hasText: !!payload.text,
        requestId: (request as any).requestId,
      });

      // Traitement du webhook via le service
      const result = await whatsappService.handleIncomingWebhook(payload);

      // Retour pour tests locaux
      return reply.status(200).send({
        success: true,
        data: result,
      });

    } catch (error) {
      logger.error('Error processing WhatsApp webhook', {
        error: error instanceof Error ? error.message : String(error),
        from: request.body?.from,
        to: request.body?.to,
        requestId: (request as any).requestId,
      });

      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to process WhatsApp webhook',
        { error: error instanceof Error ? error.message : String(error) },
        (request as any).requestId
      );
    }
  }
}

/**
 * Instance du controller pour utilisation dans les routes
 */
export const whatsappController = new WhatsAppController();
