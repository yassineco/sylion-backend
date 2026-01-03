/**
 * ================================
 * Rate Limiting & Idempotence - Sylion Backend
 * ================================
 * 
 * Protection anti-abus pour le pipeline WhatsApp v1:
 * - Idempotence: Détection des messages dupliqués (même provider message_id)
 * - Rate Limiting: Limitation du nombre de messages par fenêtre temporelle
 * 
 * Utilise Redis avec fallback graceful en cas d'indisponibilité.
 * 
 * @module lib/rateLimit
 */

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

/**
 * Configuration du rate limiting
 */
export const RATE_LIMIT_CONFIG = {
  /**
   * Rate limit par conversation
   * max 5 messages / 30 secondes
   */
  conversation: {
    maxRequests: 5,
    windowSeconds: 30,
  },
  /**
   * Rate limit par sender (fallback si conversation non disponible)
   * max 20 messages / 5 minutes
   */
  sender: {
    maxRequests: 20,
    windowSeconds: 300, // 5 minutes
  },
  /**
   * TTL pour les clés d'idempotence (éviter les doublons)
   * 24 heures - suffisant pour couvrir les retry WhatsApp
   */
  idempotenceTTLSeconds: 86400,
} as const;

/**
 * Préfixes des clés Redis
 */
const REDIS_KEY_PREFIX = {
  idempotence: 'idempotence:msg:',
  rateLimitConversation: 'ratelimit:conv:',
  rateLimitSender: 'ratelimit:sender:',
  rateLimitNotified: 'ratelimit:notified:',
} as const;

/**
 * Résultat du check d'idempotence
 */
export interface IdempotenceCheckResult {
  isDuplicate: boolean;
  reason?: string;
}

/**
 * Résultat du check de rate limit
 */
export interface RateLimitCheckResult {
  isLimited: boolean;
  currentCount: number;
  limit: number;
  windowSeconds: number;
  reason?: string;
  /**
   * Indique si l'utilisateur a déjà été notifié dans cette fenêtre
   * (pour éviter de spammer le même message rate limit)
   */
  alreadyNotified: boolean;
}

/**
 * ================================
 * Idempotence Check
 * ================================
 * 
 * Vérifie si un message a déjà été traité en utilisant son provider message_id.
 * Utilise Redis SETNX pour une vérification atomique.
 */
export async function checkIdempotence(
  providerMessageId: string,
  tenantId: string
): Promise<IdempotenceCheckResult> {
  if (!providerMessageId) {
    logger.warn('[RateLimit] No provider message ID provided for idempotence check', {
      tenantId,
      event: 'idempotence_no_id',
    });
    return { isDuplicate: false };
  }

  const key = `${REDIS_KEY_PREFIX.idempotence}${tenantId}:${providerMessageId}`;

  try {
    // SETNX + EXPIRE atomique : retourne 'OK' si la clé n'existait pas
    const result = await redis.set(key, '1', 'EX', RATE_LIMIT_CONFIG.idempotenceTTLSeconds, 'NX');

    if (result === 'OK') {
      // Première fois qu'on voit ce message
      return { isDuplicate: false };
    } else {
      // Message déjà vu
      logger.info('[RateLimit] Duplicate message detected', {
        providerMessageId,
        tenantId,
        event: 'duplicate_message_dropped',
      });
      return {
        isDuplicate: true,
        reason: 'duplicate_message',
      };
    }
  } catch (error) {
    // Fail-open: en cas d'erreur Redis, on laisse passer (pas de blocage)
    logger.error('[RateLimit] Idempotence check failed, failing open', {
      providerMessageId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
      event: 'idempotence_check_error',
    });
    return { isDuplicate: false };
  }
}

/**
 * ================================
 * Rate Limit Check
 * ================================
 * 
 * Vérifie le rate limit pour une conversation ou un sender.
 * Utilise Redis INCR + EXPIRE pour un compteur par fenêtre temporelle.
 * 
 * @param conversationId - ID de la conversation (prioritaire)
 * @param senderId - ID du sender (fallback)
 * @param tenantId - ID du tenant
 */
export async function checkRateLimit(
  conversationId: string | undefined,
  senderId: string,
  tenantId: string
): Promise<RateLimitCheckResult> {
  // Déterminer le scope et la configuration
  const useConversationScope = !!conversationId;
  const config = useConversationScope 
    ? RATE_LIMIT_CONFIG.conversation 
    : RATE_LIMIT_CONFIG.sender;
  
  const identifier = useConversationScope ? conversationId : senderId;
  const keyPrefix = useConversationScope 
    ? REDIS_KEY_PREFIX.rateLimitConversation 
    : REDIS_KEY_PREFIX.rateLimitSender;
  
  const key = `${keyPrefix}${tenantId}:${identifier}`;
  const notifiedKey = `${REDIS_KEY_PREFIX.rateLimitNotified}${tenantId}:${identifier}`;

  try {
    // Incrémenter le compteur
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    
    const results = await pipeline.exec();
    
    const currentCount = results?.[0]?.[1] as number ?? 1;
    const ttl = results?.[1]?.[1] as number ?? -1;

    // Si c'est le premier message dans la fenêtre, définir l'expiration
    if (currentCount === 1 || ttl === -1) {
      await redis.expire(key, config.windowSeconds);
    }

    const isLimited = currentCount > config.maxRequests;

    if (isLimited) {
      // Vérifier si on a déjà notifié l'utilisateur dans cette fenêtre
      const alreadyNotified = await redis.get(notifiedKey) === '1';

      logger.warn('[RateLimit] Rate limit exceeded', {
        tenantId,
        conversationId,
        senderId,
        scope: useConversationScope ? 'conversation' : 'sender',
        currentCount,
        limit: config.maxRequests,
        windowSeconds: config.windowSeconds,
        alreadyNotified,
        event: 'rate_limited',
      });

      // Marquer comme notifié si on va envoyer un message
      if (!alreadyNotified) {
        await redis.set(notifiedKey, '1', 'EX', config.windowSeconds);
      }

      return {
        isLimited: true,
        currentCount,
        limit: config.maxRequests,
        windowSeconds: config.windowSeconds,
        reason: `Rate limit exceeded: ${currentCount}/${config.maxRequests} in ${config.windowSeconds}s`,
        alreadyNotified,
      };
    }

    return {
      isLimited: false,
      currentCount,
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
      alreadyNotified: false,
    };
  } catch (error) {
    // Fail-open: en cas d'erreur Redis, on laisse passer
    logger.error('[RateLimit] Rate limit check failed, failing open', {
      tenantId,
      conversationId,
      senderId,
      error: error instanceof Error ? error.message : String(error),
      event: 'rate_limit_check_error',
    });
    return {
      isLimited: false,
      currentCount: 0,
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
      alreadyNotified: false,
    };
  }
}

/**
 * ================================
 * Reset Rate Limit (pour les tests)
 * ================================
 */
export async function resetRateLimit(
  conversationId: string | undefined,
  senderId: string,
  tenantId: string
): Promise<void> {
  const identifier = conversationId || senderId;
  const keyConv = `${REDIS_KEY_PREFIX.rateLimitConversation}${tenantId}:${conversationId}`;
  const keySender = `${REDIS_KEY_PREFIX.rateLimitSender}${tenantId}:${senderId}`;
  const notifiedConv = `${REDIS_KEY_PREFIX.rateLimitNotified}${tenantId}:${conversationId}`;
  const notifiedSender = `${REDIS_KEY_PREFIX.rateLimitNotified}${tenantId}:${senderId}`;

  try {
    await redis.del(keyConv, keySender, notifiedConv, notifiedSender);
  } catch (error) {
    logger.error('[RateLimit] Reset failed', {
      tenantId,
      conversationId,
      senderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * ================================
 * Reset Idempotence (pour les tests)
 * ================================
 */
export async function resetIdempotence(
  providerMessageId: string,
  tenantId: string
): Promise<void> {
  const key = `${REDIS_KEY_PREFIX.idempotence}${tenantId}:${providerMessageId}`;

  try {
    await redis.del(key);
  } catch (error) {
    logger.error('[RateLimit] Idempotence reset failed', {
      tenantId,
      providerMessageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
