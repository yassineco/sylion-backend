/**
 * ================================
 * WhatsApp Gateway - Sylion Backend
 * ================================
 *
 * Entrypoint for incoming WhatsApp webhooks.
 *
 * This module provides:
 *  - Fastify plugin to register the POST /whatsapp/webhook route
 *  - GET webhook validation for provider handshake
 *  - Signature verification (stub for now)
 *
 * Architecture:
 *  - Gateway receives raw webhook payloads
 *  - Logs incoming requests with structured metadata
 *  - Returns 200 OK immediately (async processing downstream)
 *
 * NOTE:
 *  - Payload normalization is handled by `gateway.ts` (Boss 1).
 *  - This file does NOT touch DB or queues directly.
 */

import { logger } from '@/lib/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { normalizeIncomingWhatsApp, WhatsAppNormalizationError } from './gateway';
import type { NormalizedIncomingMessage, RawWhatsAppPayload } from './types';
import { maskPhoneNumber, WhatsAppError, WhatsAppErrorCodes } from './types';

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

/** Response returned by the POST webhook endpoint */
export interface WebhookResponse {
  status: 'ok' | 'error';
  source: 'whatsapp-webhook';
  requestId?: string;
  message?: string;
}

/**
 * ================================
 * Gateway Handler
 * ================================
 */

/**
 * Handle incoming WhatsApp webhook POST request.
 *
 * This is the minimal gateway skeleton that:
 * - Accepts any JSON body
 * - Logs structured metadata
 * - Returns 200 OK immediately
 *
 * @param request - Fastify request with JSON body
 * @param reply - Fastify reply
 */
export async function handleIncomingWebhook(
  request: FastifyRequest<{ Body: IncomingWebhookBody }>,
  reply: FastifyReply,
): Promise<WebhookResponse> {
  const requestId = (request as any).requestId as string | undefined;

  // Extract key fields for logging (if present in typical WhatsApp payloads)
  const body = request.body || {};
  const hasMessages = Array.isArray((body as any).messages);
  const messageCount = hasMessages ? (body as any).messages.length : 0;
  const hasStatuses = Array.isArray((body as any).statuses);
  const statusCount = hasStatuses ? (body as any).statuses.length : 0;

  logger.info('[WhatsApp Gateway] Incoming webhook received', {
    requestId,
    contentType: request.headers['content-type'],
    hasMessages,
    messageCount,
    hasStatuses,
    statusCount,
    bodyKeys: Object.keys(body),
  });

  // TODO: validate provider signature (360dialog / Meta)
  // - Extract signature from headers (e.g., x-hub-signature-256)
  // - Verify HMAC-SHA256 against raw body and shared secret
  // - Reject if signature is invalid

  // Skip normalization for status-only webhooks (no messages)
  if (!hasMessages) {
    logger.debug('[WhatsApp Gateway] Status-only webhook, skipping normalization', {
      requestId,
      hasStatuses,
      statusCount,
    });

    return reply.status(200).send({
      status: 'ok',
      source: 'whatsapp-webhook',
      requestId,
    });
  }

  // Build raw payload for normalization (default to 360dialog provider)
  const rawPayload: RawWhatsAppPayload = {
    provider: '360dialog',
    body: request.body,
  };

  // Attempt to normalize the incoming message
  let normalizedMessage: NormalizedIncomingMessage;
  try {
    normalizedMessage = normalizeIncomingWhatsApp(rawPayload);
  } catch (error) {
    if (error instanceof WhatsAppNormalizationError) {
      logger.warn('[WhatsApp Gateway] Unrecognized or unsupported payload', {
        requestId,
        error: error.message,
        details: error.details,
      });

      return reply.status(400).send({
        status: 'error',
        source: 'whatsapp-webhook',
        message: 'unrecognized_payload',
        requestId,
      });
    }

    // Unexpected error - log and rethrow
    logger.error('[WhatsApp Gateway] Unexpected normalization error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Log successful normalization with structured metadata
  logger.info('[WhatsApp Gateway] Normalized message', {
    requestId,
    messageId: normalizedMessage.providerMessageId,
    from: maskPhoneNumber(normalizedMessage.fromPhone),
    to: maskPhoneNumber(normalizedMessage.toPhone),
    type: normalizedMessage.text ? 'text' : 'unknown',
    hasText: !!normalizedMessage.text,
    timestamp: normalizedMessage.timestamp.toISOString(),
  });

  // TODO: resolve channel/tenant from phone number
  // - Lookup channel by businessPhoneNumber (normalizedMessage.toPhone)
  // - Get associated tenant for multi-tenant routing

  // TODO: push normalized message into BullMQ queue
  // - Use enqueueIncomingWhatsAppJob from whatsapp_service.ts
  // - Include tenant context for downstream processing

  const response: WebhookResponse = {
    status: 'ok',
    source: 'whatsapp-webhook',
    requestId,
  };

  return reply.status(200).send(response);
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
 * This plugin registers:
 * - POST /webhook - Incoming message webhook (gateway entrypoint)
 * - GET /webhook - Webhook verification handshake
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
   * Gateway entrypoint for incoming WhatsApp messages
   */
  fastify.post<{ Body: IncomingWebhookBody }>(
    '/webhook',
    {
      schema: {
        tags: ['WhatsApp'],
        summary: 'Incoming WhatsApp webhook (gateway entrypoint)',
        description:
          'Receives incoming WhatsApp messages from providers (360dialog, Meta). ' +
          'Returns 200 OK immediately; processing happens asynchronously.',
        body: {
          type: 'object',
          additionalProperties: true, // Accept any JSON payload
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'error'] },
              source: { type: 'string', const: 'whatsapp-webhook' },
              requestId: { type: 'string' },
            },
            required: ['status', 'source'],
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
    routes: ['POST /webhook', 'GET /webhook'],
  });
}
