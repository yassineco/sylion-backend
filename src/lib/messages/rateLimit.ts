/**
 * ================================
 * Rate Limit Messages - i18n Ready
 * ================================
 * 
 * Messages utilisateur pour les scénarios de rate limiting.
 * Structure i18n-ready : clé logique → valeur par langue.
 * 
 * @module lib/messages/rateLimit
 */

/**
 * Clés logiques des messages rate limit
 */
export const RATE_LIMIT_MESSAGE_KEYS = {
  TOO_MANY_MESSAGES: 'rateLimit.tooManyMessages',
} as const;

export type RateLimitMessageKey = typeof RATE_LIMIT_MESSAGE_KEYS[keyof typeof RATE_LIMIT_MESSAGE_KEYS];

/**
 * Messages par langue
 * 
 * Locales supportées:
 * - fr: Français (défaut)
 * - ar: Arabe standard
 * - ar-ma: Darija (arabe marocain)
 */
export const RATE_LIMIT_MESSAGES: Record<string, Record<RateLimitMessageKey, string>> = {
  fr: {
    [RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES]: 
      '⚠️ Trop de messages en peu de temps. Merci de réessayer dans quelques instants.',
  },
  ar: {
    [RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES]: 
      '⚠️ تم إرسال رسائل كثيرة في وقت قصير. يُرجى المحاولة مرة أخرى بعد قليل.',
  },
  'ar-ma': {
    [RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES]: 
      '⚠️ بزاف ديال الرسائل في وقت قصير. عافاك عاود بعد شوية.',
  },
};

/**
 * Langue par défaut
 */
export const DEFAULT_LOCALE = 'fr';

/**
 * Récupérer un message rate limit par clé et locale
 * 
 * @param key - Clé logique du message
 * @param locale - Code langue (défaut: 'fr')
 * @returns Message formaté
 */
export function getRateLimitMessage(
  key: RateLimitMessageKey,
  locale: string = DEFAULT_LOCALE
): string {
  const messages = RATE_LIMIT_MESSAGES[locale] || RATE_LIMIT_MESSAGES[DEFAULT_LOCALE];
  return messages?.[key] || RATE_LIMIT_MESSAGES[DEFAULT_LOCALE]![key] || key;
}

/**
 * Message utilisateur par défaut pour rate limit dépassé
 * Utilisé dans le pipeline WhatsApp
 */
export const RATE_LIMITED_USER_MESSAGE = getRateLimitMessage(RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES);
