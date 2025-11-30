/**
 * ================================
 * Multi-Tenant Fence Integration Tests
 * ================================
 * 
 * Tests d'isolation multi-tenant pour garantir qu'aucun tenant
 * ne peut accéder aux données d'un autre tenant.
 */

import { db, schema } from '../../src/db/index';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ChannelService } from '../../src/modules/channel/channel.service';
import { ConversationService } from '../../src/modules/conversation/conversation.service';
import { AssistantService } from '../../src/modules/assistant/assistant.service';
import { MessageService } from '../../src/modules/message/message.service';
import { eq } from 'drizzle-orm';

describe('Multi-Tenant Fence Tests', () => {
  let tenantService: TenantService;
  let channelService: ChannelService;
  let conversationService: ConversationService;
  let assistantService: AssistantService;
  let messageService: MessageService;

  // Test data IDs
  let tenantA_id: string;
  let tenantB_id: string;
  let channelA_id: string;
  let channelB_id: string;
  let assistantA_id: string;
  let assistantB_id: string;
  let conversationA_id: string;
  let conversationB_id: string;

  beforeAll(async () => {
    // Initialize services - they don't need constructor arguments
    tenantService = new TenantService();
    channelService = new ChannelService();
    conversationService = new ConversationService();
    assistantService = new AssistantService();
    messageService = new MessageService();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test tenants
    const tenantA = await tenantService.createTenant({
      name: 'Test Tenant A',
      slug: 'tenant-a-test',
      plan: 'pro',
      contactEmail: 'test-a@example.com'
    });
    
    const tenantB = await tenantService.createTenant({
      name: 'Test Tenant B', 
      slug: 'tenant-b-test',
      plan: 'enterprise',
      contactEmail: 'test-b@example.com'
    });

    tenantA_id = tenantA.id;
    tenantB_id = tenantB.id;

    // Create assistants for each tenant
    const assistantA = await assistantService.createAssistant(tenantA_id, {
      name: 'Assistant A',
      systemPrompt: 'You are a helpful assistant for Tenant A',
      model: 'gemini-1.5-pro',
      isDefault: true
    });

    const assistantB = await assistantService.createAssistant(tenantB_id, {
      name: 'Assistant B', 
      systemPrompt: 'You are a helpful assistant for Tenant B',
      model: 'gemini-1.5-pro',
      isDefault: true
    });

    assistantA_id = assistantA.id;
    assistantB_id = assistantB.id;

    // Create channels for each tenant
    const channelA = await channelService.createChannel(tenantA_id, {
      name: 'WhatsApp Channel A',
      type: 'whatsapp',
      whatsappPhoneNumber: '+1234567890',
      whatsappApiKey: 'test-key-a'
    });

    const channelB = await channelService.createChannel(tenantB_id, {
      name: 'WhatsApp Channel B',
      type: 'whatsapp', 
      whatsappPhoneNumber: '+0987654321',
      whatsappApiKey: 'test-key-b'
    });

    channelA_id = channelA.id;
    channelB_id = channelB.id;

    // Create conversations for each tenant
    const conversationA = await conversationService.createConversation(
      tenantA_id,
      channelA_id,
      assistantA_id,
      {
        userIdentifier: '+1111111111',
        userName: 'User A'
      }
    );

    const conversationB = await conversationService.createConversation(
      tenantB_id,
      channelB_id,
      assistantB_id,
      {
        userIdentifier: '+2222222222',
        userName: 'User B'
      }
    );

    conversationA_id = conversationA.id;
    conversationB_id = conversationB.id;

    // Create messages for each conversation
    await messageService.createMessage(conversationA_id, {
      type: 'text',
      direction: 'inbound',
      content: 'Hello from Tenant A user'
    });

    await messageService.createMessage(conversationB_id, {
      type: 'text',
      direction: 'inbound', 
      content: 'Hello from Tenant B user'
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Tenant Isolation', () => {
    it('should allow tenant A to access only its own data', async () => {
      // Tenant A should see its own data
      const tenantA = await tenantService.getTenantById(tenantA_id);
      expect(tenantA).toBeDefined();
      expect(tenantA?.id).toBe(tenantA_id);
      expect(tenantA?.slug).toBe('tenant-a-test');

      // Tenant A should see its own channels
      const channelsA = await channelService.getChannelsByTenant(tenantA_id);
      expect(channelsA).toHaveLength(1);
      expect(channelsA[0].id).toBe(channelA_id);
      expect(channelsA[0].tenantId).toBe(tenantA_id);
      expect(channelsA[0].whatsappPhoneNumber).toBe('+1234567890');

      // Tenant A should see its own assistants
      const assistantsA = await assistantService.getAssistantsByTenant(tenantA_id);
      expect(assistantsA).toHaveLength(1);
      expect(assistantsA[0].id).toBe(assistantA_id);
      expect(assistantsA[0].tenantId).toBe(tenantA_id);
      expect(assistantsA[0].name).toBe('Assistant A');

      // Tenant A should see its own conversations  
      const conversationsA = await conversationService.getConversationsByTenant(tenantA_id);
      expect(conversationsA).toHaveLength(1);
      expect(conversationsA[0].id).toBe(conversationA_id);
      expect(conversationsA[0].tenantId).toBe(tenantA_id);
    });

    it('should prevent tenant A from accessing tenant B data', async () => {
      // Tenant A should NOT be able to access tenant B's channel
      const channelB_accessed_by_A = await channelService.getChannelById(channelB_id, tenantA_id);
      expect(channelB_accessed_by_A).toBeNull();

      // Tenant A should NOT be able to access tenant B's assistant
      const assistantB_accessed_by_A = await assistantService.getAssistantById(assistantB_id, tenantA_id);
      expect(assistantB_accessed_by_A).toBeNull();

      // Tenant A should NOT be able to access tenant B's conversation
      const conversationB_accessed_by_A = await conversationService.getConversationById(conversationB_id, tenantA_id);
      expect(conversationB_accessed_by_A).toBeNull();

      // Tenant A should only see its own channels when listing
      const channelsA = await channelService.getChannelsByTenant(tenantA_id);
      expect(channelsA).toHaveLength(1);
      expect(channelsA[0].tenantId).toBe(tenantA_id);
      
      // Tenant A should only see its own assistants when listing
      const assistantsA = await assistantService.getAssistantsByTenant(tenantA_id);
      expect(assistantsA).toHaveLength(1);
      expect(assistantsA[0].tenantId).toBe(tenantA_id);
    });

    it('should prevent cross-tenant conversation and message access', async () => {
      // Try to access conversation B with tenant A context
      const conversationB_with_tenantA = await conversationService.getConversationById(conversationB_id, tenantA_id);
      expect(conversationB_with_tenantA).toBeNull();

      // Verify messages are properly isolated via tenant-aware method
      const messagesA = await messageService.getMessagesByTenant(tenantA_id);
      expect(messagesA).toHaveLength(1);
      expect(messagesA[0].content).toBe('Hello from Tenant A user');

      const messagesB = await messageService.getMessagesByTenant(tenantB_id);
      expect(messagesB).toHaveLength(1);
      expect(messagesB[0].content).toBe('Hello from Tenant B user');

      // Cross-tenant message access should be blocked at service level
      const messageByIdA = await messageService.getMessageById(messagesB[0].id, tenantA_id);
      expect(messageByIdA).toBeNull();
    });
  });

  describe('Database Level Isolation', () => {
    it('should enforce tenant_id filtering at database level', async () => {
      // Direct database queries should respect tenant isolation
      
      // Query channels directly with tenant filter
      const channelsA_direct = await db
        .select()
        .from(schema.channels)
        .where(eq(schema.channels.tenantId, tenantA_id));
      
      expect(channelsA_direct).toHaveLength(1);
      expect(channelsA_direct[0].id).toBe(channelA_id);

      // Query conversations directly with tenant filter
      const conversationsA_direct = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, tenantA_id));
      
      expect(conversationsA_direct).toHaveLength(1);
      expect(conversationsA_direct[0].id).toBe(conversationA_id);
      expect(conversationsA_direct[0].userIdentifier).toBe('+1111111111');

      // Verify no cross-contamination
      const conversationsB_direct = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, tenantB_id));
      
      expect(conversationsB_direct).toHaveLength(1);
      expect(conversationsB_direct[0].id).toBe(conversationB_id);
      expect(conversationsB_direct[0].userIdentifier).toBe('+2222222222');
      
      // Ensure no conversation from A appears in B's results
      expect(conversationsB_direct.every(conv => conv.tenantId === tenantB_id)).toBe(true);
    });

    it('should maintain referential integrity with tenant constraints', async () => {
      // Verify all related entities have correct tenant_id relationships
      
      // Check channel -> tenant relationship
      const channel = await db
        .select()
        .from(schema.channels)
        .where(eq(schema.channels.id, channelA_id));
      
      expect(channel[0].tenantId).toBe(tenantA_id);

      // Check conversation -> tenant + channel relationship
      const conversation = await db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationA_id));
      
      expect(conversation[0].tenantId).toBe(tenantA_id);
      expect(conversation[0].channelId).toBe(channelA_id);
      
      // Verify assistant belongs to correct tenant
      const assistant = await db
        .select()
        .from(schema.assistants)
        .where(eq(schema.assistants.id, assistantA_id));
      
      expect(assistant[0].tenantId).toBe(tenantA_id);
    });
  });

  describe('Service Layer Security', () => {
    it('should handle unauthorized cross-tenant access gracefully', async () => {
      // Attempting to update a channel from another tenant should throw
      await expect(
        channelService.updateChannel(channelB_id, tenantA_id, {
          name: 'Hacked Channel Name'
        })
      ).rejects.toThrow();

      // Attempting to get an assistant from another tenant should return null
      const foreignAssistant = await assistantService.getAssistantById(assistantB_id, tenantA_id);
      expect(foreignAssistant).toBeNull();
    });

    it('should ensure list operations only return tenant-scoped data', async () => {
      // Create additional data for tenant B
      await channelService.createChannel(tenantB_id, {
        name: 'Second Channel B',
        type: 'whatsapp',
        whatsappPhoneNumber: '+5555555555'
      });

      // Tenant A should still see only its own channels
      const channelsA = await channelService.getChannelsByTenant(tenantA_id);
      expect(channelsA).toHaveLength(1);
      expect(channelsA.every(channel => channel.tenantId === tenantA_id)).toBe(true);

      // Tenant B should see both its channels
      const channelsB = await channelService.getChannelsByTenant(tenantB_id);
      expect(channelsB).toHaveLength(2);
      expect(channelsB.every(channel => channel.tenantId === tenantB_id)).toBe(true);
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
        eq(schema.tenants.slug, 'tenant-a-test')
      );
      await db.delete(schema.tenants).where(
        eq(schema.tenants.slug, 'tenant-b-test')
      );
    } catch (error) {
      // Ignore cleanup errors - they're non-critical for test execution
      console.warn('Cleanup warning (non-critical):', error);
    }
  }
});