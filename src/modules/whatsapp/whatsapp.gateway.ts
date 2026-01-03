/**
 * ================================
 * WhatsApp Gateway - Sylion Backend
 * ================================
 *
 * DEPRECATED: Ce webhook legacy est déprécié.
 * Utilisez le pipeline standardisé POST /api/v1/whatsapp/webhook (Boss 1).
 *
 * This module provides:
 *  - Fastify plugin to register the /whatsapp routes
 *  - GET webhook validation for provider handshake (still active)
 *  - POST webhook returns 410 Gone with migration instructions
 *
 * NOTE:
 *  - Le POST /whatsapp/webhook retourne désormais 410 Gone
 *  - Migrez vers POST /api/v1/whatsapp/webhook
 */

import { logger } from '@/lib/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { WhatsAppError, WhatsAppErrorCodes } from './types';

/**
 * ================================
 * Types
 * ================================
 */

/** Raw incoming webhook body (any JSON) */
interface IncomingWebhookBody {
  [key: string]: unknown;
}

/** Query params for GET webhook verification */
interface WebhookVerificationQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

/** Response returned by the deprecated POST webhook endpoint */
export interface WebhookDeprecatedResponse {
  error: 'deprecated';
  message: string;
  use: string;
  documentation?: string;
}

/** Response returned by the POST webhook endpoint */
export interface WebhookResponse {
  status: 'ok' | 'error';
  source: 'whatsapp-webhook';
  requestId?: string;
  message?: string;
}

/**
 * ================================
 * DEPRECATED Gateway Handler
 * ================================
 */

/**
 * Handle incoming WhatsApp webhook POST request.
 * 
 * DEPRECATED: Returns 410 Gone with migration instructions.
 * Use POST /api/v1/whatsapp/webhook instead.
 *
 * @param request - Fastify request with JSON body
 * @param reply - Fastify reply
 */
export async function handleIncomingWebhook(
  request: FastifyRequest<{ Body: IncomingWebhookBody }>,
  reply: FastifyReply,
): Promise<WebhookDeprecatedResponse> {
  const requestId = (request as any).requestId as string | undefined;

  logger.warn('[WhatsApp Gateway] DEPRECATED endpoint called - POST /whatsapp/webhook', {
    requestId,
    deprecatedEndpoint: 'POST /whatsapp/webhook',
    recommendedEndpoint: 'POST /api/v1/whatsapp/webhook',
  });

  const response: WebhookDeprecatedResponse = {
    error: 'deprecated',
    message: 'This webhook endpoint is deprecated. Please migrate to the standardized pipeline.',
    use: '/api/v1/whatsapp/webhook',
    documentation: 'https://docs.sylion.tech/api/whatsapp-webhook',
  };

  return reply.status(410).send(response);
}

/**
 * ================================
 * Webhook Verification (GET)
 * ================================
 */

/**
 * Validate webhook for initial provider handshake (GET /whatsapp/webhook).
 *
 * If validation succeeds:
 *   → Returns the `challenge` string to echo back to WhatsApp.
 * If validation fails:
 *   → Throws a `WhatsAppError` with code WEBHOOK_VERIFICATION_FAILED.
 *
 * @param mode - The hub.mode query parameter (should be 'subscribe')
 * @param token - The hub.verify_token query parameter
 * @param challenge - The hub.challenge query parameter to echo back
 * @returns The challenge string on success
 * @throws WhatsAppError on verification failure
 */
export async function validateWebhook(
  mode: string,
  token: string,
  challenge: string,
): Promise<string> {
  const expectedToken = process.env['WHATSAPP_VERIFY_TOKEN'];

  logger.info('[WhatsApp Gateway] Validating webhook subscription', {
    mode,
    hasToken: !!token,
    hasChallenge: !!challenge,
    hasExpectedToken: !!expectedToken,
  });

  if (mode === 'subscribe' && token === expectedToken && !!challenge) {
    logger.info('[WhatsApp Gateway] Webhook validation successful', {
      mode,
    });
    return challenge;
  }

  logger.warn('[WhatsApp Gateway] Webhook validation failed', {
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
 * ================================
 * Signature Verification
 * ================================
 */

/**
 * Verify webhook signature from provider (if supported).
 *
 * This is a stub for future implementation:
 * - 360dialog: HMAC-SHA256 with shared secret
 * - Meta Cloud API: x-hub-signature-256 header
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from request headers
 * @returns true if valid (or skipped), false if invalid
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean> {
  // TODO: Implement real signature verification
  // - Parse signature header format
  // - Compute HMAC-SHA256 of payload with secret
  // - Compare computed vs provided signature
  logger.debug('[WhatsApp Gateway] Signature verification skipped (not implemented)', {
    hasPayload: !!payload,
    hasSignature: !!signature,
  });

  return true;
}

/**
 * ================================
 * Fastify Plugin Registration
 * ================================
 */

/**
 * Register WhatsApp Gateway routes as a Fastify plugin.
 *
 * DEPRECATED: POST /webhook now returns 410 Gone.
 * Use POST /api/v1/whatsapp/webhook for the standardized pipeline.
 *
 * This plugin registers:
 * - POST /webhook - DEPRECATED, returns 410 Gone
 * - GET /webhook - Webhook verification handshake (still active)
 *
 * Usage in routes.ts:
 * \`\`\`ts
 * await fastify.register(registerWhatsAppGateway, { prefix: '/whatsapp' });
 * \`\`\`
 *
 * @param fastify - Fastify instance
 */
export async function registerWhatsAppGateway(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /whatsapp/webhook
   * DEPRECATED - Returns 410 Gone with migration instructions
   */
  fastify.post<{ Body: IncomingWebhookBody }>(
    '/webhook',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: '[DEPRECATED] Legacy WhatsApp webhook - Use /api/v1/whatsapp/webhook',
        description:
          'DEPRECATED: This endpoint returns 410 Gone. ' +
          'Please migrate to POST /api/v1/whatsapp/webhook for the standardized pipeline.',
        deprecated: true,
        body: {
          type: 'object',
          additionalProperties: true,
        },
        response: {
          410: {
            type: 'object',
            properties: {
              error: { type: 'string', const: 'deprecated' },
              message: { type: 'string' },
              use: { type: 'string' },
              documentation: { type: 'string' },
            },
            required: ['error', 'message', 'use'],
          },
        },
      },
    },
    handleIncomingWebhook,
  );

  /**
   * GET /whatsapp/webhook
   * Webhook verification endpoint for provider handshake
   */
  fastify.get<{ Querystring: WebhookVerificationQuery }>(
    '/webhook',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Webhook verification (provider handshake)',
        description:
          'Verifies the webhook subscription with the provider. ' +
          'Returns the challenge token if verification succeeds.',
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
    async (
      request: FastifyRequest<{ Querystring: WebhookVerificationQuery }>,
      reply: FastifyReply,
    ): Promise<void> => {
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
        request.query;

      if (!mode || !token || !challenge) {
        logger.warn('[WhatsApp Gateway] Missing verification params', {
          hasMode: !!mode,
          hasToken: !!token,
          hasChallenge: !!challenge,
        });
        return reply.status(400).send({
          status: 'error',
          source: 'whatsapp-webhook',
          message: 'Missing required query parameters',
        });
      }

      try {
        const challengeResponse = await validateWebhook(mode, token, challenge);
        // Must return challenge as plain text for WhatsApp verification
        return reply.type('text/plain').send(challengeResponse);
      } catch (error) {
        if (error instanceof WhatsAppError) {
          logger.warn('[WhatsApp Gateway] Verification failed', {
            code: error.code,
            message: error.message,
          });
          return reply.status(401).send({
            status: 'error',
            source: 'whatsapp-webhook',
            message: error.message,
          });
        }
        throw error;
      }
    },
  );

  logger.info('[WhatsApp Gateway] Routes registered', {
    routes: ['POST /webhook (DEPRECATED - 410)', 'GET /webhook'],
    note: 'Use POST /api/v1/whatsapp/webhook for message processing',
  });
}
