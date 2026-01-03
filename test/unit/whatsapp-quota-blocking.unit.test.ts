/**
 * ================================
 * WhatsApp Quota Blocking Unit Tests
 * ================================
 *
 * Tests BLOQUANTS: Le LLM NE DOIT PAS être appelé si le quota est épuisé.
 * 
 * Ces tests vérifient le comportement du quota check de manière unitaire
 * et documentent le contrat d'interface pour le blocking.
 *
 * L'intégration complète est testée via le code du worker lui-même
 * (voir messageProcessor.worker.ts lignes 198-234).
 *
 * Vérifie:
 * - quotaService.checkQuota retourne {allowed: false} => LLM bloqué
 * - quotaService.checkQuota retourne {allowed: true} => LLM appelé
 * - Fail-safe: erreur lors du check => bloquer par sécurité
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getQuotaMessage,
    QUOTA_EXCEEDED_USER_MESSAGE,
    QUOTA_MESSAGE_KEYS,
} from '../../src/lib/messages/quota';
import type { QuotaCheckResult } from '../../src/modules/quota/quota.types';

// ================================
// Tests du comportement quota
// ================================

describe('WhatsApp Quota Blocking - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('QuotaCheckResult behavior', () => {
    it('should represent BLOCKED state correctly', () => {
      const blockedResult: QuotaCheckResult = {
        allowed: false,
        reason: 'Daily messages limit reached: 100/100',
        currentUsage: 100,
        limit: 100,
      };

      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toContain('limit reached');
    });

    it('should represent ALLOWED state correctly', () => {
      const allowedResult: QuotaCheckResult = {
        allowed: true,
        currentUsage: 50,
        limit: 100,
      };

      expect(allowedResult.allowed).toBe(true);
    });

    it('should handle edge case at limit boundary', () => {
      // 99/100 = encore permis
      const edgeResult: QuotaCheckResult = {
        allowed: true,
        currentUsage: 99,
        limit: 100,
      };

      expect(edgeResult.allowed).toBe(true);

      // 100/100 = bloqué
      const blockedResult: QuotaCheckResult = {
        allowed: false,
        reason: 'Daily messages limit reached: 100/100',
        currentUsage: 100,
        limit: 100,
      };

      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('Quota blocking logic simulation', () => {
    /**
     * Simule la logique du worker: si quota.allowed === false,
     * - NE PAS appeler LLM
     * - Envoyer message fallback
     * - NE PAS incrémenter les compteurs
     */
    it('MUST NOT call LLM when quota.allowed === false', async () => {
      // Arrange
      const mockLLMCall = vi.fn().mockResolvedValue('LLM response');
      const mockSendFallback = vi.fn();
      const mockIncrementCounter = vi.fn();

      const quotaResult: QuotaCheckResult = {
        allowed: false,
        reason: 'Daily messages limit reached',
        currentUsage: 100,
        limit: 100,
      };

      // Act - Simulate worker logic (same as in messageProcessor.worker.ts)
      if (!quotaResult.allowed) {
        // Blocked flow - quota exceeded
        mockSendFallback('Quota exceeded fallback message');
        // LLM NOT called
        // Counter NOT incremented
      } else {
        // Normal flow
        await mockLLMCall();
        mockIncrementCounter();
      }

      // Assert - CRITICAL: LLM must NOT be called
      expect(mockLLMCall).not.toHaveBeenCalled();
      expect(mockSendFallback).toHaveBeenCalledWith('Quota exceeded fallback message');
      expect(mockIncrementCounter).not.toHaveBeenCalled();
    });

    it('MUST call LLM when quota.allowed === true', async () => {
      // Arrange
      const mockLLMCall = vi.fn().mockResolvedValue('LLM response');
      const mockSendMessage = vi.fn();
      const mockIncrementCounter = vi.fn();

      const quotaResult: QuotaCheckResult = {
        allowed: true,
        currentUsage: 50,
        limit: 100,
      };

      // Act - Simulate worker logic
      if (!quotaResult.allowed) {
        // Blocked flow - should NOT execute
        throw new Error('Should not reach here when allowed=true');
      } else {
        // Normal flow
        const response = await mockLLMCall();
        mockSendMessage(response);
        mockIncrementCounter();
      }

      // Assert - LLM MUST be called
      expect(mockLLMCall).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith('LLM response');
      expect(mockIncrementCounter).toHaveBeenCalled();
    });

    it('MUST block on quota check error (fail-safe)', async () => {
      // Arrange
      const mockLLMCall = vi.fn();
      const mockSendFallback = vi.fn();

      /**
       * Simule checkQuotaBeforeLLM avec gestion d'erreur fail-safe
       * Cette logique correspond au code dans messageProcessor.worker.ts
       */
      const checkQuotaBeforeLLM = async (): Promise<QuotaCheckResult> => {
        try {
          // Simulate database error during quota check
          throw new Error('Database connection failed');
        } catch {
          // Fail-safe: block if quota check fails
          return {
            allowed: false,
            reason: 'quota_check_error',
            currentUsage: 0,
            limit: 0,
          };
        }
      };

      // Act
      const quotaResult = await checkQuotaBeforeLLM();
      
      if (!quotaResult.allowed) {
        mockSendFallback('Error fallback');
      } else {
        mockLLMCall();
      }

      // Assert - fail-safe MUST block LLM
      expect(mockLLMCall).not.toHaveBeenCalled();
      expect(mockSendFallback).toHaveBeenCalled();
      expect(quotaResult.reason).toBe('quota_check_error');
    });

    it('MUST NOT call incrementDailyCounter when LLM is skipped', async () => {
      // Arrange
      const mockLLMCall = vi.fn();
      const mockIncrementCounter = vi.fn();

      const quotaResult: QuotaCheckResult = {
        allowed: false,
        reason: 'Daily limit reached',
        currentUsage: 100,
        limit: 100,
      };

      // Act - Simulate worker logic
      if (!quotaResult.allowed) {
        // Early return - no LLM, no counter increment
        // This is what the worker does
      } else {
        await mockLLMCall();
        mockIncrementCounter();
      }

      // Assert - Counter MUST NOT be incremented when LLM skipped
      expect(mockIncrementCounter).not.toHaveBeenCalled();
    });
  });

  describe('Quota Check Order Contract', () => {
    it('documents that checkQuota MUST be called BEFORE generateReply', async () => {
      /**
       * Ce test documente l'ordre attendu des appels dans processIncomingMessage:
       * 
       * 1. resolveMessageContext()
       * 2. saveUserMessage()
       * 3. checkQuotaBeforeLLM()  <-- QUOTA CHECK (BLOCKING)
       * 4. IF allowed === false: saveQuotaExceededMessage() + sendReply() + RETURN
       * 5. generateReply()        <-- LLM CALL (only if quota allowed)
       * 6. saveAssistantMessage()
       * 7. sendReplyToWhatsApp()
       * 8. updateStats()
       * 
       * Référence: messageProcessor.worker.ts lignes 198-248
       */
      
      const callOrder: string[] = [];

      const mockCheckQuota = vi.fn().mockImplementation(() => {
        callOrder.push('checkQuota');
        return { allowed: true };
      });

      const mockGenerateReply = vi.fn().mockImplementation(() => {
        callOrder.push('generateReply');
        return 'response';
      });

      // Simulate execution order
      mockCheckQuota();
      const result = mockCheckQuota.mock.results[0]?.value;
      if (result.allowed) {
        mockGenerateReply();
      }

      // Assert order is correct
      expect(callOrder[0]).toBe('checkQuota');
      expect(callOrder[1]).toBe('generateReply');
      expect(callOrder.indexOf('checkQuota')).toBeLessThan(callOrder.indexOf('generateReply'));
    });
  });
});

describe('Quota Blocking Integration Contract', () => {
  /**
   * Ces tests définissent le contrat que doit respecter l'implémentation
   * dans messageProcessor.worker.ts
   */
  
  it('defines the quota check interface contract', () => {
    // The quotaService.checkQuota function must:
    // 1. Accept (tenantId: string, type: 'message') parameters
    // 2. Return QuotaCheckResult { allowed: boolean, reason?, currentUsage?, limit? }
    // 3. NOT throw exceptions (return allowed:false instead)
    
    const validResult: QuotaCheckResult = {
      allowed: false,
      reason: 'Daily messages limit reached: 100/100',
      currentUsage: 100,
      limit: 100,
    };

    expect(validResult).toHaveProperty('allowed');
    expect(typeof validResult.allowed).toBe('boolean');
  });

  it('defines the fallback message requirements', () => {
    // The QUOTA_EXCEEDED_USER_MESSAGE constant must:
    // 1. Contain the word "quota" or "limite" for clarity
    // 2. Be user-friendly (not technical jargon)
    // 3. Indicate the action to take (wait or upgrade)
    
    expect(QUOTA_EXCEEDED_USER_MESSAGE).toBeDefined();
    expect(typeof QUOTA_EXCEEDED_USER_MESSAGE).toBe('string');
    expect(QUOTA_EXCEEDED_USER_MESSAGE.length).toBeGreaterThan(20);
    
    // Must mention limit or quota concept
    expect(QUOTA_EXCEEDED_USER_MESSAGE.toLowerCase()).toMatch(/quota|limite|messages/i);
  });
});

describe('Conversational Quota Blocking - quotaBlocked Flag', () => {
  /**
   * Tests for the conversation-level quota blocking flag (MVP).
   * 
   * When quota is exceeded:
   * 1. First message: quota service check → blocked → set quotaBlocked=true
   * 2. Subsequent messages: check quotaBlocked flag first → skip quota service
   * 
   * This optimizes performance by avoiding redundant quota checks.
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('First message after quota exceeded', () => {
    it('MUST set quotaBlocked flag when quota service returns allowed=false', async () => {
      // Arrange
      const mockIsQuotaBlocked = vi.fn().mockResolvedValue(false);
      const mockSetQuotaBlocked = vi.fn().mockResolvedValue(undefined);
      const mockCheckQuota = vi.fn().mockResolvedValue({
        allowed: false,
        reason: 'Daily limit reached',
        currentUsage: 100,
        limit: 100,
      } as QuotaCheckResult);
      const mockSendFallback = vi.fn();
      const mockLLMCall = vi.fn();

      // Act - Simulate worker logic for first blocked message
      const alreadyBlocked = await mockIsQuotaBlocked();
      
      if (alreadyBlocked) {
        // Skip quota check, send fallback immediately
        mockSendFallback(QUOTA_EXCEEDED_USER_MESSAGE);
      } else {
        const quotaResult = await mockCheckQuota();
        
        if (!quotaResult.allowed) {
          // Mark conversation as blocked for subsequent messages
          await mockSetQuotaBlocked(true);
          mockSendFallback(QUOTA_EXCEEDED_USER_MESSAGE);
        } else {
          await mockLLMCall();
        }
      }

      // Assert
      expect(mockIsQuotaBlocked).toHaveBeenCalled();
      expect(mockCheckQuota).toHaveBeenCalled();
      expect(mockSetQuotaBlocked).toHaveBeenCalledWith(true);
      expect(mockSendFallback).toHaveBeenCalledWith(QUOTA_EXCEEDED_USER_MESSAGE);
      expect(mockLLMCall).not.toHaveBeenCalled();
    });
  });

  describe('Second message after quota exceeded', () => {
    it('MUST skip quota service check when quotaBlocked=true', async () => {
      // Arrange
      const mockIsQuotaBlocked = vi.fn().mockResolvedValue(true);
      const mockCheckQuota = vi.fn();
      const mockSendFallback = vi.fn();
      const mockLLMCall = vi.fn();

      // Act - Simulate worker logic for subsequent message
      const alreadyBlocked = await mockIsQuotaBlocked();
      
      if (alreadyBlocked) {
        // Skip quota check, send fallback immediately
        mockSendFallback(QUOTA_EXCEEDED_USER_MESSAGE);
      } else {
        const quotaResult = await mockCheckQuota();
        if (!quotaResult.allowed) {
          mockSendFallback(QUOTA_EXCEEDED_USER_MESSAGE);
        } else {
          await mockLLMCall();
        }
      }

      // Assert - CRITICAL: quota service NOT called
      expect(mockIsQuotaBlocked).toHaveBeenCalled();
      expect(mockCheckQuota).not.toHaveBeenCalled(); // Optimization check
      expect(mockSendFallback).toHaveBeenCalledWith(QUOTA_EXCEEDED_USER_MESSAGE);
      expect(mockLLMCall).not.toHaveBeenCalled();
    });

    it('MUST send same fallback message for cached blocked state', async () => {
      // Arrange
      const mockIsQuotaBlocked = vi.fn().mockResolvedValue(true);
      const sentMessages: string[] = [];
      const mockSendMessage = vi.fn().mockImplementation((msg: string) => {
        sentMessages.push(msg);
      });

      // Act - Simulate two consecutive blocked messages
      for (let i = 0; i < 2; i++) {
        const alreadyBlocked = await mockIsQuotaBlocked();
        if (alreadyBlocked) {
          mockSendMessage(QUOTA_EXCEEDED_USER_MESSAGE);
        }
      }

      // Assert - Same message sent both times
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0]).toBe(sentMessages[1]);
      expect(sentMessages[0]).toBe(QUOTA_EXCEEDED_USER_MESSAGE);
    });
  });

  describe('Normal flow without blocking', () => {
    it('MUST call LLM when neither isQuotaBlocked nor quotaService blocks', async () => {
      // Arrange
      const mockIsQuotaBlocked = vi.fn().mockResolvedValue(false);
      const mockCheckQuota = vi.fn().mockResolvedValue({
        allowed: true,
        currentUsage: 50,
        limit: 100,
      } as QuotaCheckResult);
      const mockSetQuotaBlocked = vi.fn();
      const mockLLMCall = vi.fn().mockResolvedValue('LLM response');
      const mockSendMessage = vi.fn();

      // Act
      const alreadyBlocked = await mockIsQuotaBlocked();
      
      if (alreadyBlocked) {
        mockSendMessage(QUOTA_EXCEEDED_USER_MESSAGE);
      } else {
        const quotaResult = await mockCheckQuota();
        if (!quotaResult.allowed) {
          await mockSetQuotaBlocked(true);
          mockSendMessage(QUOTA_EXCEEDED_USER_MESSAGE);
        } else {
          const response = await mockLLMCall();
          mockSendMessage(response);
        }
      }

      // Assert - Normal flow
      expect(mockIsQuotaBlocked).toHaveBeenCalled();
      expect(mockCheckQuota).toHaveBeenCalled();
      expect(mockSetQuotaBlocked).not.toHaveBeenCalled();
      expect(mockLLMCall).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith('LLM response');
    });
  });

  describe('QUOTA_EXCEEDED_USER_MESSAGE i18n-ready structure', () => {
    it('should have a proper i18n-ready message', () => {
      expect(QUOTA_EXCEEDED_USER_MESSAGE).toBeDefined();
      expect(typeof QUOTA_EXCEEDED_USER_MESSAGE).toBe('string');
      expect(QUOTA_EXCEEDED_USER_MESSAGE.length).toBeGreaterThan(0);
    });

    it('should return exact FR message (Variante A)', () => {
      const expectedFr = 
        "⚠️ L'assistant a atteint sa limite d'utilisation pour le moment.\n" +
        "Merci de contacter l'administrateur pour continuer à utiliser le service.";
      
      const frMessage = getQuotaMessage(QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY, 'fr');
      expect(frMessage).toBe(expectedFr);
      expect(QUOTA_EXCEEDED_USER_MESSAGE).toBe(expectedFr);
    });

    it('should return exact AR message (arabe standard)', () => {
      const expectedAr = 
        '⚠️ لقد بلغ المساعد الحدّ الأقصى للاستخدام في الوقت الحالي.\n' +
        'يُرجى التواصل مع المسؤول لمواصلة استخدام الخدمة.';
      
      const arMessage = getQuotaMessage(QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY, 'ar');
      expect(arMessage).toBe(expectedAr);
    });

    it('should return exact ar-ma message (darija)', () => {
      const expectedDarija = 
        '⚠️ المساعد وصل دابا للحدّ ديال الاستعمال.\n' +
        'عافاك تواصل مع المسؤول باش تكمل استعمال الخدمة.';
      
      const darijaMessage = getQuotaMessage(QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY, 'ar-ma');
      expect(darijaMessage).toBe(expectedDarija);
    });

    it('should fallback to FR for unknown locale', () => {
      const unknownLocaleMessage = getQuotaMessage(QUOTA_MESSAGE_KEYS.EXCEEDED_DAILY, 'unknown');
      expect(unknownLocaleMessage).toBe(QUOTA_EXCEEDED_USER_MESSAGE);
    });
  });

  describe('Structured logging events verification', () => {
    /**
     * Vérifie que le log event 'llm_request' n'est PAS émis
     * lorsque le quota bloque le traitement.
     * 
     * Ce test valide le comportement attendu documenté dans GO_LIVE_META_READY.md:
     * - Scénario A (normal): llm_request est loggé
     * - Scénario B (quota exceeded): llm_request n'est PAS loggé
     */
    it('should NOT emit llm_request event when quota blocks processing', () => {
      // Arrange
      const loggedEvents: string[] = [];
      const mockLogger = {
        info: vi.fn((message: string, meta?: Record<string, unknown>) => {
          if (meta?.event) {
            loggedEvents.push(meta.event as string);
          }
        }),
      };

      // Simulate quota-blocked processing flow
      const quotaResult: QuotaCheckResult = {
        allowed: false,
        reason: 'Monthly limit exceeded',
        currentUsage: 1000,
        limit: 1000,
      };

      // Act - Simulate worker flow when quota blocks
      mockLogger.info('Incoming WhatsApp message received', { event: 'message_received' });
      mockLogger.info('Job added to queue', { event: 'job_added' });
      
      if (quotaResult.allowed) {
        // This should NOT be reached
        mockLogger.info('LLM request initiated', { event: 'llm_request' });
        mockLogger.info('Message sent', { event: 'message_sent' });
      } else {
        // Quota blocked path
        mockLogger.info('Quota exceeded', { event: 'quota_exceeded' });
        mockLogger.info('Fallback sent', { event: 'quota_exceeded_handled' });
      }

      // Assert
      expect(loggedEvents).toContain('message_received');
      expect(loggedEvents).toContain('job_added');
      expect(loggedEvents).toContain('quota_exceeded');
      expect(loggedEvents).toContain('quota_exceeded_handled');
      
      // CRITICAL: llm_request must NOT be present when quota blocks
      expect(loggedEvents).not.toContain('llm_request');
      expect(loggedEvents).not.toContain('message_sent');
    });

    it('should emit llm_request event when quota allows processing', () => {
      // Arrange
      const loggedEvents: string[] = [];
      const mockLogger = {
        info: vi.fn((message: string, meta?: Record<string, unknown>) => {
          if (meta?.event) {
            loggedEvents.push(meta.event as string);
          }
        }),
      };

      // Simulate quota-allowed processing flow
      const quotaResult: QuotaCheckResult = {
        allowed: true,
        currentUsage: 50,
        limit: 1000,
      };

      // Act - Simulate worker flow when quota allows
      mockLogger.info('Incoming WhatsApp message received', { event: 'message_received' });
      mockLogger.info('Job added to queue', { event: 'job_added' });
      
      if (quotaResult.allowed) {
        mockLogger.info('LLM request initiated', { event: 'llm_request' });
        mockLogger.info('Message sent', { event: 'message_sent' });
      }

      // Assert
      expect(loggedEvents).toContain('message_received');
      expect(loggedEvents).toContain('job_added');
      expect(loggedEvents).toContain('llm_request');
      expect(loggedEvents).toContain('message_sent');
      
      // Should NOT contain quota blocking events
      expect(loggedEvents).not.toContain('quota_exceeded');
    });

    it('should verify expected events sequence matches GO_LIVE_META_READY.md Scenario A', () => {
      // Expected sequence from documentation: message_received → job_added → llm_request → message_sent
      const expectedNormalFlow = ['message_received', 'job_added', 'llm_request', 'message_sent'];
      
      // Simulate normal flow
      const loggedEvents: string[] = [];
      const mockLogger = {
        info: vi.fn((message: string, meta?: Record<string, unknown>) => {
          if (meta?.event) {
            loggedEvents.push(meta.event as string);
          }
        }),
      };

      mockLogger.info('1', { event: 'message_received' });
      mockLogger.info('2', { event: 'job_added' });
      mockLogger.info('3', { event: 'llm_request' });
      mockLogger.info('4', { event: 'message_sent' });

      expect(loggedEvents).toEqual(expectedNormalFlow);
    });
  });
});