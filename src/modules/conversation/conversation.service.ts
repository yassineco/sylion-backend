/**
 * ================================
 * Conversation Service - Sylion Backend
 * ================================
 * 
 * Logique métier pour la gestion des conversations.
 * Aucune logique HTTP, uniquement business logic.
 */

import { and, eq, desc, sql, count } from 'drizzle-orm';
import { db, withTransaction } from '@/db/index';
import { schema } from '@/db/index';
import { logger } from '@/lib/logger';
import { SylionError, ErrorCodes } from '@/lib/http';
import { cacheKeys, setCache, getCache, deleteCache, cacheTTL } from '@/lib/redis';
import type {
  CreateConversationInput,
  UpdateConversationInput,
} from './conversation.types';
import type { Conversation } from '@/db/schema';

/**
 * Service pour la gestion des conversations
 */
export class ConversationService {
  
  /**
   * Créer une nouvelle conversation
   */
  async createConversation(
    tenantId: string, 
    channelId: string, 
    assistantId: string, 
    input: CreateConversationInput
  ): Promise<Conversation> {
    logger.info('Creating new conversation', { 
      tenantId,
      channelId,
      assistantId,
      userIdentifier: input.userIdentifier
    });

    return await withTransaction(async (tx) => {
      // Vérifier que le tenant existe
      const tenantResults = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (tenantResults.length === 0) {
        throw new SylionError(ErrorCodes.TENANT_NOT_FOUND, 'Tenant non trouvé', {
          details: { tenantId }
        });
      }

      // Vérifier que le channel existe et appartient au tenant
      const channelResults = await tx
        .select()
        .from(schema.channels)
        .where(and(
          eq(schema.channels.id, channelId),
          eq(schema.channels.tenantId, tenantId),
          eq(schema.channels.isActive, true)
        ))
        .limit(1);

      if (channelResults.length === 0) {
        throw new SylionError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel non trouvé ou inactif', {
          details: { channelId, tenantId }
        });
      }

      // Vérifier que l'assistant existe et appartient au tenant
      const assistantResults = await tx
        .select()
        .from(schema.assistants)
        .where(and(
          eq(schema.assistants.id, assistantId),
          eq(schema.assistants.tenantId, tenantId),
          eq(schema.assistants.isActive, true)
        ))
        .limit(1);

      if (assistantResults.length === 0) {
        throw new SylionError(ErrorCodes.ASSISTANT_NOT_FOUND, 'Assistant non trouvé ou inactif', {
          details: { assistantId, tenantId }
        });
      }

      // Créer la conversation
      const results = await tx
        .insert(schema.conversations)
        .values({
          tenantId,
          channelId,
          assistantId,
          userIdentifier: input.userIdentifier,
          userName: input.userName,
          userMetadata: input.userMetadata || {},
          status: input.status || 'active',
          title: input.title,
          context: input.context || {},
        })
        .returning();

      const conversation = results[0];
      if (!conversation) {
        throw new SylionError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Erreur lors de la création de la conversation', {
          
        });
      }

      // Invalider les caches
      await deleteCache(cacheKeys.conversationsByTenant(tenantId));
      await deleteCache(cacheKeys.conversationsByChannel(channelId));

      logger.info('Conversation created successfully', { 
        conversationId: conversation.id,
        tenantId: conversation.tenantId,
        userIdentifier: conversation.userIdentifier
      });

      return conversation;
    });
  }

  /**
   * Obtenir une conversation par ID
   */
  async getConversationById(id: string): Promise<Conversation | null> {
    const cacheKey = cacheKeys.conversation(id);
    
    // Essayer le cache d'abord
    const cached = await getCache<Conversation>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id))
      .limit(1);

    const conversation = results[0] || null;

    // Mettre en cache si trouvé
    if (conversation) {
      await setCache(cacheKey, conversation, cacheTTL.conversation);
    }

    return conversation;
  }

  /**
   * Obtenir une conversation avec les détails des relations
   */
  async getConversationWithDetails(id: string): Promise<any | null> {
    const results = await db
      .select({
        conversation: schema.conversations,
        channel: schema.channels,
        assistant: schema.assistants,
      })
      .from(schema.conversations)
      .innerJoin(schema.channels, eq(schema.conversations.channelId, schema.channels.id))
      .innerJoin(schema.assistants, eq(schema.conversations.assistantId, schema.assistants.id))
      .where(eq(schema.conversations.id, id))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Obtenir toutes les conversations d'un tenant
   */
  async getConversationsByTenant(tenantId: string): Promise<Conversation[]> {
    const cacheKey = cacheKeys.conversationsByTenant(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Conversation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.tenantId, tenantId))
      .orderBy(desc(schema.conversations.lastMessageAt), desc(schema.conversations.createdAt));

    // Mettre en cache
    await setCache(cacheKey, conversations, cacheTTL.conversationList);

    return conversations;
  }

  /**
   * Obtenir les conversations d'un channel
   */
  async getConversationsByChannel(channelId: string): Promise<Conversation[]> {
    const cacheKey = cacheKeys.conversationsByChannel(channelId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Conversation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.channelId, channelId))
      .orderBy(desc(schema.conversations.lastMessageAt), desc(schema.conversations.createdAt));

    // Mettre en cache
    await setCache(cacheKey, conversations, cacheTTL.conversationList);

    return conversations;
  }

  /**
   * Obtenir les conversations actives d'un tenant
   */
  async getActiveConversationsByTenant(tenantId: string): Promise<Conversation[]> {
    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(and(
        eq(schema.conversations.tenantId, tenantId),
        eq(schema.conversations.status, 'active')
      ))
      .orderBy(desc(schema.conversations.lastMessageAt), desc(schema.conversations.createdAt));

    return conversations;
  }

  /**
   * Trouver ou créer une conversation pour un utilisateur
   */
  async findOrCreateConversation(
    tenantId: string,
    channelId: string,
    assistantId: string,
    userIdentifier: string,
    input?: Partial<CreateConversationInput>
  ): Promise<Conversation> {
    // Rechercher une conversation active existante
    const existingResults = await db
      .select()
      .from(schema.conversations)
      .where(and(
        eq(schema.conversations.tenantId, tenantId),
        eq(schema.conversations.channelId, channelId),
        eq(schema.conversations.userIdentifier, userIdentifier),
        eq(schema.conversations.status, 'active')
      ))
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(1);

    const existing = existingResults[0];
    if (existing) {
      return existing;
    }

    // Créer une nouvelle conversation
    return await this.createConversation(tenantId, channelId, assistantId, {
      userIdentifier,
      userName: input?.userName,
      userMetadata: input?.userMetadata || {},
      status: 'active',
      title: input?.title,
      context: input?.context || {},
    });
  }

  /**
   * Mettre à jour une conversation
   */
  async updateConversation(id: string, input: UpdateConversationInput): Promise<Conversation> {
    logger.info('Updating conversation', { conversationId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence de la conversation
      const existingResults = await tx
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.CONVERSATION_NOT_FOUND, 'Conversation non trouvée', {
          details: { conversationId: id }
        });
      }

      // Mettre à jour la conversation
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      // Ajouter les champs modifiés
      if (input.userIdentifier !== undefined) updateData['userIdentifier'] = input.userIdentifier;
      if (input.userName !== undefined) updateData['userName'] = input.userName;
      if (input.userMetadata !== undefined) updateData['userMetadata'] = input.userMetadata;
      if (input.status !== undefined) updateData['status'] = input.status;
      if (input.title !== undefined) updateData['title'] = input.title;
      if (input.context !== undefined) updateData['context'] = input.context;

      const results = await tx
        .update(schema.conversations)
        .set(updateData)
        .where(eq(schema.conversations.id, id))
        .returning();

      const conversation = results[0];
      if (!conversation) {
        throw new SylionError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Erreur lors de la mise à jour de la conversation', {
          
        });
      }

      // Invalider les caches
      await deleteCache(cacheKeys.conversation(id));
      await deleteCache(cacheKeys.conversationsByTenant(existing.tenantId));
      await deleteCache(cacheKeys.conversationsByChannel(existing.channelId));

      logger.info('Conversation updated successfully', { 
        conversationId: id,
        changes: Object.keys(input)
      });

      return conversation;
    });
  }

  /**
   * Terminer une conversation
   */
  async endConversation(id: string): Promise<Conversation> {
    return await this.updateConversation(id, { status: 'ended' });
  }

  /**
   * Mettre en pause une conversation
   */
  async pauseConversation(id: string): Promise<Conversation> {
    return await this.updateConversation(id, { status: 'paused' });
  }

  /**
   * Reprendre une conversation
   */
  async resumeConversation(id: string): Promise<Conversation> {
    return await this.updateConversation(id, { status: 'active' });
  }

  /**
   * Mettre à jour le timestamp du dernier message
   */
  async updateLastMessageTime(id: string): Promise<void> {
    await withTransaction(async (tx) => {
      await tx
        .update(schema.conversations)
        .set({
          lastMessageAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.conversations.id, id));

      // Invalider les caches
      const conversationResults = await tx
        .select({
          tenantId: schema.conversations.tenantId,
          channelId: schema.conversations.channelId
        })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, id))
        .limit(1);

      const conversation = conversationResults[0];
      if (conversation) {
        await deleteCache(cacheKeys.conversation(id));
        await deleteCache(cacheKeys.conversationsByTenant(conversation.tenantId));
        await deleteCache(cacheKeys.conversationsByChannel(conversation.channelId));
      }
    });
  }

  /**
   * Obtenir les statistiques des conversations pour un tenant
   */
  async getConversationStats(tenantId: string): Promise<{
    total: number;
    active: number;
    ended: number;
    paused: number;
  }> {
    const results = await db
      .select({
        status: schema.conversations.status,
        count: count(),
      })
      .from(schema.conversations)
      .where(eq(schema.conversations.tenantId, tenantId))
      .groupBy(schema.conversations.status);

    const stats = {
      total: 0,
      active: 0,
      ended: 0,
      paused: 0,
    };

    for (const result of results) {
      const statusCount = Number(result.count);
      stats.total += statusCount;
      
      if (result.status === 'active') stats.active = statusCount;
      else if (result.status === 'ended') stats.ended = statusCount;
      else if (result.status === 'paused') stats.paused = statusCount;
    }

    return stats;
  }
}

/**
 * Instance singleton du service
 */
export const conversationService = new ConversationService();