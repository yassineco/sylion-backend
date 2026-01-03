/**
 * ================================
 * Quota Messages - i18n Ready
 * ================================
 * 
 * Messages utilisateur pour les scénarios de quota.
 * Structure i18n-ready : clé logique → valeur par langue.
 * 
 * @module lib/messages/quota
 */

/**
 * Clés logiques des messages quota
 */
export const QUOTA_MESSAGE_KEYS = {
  EXCEEDED: 'quota.exceeded',
  EXCEEDED_DAILY: 'quota.exceeded.daily',
} as const;

export type QuotaMessageKey = typeof QUOTA_MESSAGE_KEYS[keyof typeof QUOTA_MESSAGE_KEYS];

/**
 * Messages par langue
 * 
 * Locales supportées:
 * - fr: Français (défaut)
 * - ar: Arabe standard
 * - ar-ma: Darija (arabe marocain)
 */
export const QUOTA_MESSAGES: Record<string, Record<QuotaMessageKey, string>> = {
  fr: {
    [QUOTA_MESSAGE_KEYS.EXCEEDED]: 
      "⚠️ L'assistant a atteint sa limite d'utilisation pour le moment.\n" +
      'Merci de contacter l\'administrateur pour continuer à utiliser le service.',
    [QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY]:
      "⚠️ L'assistant a atteint sa limite d'utilisation pour le moment.\n" +
      'Merci de contacter l\'administrateur pour continuer à utiliser le service.',
  },
  ar: {
    [QUOTA_MESSAGE_KEYS.EXCEEDED]: 
      '⚠️ لقد بلغ المساعد الحدّ الأقصى للاستخدام في الوقت الحالي.\n' +
      'يُرجى التواصل مع المسؤول لمواصلة استخدام الخدمة.',
    [QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY]:
      '⚠️ لقد بلغ المساعد الحدّ الأقصى للاستخدام في الوقت الحالي.\n' +
      'يُرجى التواصل مع المسؤول لمواصلة استخدام الخدمة.',
  },
  'ar-ma': {
    [QUOTA_MESSAGE_KEYS.EXCEEDED]: 
      '⚠️ المساعد وصل دابا للحدّ ديال الاستعمال.\n' +
      'عافاك تواصل مع المسؤول باش تكمل استعمال الخدمة.',
    [QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY]:
      '⚠️ المساعد وصل دابا للحدّ ديال الاستعمال.\n' +
      'عافاك تواصل مع المسؤول باش تكمل استعمال الخدمة.',
  },
};

/**
 * Langue par défaut
 */
export const DEFAULT_LOCALE = 'fr';

/**
 * Récupérer un message quota par clé et locale
 * 
 * @param key - Clé logique du message
 * @param locale - Code langue (défaut: 'fr')
 * @returns Message formaté
 */
export function getQuotaMessage(key: QuotaMessageKey, locale: string = DEFAULT_LOCALE): string {
  const messages = QUOTA_MESSAGES[locale] || QUOTA_MESSAGES[DEFAULT_LOCALE];
  return messages?.[key] || QUOTA_MESSAGES[DEFAULT_LOCALE]![key] || key;
}

/**
 * Message utilisateur par défaut pour quota dépassé
 * Utilisé dans le pipeline WhatsApp
 */
export const QUOTA_EXCEEDED_USER_MESSAGE = getQuotaMessage(QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY);
