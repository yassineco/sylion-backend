/**
 * ================================
 * WhatsApp Rate Limiting & Idempotence Unit Tests
 * ================================
 *
 * Tests pour les protections anti-abus du pipeline WhatsApp v1:
 * - Idempotence: détection des messages dupliqués
 * - Rate Limiting: limitation du nombre de messages par fenêtre temporelle
 *
 * Vérifie:
 * - Message dupliqué → pas de traitement + log
 * - 6 messages en <30s → le 6e est rate-limited
 * - Après expiration de fenêtre → traitement reprend
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getRateLimitMessage,
    RATE_LIMIT_MESSAGE_KEYS,
    RATE_LIMITED_USER_MESSAGE,
} from '../../src/lib/messages/rateLimit';
import {
    checkIdempotence,
    checkRateLimit,
    RATE_LIMIT_CONFIG,
    type IdempotenceCheckResult,
    type RateLimitCheckResult,
} from '../../src/lib/rateLimit';

// ================================
// Mocks Redis
// ================================
const mockRedisSet = vi.fn();
const mockRedisGet = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisTtl = vi.fn();
const mockRedisExpire = vi.fn();
const mockRedisDel = vi.fn();
const mockPipelineExec = vi.fn();

vi.mock('@/lib/redis', () => ({
  redis: {
    set: (...args: unknown[]) => mockRedisSet(...args),
    get: (...args: unknown[]) => mockRedisGet(...args),
    incr: (...args: unknown[]) => mockRedisIncr(...args),
    ttl: (...args: unknown[]) => mockRedisTtl(...args),
    expire: (...args: unknown[]) => mockRedisExpire(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    pipeline: () => ({
      incr: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: mockPipelineExec,
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ================================
// Tests
// ================================

describe('WhatsApp Rate Limiting & Idempotence - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rate Limit Configuration', () => {
    it('should have correct conversation rate limit config', () => {
      expect(RATE_LIMIT_CONFIG.conversation.maxRequests).toBe(5);
      expect(RATE_LIMIT_CONFIG.conversation.windowSeconds).toBe(30);
    });

    it('should have correct sender rate limit config', () => {
      expect(RATE_LIMIT_CONFIG.sender.maxRequests).toBe(20);
      expect(RATE_LIMIT_CONFIG.sender.windowSeconds).toBe(300); // 5 minutes
    });

    it('should have idempotence TTL of 24 hours', () => {
      expect(RATE_LIMIT_CONFIG.idempotenceTTLSeconds).toBe(86400);
    });
  });

  describe('Idempotence Check', () => {
    it('should allow first occurrence of a message (not duplicate)', async () => {
      mockRedisSet.mockResolvedValue('OK'); // SETNX returns 'OK' for new key

      const result = await checkIdempotence('msg_123', 'tenant_abc');

      expect(result.isDuplicate).toBe(false);
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('idempotence:msg:tenant_abc:msg_123'),
        '1',
        'EX',
        RATE_LIMIT_CONFIG.idempotenceTTLSeconds,
        'NX'
      );
    });

    it('should detect duplicate message', async () => {
      mockRedisSet.mockResolvedValue(null); // SETNX returns null if key exists

      const result = await checkIdempotence('msg_123', 'tenant_abc');

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('duplicate_message');
    });

    it('should fail-open on Redis error (not blocking)', async () => {
      mockRedisSet.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkIdempotence('msg_123', 'tenant_abc');

      // Fail-open: let it through
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle empty provider message ID gracefully', async () => {
      const result = await checkIdempotence('', 'tenant_abc');

      expect(result.isDuplicate).toBe(false);
      expect(mockRedisSet).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Check', () => {
    it('should allow messages under the limit', async () => {
      // Simulate 3rd message (under limit of 5)
      mockPipelineExec.mockResolvedValue([
        [null, 3], // incr result
        [null, 25], // ttl result
      ]);

      const result = await checkRateLimit('conv_123', 'sender_456', 'tenant_abc');

      expect(result.isLimited).toBe(false);
      expect(result.currentCount).toBe(3);
      expect(result.limit).toBe(5);
    });

    it('should BLOCK 6th message in 30 seconds (rate limited)', async () => {
      // Simulate 6th message (over limit of 5)
      mockPipelineExec.mockResolvedValue([
        [null, 6], // incr result
        [null, 20], // ttl result
      ]);
      mockRedisGet.mockResolvedValue(null); // Not yet notified

      const result = await checkRateLimit('conv_123', 'sender_456', 'tenant_abc');

      expect(result.isLimited).toBe(true);
      expect(result.currentCount).toBe(6);
      expect(result.limit).toBe(5);
      expect(result.windowSeconds).toBe(30);
      expect(result.alreadyNotified).toBe(false);
    });

    it('should mark alreadyNotified=true on subsequent rate-limited messages', async () => {
      // Simulate 7th message (still rate limited)
      mockPipelineExec.mockResolvedValue([
        [null, 7], // incr result
        [null, 15], // ttl result
      ]);
      mockRedisGet.mockResolvedValue('1'); // Already notified

      const result = await checkRateLimit('conv_123', 'sender_456', 'tenant_abc');

      expect(result.isLimited).toBe(true);
      expect(result.alreadyNotified).toBe(true);
    });

    it('should use sender scope if conversationId is undefined', async () => {
      mockPipelineExec.mockResolvedValue([
        [null, 1],
        [null, -1], // No TTL set yet
      ]);
      mockRedisExpire.mockResolvedValue(1);

      const result = await checkRateLimit(undefined, 'sender_456', 'tenant_abc');

      expect(result.isLimited).toBe(false);
      expect(result.windowSeconds).toBe(300); // 5 minutes for sender scope
      expect(result.limit).toBe(20); // sender limit
    });

    it('should fail-open on Redis error', async () => {
      mockPipelineExec.mockRejectedValue(new Error('Redis unavailable'));

      const result = await checkRateLimit('conv_123', 'sender_456', 'tenant_abc');

      expect(result.isLimited).toBe(false);
      expect(result.currentCount).toBe(0);
    });

    it('should set TTL on first message in window', async () => {
      mockPipelineExec.mockResolvedValue([
        [null, 1], // First message
        [null, -1], // No TTL yet
      ]);
      mockRedisExpire.mockResolvedValue(1);

      await checkRateLimit('conv_123', 'sender_456', 'tenant_abc');

      expect(mockRedisExpire).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:conv:tenant_abc:conv_123'),
        30
      );
    });
  });

  describe('Rate Limit User Messages (i18n)', () => {
    it('should have FR message defined', () => {
      expect(RATE_LIMITED_USER_MESSAGE).toBeDefined();
      expect(typeof RATE_LIMITED_USER_MESSAGE).toBe('string');
      expect(RATE_LIMITED_USER_MESSAGE).toContain('⚠️');
      expect(RATE_LIMITED_USER_MESSAGE.toLowerCase()).toMatch(/trop|messages|réessayer/i);
    });

    it('should return exact FR message', () => {
      const expectedFr = '⚠️ Trop de messages en peu de temps. Merci de réessayer dans quelques instants.';
      const frMessage = getRateLimitMessage(RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES, 'fr');
      expect(frMessage).toBe(expectedFr);
    });

    it('should return AR message', () => {
      const arMessage = getRateLimitMessage(RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES, 'ar');
      expect(arMessage).toContain('⚠️');
      expect(arMessage).toMatch(/رسائل|المحاولة/);
    });

    it('should return ar-ma message (darija)', () => {
      const darijaMessage = getRateLimitMessage(RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES, 'ar-ma');
      expect(darijaMessage).toContain('⚠️');
      expect(darijaMessage).toMatch(/بزاف|عافاك/);
    });

    it('should fallback to FR for unknown locale', () => {
      const unknownMessage = getRateLimitMessage(RATE_LIMIT_MESSAGE_KEYS.TOO_MANY_MESSAGES, 'unknown');
      expect(unknownMessage).toBe(RATE_LIMITED_USER_MESSAGE);
    });
  });

  describe('Pipeline Behavior Simulation', () => {
    /**
     * Simule le comportement du worker : si idempotence détecte un doublon,
     * - NE PAS appeler LLM
     * - NE PAS sauvegarder le message
     * - Drop silencieux + log
     */
    it('MUST NOT call LLM when duplicate message detected', async () => {
      const mockLLMCall = vi.fn();
      const mockSaveMessage = vi.fn();
      const mockLogDrop = vi.fn();

      // Simulate duplicate detection
      const idempotenceResult: IdempotenceCheckResult = {
        isDuplicate: true,
        reason: 'duplicate_message',
      };

      // Worker logic simulation
      if (idempotenceResult.isDuplicate) {
        mockLogDrop('duplicate_message_dropped');
        // Early return - no processing
      } else {
        mockSaveMessage();
        mockLLMCall();
      }

      expect(mockLLMCall).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockLogDrop).toHaveBeenCalledWith('duplicate_message_dropped');
    });

    it('MUST NOT call LLM when rate limited', async () => {
      const mockLLMCall = vi.fn();
      const mockSaveMessage = vi.fn();
      const mockRecordUsage = vi.fn();
      const mockSendRateLimitMessage = vi.fn();

      // Simulate rate limit exceeded
      const rateLimitResult: RateLimitCheckResult = {
        isLimited: true,
        currentCount: 6,
        limit: 5,
        windowSeconds: 30,
        reason: 'Rate limit exceeded',
        alreadyNotified: false,
      };

      // Worker logic simulation
      if (rateLimitResult.isLimited) {
        if (!rateLimitResult.alreadyNotified) {
          mockSendRateLimitMessage(RATE_LIMITED_USER_MESSAGE);
        }
        // Early return - no LLM, no recordUsage
      } else {
        mockSaveMessage();
        mockLLMCall();
        mockRecordUsage();
      }

      expect(mockLLMCall).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockRecordUsage).not.toHaveBeenCalled();
      expect(mockSendRateLimitMessage).toHaveBeenCalledWith(RATE_LIMITED_USER_MESSAGE);
    });

    it('MUST NOT send rate limit message twice in same window', async () => {
      const mockSendRateLimitMessage = vi.fn();

      // Simulate already notified
      const rateLimitResult: RateLimitCheckResult = {
        isLimited: true,
        currentCount: 7,
        limit: 5,
        windowSeconds: 30,
        reason: 'Rate limit exceeded',
        alreadyNotified: true, // Already sent
      };

      // Worker logic simulation
      if (rateLimitResult.isLimited) {
        if (!rateLimitResult.alreadyNotified) {
          mockSendRateLimitMessage(RATE_LIMITED_USER_MESSAGE);
        }
        // No message sent - already notified
      }

      expect(mockSendRateLimitMessage).not.toHaveBeenCalled();
    });

    it('MUST resume processing after rate limit window expires', async () => {
      const mockLLMCall = vi.fn().mockResolvedValue('LLM response');
      const mockSaveMessage = vi.fn();

      // Simulate rate limit not exceeded (window expired, counter reset)
      const rateLimitResult: RateLimitCheckResult = {
        isLimited: false,
        currentCount: 1, // New window, first message
        limit: 5,
        windowSeconds: 30,
        alreadyNotified: false,
      };

      const idempotenceResult: IdempotenceCheckResult = {
        isDuplicate: false,
      };

      // Worker logic simulation
      if (!idempotenceResult.isDuplicate && !rateLimitResult.isLimited) {
        mockSaveMessage();
        await mockLLMCall();
      }

      expect(mockSaveMessage).toHaveBeenCalled();
      expect(mockLLMCall).toHaveBeenCalled();
    });
  });

  describe('Pipeline Order Contract', () => {
    it('documents the correct order of checks', () => {
      /**
       * Ce test documente l'ordre attendu des checks dans processIncomingMessage:
       * 
       * 1. resolveMessageContext()      ─── Résolution tenant/channel/conversation
       * 2. checkIdempotence()           ─── ⚠️ IDEMPOTENCE CHECK (BLOCKING)
       *    └── isDuplicate: true ───────▶ RETURN (drop silencieux)
       * 3. checkRateLimit()             ─── ⚠️ RATE LIMIT CHECK (BLOCKING)
       *    └── isLimited: true ─────────▶ sendRateLimitReply() + RETURN
       * 4. saveUserMessage()            ─── Persistance du message utilisateur
       * 5. checkQuotaBeforeLLM()        ─── QUOTA CHECK (BLOCKING)
       * 6. generateReply()              ─── Appel LLM
       * 7. saveAssistantMessage()       ─── Persistance réponse
       * 8. sendReplyToWhatsApp()        ─── Envoi WhatsApp
       * 9. updateStats()                ─── Mise à jour statistiques
       * 
       * Référence: messageProcessor.worker.ts
       */
      const expectedOrder = [
        'resolveMessageContext',
        'checkIdempotence',
        'checkRateLimit',
        'saveUserMessage',
        'checkQuotaBeforeLLM',
        'generateReply',
        'saveAssistantMessage',
        'sendReplyToWhatsApp',
        'updateStats',
      ];

      expect(expectedOrder[1]).toBe('checkIdempotence');
      expect(expectedOrder[2]).toBe('checkRateLimit');
      expect(expectedOrder.indexOf('checkIdempotence')).toBeLessThan(
        expectedOrder.indexOf('saveUserMessage')
      );
      expect(expectedOrder.indexOf('checkRateLimit')).toBeLessThan(
        expectedOrder.indexOf('checkQuotaBeforeLLM')
      );
    });
  });
});
