/**
 * ================================
 * WhatsApp Routes - Sylion Backend
 * ================================
 *
 * Routes pour le webhook WhatsApp et les endpoints de gestion.
 */

import { ErrorCodes, sendError, sendSuccess, SylionError } from '@/lib/http';
import { logger } from '@/lib/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { normalizeIncomingWhatsApp, WhatsAppNormalizationError } from './gateway';
import type { RawWhatsAppPayload } from './types';
import { WhatsAppError } from './types';
import { validateWebhook } from './whatsapp.gateway'; // legacy GET webhook
import {
  enqueueIncomingWhatsAppJob,
  handleIncomingWhatsAppMessage,
} from './whatsapp_service';

/**
 * ================================
 * Interfaces de requêtes
 * ================================
 */

interface WebhookValidationQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

interface WebhookPostRequest extends FastifyRequest {
  body: any; // le schema JSON fait la vraie validation
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
   * Validation du webhook (legacy)
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
      const requestId = (request as any).requestId;

      try {
        const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
          request.query;

        logger.info('WhatsApp webhook validation request', {
          mode,
          hasToken: !!token,
          hasChallenge: !!challenge,
          requestId,
        });

        if (!mode || !token || !challenge) {
          return sendError(
            reply,
            ErrorCodes.BAD_REQUEST,
            'Missing required query parameters for webhook validation',
            undefined,
            requestId,
          );
        }

        const challengeResponse = await validateWebhook(mode, token, challenge);

        if (challengeResponse) {
          reply.type('text/plain').send(challengeResponse);
          return;
        }

        return sendError(
          reply,
          ErrorCodes.UNAUTHORIZED,
          'Webhook verification failed',
          undefined,
          requestId,
        );
      } catch (err: unknown) {
        logger.error('Error during webhook validation', {
          error: err instanceof Error ? err.message : String(err),
          requestId,
        });

        if (err instanceof WhatsAppError) {
          return sendError(
            reply,
            ErrorCodes.UNAUTHORIZED,
            err.message,
            (err as any).details,
            requestId,
          );
        }

        return sendError(
          reply,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Internal error during webhook validation',
          undefined,
          requestId,
        );
      }
    },
  );

  /**
   * POST /whatsapp/webhook
   * Pipeline WhatsApp Boss 1 (Gateway → Service → Queue)
   *
   * Format 360dialog:
   * {
   *   "messages": [
   *     { "id": "...", "from": "...", "to": "...", "timestamp": "...", "type": "text", "text": { "body": "..." } }
   *   ]
   * }
   */
  fastify.post<{ Body: any }>(
    '/webhook',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Webhook 360dialog (Boss 1)',
        body: {
          type: 'object',
          properties: {
            // Format 360dialog : tableau de messages
            messages: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  from: { type: 'string' },
                  to: { type: 'string' },
                  timestamp: { type: 'string' },
                  type: { type: 'string' },
                  text: {
                    type: 'object',
                    properties: {
                      body: { type: 'string' },
                    },
                    required: ['body'],
                    additionalProperties: true,
                  },
                },
                required: ['id', 'from', 'to', 'timestamp', 'type'],
                additionalProperties: true,
              },
            },
          },
          required: ['messages'],
          // on laisse passer le reste du payload (metadata provider, statuses, etc.)
          additionalProperties: true,
        },
      },
    },
    async (request: WebhookPostRequest, reply: FastifyReply): Promise<void> => {
      const requestId = (request as any).requestId;

      try {
        logger.info('WhatsApp webhook event received (Boss 1)', {
          hasBody: !!request.body,
          contentType: request.headers['content-type'],
          requestId,
        });

        // 1. Payload brut provider
        const rawPayload: RawWhatsAppPayload = {
          provider: '360dialog',
          body: request.body,
        };

        // 2. Normalisation
        const normalized = normalizeIncomingWhatsApp(rawPayload);

        logger.info('Message normalized successfully', {
          providerMessageId: normalized.providerMessageId,
          fromPhone: normalized.fromPhone.substring(0, 8) + '***',
          toPhone: normalized.toPhone.substring(0, 8) + '***',
          textLength: normalized.text.length,
          requestId,
        });

        // 3. Service core (tenant/channel/conversation/message)
        const coreResult = await handleIncomingWhatsAppMessage(normalized);

        logger.info('Core message processing completed', {
          tenantId: coreResult.tenantId,
          channelId: coreResult.channelId,
          conversationId: coreResult.conversationId,
          messageId: coreResult.messageId,
          requestId,
        });

        // 4. Push queue
        await enqueueIncomingWhatsAppJob(normalized, coreResult);

        logger.info('WhatsApp message processing job enqueued', {
          tenantId: coreResult.tenantId,
          conversationId: coreResult.conversationId,
          requestId,
        });

        // 5. Réponse WhatsApp (200 OK obligatoire)
        return sendSuccess(
          reply,
          {
            status: 'accepted',
            tenantId: coreResult.tenantId,
            channelId: coreResult.channelId,
            conversationId: coreResult.conversationId,
            messageId: coreResult.messageId,
          },
          200,
        );
      } catch (err: unknown) {
        logger.error('Error processing WhatsApp webhook (Boss 1)', {
          error: err instanceof Error ? err.message : String(err),
          errorType: (err as any)?.constructor?.name ?? 'Unknown',
          requestId,
        });

        // 1. Erreur normalisation gateway
        if (err instanceof WhatsAppNormalizationError) {
          const msg = (err as Error).message;
          const details = (err as any).details;

          return sendError(
            reply,
            ErrorCodes.BAD_REQUEST,
            'Erreur de normalisation: ' + msg,
            details,
            requestId,
          );
        }

        // 2. Erreur métier Sylion (service core)
        if (err instanceof SylionError) {
          const details = (err as any).details;

          return sendError(reply, err.code, err.message, details, requestId);
        }

        // 3. Erreurs legacy WhatsApp
        if (err instanceof WhatsAppError) {
          const details = (err as any).details;

          return sendError(
            reply,
            ErrorCodes.VALIDATION_ERROR,
            err.message,
            details,
            requestId,
          );
        }

        // 4. Fallback : Toujours 200 pour éviter retry WhatsApp
        logger.error('Returning 200 to WhatsApp despite internal error', {
          error: err instanceof Error ? err.message : String(err),
          requestId,
        });

        return sendSuccess(
          reply,
          {
            status: 'error',
            message: 'Webhook received but processing failed',
          },
          200,
        );
      }
    },
  );

  /**
   * GET /whatsapp/status
   * Simple health-check
   */
  fastify.get(
    '/status',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Check WhatsApp integration status',
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        return sendSuccess(reply, {
          status: 'operational',
          provider: 'configured',
          webhook: 'ready',
          queue: 'connected',
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        logger.error('Error checking WhatsApp status', {
          error: err instanceof Error ? err.message : String(err),
        });

        return sendError(
          reply,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Failed to check WhatsApp status',
        );
      }
    },
  );

  logger.info('WhatsApp routes registered successfully');
}
