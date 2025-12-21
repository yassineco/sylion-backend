/**
 * ================================
 * Vertical Slice Integration Test - Sylion Backend
 * ================================
 * 
 * Test d'intégration complet du pipeline WhatsApp → Core.
 * Vérifie le flow: Webhook → Gateway → Queue → Worker → Mock Response
 */

import { vi } from 'vitest';

// Mock Redis avant import des modules
vi.mock('../../src/lib/redis', () => ({
  redisPublisher: {},
  redisSubscriber: {},
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(true),
  deleteCache: vi.fn().mockResolvedValue(true),
  cacheKeys: {
    conversation: (id: string) => `conv:${id}`,
    message: (id: string) => `msg:${id}`,
    messagesByConversation: (id: string) => `msgs:${id}`,
    assistantsByTenant: (id: string) => `assistants:${id}`,
  },
  cacheTTL: {
    short: 60,
    medium: 300,
    long: 3600,
  },
}));

// Force le mock provider
process.env['WHATSAPP_MOCK_PROVIDER'] = 'true';

import { normalizeIncomingWhatsApp, WhatsAppNormalizationError } from '../../src/modules/whatsapp/gateway';
import type { RawWhatsAppPayload } from '../../src/modules/whatsapp/types';
import {
    getWhatsAppProvider,
    resetProvider,
    useMockProvider
} from '../../src/modules/whatsapp/whatsapp.provider.factory';
import { WhatsAppMockProvider } from '../../src/modules/whatsapp/whatsapp.provider.mock';

describe('Vertical Slice: WhatsApp → Core', () => {
  
  beforeEach(() => {
    // Reset le provider avant chaque test
    resetProvider();
  });

  describe('Step 1: Gateway - Message Normalization', () => {
    
    it('should normalize a valid 360dialog payload', () => {
      const rawPayload: RawWhatsAppPayload = {
        provider: '360dialog',
        body: {
          messages: [
            {
              id: 'wamid_test_123',
              from: '212661976863',
              to: '212661976864',
              timestamp: '1733580000',
              type: 'text',
              text: { body: 'Bonjour SYLION!' },
            },
          ],
        },
      };

      const normalized = normalizeIncomingWhatsApp(rawPayload);

      expect(normalized).toBeDefined();
      expect(normalized.provider).toBe('360dialog');
      expect(normalized.providerMessageId).toBe('wamid_test_123');
      expect(normalized.fromPhone).toBe('+212661976863');
      expect(normalized.toPhone).toBe('+212661976864');
      expect(normalized.text).toBe('Bonjour SYLION!');
      expect(normalized.timestamp).toBeInstanceOf(Date);
    });

    it('should reject unsupported providers', () => {
      const rawPayload: RawWhatsAppPayload = {
        provider: 'unsupported' as any,
        body: {},
      };

      expect(() => normalizeIncomingWhatsApp(rawPayload)).toThrow(
        WhatsAppNormalizationError
      );
    });

    it('should reject payload without messages', () => {
      const rawPayload: RawWhatsAppPayload = {
        provider: '360dialog',
        body: { messages: [] },
      };

      expect(() => normalizeIncomingWhatsApp(rawPayload)).toThrow(
        WhatsAppNormalizationError
      );
    });

    it('should reject message without required fields', () => {
      const rawPayload: RawWhatsAppPayload = {
        provider: '360dialog',
        body: {
          messages: [
            {
              id: 'wamid_test_123',
              // missing from, to, timestamp
            },
          ],
        },
      };

      expect(() => normalizeIncomingWhatsApp(rawPayload)).toThrow(
        WhatsAppNormalizationError
      );
    });
  });

  describe('Step 2: Provider Factory', () => {
    
    it('should return mock provider in test environment', () => {
      const provider = getWhatsAppProvider();
      
      // En environnement test avec WHATSAPP_MOCK_PROVIDER=true, 
      // on doit recevoir le mock
      expect(provider).toBeDefined();
    });

    it('should allow forcing mock provider', () => {
      const mockProvider = useMockProvider();
      
      expect(mockProvider).toBeInstanceOf(WhatsAppMockProvider);
    });

    it('should return same instance on multiple calls', () => {
      const provider1 = getWhatsAppProvider();
      const provider2 = getWhatsAppProvider();
      
      expect(provider1).toBe(provider2);
    });
  });

  describe('Step 3: Mock Provider - Message Sending', () => {
    let mockProvider: WhatsAppMockProvider;

    beforeEach(() => {
      mockProvider = useMockProvider();
      mockProvider.clearSentMessages();
    });

    it('should simulate sending a text message', async () => {
      const response = await mockProvider.sendTextMessage(
        '+212661976863',
        'Test message from SYLION',
        { tenantId: 'test-tenant', conversationId: 'test-conv' }
      );

      expect(response.messaging_product).toBe('whatsapp');
      expect(response.messages).toHaveLength(1);
      expect(response.messages[0]?.id).toMatch(/^mock_wamid_/);
      expect(response.messages[0]?.message_status).toBe('accepted');
    });

    it('should store sent messages for inspection', async () => {
      await mockProvider.sendTextMessage('+212661976863', 'Message 1');
      await mockProvider.sendTextMessage('+212661976864', 'Message 2');

      const sentMessages = mockProvider.getSentMessages();
      
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0]?.text).toBe('Message 1');
      expect(sentMessages[1]?.text).toBe('Message 2');
    });

    it('should validate phone numbers', async () => {
      // Numéro invalide (trop court)
      await expect(
        mockProvider.sendTextMessage('123', 'Test')
      ).rejects.toThrow('Invalid WhatsApp number');
    });

    it('should retrieve last sent message', async () => {
      await mockProvider.sendTextMessage('+212661976863', 'First');
      await mockProvider.sendTextMessage('+212661976864', 'Second');

      const lastMessage = mockProvider.getLastSentMessage();
      
      expect(lastMessage?.text).toBe('Second');
      expect(lastMessage?.to).toBe('+212661976864');
    });
  });

  describe('Step 4: Full Pipeline Simulation', () => {
    let mockProvider: WhatsAppMockProvider;

    beforeEach(() => {
      mockProvider = useMockProvider();
      mockProvider.clearSentMessages();
    });

    it('should process a complete flow: normalize → send response', async () => {
      // 1. Simuler un payload webhook
      const rawPayload: RawWhatsAppPayload = {
        provider: '360dialog',
        body: {
          messages: [
            {
              id: 'wamid_pipeline_test',
              from: '212661976863',
              to: '212600000000', // Channel phone
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'text',
              text: { body: 'Je veux inscrire mon fils' },
            },
          ],
        },
      };

      // 2. Normaliser le message
      const normalized = normalizeIncomingWhatsApp(rawPayload);
      
      expect(normalized.text).toBe('Je veux inscrire mon fils');
      expect(normalized.fromPhone).toBe('+212661976863');

      // 3. Simuler la réponse (ce que ferait le worker)
      const echoResponse = `Echo: ${normalized.text}`;
      const sendResult = await mockProvider.sendTextMessage(
        normalized.fromPhone,
        echoResponse,
        { tenantId: 'test-tenant' }
      );

      // 4. Vérifier la réponse
      expect(sendResult.messages[0]?.message_status).toBe('accepted');

      // 5. Vérifier le message stocké dans le mock
      const lastSent = mockProvider.getLastSentMessage();
      expect(lastSent?.text).toBe('Echo: Je veux inscrire mon fils');
      expect(lastSent?.to).toBe('+212661976863');
    });
  });
});
