/**
 * ================================
 * WhatsApp Types - Sylion Backend
 * ================================
 * 
 * Types pour l'intégration WhatsApp Gateway.
 * Normalisations des payloads webhook et messages.
 */

import { z } from 'zod';

/**
 * ================================
 * WhatsApp Raw Payload Types (360dialog-like)
 * ================================
 */

// Contact WhatsApp brut
const WhatsAppRawContactSchema = z.object({
  profile: z.object({
    name: z.string(),
  }).optional(),
  wa_id: z.string(),
});

// Message texte WhatsApp brut
const WhatsAppRawTextSchema = z.object({
  body: z.string(),
});

// Message WhatsApp brut
const WhatsAppRawMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  text: WhatsAppRawTextSchema.optional(),
  type: z.enum(['text', 'image', 'document', 'audio', 'video', 'location', 'contacts']),
  context: z.object({
    from: z.string(),
    id: z.string(),
  }).optional(),
});

// Payload webhook WhatsApp complet
export const WhatsAppRawPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.string(),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string(),
            }),
            contacts: z.array(WhatsAppRawContactSchema).optional(),
            messages: z.array(WhatsAppRawMessageSchema).optional(),
            statuses: z.array(z.any()).optional(), // Status updates (delivered, read, etc.)
          }),
          field: z.string(),
        })
      ),
    })
  ),
});

export type WhatsAppRawPayload = z.infer<typeof WhatsAppRawPayloadSchema>;
export type WhatsAppRawMessage = z.infer<typeof WhatsAppRawMessageSchema>;
export type WhatsAppRawContact = z.infer<typeof WhatsAppRawContactSchema>;

/**
 * ================================
 * Normalized Internal Types
 * ================================
 */

// Contact normalisé interne
export const NormalizedContactSchema = z.object({
  phoneNumber: z.string(),
  name: z.string().optional(),
  waId: z.string(),
});

export type NormalizedContact = z.infer<typeof NormalizedContactSchema>;

// Message normalisé interne
export const NormalizedIncomingMessageSchema = z.object({
  // Identifiants
  externalId: z.string(), // ID du message dans le provider
  timestamp: z.string(), // ISO 8601
  
  // Contenu
  type: z.enum(['text', 'media']), // Simplifié pour MVP
  text: z.string().optional(),
  
  // Expéditeur
  from: NormalizedContactSchema,
  
  // Canal
  channelPhoneNumber: z.string(), // Numéro de destination (notre numéro business)
  channelId: z.string().optional(), // Sera résolu par le worker
  
  // Contexte
  isReply: z.boolean().default(false),
  replyToMessageId: z.string().optional(),
  
  // Métadonnées
  metadata: z.record(z.any()).default({}),
});

export type NormalizedIncomingMessage = z.infer<typeof NormalizedIncomingMessageSchema>;

/**
 * ================================
 * WhatsApp API Response Types
 * ================================
 */

// Réponse d'envoi de message
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
 * Options d'envoi
 * ================================
 */

export const SendTextMessageOptionsSchema = z.object({
  tenantId: z.string().optional(),
  conversationId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  previewUrl: z.boolean().default(false),
  metadata: z.record(z.any()).default({}),
});

export type SendTextMessageOptions = z.infer<typeof SendTextMessageOptionsSchema>;

/**
 * ================================
 * Validation Helpers
 * ================================
 */

// Valider si un numéro de téléphone est valide WhatsApp
export const validateWhatsAppNumber = (phoneNumber: string): boolean => {
  // Format international: +[country_code][number]
  const regex = /^\+\d{10,15}$/;
  return regex.test(phoneNumber);
};

// Nettoyer et formater un numéro de téléphone
export const normalizePhoneNumber = (phoneNumber: string): string => {
  // Supprimer tous les caractères non numériques sauf le +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Ajouter + si manquant et que ça commence par un chiffre
  if (!cleaned.startsWith('+') && cleaned.length > 0) {
    return '+' + cleaned;
  }
  
  return cleaned;
};

// Masquer un numéro de téléphone pour les logs (sécurité)
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
    public readonly details?: Record<string, any>
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