/**
 * ================================
 * WhatsApp Types - Sylion Backend (Boss 1)
 * ================================
 * 
 * Types pour l'implémentation Boss 1: WhatsApp Gateway + Normalization + Core
 * Support du provider 360dialog avec normalisation vers format interne.
 * 
 * CE FICHIER EST LA SOURCE DE VÉRITÉ pour tous les types WhatsApp.
 */

import { z } from 'zod';

/**
 * Providers WhatsApp supportés
 */
export type WhatsAppProvider = '360dialog'; // Pour le MVP, uniquement 360dialog

/**
 * Payload brut du provider WhatsApp (générique)
 */
export interface RawWhatsAppPayload {
  provider: WhatsAppProvider;
  body: unknown; // Payload brut spécifique au provider
}

/**
 * Message entrant normalisé (format interne unifié)
 */
export interface NormalizedIncomingMessage {
  // === Champs Boss 1 (nouveaux, propres) ===
  provider: WhatsAppProvider;
  providerMessageId: string;
  fromPhone: string;      // Numéro normalisé (+212xxxxxx)
  toPhone: string;        // Numéro normalisé (+212xxxxxx) 
  text: string;           // Contenu textuel (peut être vide si non-text)
  timestamp: Date;        // Date de création du message

  // === Alias pour compatibilité worker legacy ===
  externalId: string;              // alias de providerMessageId
  from: { phoneNumber: string };   // alias structuré de fromPhone
  channelPhoneNumber: string;      // alias de toPhone

  // === Champs optionnels pour contexte reply ===
  isReply?: boolean;
  replyToMessageId?: string;
}

/**
 * ================================
 * Send Response Types
 * ================================
 */
export const WhatsAppSendResponseSchema = z.object({
  messaging_product: z.string(),
  contacts: z.array(
    z.object({
      input: z.string(),
      wa_id: z.string(),
    })
  ),
  messages: z.array(
    z.object({
      id: z.string(),
      message_status: z.enum(['accepted', 'failed']).optional(),
    })
  ),
});

export type WhatsAppSendResponse = z.infer<typeof WhatsAppSendResponseSchema>;

/**
 * ================================
 * Send Options
 * ================================
 */
export interface SendTextMessageOptions {
  tenantId?: string;
  conversationId?: string;
  replyToMessageId?: string;
  previewUrl?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * ================================
 * Validation Helpers
 * ================================
 */

/**
 * Valider si un numéro de téléphone est valide WhatsApp
 */
export const validateWhatsAppNumber = (phoneNumber: string): boolean => {
  // Format international: +[country_code][number]
  const regex = /^\+\d{10,15}$/;
  return regex.test(phoneNumber);
};

/**
 * Normalize phone number to standard format
 * 
 * Rules:
 * - Trims input and extracts digits only (removes all formatting: spaces, dashes, parentheses, letters)
 * - Removes all existing '+' signs to prevent double prefix bug
 * - Returns exactly one leading '+' followed by digits only
 * - Returns empty string if no digits found
 * 
 * @param phoneNumber - Raw phone number string (any format)
 * @returns Normalized phone number with single '+' prefix, or empty string if no digits
 */
export const normalizePhoneNumber = (phoneNumber: string): string => {
  // Trim input and extract digits only - remove ALL non-digit characters (including all + signs)
  const digitsOnly = phoneNumber.trim().replace(/\D/g, '');
  
  // If no digits found, return empty string
  if (digitsOnly.length === 0) {
    return '';
  }
  
  // Return exactly one leading '+' followed by all digits
  return '+' + digitsOnly;
};

/**
 * Masquer un numéro de téléphone pour les logs (sécurité)
 */
export const maskPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber || phoneNumber.length < 8) {
    return '***';
  }
  
  // Garder le code pays + 2 premiers et 2 derniers chiffres
  const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
  if (cleanNumber.length <= 6) {
    return phoneNumber.slice(0, 3) + '***';
  }
  
  return phoneNumber.slice(0, 5) + 'x'.repeat(cleanNumber.length - 7) + phoneNumber.slice(-2);
};

/**
 * ================================
 * Error Types
 * ================================
 */
export class WhatsAppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WhatsAppError';
  }
}

export const WhatsAppErrorCodes = {
  INVALID_PAYLOAD: 'WHATSAPP_INVALID_PAYLOAD',
  INVALID_NUMBER: 'WHATSAPP_INVALID_NUMBER',
  SEND_FAILED: 'WHATSAPP_SEND_FAILED',
  WEBHOOK_VERIFICATION_FAILED: 'WHATSAPP_WEBHOOK_VERIFICATION_FAILED',
  UNSUPPORTED_MESSAGE_TYPE: 'WHATSAPP_UNSUPPORTED_MESSAGE_TYPE',
  RATE_LIMIT_EXCEEDED: 'WHATSAPP_RATE_LIMIT_EXCEEDED',
} as const;

export type WhatsAppErrorCode = typeof WhatsAppErrorCodes[keyof typeof WhatsAppErrorCodes];