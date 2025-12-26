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

import { addJob } from '@/jobs/index';
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
 * Helper Functions
 * ================================
 */

/**
 * Extract the value object from Meta Cloud API payload structure.
 * Meta payloads have: body.entry[0].changes[0].value
 *
 * @param body - Raw webhook body
 * @returns The value object if Meta shape, null otherwise
 */
function extractMetaValue(body: any): any | null {
  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Get messages array from webhook body (supports both 360dialog and Meta formats).
 *
 * @param body - Raw webhook body
 * @returns Array of messages (empty if none found)
 */
function getMessages(body: any): any[] {
  // 360dialog format: body.messages
  if (Array.isArray(body?.messages)) {
    return body.messages;
  }
  // Meta format: body.entry[0].changes[0].value.messages
  const value = extractMetaValue(body);
  if (value && Array.isArray(value.messages)) {
    return value.messages;
  }
  return [];
}

/**
 * Get statuses array from webhook body (supports both 360dialog and Meta formats).
 *
 * @param body - Raw webhook body
 * @returns Array of statuses (empty if none found)
 */
function getStatuses(body: any): any[] {
  // 360dialog format: body.statuses
  if (Array.isArray(body?.statuses)) {
    return body.statuses;
  }
  // Meta format: body.entry[0].changes[0].value.statuses
  const value = extractMetaValue(body);
  if (value && Array.isArray(value.statuses)) {
    return value.statuses;
  }
  return [];
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

  // Extract key fields for logging (supports both 360dialog and Meta formats)
  const body = request.body || {};
  const metaValue = extractMetaValue(body);
  const isMetaShape = metaValue !== null;

  // Detect provider based on payload shape and env config
  const envProvider = process.env['WHATSAPP_PROVIDER'] ?? '360dialog';
  const provider = isMetaShape ? 'meta' : envProvider;

  // Extract messages and statuses using helpers
  const messages = getMessages(body);
  const statuses = getStatuses(body);
  const hasMessages = messages.length > 0;
  const messageCount = messages.length;
  const hasStatuses = statuses.length > 0;
  const statusCount = statuses.length;

  // Check for signature headers
  const hasSignatureHeader =
    !!request.headers['x-hub-signature-256'] || !!request.headers['x-signature'];

  logger.debug('[WhatsApp Gateway] Provider detection', {
    requestId,
    detectedProvider: provider,
    isMetaShape,
    hasSignatureHeader,
  });

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

  // Build raw payload for normalization (using detected provider)
  const rawPayload: RawWhatsAppPayload = {
    provider: provider as RawWhatsAppPayload['provider'],
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

      // Always return 200 to avoid provider retries
      return reply.status(200).send({
        status: 'ok',
        source: 'whatsapp-webhook',
        requestId,
        message: 'ignored_unrecognized_payload',
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

  // Enqueue normalized message to BullMQ (fire-and-forget)
  // Note: tenant/channel resolution happens in the worker
  try {
    await addJob(
      'incoming-message',
      {
        messageData: normalizedMessage,
        timestamp: new Date().toISOString(),
      },
      {
        priority: 10,
        attempts: 3,
      },
    );

    logger.info('[WhatsApp Gateway] Message enqueued for processing', {
      requestId,
      messageId: normalizedMessage.providerMessageId,
      provider: normalizedMessage.provider,
    });
  } catch (enqueueError) {
    // Fire-and-forget: log error but DO NOT fail HTTP response
    // This prevents provider retries on queue failures
    logger.error('[WhatsApp Gateway] Failed to enqueue message (non-fatal)', {
      requestId,
      error: enqueueError instanceof Error ? enqueueError.message : String(enqueueError),
      messageId: normalizedMessage.providerMessageId,
    });
  }

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
