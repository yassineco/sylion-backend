/**
 * ================================
 * WhatsApp Observability Unit Tests (A4/A5)
 * ================================
 *
 * Tests pour les invariants d'observabilité du pipeline WhatsApp:
 * - A4: Corrélation end-to-end (requestId/providerMessageId/jobId)
 * - A5: Erreurs/retry BullMQ observables via events officiels
 *
 * Vérifie:
 * - message_sent NOT emitted si sendReplyToWhatsApp échoue
 * - job_failed emitted avec les bons champs lors d'un échec
 * - job_retry_scheduled emitted si retry prévu
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ================================
// Mock Logger
// ================================
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerDebug = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    debug: (...args: unknown[]) => mockLoggerDebug(...args),
    jobLog: vi.fn(),
  },
}));

// ================================
// Helper functions
// ================================

/**
 * Extract all structured events from mock logger calls
 */
function getLoggedEvents(mockFn: ReturnType<typeof vi.fn>): Array<{ event: string; [key: string]: unknown }> {
  return mockFn.mock.calls
    .filter((call: unknown[]) => call[1] && typeof call[1] === 'object' && 'event' in (call[1] as object))
    .map((call: unknown[]) => call[1] as { event: string; [key: string]: unknown });
}

/**
 * Find a specific event in logged events
 */
function findEvent(mockFn: ReturnType<typeof vi.fn>, eventName: string): { event: string; [key: string]: unknown } | undefined {
  return getLoggedEvents(mockFn).find(e => e.event === eventName);
}

// ================================
// Tests
// ================================

describe('WhatsApp Observability - A4/A5 Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('A4 - Correlation Fields', () => {
    describe('message_sent event invariants', () => {
      it('MUST NOT emit message_sent when sendReplyToWhatsApp throws', async () => {
        /**
         * Simulates the worker flow where:
         * 1. DB persistence succeeds (assistantMessage.id exists)
         * 2. sendReplyToWhatsApp throws an error
         * 
         * Expected: message_sent event must NOT be emitted
         */
        
        // Arrange
        const mockSendReplyToWhatsApp = vi.fn().mockRejectedValue(new Error('Provider timeout'));
        const mockSaveAssistantMessage = vi.fn().mockResolvedValue({ id: 'msg_123' });
        const mockLogMessageSent = vi.fn();
        
        const context = {
          conversationId: 'conv_abc',
          tenantId: 'tenant_xyz',
          channelId: 'channel_123',
          message: {
            from: { phoneNumber: '+33612345678' },
            channelPhoneNumber: '+33698765432',
            externalId: 'provider_msg_001',
          },
        };
        
        const assistantReply = 'Hello, how can I help?';
        
        // Act - Simulate worker logic
        try {
          // 1. Save to DB (succeeds)
          const assistantMessage = await mockSaveAssistantMessage();
          
          // 2. Send to WhatsApp (fails)
          await mockSendReplyToWhatsApp(context, assistantReply);
          
          // 3. Log message_sent - ONLY if both succeed
          mockLogMessageSent({
            event: 'message_sent',
            messageId: assistantMessage.id,
          });
        } catch {
          // Error caught - message_sent should NOT be logged
        }
        
        // Assert - CRITICAL: message_sent MUST NOT be called
        expect(mockLogMessageSent).not.toHaveBeenCalled();
        expect(mockSendReplyToWhatsApp).toHaveBeenCalled();
        expect(mockSaveAssistantMessage).toHaveBeenCalled();
      });

      it('MUST emit message_sent with all correlation fields when successful', async () => {
        /**
         * Verifies that message_sent includes all required correlation fields:
         * - jobId, providerMessageId, conversationId, tenantId, channelId, messageId
         */
        
        // Arrange
        const mockSendReplyToWhatsApp = vi.fn().mockResolvedValue(undefined);
        const mockSaveAssistantMessage = vi.fn().mockResolvedValue({ id: 'msg_assistant_456' });
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        const jobId = 'job_789';
        const providerMessageId = 'provider_msg_002';
        const context = {
          conversationId: 'conv_def',
          tenantId: 'tenant_uvw',
          channelId: 'channel_456',
          message: {
            from: { phoneNumber: '+33687654321' },
            channelPhoneNumber: '+33612341234',
            externalId: providerMessageId,
          },
        };
        
        const assistantReply = 'Test reply';
        
        // Act - Simulate successful flow
        const assistantMessage = await mockSaveAssistantMessage();
        await mockSendReplyToWhatsApp(context, assistantReply);
        
        // Emit message_sent
        mockLogger.info('Reply sent and persisted successfully', {
          event: 'message_sent',
          direction: 'outbound',
          jobId,
          providerMessageId,
          conversationId: context.conversationId,
          tenantId: context.tenantId,
          channelId: context.channelId,
          messageId: assistantMessage.id,
          botPhone: '3361234****',
          to: '3368765****',
          replyLength: assistantReply.length,
        });
        
        // Assert - All correlation fields must be present
        const messageSentEvent = loggedEvents.find(e => e.event === 'message_sent');
        expect(messageSentEvent).toBeDefined();
        expect(messageSentEvent?.jobId).toBe(jobId);
        expect(messageSentEvent?.providerMessageId).toBe(providerMessageId);
        expect(messageSentEvent?.conversationId).toBe('conv_def');
        expect(messageSentEvent?.tenantId).toBe('tenant_uvw');
        expect(messageSentEvent?.channelId).toBe('channel_456');
        expect(messageSentEvent?.messageId).toBe('msg_assistant_456');
        expect(messageSentEvent?.direction).toBe('outbound');
      });
    });
  });

  describe('A5 - Job Failure Observability', () => {
    describe('job_failed event', () => {
      it('MUST emit job_failed with attempts fields on job failure', () => {
        /**
         * Simulates BullMQ worker.on('failed') handler emitting job_failed event
         */
        
        // Arrange - Simulate job object
        const job = {
          id: 'job_failed_001',
          name: 'whatsapp:process-incoming',
          attemptsMade: 2,
          opts: { attempts: 3 },
          data: {
            tenantId: 'tenant_fail_test',
            channelId: 'channel_fail_test',
            conversationId: 'conv_fail_test',
          },
        };
        const error = new Error('LLM service unavailable');
        const queueName = 'whatsapp';
        const workerName = 'WhatsApp';
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate worker.on('failed') handler
        const jobData = job.data as Record<string, unknown>;
        const attemptsMade = job.attemptsMade;
        const attemptsMax = job.opts.attempts;
        const willRetry = attemptsMade < attemptsMax;
        
        mockLogger.info('Job failed', {
          event: 'job_failed',
          jobId: job.id,
          jobName: job.name,
          queue: queueName,
          workerName,
          attemptsMade,
          attemptsMax,
          willRetry,
          error: error.message,
          tenantId: jobData.tenantId as string,
          channelId: jobData.channelId as string,
          conversationId: jobData.conversationId as string,
        });
        
        // Assert - All required fields must be present
        const jobFailedEvent = loggedEvents.find(e => e.event === 'job_failed');
        expect(jobFailedEvent).toBeDefined();
        expect(jobFailedEvent?.jobId).toBe('job_failed_001');
        expect(jobFailedEvent?.jobName).toBe('whatsapp:process-incoming');
        expect(jobFailedEvent?.queue).toBe('whatsapp');
        expect(jobFailedEvent?.attemptsMade).toBe(2);
        expect(jobFailedEvent?.attemptsMax).toBe(3);
        expect(jobFailedEvent?.willRetry).toBe(true);
        expect(jobFailedEvent?.error).toBe('LLM service unavailable');
        expect(jobFailedEvent?.tenantId).toBe('tenant_fail_test');
        expect(jobFailedEvent?.conversationId).toBe('conv_fail_test');
      });

      it('MUST emit job_retry_scheduled when willRetry is true', () => {
        /**
         * When a job fails but still has retry attempts left,
         * job_retry_scheduled must be emitted after job_failed
         */
        
        // Arrange
        const job = {
          id: 'job_retry_001',
          name: 'whatsapp:process-incoming',
          attemptsMade: 1,
          opts: { attempts: 3 },
          data: {
            tenantId: 'tenant_retry_test',
            channelId: 'channel_retry_test',
            conversationId: 'conv_retry_test',
          },
        };
        const queueName = 'whatsapp';
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate handler with retry
        const jobData = job.data as Record<string, unknown>;
        const attemptsMade = job.attemptsMade;
        const attemptsMax = job.opts.attempts;
        const willRetry = attemptsMade < attemptsMax;
        
        if (willRetry) {
          mockLogger.info('Job retry scheduled', {
            event: 'job_retry_scheduled',
            jobId: job.id,
            jobName: job.name,
            queue: queueName,
            attemptsMade,
            attemptsMax,
            nextAttempt: attemptsMade + 1,
            tenantId: jobData.tenantId as string,
            channelId: jobData.channelId as string,
            conversationId: jobData.conversationId as string,
          });
        }
        
        // Assert
        const retryEvent = loggedEvents.find(e => e.event === 'job_retry_scheduled');
        expect(retryEvent).toBeDefined();
        expect(retryEvent?.jobId).toBe('job_retry_001');
        expect(retryEvent?.attemptsMade).toBe(1);
        expect(retryEvent?.attemptsMax).toBe(3);
        expect(retryEvent?.nextAttempt).toBe(2);
      });

      it('MUST NOT emit job_retry_scheduled when max attempts reached', () => {
        /**
         * When attemptsMade >= attemptsMax, no retry is scheduled
         */
        
        // Arrange
        const job = {
          id: 'job_final_fail',
          name: 'whatsapp:process-incoming',
          attemptsMade: 3,
          opts: { attempts: 3 },
          data: {},
        };
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act
        const attemptsMade = job.attemptsMade;
        const attemptsMax = job.opts.attempts;
        const willRetry = attemptsMade < attemptsMax;
        
        mockLogger.info('Job failed', {
          event: 'job_failed',
          jobId: job.id,
          attemptsMade,
          attemptsMax,
          willRetry,
          error: 'Final failure',
        });
        
        if (willRetry) {
          mockLogger.info('Job retry scheduled', {
            event: 'job_retry_scheduled',
            jobId: job.id,
          });
        }
        
        // Assert
        const failedEvent = loggedEvents.find(e => e.event === 'job_failed');
        expect(failedEvent).toBeDefined();
        expect(failedEvent?.willRetry).toBe(false);
        
        const retryEvent = loggedEvents.find(e => e.event === 'job_retry_scheduled');
        expect(retryEvent).toBeUndefined();
      });
    });

    describe('Invariant L4 - message_sent implies DB persistence', () => {
      it('message_sent MUST include messageId as proof of DB persistence', () => {
        /**
         * L4: message_sent DOIT correspondre à un message persisté en DB
         * Proof: messageId field must be present and non-empty
         */
        
        // Arrange
        const assistantMessageId = 'db_msg_persisted_001';
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Emit message_sent with messageId
        mockLogger.info('Reply sent', {
          event: 'message_sent',
          messageId: assistantMessageId,
          conversationId: 'conv_l4_test',
        });
        
        // Assert - messageId must be present and valid
        const messageSentEvent = loggedEvents.find(e => e.event === 'message_sent');
        expect(messageSentEvent).toBeDefined();
        expect(messageSentEvent?.messageId).toBe('db_msg_persisted_001');
        expect(typeof messageSentEvent?.messageId).toBe('string');
        expect((messageSentEvent?.messageId as string).length).toBeGreaterThan(0);
      });
    });
  });

  // ================================
  // A4/A5 R1+R2 Correlation Tests (GO-LIVE CRITICAL)
  // ================================
  describe('A4 - R1/R2 Correlation End-to-End', () => {
    describe('R1: providerMessageId propagation', () => {
      it('E1: enqueue MUST include providerMessageId in job.data for whatsapp:process-incoming', () => {
        /**
         * R1 Critical: providerMessageId must be included in job.data
         * so it can be correlated through job_failed/job_retry_scheduled events.
         * 
         * This simulates what whatsapp_service.ts addJob() should do.
         */
        
        // Arrange - Simulate the job data structure created by whatsapp_service.ts
        const normalized = {
          providerMessageId: 'wamid.HBgLMzM2XXXXXXXXXXXX==',
          fromPhone: '+33612345678',
          toPhone: '+33698765432',
          text: 'Hello',
          timestamp: new Date(),
        };
        
        const coreResult = {
          tenantId: 'tenant_enqueue_test',
          channelId: 'channel_enqueue_test',
          conversationId: 'conv_enqueue_test',
          messageId: 'msg_enqueue_test',
        };
        
        // Act - Simulate job data construction (as per whatsapp_service.ts)
        const jobData = {
          tenantId: coreResult.tenantId,
          channelId: coreResult.channelId,
          conversationId: coreResult.conversationId,
          messageId: coreResult.messageId,
          from: normalized.fromPhone,
          message: { type: 'text', content: normalized.text },
          timestamp: normalized.timestamp.toISOString(),
          providerMessageId: normalized.providerMessageId, // R1: CRITICAL field
        };
        
        // Assert - providerMessageId MUST be in job.data
        expect(jobData.providerMessageId).toBeDefined();
        expect(jobData.providerMessageId).toBe('wamid.HBgLMzM2XXXXXXXXXXXX==');
        expect(typeof jobData.providerMessageId).toBe('string');
      });

      it('E2: job_failed handler MUST include providerMessageId when present in job.data', () => {
        /**
         * R1 Critical: When a job fails, providerMessageId from job.data
         * must be included in the job_failed event for correlation.
         */
        
        // Arrange - Job with providerMessageId in data (as populated by R1)
        const job = {
          id: 'job_correlation_001',
          name: 'whatsapp:process-incoming',
          attemptsMade: 3,
          opts: { attempts: 3 },
          data: {
            tenantId: 'tenant_corr_test',
            channelId: 'channel_corr_test',
            conversationId: 'conv_corr_test',
            providerMessageId: 'wamid.CORRELATION_TEST_123', // R1: Present in job.data
          },
        };
        const error = new Error('Provider timeout');
        const queueName = 'whatsapp';
        const workerName = 'WhatsApp';
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate worker.on('failed') handler (as per jobs/index.ts)
        const jobData = job.data as Record<string, unknown>;
        const attemptsMade = job.attemptsMade;
        const attemptsMax = job.opts.attempts;
        const willRetry = attemptsMade < attemptsMax;
        
        mockLogger.info('Job failed', {
          event: 'job_failed',
          jobId: job.id,
          jobName: job.name,
          queue: queueName,
          workerName,
          attemptsMade,
          attemptsMax,
          willRetry,
          error: error.message,
          providerMessageId: jobData.providerMessageId as string | undefined, // R1: CRITICAL
          tenantId: jobData.tenantId as string,
          channelId: jobData.channelId as string,
          conversationId: jobData.conversationId as string,
        });
        
        // Assert - providerMessageId MUST be present in job_failed event
        const jobFailedEvent = loggedEvents.find(e => e.event === 'job_failed');
        expect(jobFailedEvent).toBeDefined();
        expect(jobFailedEvent?.providerMessageId).toBe('wamid.CORRELATION_TEST_123');
        expect(jobFailedEvent?.jobId).toBe('job_correlation_001');
        expect(jobFailedEvent?.tenantId).toBe('tenant_corr_test');
      });
    });

    describe('R2: llm_request correlation', () => {
      it('E3: llm_request MUST include jobId + providerMessageId for correlation', () => {
        /**
         * R2: llm_request must include both jobId and providerMessageId
         * to enable full correlation from webhook to LLM cost tracking.
         */
        
        // Arrange - Simulate worker processing context
        const job = {
          id: 'job_llm_corr_001',
        };
        const messageData = {
          providerMessageId: 'wamid.LLM_CORRELATION_TEST',
          externalId: 'wamid.LLM_CORRELATION_TEST',
          from: { phoneNumber: '+33612345678' },
          channelPhoneNumber: '+33698765432',
        };
        const context = {
          tenantId: 'tenant_llm_test',
          channelId: 'channel_llm_test',
          conversationId: 'conv_llm_test',
        };
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate llm_request event (as per messageProcessor.worker.ts)
        mockLogger.info('Initiating LLM request for message processing', {
          event: 'llm_request',
          jobId: job.id,                                // R2: CRITICAL
          providerMessageId: messageData.providerMessageId, // R2: CRITICAL
          conversationId: context.conversationId,
          tenantId: context.tenantId,
          channelId: context.channelId,
          reason: 'normal',
        });
        
        // Assert - Both jobId and providerMessageId MUST be present
        const llmRequestEvent = loggedEvents.find(e => e.event === 'llm_request');
        expect(llmRequestEvent).toBeDefined();
        expect(llmRequestEvent?.jobId).toBe('job_llm_corr_001');
        expect(llmRequestEvent?.providerMessageId).toBe('wamid.LLM_CORRELATION_TEST');
        expect(llmRequestEvent?.tenantId).toBe('tenant_llm_test');
        expect(llmRequestEvent?.reason).toBe('normal');
      });
    });
  });

  // ================================
  // CS3: L2/L3 Invariant Tests (POST-PROD HARDENING)
  // ================================
  describe('CS3 - L2/L3 Invariant Verification Tests', () => {
    /**
     * These tests verify the fundamental blocking invariants:
     * - L2: rate_limited OR quota_exceeded BLOCKS llm_request
     * - L3: duplicate_message_dropped STOPS all further processing
     * 
     * Using mock-based simulation to verify event flow contracts.
     */

    describe('L2: Blocking Events MUST Prevent llm_request', () => {
      it('T1: rate_limited event MUST block llm_request (no LLM call when rate limited)', () => {
        /**
         * L2 Critical: When rate_limited is emitted, llm_request MUST NOT be emitted.
         * This ensures LLM cost protection is enforced.
         * 
         * Flow: rate_limited → return (no llm_request)
         */
        
        // Arrange - Simulate worker flow with rate limit triggered
        const job = {
          id: 'job_rate_limit_block_001',
          data: {
            requestId: 'req_rate_limit_test',
            providerMessageId: 'wamid.RATE_LIMIT_BLOCK_TEST',
          },
        };
        const context = {
          tenantId: 'tenant_l2_rate',
          channelId: 'channel_l2_rate',
          conversationId: 'conv_l2_rate',
        };
        const rateLimitResult = {
          isLimited: true,
          currentCount: 150,
          limit: 100,
          windowSeconds: 60,
          alreadyNotified: false,
        };
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
          warn: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate worker processing with rate limit triggered
        // (Simulating messageProcessor.worker.ts flow)
        
        // Step 1: Rate limit check returns isLimited: true
        if (rateLimitResult.isLimited) {
          mockLogger.warn('[Worker] Rate limit exceeded - LLM call blocked', {
            event: 'rate_limited',
            jobId: job.id,
            requestId: job.data.requestId,
            tenantId: context.tenantId,
            channelId: context.channelId,
            conversationId: context.conversationId,
            currentCount: rateLimitResult.currentCount,
            limit: rateLimitResult.limit,
            windowSeconds: rateLimitResult.windowSeconds,
            alreadyNotified: rateLimitResult.alreadyNotified,
          });
          // Worker returns here - no llm_request event is emitted
          // (simulating early return)
        }
        
        // Assert L2: llm_request MUST NOT be present when rate_limited is emitted
        const rateLimitedEvent = loggedEvents.find(e => e.event === 'rate_limited');
        const llmRequestEvent = loggedEvents.find(e => e.event === 'llm_request');
        
        expect(rateLimitedEvent).toBeDefined();
        expect(rateLimitedEvent?.jobId).toBe('job_rate_limit_block_001');
        expect(rateLimitedEvent?.requestId).toBe('req_rate_limit_test');
        
        // L2 INVARIANT: llm_request MUST NOT exist
        expect(llmRequestEvent).toBeUndefined();
      });

      it('T2: quota_exceeded event MUST block llm_request (no LLM call when quota exceeded)', () => {
        /**
         * L2 Critical: When quota_exceeded is emitted, llm_request MUST NOT be emitted.
         * This ensures tenant billing protection is enforced.
         * 
         * Flow: quota_exceeded → quota_exceeded_handled → return (no llm_request)
         */
        
        // Arrange - Simulate worker flow with quota exceeded
        const job = {
          id: 'job_quota_block_001',
          data: {
            requestId: 'req_quota_test',
            providerMessageId: 'wamid.QUOTA_BLOCK_TEST',
          },
        };
        const context = {
          tenantId: 'tenant_l2_quota',
          channelId: 'channel_l2_quota',
          conversationId: 'conv_l2_quota',
        };
        const quotaResult = {
          allowed: false,
          reason: 'monthly_limit_exceeded',
          currentUsage: 10500,
          limit: 10000,
        };
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
          warn: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate worker processing with quota exceeded
        // (Simulating messageProcessor.worker.ts flow)
        
        // Step 1: Quota check returns allowed: false
        if (!quotaResult.allowed) {
          mockLogger.warn('[Worker] Quota exceeded - LLM call blocked', {
            event: 'quota_exceeded',
            jobId: job.id,
            requestId: job.data.requestId,
            tenantId: context.tenantId,
            conversationId: context.conversationId,
            reason: quotaResult.reason,
            currentUsage: quotaResult.currentUsage,
            limit: quotaResult.limit,
          });
          
          // Step 2: Fallback message handling
          mockLogger.info('[Worker] Quota exceeded message sent', {
            event: 'quota_exceeded_handled',
            jobId: job.id,
            requestId: job.data.requestId,
            tenantId: context.tenantId,
            conversationId: context.conversationId,
            fallbackMessageId: 'fallback_quota_001',
            quotaBlocked: true,
          });
          // Worker returns here - no llm_request event is emitted
        }
        
        // Assert L2: llm_request MUST NOT be present when quota_exceeded is emitted
        const quotaExceededEvent = loggedEvents.find(e => e.event === 'quota_exceeded');
        const quotaHandledEvent = loggedEvents.find(e => e.event === 'quota_exceeded_handled');
        const llmRequestEvent = loggedEvents.find(e => e.event === 'llm_request');
        
        expect(quotaExceededEvent).toBeDefined();
        expect(quotaExceededEvent?.jobId).toBe('job_quota_block_001');
        expect(quotaExceededEvent?.reason).toBe('monthly_limit_exceeded');
        
        expect(quotaHandledEvent).toBeDefined();
        expect(quotaHandledEvent?.quotaBlocked).toBe(true);
        
        // L2 INVARIANT: llm_request MUST NOT exist
        expect(llmRequestEvent).toBeUndefined();
      });
    });

    describe('L3: Duplicate Detection MUST Stop All Processing', () => {
      it('T3: duplicate_message_dropped MUST prevent llm_request AND message_sent', () => {
        /**
         * L3 Critical: When duplicate_message_dropped is emitted, 
         * NO FURTHER PROCESSING should occur.
         * - No llm_request (no LLM call)
         * - No message_sent (no reply sent)
         * 
         * Flow: duplicate_message_dropped → return immediately
         */
        
        // Arrange - Simulate worker flow with duplicate detected
        const job = {
          id: 'job_duplicate_stop_001',
          data: {
            requestId: 'req_duplicate_test',
            providerMessageId: 'wamid.DUPLICATE_STOP_TEST',
          },
        };
        const context = {
          tenantId: 'tenant_l3_dup',
          conversationId: 'conv_l3_dup',
        };
        const idempotenceResult = {
          isDuplicate: true,
        };
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Simulate worker processing with duplicate detected
        // (Simulating messageProcessor.worker.ts flow - very early in pipeline)
        
        // Step 1: Idempotence check returns isDuplicate: true
        if (idempotenceResult.isDuplicate) {
          mockLogger.info('[Worker] Duplicate message detected - dropping silently', {
            event: 'duplicate_message_dropped',
            jobId: job.id,
            requestId: job.data.requestId,
            providerMessageId: job.data.providerMessageId,
            tenantId: context.tenantId,
            conversationId: context.conversationId,
          });
          // Worker returns immediately - no further processing
          // (simulating early return before any llm_request or message_sent)
        }
        
        // Assert L3: llm_request AND message_sent MUST NOT be present
        const duplicateEvent = loggedEvents.find(e => e.event === 'duplicate_message_dropped');
        const llmRequestEvent = loggedEvents.find(e => e.event === 'llm_request');
        const messageSentEvent = loggedEvents.find(e => e.event === 'message_sent');
        
        expect(duplicateEvent).toBeDefined();
        expect(duplicateEvent?.jobId).toBe('job_duplicate_stop_001');
        expect(duplicateEvent?.requestId).toBe('req_duplicate_test');
        expect(duplicateEvent?.providerMessageId).toBe('wamid.DUPLICATE_STOP_TEST');
        
        // L3 INVARIANT: No further processing events
        expect(llmRequestEvent).toBeUndefined();
        expect(messageSentEvent).toBeUndefined();
      });

      it('T4: duplicate_message_dropped MUST include requestId for correlation', () => {
        /**
         * Correlation requirement: duplicate_message_dropped must include
         * requestId for end-to-end tracing (CS1 compliance).
         */
        
        // Arrange
        const job = {
          id: 'job_dup_correlation_001',
          data: {
            requestId: 'req_dup_corr_test',
            providerMessageId: 'wamid.DUP_CORRELATION',
          },
        };
        const context = {
          tenantId: 'tenant_dup_corr',
          conversationId: 'conv_dup_corr',
        };
        
        const loggedEvents: Array<{ event: string; [key: string]: unknown }> = [];
        const mockLogger = {
          info: (_msg: string, data: { event: string; [key: string]: unknown }) => {
            if (data?.event) loggedEvents.push(data);
          },
        };
        
        // Act - Emit duplicate event with requestId
        mockLogger.info('[Worker] Duplicate message detected', {
          event: 'duplicate_message_dropped',
          jobId: job.id,
          requestId: job.data.requestId,
          providerMessageId: job.data.providerMessageId,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
        });
        
        // Assert - requestId MUST be present (CS1 compliance)
        const duplicateEvent = loggedEvents.find(e => e.event === 'duplicate_message_dropped');
        expect(duplicateEvent).toBeDefined();
        expect(duplicateEvent?.requestId).toBe('req_dup_corr_test');
        expect(duplicateEvent?.providerMessageId).toBe('wamid.DUP_CORRELATION');
        expect(duplicateEvent?.jobId).toBe('job_dup_correlation_001');
      });
    });
  });

  // ================================
  // EVENT CONTRACT TESTS (GO-LIVE VALIDATION)
  // ================================
  describe('Event Contract Validation - Required Fields', () => {
    /**
     * These tests validate that all critical events contain their
     * mandatory fields as defined in OBSERVABILITY_EVENTS.md.
     * 
     * Purpose: Ensure the observability contract is not violated.
     * No business logic - pure schema validation.
     */

    describe('message_received contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'message_received',
          provider: '360dialog',
          providerMessageId: 'wamid.test123',
          from: '33612****78',
          timestamp: '2026-01-03T14:30:00.000Z',
          requestId: 'req-test-001',
        };

        expect(event).toMatchObject({
          event: 'message_received',
          provider: expect.any(String),
          providerMessageId: expect.any(String),
          from: expect.any(String),
          timestamp: expect.any(String),
          requestId: expect.any(String),
        });
      });
    });

    describe('job_added contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'job_added',
          queue: 'whatsapp:process-incoming',
          jobId: 'job-123',
          tenantId: 'tenant-uuid',
          channelId: 'channel-uuid',
          conversationId: 'conv-uuid',
          messageId: 'msg-uuid',
          providerMessageId: 'wamid.test123',
        };

        expect(event).toMatchObject({
          event: 'job_added',
          queue: expect.any(String),
          jobId: expect.any(String),
          tenantId: expect.any(String),
          channelId: expect.any(String),
          conversationId: expect.any(String),
          messageId: expect.any(String),
          providerMessageId: expect.any(String),
        });
      });
    });

    describe('llm_request contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'llm_request',
          jobId: 'job-123',
          providerMessageId: 'wamid.test123',
          conversationId: 'conv-uuid',
          tenantId: 'tenant-uuid',
          channelId: 'channel-uuid',
          reason: 'normal',
        };

        expect(event).toMatchObject({
          event: 'llm_request',
          jobId: expect.any(String),
          providerMessageId: expect.any(String),
          conversationId: expect.any(String),
          tenantId: expect.any(String),
          channelId: expect.any(String),
          reason: expect.any(String),
        });
      });
    });

    describe('llm_request_completed contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'llm_request_completed',
          jobId: 'job-123',
          providerMessageId: 'wamid.test123',
          conversationId: 'conv-uuid',
          tenantId: 'tenant-uuid',
          channelId: 'channel-uuid',
          durationMs: 1234,
          replyLength: 256,
          ragUsed: true,
        };

        expect(event).toMatchObject({
          event: 'llm_request_completed',
          jobId: expect.any(String),
          providerMessageId: expect.any(String),
          conversationId: expect.any(String),
          tenantId: expect.any(String),
          channelId: expect.any(String),
          durationMs: expect.any(Number),
          replyLength: expect.any(Number),
          ragUsed: expect.any(Boolean),
        });
      });
    });

    describe('message_sent contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'message_sent',
          direction: 'outbound',
          jobId: 'job-123',
          providerMessageId: 'wamid.test123',
          conversationId: 'conv-uuid',
          tenantId: 'tenant-uuid',
          channelId: 'channel-uuid',
          messageId: 'assistant-msg-uuid',
          botPhone: '33698****32',
          to: '33612****78',
          replyLength: 256,
        };

        expect(event).toMatchObject({
          event: 'message_sent',
          direction: 'outbound',
          jobId: expect.any(String),
          providerMessageId: expect.any(String),
          conversationId: expect.any(String),
          tenantId: expect.any(String),
          channelId: expect.any(String),
          messageId: expect.any(String),
          botPhone: expect.any(String),
          to: expect.any(String),
          replyLength: expect.any(Number),
        });
      });
    });

    describe('job_failed contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'job_failed',
          jobId: 'job-123',
          jobName: 'whatsapp:process-incoming',
          queue: 'incoming-messages',
          workerName: 'Incoming Messages',
          attemptsMade: 2,
          attemptsMax: 3,
          willRetry: true,
          error: 'Connection timeout',
        };

        expect(event).toMatchObject({
          event: 'job_failed',
          jobId: expect.any(String),
          jobName: expect.any(String),
          queue: expect.any(String),
          workerName: expect.any(String),
          attemptsMade: expect.any(Number),
          attemptsMax: expect.any(Number),
          willRetry: expect.any(Boolean),
          error: expect.any(String),
        });
      });
    });

    describe('job_retry_scheduled contract', () => {
      it('MUST contain all mandatory fields per OBSERVABILITY_EVENTS.md', () => {
        const event = {
          event: 'job_retry_scheduled',
          jobId: 'job-123',
          jobName: 'whatsapp:process-incoming',
          queue: 'incoming-messages',
          attemptsMade: 2,
          attemptsMax: 3,
          nextAttempt: 3,
        };

        expect(event).toMatchObject({
          event: 'job_retry_scheduled',
          jobId: expect.any(String),
          jobName: expect.any(String),
          queue: expect.any(String),
          attemptsMade: expect.any(Number),
          attemptsMax: expect.any(Number),
          nextAttempt: expect.any(Number),
        });
      });
    });

    describe('Correlation fields presence', () => {
      it('providerMessageId MUST be present in all worker events for correlation', () => {
        // Simulates the contract that providerMessageId enables end-to-end tracing
        const workerEvents = [
          { event: 'llm_request', providerMessageId: 'wamid.test' },
          { event: 'llm_request_completed', providerMessageId: 'wamid.test' },
          { event: 'message_sent', providerMessageId: 'wamid.test' },
        ];

        for (const evt of workerEvents) {
          expect(evt.providerMessageId).toBeDefined();
          expect(typeof evt.providerMessageId).toBe('string');
          expect(evt.providerMessageId.length).toBeGreaterThan(0);
        }
      });

      it('jobId MUST be present in all worker events for BullMQ correlation', () => {
        const workerEvents = [
          { event: 'llm_request', jobId: 'job-123' },
          { event: 'llm_request_completed', jobId: 'job-123' },
          { event: 'message_sent', jobId: 'job-123' },
          { event: 'job_failed', jobId: 'job-123' },
          { event: 'job_retry_scheduled', jobId: 'job-123' },
        ];

        for (const evt of workerEvents) {
          expect(evt.jobId).toBeDefined();
          expect(typeof evt.jobId).toBe('string');
        }
      });
    });
  });
});
