/**
 * ================================
 * WhatsApp Routes - Sylion Backend
 * ================================
 * 
 * Routes pour le webhook WhatsApp et les endpoints de gestion.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendError, ErrorCodes } from '@/lib/http';
import { logger } from '@/lib/logger';
import {
  handleIncomingWebhook,
  validateWebhook,
} from './whatsapp.gateway';
import {
  WhatsAppError,
  WhatsAppErrorCodes,
} from './whatsapp.types';

/**
 * ================================
 * Interface des requêtes
 * ================================
 */

interface WebhookValidationQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

interface WebhookPostRequest extends FastifyRequest {
  body: unknown;
}

interface WebhookGetRequest extends FastifyRequest {
  query: WebhookValidationQuery;
}

/**
 * ================================
 * Plugin des routes WhatsApp
 * ================================
 */
export async function registerWhatsAppRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /whatsapp/webhook
   * Validation du webhook par le provider WhatsApp
   */
  fastify.get<{ Querystring: WebhookValidationQuery }>(
    '/webhook',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Webhook validation endpoint for WhatsApp',
        querystring: {
          type: 'object',
          properties: {
            'hub.mode': { type: 'string' },
            'hub.verify_token': { type: 'string' },
            'hub.challenge': { type: 'string' },
          },
        },
      },
    },
    async (request: WebhookGetRequest, reply: FastifyReply): Promise<void> => {
      try {
        const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = request.query;

        logger.info('WhatsApp webhook validation request', {
          mode,
          hasToken: !!token,
          hasChallenge: !!challenge,
          requestId: (request as any).requestId,
        });

        if (!mode || !token || !challenge) {
          return sendError(
            reply,
            ErrorCodes.BAD_REQUEST,
            'Missing required query parameters for webhook validation',
            undefined,
            (request as any).requestId
          );
        }

        const challengeResponse = await validateWebhook(mode, token, challenge);

        if (challengeResponse) {
          // WhatsApp attend juste le challenge en réponse, pas un JSON
          reply.type('text/plain').send(challengeResponse);
          return;
        }

        return sendError(
          reply,
          ErrorCodes.UNAUTHORIZED,
          'Webhook verification failed',
          undefined,
          (request as any).requestId
        );

      } catch (error) {
        logger.error('Error during webhook validation', {
          error: error instanceof Error ? error.message : String(error),
          requestId: (request as any).requestId,
        });

        if (error instanceof WhatsAppError) {
          const statusCode = error.code === WhatsAppErrorCodes.WEBHOOK_VERIFICATION_FAILED ? 403 : 400;
          return sendError(
            reply,
            ErrorCodes.UNAUTHORIZED,
            error.message,
            error.details,
            (request as any).requestId
          );
        }

        return sendError(
          reply,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Internal error during webhook validation',
          undefined,
          (request as any).requestId
        );
      }
    }
  );

  /**
   * POST /whatsapp/webhook
   * Réception des événements WhatsApp
   */
  fastify.post<{ Body: unknown }>(
    '/webhook',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Receive WhatsApp webhook events',
        body: {
          type: 'object',
          // Pas de validation stricte du body ici, c'est fait dans le gateway
        },
      },
    },
    async (request: WebhookPostRequest, reply: FastifyReply): Promise<void> => {
      try {
        logger.info('WhatsApp webhook event received', {
          hasBody: !!request.body,
          contentType: request.headers['content-type'],
          requestId: (request as any).requestId,
        });

        // Traitement du webhook via le gateway
        await handleIncomingWebhook(request.body);

        // Réponse standard WhatsApp (200 OK)
        return sendSuccess(reply, { 
          status: 'success',
          message: 'Webhook processed successfully',
        }, 200);

      } catch (error) {
        logger.error('Error processing WhatsApp webhook', {
          error: error instanceof Error ? error.message : String(error),
          requestId: (request as any).requestId,
        });

        if (error instanceof WhatsAppError) {
          // Erreurs métier WhatsApp
          const statusCode = error.code === WhatsAppErrorCodes.INVALID_PAYLOAD ? 400 : 422;
          return sendError(
            reply,
            ErrorCodes.VALIDATION_ERROR,
            error.message,
            error.details,
            (request as any).requestId
          );
        }

        // Toujours renvoyer 200 à WhatsApp pour éviter les retry infinis
        // mais logger l'erreur pour investigation
        logger.error('Returning 200 to WhatsApp despite internal error', {
          error: error instanceof Error ? error.message : String(error),
          requestId: (request as any).requestId,
        });

        return sendSuccess(reply, {
          status: 'error',
          message: 'Webhook received but processing failed',
        }, 200);
      }
    }
  );

  /**
   * GET /whatsapp/status
   * Endpoint pour vérifier le statut de l'intégration WhatsApp
   */
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Check WhatsApp integration status',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        // TODO: Ajouter des checks de santé plus avancés
        // - Test de connexion au provider
        // - Vérification des configs
        // - État de la queue

        return sendSuccess(reply, {
          status: 'operational',
          provider: 'configured',
          webhook: 'ready',
          queue: 'connected',
          timestamp: new Date().toISOString(),
        });

      } catch (error) {
        logger.error('Error checking WhatsApp status', {
          error: error instanceof Error ? error.message : String(error),
          requestId: (request as any).requestId,
        });

        return sendError(
          reply,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Failed to check WhatsApp status',
          undefined,
          (request as any).requestId
        );
      }
    }
  );

  logger.info('WhatsApp routes registered successfully');
}