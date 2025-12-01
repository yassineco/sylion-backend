/**
 * ================================
 * WhatsApp Types - Sylion Backend (Boss 1)
 * ================================
 * 
 * Types pour l'implémentation Boss 1: WhatsApp Gateway + Normalization + Core
 * Support du provider 360dialog avec normalisation vers format interne.
 */

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
  provider: WhatsAppProvider;
  providerMessageId: string;
  fromPhone: string;      // Numéro normalisé (+212xxxxxx)
  toPhone: string;        // Numéro normalisé (+212xxxxxx) 
  text: string;           // Contenu textuel (peut être vide si non-text)
  timestamp: Date;        // Date de création du message
}