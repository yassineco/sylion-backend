/**
 * ================================
 * Redis Configuration - Sylion Backend
 * ================================
 * 
 * Configuration centralisée de Redis pour le cache et BullMQ.
 * Gestion des connexions, reconnexions et monitoring.
 */


import { config } from '@/config/env';
import Redis, { RedisOptions } from 'ioredis';
import { logger } from './logger';

/**
 * Configuration Redis pour l'application principale
 */
const url = new URL(config.redis.url);

const redisConfig: RedisOptions = {
  // URL de connexion
  host: url.hostname,
  port: parseInt(url.port || '6379', 10),
  password: url.password || undefined,
  db: parseInt(url.pathname.substring(1) || '0', 10),

  // ✅ Réglages recommandés par BullMQ / ioredis
  // - maxRetriesPerRequest doit être null
  // - commandTimeout à 0 pour éviter les "Command timed out"
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  //commandTimeout: 0,

  // Timeouts & réseau
  connectTimeout: 10000,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,

  // Debug
  showFriendlyErrorStack: !config.isProd,
};


/**
 * Instance Redis principale pour le cache
 */
export const redis = new Redis(redisConfig);

/**
 * Instance Redis dédiée pour BullMQ (Publisher)
 */
export const redisPublisher = new Redis({
  ...redisConfig,
  db: (redisConfig.db || 0) + 1, // DB séparée pour BullMQ
});

/**
 * Instance Redis dédiée pour BullMQ (Subscriber)
 */
export const redisSubscriber = new Redis({
  ...redisConfig,
  db: (redisConfig.db || 0) + 1, // Même DB que Publisher
});

/**
 * Configuration des événements Redis
 */
function setupRedisEvents(instance: Redis, name: string): void {
  instance.on('connect', () => {
    logger.info(`Redis ${name} connecting...`);
  });

  instance.on('ready', () => {
    logger.info(`Redis ${name} ready`);
  });

  instance.on('error', (error: Error) => {
    logger.error(`Redis ${name} error`, {
      error: error.message,
      redisInstance: name,
    });
  });

  instance.on('close', () => {
    logger.warn(`Redis ${name} connection closed`);
  });

  instance.on('reconnecting', (delay: number) => {
    logger.info(`Redis ${name} reconnecting in ${delay}ms`);
  });

  instance.on('end', () => {
    logger.warn(`Redis ${name} connection ended`);
  });
}

// Configuration des événements pour toutes les instances
setupRedisEvents(redis, 'Cache');
setupRedisEvents(redisPublisher, 'Publisher');
setupRedisEvents(redisSubscriber, 'Subscriber');

/**
 * Interface pour les clés de cache standardisées
 */
export interface CacheKey {
  tenant: (tenantId: string) => string;
  tenantBySlug: (slug: string) => string;
  tenantList: string;
  tenantUsage: (tenantId: string) => string;
  channel: (channelId: string) => string;
  channelsByTenant: (tenantId: string) => string;
  activeChannelsByTenant: (tenantId: string) => string;
  assistant: (assistantId: string) => string;
  assistantsByTenant: (tenantId: string) => string;
  activeAssistantsByTenant: (tenantId: string) => string;
  defaultAssistant: (tenantId: string) => string;
  conversation: (conversationId: string) => string;
  conversationsByTenant: (tenantId: string) => string;
  conversationsByChannel: (channelId: string) => string;
  message: (messageId: string) => string;
  messagesByConversation: (conversationId: string) => string;
  user: (userId: string) => string;
  session: (sessionId: string) => string;
  quota: (tenantId: string, period: string) => string;
  rateLimit: (identifier: string) => string;
}

/**
 * Générateurs de clés de cache standardisées
 */
export const cacheKeys: CacheKey = {
  tenant: (tenantId: string) => `tenant:${tenantId}`,
  tenantBySlug: (slug: string) => `tenant:slug:${slug}`,
  tenantList: 'tenants:list',
  tenantUsage: (tenantId: string) => `tenant:${tenantId}:usage`,
  channel: (channelId: string) => `channel:${channelId}`,
  channelsByTenant: (tenantId: string) => `channels:tenant:${tenantId}`,
  activeChannelsByTenant: (tenantId: string) => `channels:active:tenant:${tenantId}`,
  assistant: (assistantId: string) => `assistant:${assistantId}`,
  assistantsByTenant: (tenantId: string) => `assistants:tenant:${tenantId}`,
  activeAssistantsByTenant: (tenantId: string) => `assistants:active:tenant:${tenantId}`,
  defaultAssistant: (tenantId: string) => `assistant:default:tenant:${tenantId}`,
  conversation: (conversationId: string) => `conversation:${conversationId}`,
  conversationsByTenant: (tenantId: string) => `conversations:tenant:${tenantId}`,
  conversationsByChannel: (channelId: string) => `conversations:channel:${channelId}`,
  message: (messageId: string) => `message:${messageId}`,
  messagesByConversation: (conversationId: string) => `messages:conversation:${conversationId}`,
  user: (userId: string) => `user:${userId}`,
  session: (sessionId: string) => `session:${sessionId}`,
  quota: (tenantId: string, period: string) => `quota:${tenantId}:${period}`,
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
};

/**
 * TTL par défaut pour les différents types de cache (en secondes)
 */
export const cacheTTL = {
  tenant: 3600, // 1 heure
  channel: 1800, // 30 minutes
  assistant: 1800, // 30 minutes
  conversation: 3600, // 1 heure
  message: 300, // 5 minutes
  user: 1800, // 30 minutes
  session: 86400, // 24 heures
  quota: 300, // 5 minutes
  rateLimit: 300, // 5 minutes
  // TTL pour les listes et collections
  channelList: 600, // 10 minutes
  assistantList: 600, // 10 minutes
  conversationList: 300, // 5 minutes
  messageList: 300, // 5 minutes
  stats: 300, // 5 minutes
} as const;

/**
 * Helper pour définir une valeur en cache avec TTL automatique
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  try {
    const serializedValue = JSON.stringify(value);
    
    if (ttl) {
      await redis.setex(key, ttl, serializedValue);
    } else {
      await redis.set(key, serializedValue);
    }
    
    logger.debug('Cache set', { key, ttl });
  } catch (error) {
    logger.error('Cache set failed', error, { key });
    throw error;
  }
}

/**
 * Helper pour récupérer une valeur du cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    
    if (value === null) {
      logger.debug('Cache miss', { key });
      return null;
    }
    
    logger.debug('Cache hit', { key });
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error('Cache get failed', error, { key });
    return null;
  }
}

/**
 * Helper pour supprimer une valeur du cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(key);
    logger.debug('Cache delete', { key });
  } catch (error) {
    logger.error('Cache delete failed', error, { key });
    throw error;
  }
}

/**
 * Helper pour supprimer plusieurs clés par pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    const deleted = await redis.del(...keys);
    logger.debug('Cache pattern delete', { pattern, deleted });
    return deleted;
  } catch (error) {
    logger.error('Cache pattern delete failed', error, { pattern });
    throw error;
  }
}

/**
 * Helper pour vérifier l'existence d'une clé
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error('Cache exists check failed', error, { key });
    return false;
  }
}

/**
 * Helper pour incrémenter une valeur (utile pour les quotas)
 */
export async function incrementCache(
  key: string,
  increment: number = 1,
  ttl?: number
): Promise<number> {
  try {
    const pipeline = redis.pipeline();
    pipeline.incrby(key, increment);
    
    if (ttl) {
      pipeline.expire(key, ttl);
    }
    
    const results = await pipeline.exec();
    const newValue = results?.[0]?.[1] as number;
    
    logger.debug('Cache increment', { key, increment, newValue, ttl });
    return newValue;
  } catch (error) {
    logger.error('Cache increment failed', error, { key });
    throw error;
  }
}

/**
 * Helper pour définir un TTL sur une clé existante
 */
export async function expireCache(key: string, ttl: number): Promise<boolean> {
  try {
    const result = await redis.expire(key, ttl);
    logger.debug('Cache expire', { key, ttl });
    return result === 1;
  } catch (error) {
    logger.error('Cache expire failed', error, { key });
    return false;
  }
}

/**
 * Fonction de test de connexion Redis
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    logger.info('Redis connection test successful', { pong });
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis connection test failed', error);
    return false;
  }
}

/**
 * Fonction de nettoyage gracieux des connexions
 */
export async function closeRedisConnections(): Promise<void> {
  try {
    await Promise.all([
      redis.quit(),
      redisPublisher.quit(),
      redisSubscriber.quit(),
    ]);
    
    logger.info('Redis connections closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connections', error);
  }
}

/**
 * Configuration pour les patterns de retry
 */
export const retryConfig = {
  maxRetries: 3,
  backoffBase: 1000,
  backoffFactor: 2,
  maxBackoff: 10000,
};

/**
 * Helper pour retry avec backoff exponentiel
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config = retryConfig
): Promise<T> {
  let lastError = new Error('Operation failed');
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === config.maxRetries) {
        break;
      }
      
      const delay = Math.min(
        config.backoffBase * Math.pow(config.backoffFactor, attempt - 1),
        config.maxBackoff
      );
      
      logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
        attempt,
        maxRetries: config.maxRetries,
        error: lastError.message,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error(`${operationName} failed after ${config.maxRetries} attempts`, {
    error: lastError.message,
  });
  throw lastError;
}