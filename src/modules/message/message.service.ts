/**
 * ================================
 * Message Service - Sylion Backend
 * ================================
 * 
 * Logique métier pour la gestion des messages.
 * Aucune logique HTTP, uniquement business logic.
 */

import { db, schema, withTransaction } from '@/db/index';
import type { Message } from '@/db/schema';
import { ErrorCodes, SylionError } from '@/lib/http';
import { logger } from '@/lib/logger';
import { cacheKeys, cacheTTL, deleteCache, getCache, setCache } from '@/lib/redis';
import { and, asc, count, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import type {
    CreateMessageInput,
    UpdateMessageInput,
} from './message.types';

/**
 * Service pour la gestion des messages
 */
export class MessageService {
  
  /**
   * Créer un nouveau message
   */
  async createMessage(conversationId: string, input: CreateMessageInput): Promise<Message> {
    logger.info('Creating new message', { 
      conversationId,
      type: input.type,
      direction: input.direction
    });

    return await withTransaction(async (tx) => {
      // Vérifier que la conversation existe
      const conversationResults = await tx
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .limit(1);

      const conversation = conversationResults[0];
      if (!conversation) {
        throw new SylionError(ErrorCodes.CONVERSATION_NOT_FOUND, 'Conversation non trouvée', {
          details: { conversationId }
        });
      }

      // Créer le message
      const results = await tx
        .insert(schema.messages)
        .values({
          conversationId,
          type: input.type,
          direction: input.direction,
          content: input.content,
          metadata: input.metadata || {},
          externalId: input.externalId,
          externalTimestamp: input.externalTimestamp,
          status: input.status || 'pending',
        })
        .returning();

      const message = results[0];
      if (!message) {
        throw new SylionError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Erreur lors de la création du message');
      }

      // Mettre à jour le timestamp de la conversation
      await tx
        .update(schema.conversations)
        .set({
          lastMessageAt: sql`NOW()`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.conversations.id, conversationId));

      // Invalider les caches
      await deleteCache(cacheKeys.messagesByConversation(conversationId));
      await deleteCache(cacheKeys.conversation(conversationId));

      logger.info('Message created successfully', { 
        messageId: message.id,
        conversationId: message.conversationId,
        type: message.type
      });

      return message;
    });
  }

  /**
   * Obtenir un message par ID (sécurisé multi-tenant)
   */
  async getMessageById(id: string, tenantId: string): Promise<Message | null> {
    const cacheKey = cacheKeys.message(id);
    
    // Essayer le cache d'abord
    const cached = await getCache<Message>(cacheKey);
    if (cached) {
      // Vérifier que le message appartient au bon tenant via sa conversation
      const conversationResults = await db
        .select({ tenantId: schema.conversations.tenantId })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, cached.conversationId))
        .limit(1);
      
      if (conversationResults[0]?.tenantId === tenantId) {
        return cached;
      }
    }

    // Jointure pour vérifier l'appartenance au tenant
    const results = await db
      .select({
        message: schema.messages,
      })
      .from(schema.messages)
      .innerJoin(schema.conversations, eq(schema.messages.conversationId, schema.conversations.id))
      .where(and(
        eq(schema.messages.id, id),
        eq(schema.conversations.tenantId, tenantId)
      ))
      .limit(1);

    const message = results[0]?.message || null;

    // Mettre en cache si trouvé
    if (message) {
      await setCache(cacheKey, message, cacheTTL.message);
    }

    return message;
  }

  /**
   * Obtenir tous les messages d'une conversation
   */
  async getMessagesByConversation(conversationId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    const cacheKey = `${cacheKeys.messagesByConversation(conversationId)}:${limit}:${offset}`;
    
    // Essayer le cache d'abord
    const cached = await getCache<Message[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(asc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Mettre en cache
    await setCache(cacheKey, messages, cacheTTL.messageList);

    return messages;
  }

  /**
   * Obtenir les messages récents d'une conversation
   */
  async getRecentMessagesByConversation(conversationId: string, limit: number = 10): Promise<Message[]> {
    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit);

    // Retourner dans l'ordre chronologique
    return messages.reverse();
  }

  /**
   * Obtenir les messages d'un tenant via les conversations
   */
  async getMessagesByTenant(tenantId: string, limit: number = 100, offset: number = 0): Promise<Message[]> {
    // Récupérer d'abord les conversations du tenant
    const conversations = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(eq(schema.conversations.tenantId, tenantId));
    
    if (conversations.length === 0) {
      return [];
    }
    
    const conversationIds = conversations.map(c => c.id);
    
    const messages = await db
      .select()
      .from(schema.messages)
      .where(inArray(schema.messages.conversationId, conversationIds))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    return messages;
  }

  /**
   * Mettre à jour un message
   */
  async updateMessage(id: string, input: UpdateMessageInput): Promise<Message> {
    logger.info('Updating message', { messageId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du message
      const existingResults = await tx
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.MESSAGE_NOT_FOUND, 'Message non trouvé', {
          details: { messageId: id }
        });
      }

      // Mettre à jour le message
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      // Ajouter les champs modifiés
      if (input.type !== undefined) updateData['type'] = input.type;
      if (input.direction !== undefined) updateData['direction'] = input.direction;
      if (input.content !== undefined) updateData['content'] = input.content;
      if (input.metadata !== undefined) updateData['metadata'] = input.metadata;
      if (input.externalId !== undefined) updateData['externalId'] = input.externalId;
      if (input.externalTimestamp !== undefined) updateData['externalTimestamp'] = input.externalTimestamp;
      if (input.status !== undefined) updateData['status'] = input.status;

      const results = await tx
        .update(schema.messages)
        .set(updateData)
        .where(eq(schema.messages.id, id))
        .returning();

      const message = results[0];
      if (!message) {
        throw new SylionError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Erreur lors de la mise à jour du message');
      }

      // Invalider les caches
      await deleteCache(cacheKeys.message(id));
      await deleteCache(cacheKeys.messagesByConversation(existing.conversationId));

      logger.info('Message updated successfully', { 
        messageId: id,
        changes: Object.keys(input)
      });

      return message;
    });
  }

  /**
   * Marquer un message comme traité
   */
  async markAsProcessed(id: string): Promise<Message> {
    return await this.updateMessage(id, { status: 'processed' });
  }

  /**
   * Marquer un message comme échoué
   */
  async markAsFailed(id: string): Promise<Message> {
    return await this.updateMessage(id, { status: 'failed' });
  }

  /**
   * Marquer un message comme livré
   */
  async markAsDelivered(id: string): Promise<Message> {
    return await this.updateMessage(id, { status: 'delivered' });
  }

  /**
   * Supprimer un message (soft delete)
   */
  async deleteMessage(id: string): Promise<void> {
    logger.info('Deleting message', { messageId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du message
      const existingResults = await tx
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.MESSAGE_NOT_FOUND, 'Message non trouvé', {
          details: { messageId: id }
        });
      }

      // Soft delete - marquer comme supprimé dans les métadonnées
      await tx
        .update(schema.messages)
        .set({
          metadata: sql`jsonb_set(${schema.messages.metadata}, '{deleted}', 'true')`,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.messages.id, id));

      // Invalider les caches
      await deleteCache(cacheKeys.message(id));
      await deleteCache(cacheKeys.messagesByConversation(existing.conversationId));

      logger.info('Message deleted successfully', { messageId: id });
    });
  }

  /**
   * Obtenir les statistiques des messages pour une conversation
   */
  async getMessageStats(conversationId: string): Promise<{
    total: number;
    inbound: number;
    outbound: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    // Stats par direction
    const directionResults = await db
      .select({
        direction: schema.messages.direction,
        count: count(),
      })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .groupBy(schema.messages.direction);

    // Stats par type
    const typeResults = await db
      .select({
        type: schema.messages.type,
        count: count(),
      })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .groupBy(schema.messages.type);

    // Stats par statut
    const statusResults = await db
      .select({
        status: schema.messages.status,
        count: count(),
      })
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .groupBy(schema.messages.status);

    let total = 0;
    let inbound = 0;
    let outbound = 0;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    // Traiter les stats par direction
    for (const result of directionResults) {
      const directionCount = Number(result.count);
      total += directionCount;
      
      if (result.direction === 'inbound') inbound = directionCount;
      else if (result.direction === 'outbound') outbound = directionCount;
    }

    // Traiter les stats par type
    for (const result of typeResults) {
      byType[result.type] = Number(result.count);
    }

    // Traiter les stats par statut
    for (const result of statusResults) {
      byStatus[result.status] = Number(result.count);
    }

    return {
      total,
      inbound,
      outbound,
      byType,
      byStatus,
    };
  }

  /**
   * Obtenir les messages en attente de traitement
   */
  async getPendingMessages(limit: number = 100): Promise<Message[]> {
    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.status, 'pending'))
      .orderBy(asc(schema.messages.createdAt))
      .limit(limit);

    return messages;
  }

  /**
   * Rechercher des messages par contenu dans un tenant
   */
  async searchMessages(
    tenantId: string,
    query: string,
    conversationId?: string,
    limit: number = 50
  ): Promise<Message[]> {
    if (conversationId) {
      // Recherche dans une conversation spécifique
      const messages = await db
        .select()
        .from(schema.messages)
        .where(and(
          eq(schema.messages.conversationId, conversationId),
          sql`${schema.messages.content} ILIKE ${`%${query}%`}`
        ))
        .orderBy(desc(schema.messages.createdAt))
        .limit(limit);

      return messages;
    } else {
      // Recherche dans toutes les conversations du tenant
      const conversations = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(eq(schema.conversations.tenantId, tenantId));
      
      if (conversations.length === 0) {
        return [];
      }
      
      const conversationIds = conversations.map(c => c.id);
      
      const messages = await db
        .select()
        .from(schema.messages)
        .where(and(
          sql`${schema.messages.conversationId} = ANY(${conversationIds})`,
          sql`${schema.messages.content} ILIKE ${`%${query}%`}`
        ))
        .orderBy(desc(schema.messages.createdAt))
        .limit(limit);

      return messages;
    }
  }

  /**
   * Obtenir les messages dans une plage de dates
   */
  async getMessagesByDateRange(
    conversationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Message[]> {
    const messages = await db
      .select()
      .from(schema.messages)
      .where(and(
        eq(schema.messages.conversationId, conversationId),
        gt(schema.messages.createdAt, startDate),
        lt(schema.messages.createdAt, endDate)
      ))
      .orderBy(asc(schema.messages.createdAt));

    return messages;
  }
}

/**
 * Instance singleton du service
 */
export const messageService = new MessageService();