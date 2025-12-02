/**
 * ================================
 * WhatsApp Echo Worker Integration Tests
 * ================================
 *
 * Phase 2.5 - Boss 1: Tests du worker Echo
 *
 * Couvre:
 * - processWhatsAppIncoming() appelé avec les bons paramètres
 * - Appel whatsAppProvider.sendTextMessage() avec le message Echo
 * - Gestion des erreurs API WhatsApp
 * - Retry automatique BullMQ (mock)
 */

import type { Job } from 'bullmq';
import type { JobTypes } from '../../src/jobs/index';
import { processWhatsAppIncoming } from '../../src/jobs/messageProcessor.worker';
import { whatsAppProvider } from '../../src/modules/whatsapp/whatsapp.provider';

// Mock du provider WhatsApp
jest.mock('../../src/modules/whatsapp/whatsapp.provider', () => ({
  whatsAppProvider: {
    sendTextMessage: jest.fn(),
  },
  sendWhatsAppTextMessage: jest.fn(),
}));

// Mock du logger pour éviter le bruit dans les tests
jest.mock('../../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

/**
 * ================================
 * Helpers - Mock Job
 * ================================
 */
function createMockJob(
  data: Partial<JobTypes['whatsapp:process-incoming']> = {}
): Job<JobTypes['whatsapp:process-incoming']> {
  return {
    id: 'test-job-123',
    data: {
      tenantId: 'test-tenant-id',
      channelId: 'test-channel-id',
      conversationId: 'test-conversation-id',
      messageId: 'test-message-id',
      from: '+212600000001',
      message: {
        content: 'Bonjour Sylion!',
        type: 'text',
        timestamp: new Date().toISOString(),
      },
      ...data,
    },
    name: 'whatsapp:process-incoming',
    queueName: 'message-processor',
  } as unknown as Job<JobTypes['whatsapp:process-incoming']>;
}

/**
 * ================================
 * Test Suite: Echo Worker
 * ================================
 */
describe('WhatsApp Echo Worker (Boss 1)', () => {
  // Reset mocks avant chaque test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * ================================
   * Tests: Succès du flow Echo
   * ================================
   */
  describe('Successful Echo Flow', () => {
    it('should call sendTextMessage with Echo prefix', async () => {
      // Arrange
      const mockJob = createMockJob({
        from: '+212661976863',
        message: { content: 'Hello World!', type: 'text', timestamp: new Date().toISOString() },
      });

      const mockSendResponse = {
        messages: [{ id: 'whatsapp-msg-12345', message_status: 'sent' }],
        contacts: [{ wa_id: '212661976863' }],
      };

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce(mockSendResponse);

      // Act
      const result = await processWhatsAppIncoming(mockJob);

      // Assert
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledTimes(1);
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        '+212661976863',
        'Echo: Hello World!',
        expect.objectContaining({
          tenantId: 'test-tenant-id',
          conversationId: 'test-conversation-id',
        })
      );

      expect(result).toEqual({
        success: true,
        messageId: 'whatsapp-msg-12345',
      });
    });

    it('should preserve message content exactly with Echo prefix', async () => {
      // Arrange - Message avec caractères spéciaux
      const mockJob = createMockJob({
        message: {
          content: '🎉 C\'est super! Merci 👍',
          type: 'text',
          timestamp: new Date().toISOString(),
        },
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-emoji-test' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert - Le message doit être préservé exactement
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        'Echo: 🎉 C\'est super! Merci 👍',
        expect.any(Object)
      );
    });

    it('should handle long messages correctly', async () => {
      // Arrange - Message long (4000 caractères)
      const longContent = 'A'.repeat(4000);
      const mockJob = createMockJob({
        message: { content: longContent, type: 'text', timestamp: new Date().toISOString() },
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-long' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        `Echo: ${longContent}`,
        expect.any(Object)
      );
    });

    it('should pass correct tenant and conversation context', async () => {
      // Arrange
      const mockJob = createMockJob({
        tenantId: 'sylion-main-tenant',
        channelId: 'whatsapp-channel-01',
        conversationId: 'conv-2024-001',
        messageId: 'msg-abc-123',
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'provider-msg-id' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert - Vérifier que le contexte est transmis
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        {
          tenantId: 'sylion-main-tenant',
          conversationId: 'conv-2024-001',
        }
      );
    });

    it('should return provider messageId on success', async () => {
      // Arrange
      const providerMessageId = 'wamid.HBgLMjEyNjYxOTc2ODYzFQIAEhggNTY3ODlBQkM=';
      const mockJob = createMockJob();

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: providerMessageId, message_status: 'sent' }],
        contacts: [{ wa_id: '212600000001' }],
      });

      // Act
      const result = await processWhatsAppIncoming(mockJob);

      // Assert
      expect(result.messageId).toBe(providerMessageId);
    });
  });

  /**
   * ================================
   * Tests: Gestion des erreurs API
   * ================================
   */
  describe('API Error Handling', () => {
    it('should throw error when WhatsApp API fails', async () => {
      // Arrange
      const mockJob = createMockJob();
      const apiError = new Error('WhatsApp API Error: Invalid recipient');

      (whatsAppProvider.sendTextMessage as jest.Mock).mockRejectedValueOnce(apiError);

      // Act & Assert
      await expect(processWhatsAppIncoming(mockJob)).rejects.toThrow('WhatsApp API Error: Invalid recipient');
    });

    it('should throw error on network timeout', async () => {
      // Arrange
      const mockJob = createMockJob();
      const timeoutError = new Error('ECONNABORTED: Request timeout');

      (whatsAppProvider.sendTextMessage as jest.Mock).mockRejectedValueOnce(timeoutError);

      // Act & Assert
      await expect(processWhatsAppIncoming(mockJob)).rejects.toThrow('ECONNABORTED');
    });

    it('should throw error on rate limit (429)', async () => {
      // Arrange
      const mockJob = createMockJob();
      const rateLimitError = new Error('Too many requests - Rate limit exceeded');

      (whatsAppProvider.sendTextMessage as jest.Mock).mockRejectedValueOnce(rateLimitError);

      // Act & Assert
      await expect(processWhatsAppIncoming(mockJob)).rejects.toThrow('Rate limit');
    });

    it('should propagate unknown errors for BullMQ retry', async () => {
      // Arrange
      const mockJob = createMockJob();
      const unexpectedError = new Error('Unexpected internal error');

      (whatsAppProvider.sendTextMessage as jest.Mock).mockRejectedValueOnce(unexpectedError);

      // Act & Assert - L'erreur doit remonter pour permettre le retry BullMQ
      await expect(processWhatsAppIncoming(mockJob)).rejects.toThrow('Unexpected internal error');
    });
  });

  /**
   * ================================
   * Tests: Formats de numéros
   * ================================
   */
  describe('Phone Number Handling', () => {
    it('should pass phone number with + prefix', async () => {
      // Arrange
      const mockJob = createMockJob({ from: '+33612345678' });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-fr' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        '+33612345678',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should pass international format correctly', async () => {
      // Arrange - Numéro USA
      const mockJob = createMockJob({ from: '+14155551234' });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-us' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        '+14155551234',
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  /**
   * ================================
   * Tests: Messages vides ou edge cases
   * ================================
   */
  describe('Edge Cases', () => {
    it('should handle empty message content', async () => {
      // Arrange
      const mockJob = createMockJob({
        message: { content: '', type: 'text', timestamp: new Date().toISOString() },
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-empty' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert - Doit envoyer "Echo: "
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        'Echo: ',
        expect.any(Object)
      );
    });

    it('should handle message with only whitespace', async () => {
      // Arrange
      const mockJob = createMockJob({
        message: { content: '   \n\t  ', type: 'text', timestamp: new Date().toISOString() },
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-whitespace' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        'Echo:    \n\t  ',
        expect.any(Object)
      );
    });

    it('should handle special characters in message', async () => {
      // Arrange
      const specialContent = '<script>alert("xss")</script> & "quotes" \'apostrophe\'';
      const mockJob = createMockJob({
        message: { content: specialContent, type: 'text', timestamp: new Date().toISOString() },
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-special' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert - Le contenu doit être préservé tel quel
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        `Echo: ${specialContent}`,
        expect.any(Object)
      );
    });

    it('should handle message with newlines', async () => {
      // Arrange
      const multilineContent = 'Ligne 1\nLigne 2\nLigne 3';
      const mockJob = createMockJob({
        message: { content: multilineContent, type: 'text', timestamp: new Date().toISOString() },
      });

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{ id: 'msg-multiline' }],
        contacts: [],
      });

      // Act
      await processWhatsAppIncoming(mockJob);

      // Assert
      expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
        expect.any(String),
        'Echo: Ligne 1\nLigne 2\nLigne 3',
        expect.any(Object)
      );
    });
  });

  /**
   * ================================
   * Tests: Réponse du provider
   * ================================
   */
  describe('Provider Response Handling', () => {
    it('should handle missing messageId in response', async () => {
      // Arrange
      const mockJob = createMockJob();

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [{}], // Pas de id
        contacts: [],
      });

      // Act
      const result = await processWhatsAppIncoming(mockJob);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
    });

    it('should handle empty messages array', async () => {
      // Arrange
      const mockJob = createMockJob();

      (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValueOnce({
        messages: [],
        contacts: [],
      });

      // Act
      const result = await processWhatsAppIncoming(mockJob);

      // Assert
      expect(result.success).toBe(true);
      expect(result.messageId).toBeUndefined();
    });
  });
});

/**
 * ================================
 * Test Suite: Job Data Validation
 * ================================
 */
describe('Job Data Structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (whatsAppProvider.sendTextMessage as jest.Mock).mockResolvedValue({
      messages: [{ id: 'test-id' }],
      contacts: [],
    });
  });

  it('should access all required job fields', async () => {
    // Arrange - Job complet avec tous les champs
    const mockJob = createMockJob({
      tenantId: 'tenant-123',
      channelId: 'channel-456',
      conversationId: 'conv-789',
      messageId: 'msg-abc',
      from: '+212661976863',
      message: { content: 'Test', type: 'text', timestamp: '2024-01-01T00:00:00Z' },
    });

    // Act
    await processWhatsAppIncoming(mockJob);

    // Assert - Le worker doit utiliser les données du job
    expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledWith(
      '+212661976863',
      'Echo: Test',
      { tenantId: 'tenant-123', conversationId: 'conv-789' }
    );
  });

  it('should use job.id for logging context', async () => {
    // Arrange
    const mockJob = {
      ...createMockJob(),
      id: 'unique-job-id-12345',
    } as Job<JobTypes['whatsapp:process-incoming']>;

    // Act
    await processWhatsAppIncoming(mockJob);

    // Assert - Le job a été traité (pas d'erreur)
    expect(whatsAppProvider.sendTextMessage).toHaveBeenCalledTimes(1);
  });
});
