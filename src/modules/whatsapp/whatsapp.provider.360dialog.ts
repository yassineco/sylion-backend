/**
 * ================================
 * WhatsApp 360dialog Provider - Sylion Backend
 * ================================
 *
 * Provider réel pour l'envoi de messages WhatsApp via 360dialog API.
 * Utilisé en production. Mock provider utilisé en dev/test.
 *
 * Environment Variables (priority order for API key):
 * 1. WHATSAPP_LIVE_API_KEY: Real API key for live tests (highest priority)
 * 2. WHATSAPP_360D_API_KEY: 360dialog-specific API key
 * 3. WHATSAPP_API_KEY: Generic WhatsApp API key (lowest priority)
 *
 * Other Environment Variables:
 * - WHATSAPP_360D_BASE_URL: Base URL (default: https://waba.360dialog.io/v1)
 * - WHATSAPP_DRY_RUN: If "true", skip actual API calls (for testing)
 * - WHATSAPP_LIVE_TEST: If "true", enable live test mode for single message tests
 */

/**
 * Check if dry-run mode is enabled
 */
export function isDryRunMode(): boolean {
  return process.env['WHATSAPP_DRY_RUN'] === 'true';
}

/**
 * Check if live test mode is enabled
 * Used by the live-test-send.ts script to make a single real API call
 */
export function isLiveTestMode(): boolean {
  return process.env['WHATSAPP_LIVE_TEST'] === 'true';
}

/**
 * Get the resolved API key from environment variables
 * Priority: WHATSAPP_LIVE_API_KEY > WHATSAPP_360D_API_KEY > WHATSAPP_API_KEY
 * 
 * @returns The resolved API key or null if none found
 */
export function getResolvedApiKey(): string | null {
  return (
    process.env['WHATSAPP_LIVE_API_KEY'] ??
    process.env['WHATSAPP_360D_API_KEY'] ??
    process.env['WHATSAPP_API_KEY'] ??
    null
  );
}

/**
 * Check if an API key looks like a dummy/placeholder key
 * Used for warning in dev mode
 */
export function isDummyApiKey(apiKey: string | null): boolean {
  if (!apiKey) return true;
  if (apiKey.length < 20) return true;
  if (apiKey.startsWith('local-dev')) return true;
  if (apiKey.startsWith('dummy')) return true;
  if (apiKey.startsWith('test-')) return true;
  if (apiKey.includes('placeholder')) return true;
  return false;
}

import { logger } from '@/lib/logger';
import {
    maskPhoneNumber,
    normalizePhoneNumber,
    SendTextMessageOptions,
    WhatsAppError,
    WhatsAppErrorCodes,
    WhatsAppSendResponse,
} from './types';
import type { IWhatsAppProvider } from './whatsapp.provider.mock';

/**
 * ================================
 * 360dialog Configuration
 * ================================
 */
interface Dialog360Config {
  apiKey: string;
  baseUrl: string;
  isDummy: boolean;
}

/**
 * Get 360dialog configuration from environment
 * Priority for API key: WHATSAPP_LIVE_API_KEY > WHATSAPP_360D_API_KEY > WHATSAPP_API_KEY
 */
function get360dialogConfig(): Dialog360Config {
  const apiKey = getResolvedApiKey() ?? '';
  const baseUrl =
    process.env['WHATSAPP_360D_BASE_URL'] ||
    process.env['WHATSAPP_API_URL'] ||
    'https://waba.360dialog.io/v1';
  const isDummy = isDummyApiKey(apiKey);

  return { apiKey, baseUrl, isDummy };
}

/**
 * ================================
 * 360dialog API Response Types
 * ================================
 */
interface Dialog360ErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_data?: {
      details?: string;
    };
  };
  meta?: {
    api_status?: string;
  };
}

/**
 * ================================
 * WhatsApp 360dialog Provider
 * ================================
 *
 * Production-ready provider for sending WhatsApp messages
 * via the 360dialog Cloud API.
 */
export class WhatsApp360dialogProvider implements IWhatsAppProvider {
  private config: Dialog360Config;

  constructor() {
    this.config = get360dialogConfig();

    if (!this.config.apiKey) {
      logger.warn('[360dialog][config] API key not configured - provider will fail on send');
    } else if (this.config.isDummy) {
      logger.warn('[360dialog][config] Dummy/placeholder API key detected - real API calls will fail', {
        baseUrl: this.config.baseUrl,
        apiKeyPreview: this.config.apiKey.substring(0, 12) + '...',
        hint: 'For live tests, use: WHATSAPP_LIVE_API_KEY=your_real_key npm run test:whatsapp:live',
      });
    } else {
      logger.info('[360dialog] Provider initialized', {
        baseUrl: this.config.baseUrl,
        apiKeyPresent: true,
        apiKeyPreview: this.config.apiKey.substring(0, 8) + '...',
      });
    }
  }

  /**
   * Send a text message via 360dialog API
   */
  async sendTextMessage(
    to: string,
    text: string,
    options: SendTextMessageOptions = {}
  ): Promise<WhatsAppSendResponse> {
    // Defensive: validate inputs
    if (!to || typeof to !== 'string') {
      throw new WhatsAppError(
        'Recipient phone number is required',
        WhatsAppErrorCodes.INVALID_NUMBER,
        { to }
      );
    }

    if (!text || typeof text !== 'string') {
      throw new WhatsAppError(
        'Message text is required',
        WhatsAppErrorCodes.INVALID_PAYLOAD,
        { textProvided: !!text }
      );
    }

    // Normalize phone number
    const normalizedTo = normalizePhoneNumber(to);
    if (!normalizedTo) {
      throw new WhatsAppError(
        'Invalid phone number format',
        WhatsAppErrorCodes.INVALID_NUMBER,
        { to: maskPhoneNumber(to) }
      );
    }

    // Build 360dialog message payload
    // Format: remove leading '+' for wa_id
    const waId = normalizedTo.replace(/^\+/, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'text',
      text: {
        preview_url: options.previewUrl ?? false,
        body: text,
      },
    };

    logger.debug('[360dialog] Preparing outbound message', {
      to: maskPhoneNumber(normalizedTo),
      textLength: text.length,
      tenantId: options.tenantId,
      conversationId: options.conversationId,
      dryRun: isDryRunMode(),
    });

    // Dry-run mode: skip actual API call
    if (isDryRunMode()) {
      const dryRunMessageId = `dryrun_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      logger.info('[360dialog][dry-run] Would send message (API call skipped)', {
        messageId: dryRunMessageId,
        to: maskPhoneNumber(normalizedTo),
        textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        textLength: text.length,
        tenantId: options.tenantId,
        conversationId: options.conversationId,
      });

      // Return a simulated successful response
      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: normalizedTo, wa_id: waId }],
        messages: [{ id: dryRunMessageId, message_status: 'accepted' }],
      };
    }

    try {
      const response = await this.makeApiRequest('/messages', payload);

      logger.info('[360dialog] Outbound message created', {
        messageId: response.messages?.[0]?.id,
        to: maskPhoneNumber(normalizedTo),
        tenantId: options.tenantId,
        conversationId: options.conversationId,
      });

      return response;
    } catch (error) {
      // Log error with safe redaction
      this.logProviderError('sendTextMessage', error, {
        to: maskPhoneNumber(normalizedTo),
        tenantId: options.tenantId,
      });

      // Re-throw as WhatsAppError if not already
      if (error instanceof WhatsAppError) {
        throw error;
      }

      throw new WhatsAppError(
        'Failed to send WhatsApp message',
        WhatsAppErrorCodes.SEND_FAILED,
        {
          originalError: error instanceof Error ? error.message : String(error),
          to: maskPhoneNumber(normalizedTo),
        }
      );
    }
  }

  /**
   * Send a media message via 360dialog API
   */
  async sendMediaMessage(
    to: string,
    mediaUrl: string,
    type: 'image' | 'document' | 'audio' | 'video',
    options: SendTextMessageOptions & { caption?: string } = {}
  ): Promise<WhatsAppSendResponse> {
    const normalizedTo = normalizePhoneNumber(to);
    if (!normalizedTo) {
      throw new WhatsAppError(
        'Invalid phone number format',
        WhatsAppErrorCodes.INVALID_NUMBER,
        { to: maskPhoneNumber(to) }
      );
    }

    const waId = normalizedTo.replace(/^\+/, '');

    const mediaPayload: Record<string, unknown> = {
      link: mediaUrl,
    };

    if (options.caption) {
      mediaPayload['caption'] = options.caption;
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type,
      [type]: mediaPayload,
    };

    // Dry-run mode: skip actual API call
    if (isDryRunMode()) {
      const dryRunMessageId = `dryrun_media_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      logger.info('[360dialog][dry-run] Would send media message (API call skipped)', {
        messageId: dryRunMessageId,
        to: maskPhoneNumber(normalizedTo),
        mediaType: type,
        mediaUrl: mediaUrl.substring(0, 50) + (mediaUrl.length > 50 ? '...' : ''),
        tenantId: options.tenantId,
      });

      return {
        messaging_product: 'whatsapp',
        contacts: [{ input: normalizedTo, wa_id: waId }],
        messages: [{ id: dryRunMessageId, message_status: 'accepted' }],
      };
    }

    try {
      const response = await this.makeApiRequest('/messages', payload);

      logger.info('[360dialog] Outbound media message created', {
        messageId: response.messages?.[0]?.id,
        to: maskPhoneNumber(normalizedTo),
        mediaType: type,
        tenantId: options.tenantId,
      });

      return response;
    } catch (error) {
      this.logProviderError('sendMediaMessage', error, {
        to: maskPhoneNumber(normalizedTo),
        mediaType: type,
        tenantId: options.tenantId,
      });

      if (error instanceof WhatsAppError) {
        throw error;
      }

      throw new WhatsAppError(
        'Failed to send WhatsApp media message',
        WhatsAppErrorCodes.SEND_FAILED,
        {
          originalError: error instanceof Error ? error.message : String(error),
          to: maskPhoneNumber(normalizedTo),
          mediaType: type,
        }
      );
    }
  }

  /**
   * Validate 360dialog configuration
   */
  async validateConfiguration(): Promise<boolean> {
    if (!this.config.apiKey) {
      logger.warn('[360dialog] Configuration invalid: API key missing');
      return false;
    }

    if (!this.config.baseUrl) {
      logger.warn('[360dialog] Configuration invalid: Base URL missing');
      return false;
    }

    // Optionally: make a health check call to 360dialog
    // For now, just validate that config is present
    logger.info('[360dialog] Configuration validated successfully');
    return true;
  }

  /**
   * Make HTTP request to 360dialog API
   */
  private async makeApiRequest(
    endpoint: string,
    payload: Record<string, unknown>
  ): Promise<WhatsAppSendResponse> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': this.config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseData = (await response.json()) as WhatsAppSendResponse & Dialog360ErrorResponse;

    // Check for API errors
    if (!response.ok || responseData.error) {
      const errorMessage =
        responseData.error?.message ||
        responseData.error?.error_data?.details ||
        `HTTP ${response.status}`;

      // Enhanced logging for 401 Unauthorized (common with dummy keys)
      if (response.status === 401) {
        const logTag = isLiveTestMode() ? '[360dialog][live-test]' : '[360dialog]';
        logger.error(`${logTag} Authentication failed (HTTP 401)`, {
          httpStatus: 401,
          errorType: responseData.error?.type || 'unauthorized',
          errorCode: responseData.error?.code,
          errorMessage: errorMessage.substring(0, 100), // Safe preview
          hint: this.config.isDummy 
            ? 'Dummy API key detected - use WHATSAPP_LIVE_API_KEY for real tests'
            : 'Check if API key is valid and not expired',
          apiKeyPreview: this.config.apiKey.substring(0, 8) + '...',
        });
      }

      throw new WhatsAppError(
        `360dialog API error: ${errorMessage}`,
        WhatsAppErrorCodes.SEND_FAILED,
        {
          httpStatus: response.status,
          errorType: responseData.error?.type,
          errorCode: responseData.error?.code,
        }
      );
    }

    return responseData;
  }

  /**
   * Log provider errors with safe redaction
   */
  private logProviderError(
    operation: string,
    error: unknown,
    context: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Redact any potential API keys or tokens from error message
    const safeMessage = errorMessage
      .replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');

    logger.error('[360dialog] Provider error', {
      operation,
      error: safeMessage,
      errorType: error instanceof Error ? error.name : 'Unknown',
      ...context,
    });
  }

  /**
   * ================================
   * LIVE TEST ONLY - Single Message Test
   * ================================
   * 
   * Dedicated method for sending exactly ONE real test message.
   * This is ONLY used by scripts/live-test-send.ts for manual testing.
   * The worker MUST NOT use this method.
   * 
   * @param to - Recipient phone number (will be normalized)
   * @param text - Message text content
   * @returns WhatsApp API response
   */
  async sendTextMessageSingleTest(
    to: string,
    text: string
  ): Promise<WhatsAppSendResponse> {
    // Guard: Only allow in live test mode
    if (!isLiveTestMode()) {
      throw new WhatsAppError(
        'sendTextMessageSingleTest can only be used with WHATSAPP_LIVE_TEST=true',
        WhatsAppErrorCodes.INVALID_PAYLOAD,
        { liveTestMode: false }
      );
    }

    // Validate inputs
    if (!to || typeof to !== 'string') {
      throw new WhatsAppError(
        'Recipient phone number is required',
        WhatsAppErrorCodes.INVALID_NUMBER,
        { to }
      );
    }

    if (!text || typeof text !== 'string') {
      throw new WhatsAppError(
        'Message text is required',
        WhatsAppErrorCodes.INVALID_PAYLOAD,
        { textProvided: !!text }
      );
    }

    // Normalize phone number
    const normalizedTo = normalizePhoneNumber(to);
    if (!normalizedTo) {
      throw new WhatsAppError(
        'Invalid phone number format',
        WhatsAppErrorCodes.INVALID_NUMBER,
        { to: maskPhoneNumber(to) }
      );
    }

    // Validate API configuration
    if (!this.config.apiKey) {
      throw new WhatsAppError(
        'API key not configured - cannot send live test message',
        WhatsAppErrorCodes.SEND_FAILED,
        { apiKeyPresent: false }
      );
    }

    const waId = normalizedTo.replace(/^\+/, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: waId,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    };

    logger.info('[360dialog][live-test] Preparing outbound REAL message', {
      to: maskPhoneNumber(normalizedTo),
      textLength: text.length,
      textPreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    });

    try {
      const response = await this.makeApiRequest('/messages', payload);

      logger.info('[360dialog][live-test] Outbound real message SENT', {
        messageId: response.messages?.[0]?.id,
        to: maskPhoneNumber(normalizedTo),
        status: response.messages?.[0]?.message_status || 'unknown',
      });

      return response;
    } catch (error) {
      // Log error with safe redaction
      this.logProviderError('sendTextMessageSingleTest', error, {
        to: maskPhoneNumber(normalizedTo),
        isLiveTest: true,
      });

      // Re-throw as WhatsAppError if not already
      if (error instanceof WhatsAppError) {
        throw error;
      }

      throw new WhatsAppError(
        'Failed to send live test WhatsApp message',
        WhatsAppErrorCodes.SEND_FAILED,
        {
          originalError: error instanceof Error ? error.message : String(error),
          to: maskPhoneNumber(normalizedTo),
        }
      );
    }
  }
}

/**
 * Singleton instance
 */
export const whatsApp360dialogProvider = new WhatsApp360dialogProvider();
