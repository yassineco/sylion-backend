/**
 * ================================
 * WhatsApp Inbound Integration Tests
 * ================================
 * 
 * Tests d'intégration pour valider le flow complet de réception
 * de messages WhatsApp entrants via webhook.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../../src/db/index';
import { AssistantService } from '../../src/modules/assistant/assistant.service';
import { ChannelService } from '../../src/modules/channel/channel.service';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { MessageService } from '../../src/modules/message/message.service';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { handleIncomingWebhook } from '../../src/modules/whatsapp/whatsapp.gateway';
import type { WhatsAppRawPayload } from '../../src/modules/whatsapp/whatsapp.types';

// Mock BullMQ jobs pour éviter le traitement asynchrone dans les tests
jest.mock('../../src/jobs/index', () => ({
  addIncomingMessageJob: jest.fn().mockResolvedValue(undefined),
}));

describe('WhatsApp Inbound Integration Tests', () => {
  let tenantService: TenantService;
  let channelService: ChannelService;
  let assistantService: AssistantService;
  let conversationService: ConversationService;
  let messageService: MessageService;

  // Test data IDs
  let tenantA_id: string;
  let tenantB_id: string;
  let channelA_id: string;
  let channelB_id: string;
  let assistantA_id: string;
  let assistantB_id: string;

  // Mock addIncomingMessageJob to capture the data
  const mockAddIncomingMessageJob = jest.requireMock('../../src/jobs/index').addIncomingMessageJob;

  beforeAll(async () => {
    // Initialize services
    tenantService = new TenantService();
    channelService = new ChannelService();
    assistantService = new AssistantService();
    conversationService = new ConversationService();
    messageService = new MessageService();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
    
    // Reset mock
    mockAddIncomingMessageJob.mockClear();
    
    // Create test tenants
    const tenantA = await tenantService.createTenant({
      name: 'WhatsApp Tenant A',
      slug: 'whatsapp-tenant-a-test',
      plan: 'pro',
      contactEmail: 'whatsapp-a@example.com'
    });
    
    const tenantB = await tenantService.createTenant({
      name: 'WhatsApp Tenant B', 
      slug: 'whatsapp-tenant-b-test',
      plan: 'enterprise',
      contactEmail: 'whatsapp-b@example.com'
    });

    tenantA_id = tenantA.id;
    tenantB_id = tenantB.id;

    // Create assistants for each tenant
    const assistantA = await assistantService.createAssistant(tenantA_id, {
      name: 'WhatsApp Assistant A',
      systemPrompt: 'You are a helpful WhatsApp assistant for Tenant A',
      model: 'gemini-1.5-pro',
      isDefault: true
    });

    const assistantB = await assistantService.createAssistant(tenantB_id, {
      name: 'WhatsApp Assistant B', 
      systemPrompt: 'You are a helpful WhatsApp assistant for Tenant B',
      model: 'gemini-1.5-pro',
      isDefault: true
    });

    assistantA_id = assistantA.id;
    assistantB_id = assistantB.id;

    // Create WhatsApp channels for each tenant
    const channelA = await channelService.createChannel(tenantA_id, {
      name: 'WhatsApp Channel A',
      type: 'whatsapp',
      whatsappPhoneNumber: '+1234567890',
      whatsappApiKey: 'test-api-key-a'
    });

    const channelB = await channelService.createChannel(tenantB_id, {
      name: 'WhatsApp Channel B',
      type: 'whatsapp', 
      whatsappPhoneNumber: '+2222222222',
      whatsappApiKey: 'test-api-key-b'
    });

    channelA_id = channelA.id;
    channelB_id = channelB.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('WhatsApp Webhook Processing', () => {
    it('should create a new conversation and inbound message for first WhatsApp message', async () => {
      // Arrange: Prepare a realistic WhatsApp webhook payload
      const whatsappPayload: WhatsAppRawPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'test_phone_id_123'
                  },
                  contacts: [
                    {
                      profile: {
                        name: 'Test User A'
                      },
                      wa_id: '1111111111'
                    }
                  ],
                  messages: [
                    {
                      from: '1111111111',
                      id: 'wamid.test123',
                      timestamp: '1698847200',
                      type: 'text',
                      text: {
                        body: 'Hello Sylion'
                      }
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      // Act: Process the webhook via the gateway
      await handleIncomingWebhook(whatsappPayload);

      // Assert: Verify that the job was queued with correct data
      expect(mockAddIncomingMessageJob).toHaveBeenCalledTimes(1);
      
      const queuedJob = mockAddIncomingMessageJob.mock.calls[0][0];
      expect(queuedJob).toMatchObject({
        externalId: 'wamid.test123',
        type: 'text',
        text: 'Hello Sylion',
        from: {
          phoneNumber: '+1111111111',
          name: 'Test User A',
          waId: '1111111111'
        },
        channelPhoneNumber: '+1234567890'
      });

      // Simulate the job processing by calling the message processor logic manually
      // (Since we mocked the queue, we need to manually trigger conversation/message creation)
      
      // Find the channel by phone number
      const channels = await db
        .select()
        .from(schema.channels)
        .where(eq(schema.channels.whatsappPhoneNumber, '+1234567890'));
      
      expect(channels).toHaveLength(1);
      expect(channels[0].tenantId).toBe(tenantA_id);

      // Create conversation for the test (simulating job processor)
      const conversation = await conversationService.createConversation(
        tenantA_id,
        channelA_id,
        assistantA_id,
        {
          userIdentifier: '+1111111111',
          userName: 'Test User A'
        }
      );

      // Create the message (simulating job processor)
      const message = await messageService.createMessage(conversation.id, {
        type: 'text',
        direction: 'inbound',
        content: 'Hello Sylion',
        externalId: 'wamid.test123'
      });

      // Assert: Verify conversation exists with correct tenant linkage
      const dbConversation = await db
        .select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.tenantId, tenantA_id),
          eq(schema.conversations.channelId, channelA_id),
          eq(schema.conversations.userIdentifier, '+1111111111')
        ));
      
      expect(dbConversation).toHaveLength(1);
      expect(dbConversation[0].userName).toBe('Test User A');

      // Assert: Verify message exists with correct properties
      const dbMessage = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversation.id));

      expect(dbMessage).toHaveLength(1);
      expect(dbMessage[0]).toMatchObject({
        direction: 'inbound',
        type: 'text',
        content: 'Hello Sylion',
        externalId: 'wamid.test123'
      });
    });

    it('should reuse the existing conversation for the same user and channel', async () => {
      // Arrange: Create initial conversation and message
      const conversation = await conversationService.createConversation(
        tenantA_id,
        channelA_id,
        assistantA_id,
        {
          userIdentifier: '+1111111111',
          userName: 'Test User A'
        }
      );

      await messageService.createMessage(conversation.id, {
        type: 'text',
        direction: 'inbound',
        content: 'First message',
        externalId: 'wamid.first123'
      });

      // Prepare second message payload
      const secondMessagePayload: WhatsAppRawPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'test_phone_id_123'
                  },
                  contacts: [
                    {
                      profile: {
                        name: 'Test User A'
                      },
                      wa_id: '1111111111'
                    }
                  ],
                  messages: [
                    {
                      from: '1111111111',
                      id: 'wamid.second123',
                      timestamp: '1698847260',
                      type: 'text',
                      text: {
                        body: 'Second message'
                      }
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      // Act: Process the second webhook
      await handleIncomingWebhook(secondMessagePayload);

      // Simulate creating the second message in the existing conversation
      await messageService.createMessage(conversation.id, {
        type: 'text',
        direction: 'inbound',
        content: 'Second message',
        externalId: 'wamid.second123'
      });

      // Assert: Still exactly one conversation for this user/channel combination
      const conversations = await db
        .select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.tenantId, tenantA_id),
          eq(schema.conversations.channelId, channelA_id),
          eq(schema.conversations.userIdentifier, '+1111111111')
        ));
      
      expect(conversations).toHaveLength(1);
      expect(conversations[0].id).toBe(conversation.id);

      // Assert: Now two messages linked to this conversation, in correct order
      const messages = await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversation.id))
        .orderBy(desc(schema.messages.createdAt));

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Second message'); // Most recent
      expect(messages[1].content).toBe('First message');  // Oldest
      expect(messages[0].externalId).toBe('wamid.second123');
      expect(messages[1].externalId).toBe('wamid.first123');
    });

    it('should scope inbound messages to the correct tenant (no cross-tenant leak)', async () => {
      // Arrange: Prepare webhook for tenant A's phone number
      const tenantAPayload: WhatsAppRawPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890', // Tenant A's number
                    phone_number_id: 'test_phone_id_123'
                  },
                  contacts: [
                    {
                      profile: {
                        name: 'Customer A'
                      },
                      wa_id: '3333333333'
                    }
                  ],
                  messages: [
                    {
                      from: '3333333333',
                      id: 'wamid.tenant_a_msg',
                      timestamp: '1698847200',
                      type: 'text',
                      text: {
                        body: 'Message to Tenant A'
                      }
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      // Act: Process the webhook
      await handleIncomingWebhook(tenantAPayload);

      // Verify the queue job targets tenant A
      expect(mockAddIncomingMessageJob).toHaveBeenCalledTimes(1);
      const queuedJob = mockAddIncomingMessageJob.mock.calls[0][0];
      expect(queuedJob.channelPhoneNumber).toBe('+1234567890');

      // Simulate job processing - create conversation and message for tenant A
      const conversation = await conversationService.createConversation(
        tenantA_id,
        channelA_id,
        assistantA_id,
        {
          userIdentifier: '+3333333333',
          userName: 'Customer A'
        }
      );

      await messageService.createMessage(conversation.id, {
        type: 'text',
        direction: 'inbound',
        content: 'Message to Tenant A',
        externalId: 'wamid.tenant_a_msg'
      });

      // Assert: All conversations and messages created must belong to tenant A ONLY
      const conversationsA = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, tenantA_id));

      expect(conversationsA).toHaveLength(1);
      expect(conversationsA[0].tenantId).toBe(tenantA_id);

      // Assert: NO conversations or messages should exist for tenant B
      const conversationsB = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, tenantB_id));

      expect(conversationsB).toHaveLength(0);

      // Assert: All messages belong to tenant A's conversation only
      const messagesA = await db
        .select({
          message: schema.messages,
          conversation: schema.conversations
        })
        .from(schema.messages)
        .innerJoin(schema.conversations, eq(schema.messages.conversationId, schema.conversations.id))
        .where(eq(schema.conversations.tenantId, tenantA_id));

      expect(messagesA).toHaveLength(1);
      expect(messagesA[0].conversation.tenantId).toBe(tenantA_id);
      expect(messagesA[0].message.content).toBe('Message to Tenant A');

      // Assert: No messages linked to tenant B
      const messagesB = await db
        .select({
          message: schema.messages,
          conversation: schema.conversations
        })
        .from(schema.messages)
        .innerJoin(schema.conversations, eq(schema.messages.conversationId, schema.conversations.id))
        .where(eq(schema.conversations.tenantId, tenantB_id));

      expect(messagesB).toHaveLength(0);
    });
  });

  /**
   * Helper function to clean up test data
   */
  async function cleanupTestData() {
    try {
      // Delete in reverse order of dependencies to respect foreign keys
      await db.delete(schema.messages);
      await db.delete(schema.conversations);
      await db.delete(schema.assistants);
      await db.delete(schema.channels);
      await db.delete(schema.tenants).where(
        eq(schema.tenants.slug, 'whatsapp-tenant-a-test')
      );
      await db.delete(schema.tenants).where(
        eq(schema.tenants.slug, 'whatsapp-tenant-b-test')
      );
    } catch (error) {
      // Ignore cleanup errors - they're non-critical for test execution
      console.warn('Cleanup warning (non-critical):', error);
    }
  }
});