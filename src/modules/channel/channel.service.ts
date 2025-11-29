/**
 * ================================
 * Channel Service - Sylion Backend
 * ================================
 * 
 * Logique métier pour la gestion des channels.
 * Aucune logique HTTP, uniquement business logic.
 */

import { and, eq, desc, sql } from 'drizzle-orm';
import { db, withTransaction } from '@/db/index';
import { schema } from '@/db/index';
import { logger } from '@/lib/logger';
import { SylionError, ErrorCodes } from '@/lib/http';
import { cacheKeys, setCache, getCache, deleteCache, cacheTTL } from '@/lib/redis';
import type {
  CreateChannelInput,
  UpdateChannelInput,
} from './channel.types';
import type { Channel } from '@/db/schema';

/**
 * Service pour la gestion des channels
 */
export class ChannelService {
  
  /**
   * Créer un nouveau channel
   */
  async createChannel(tenantId: string, input: CreateChannelInput): Promise<Channel> {
    logger.info('Creating new channel', { 
      tenantId,
      name: input.name, 
      type: input.type 
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

      // Créer le channel
      const results = await tx
        .insert(schema.channels)
        .values({
          tenantId,
          name: input.name,
          type: input.type,
          isActive: input.isActive ?? true,
          config: input.config || {},
          whatsappPhoneNumber: input.whatsappPhoneNumber,
          whatsappApiKey: input.whatsappApiKey,
          whatsappVerifyToken: input.whatsappVerifyToken,
        })
        .returning();

      const channel = results[0];
      if (!channel) {
        throw new SylionError('Erreur lors de la création du channel', {
          
        });
      }

      // Invalider le cache des channels du tenant
      await deleteCache(cacheKeys.channelsByTenant(tenantId));

      logger.info('Channel created successfully', { 
        channelId: channel.id,
        tenantId: channel.tenantId,
        type: channel.type
      });

      return channel;
    });
  }

  /**
   * Obtenir un channel par ID
   */
  async getChannelById(id: string): Promise<Channel | null> {
    const cacheKey = cacheKeys.channel(id);
    
    // Essayer le cache d'abord
    const cached = await getCache<Channel>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.id, id))
      .limit(1);

    const channel = results[0] || null;

    // Mettre en cache si trouvé
    if (channel) {
      await setCache(cacheKey, channel, cacheTTL.channel);
    }

    return channel;
  }

  /**
   * Obtenir tous les channels d'un tenant
   */
  async getChannelsByTenant(tenantId: string): Promise<Channel[]> {
    const cacheKey = cacheKeys.channelsByTenant(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Channel[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const channels = await db
      .select()
      .from(schema.channels)
      .where(eq(schema.channels.tenantId, tenantId))
      .orderBy(desc(schema.channels.createdAt));

    // Mettre en cache
    await setCache(cacheKey, channels, cacheTTL.channelList);

    return channels;
  }

  /**
   * Obtenir les channels actifs d'un tenant
   */
  async getActiveChannelsByTenant(tenantId: string): Promise<Channel[]> {
    const cacheKey = cacheKeys.activeChannelsByTenant(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Channel[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const channels = await db
      .select()
      .from(schema.channels)
      .where(and(
        eq(schema.channels.tenantId, tenantId),
        eq(schema.channels.isActive, true)
      ))
      .orderBy(desc(schema.channels.createdAt));

    // Mettre en cache
    await setCache(cacheKey, channels, cacheTTL.channelList);

    return channels;
  }

  /**
   * Mettre à jour un channel
   */
  async updateChannel(id: string, input: UpdateChannelInput): Promise<Channel> {
    logger.info('Updating channel', { channelId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du channel
      const existingResults = await tx
        .select()
        .from(schema.channels)
        .where(eq(schema.channels.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel non trouvé', {
          details: { channelId: id }
        });
      }

      // Mettre à jour le channel
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      // Ajouter les champs modifiés
      if (input.name !== undefined) updateData['name'] = input.name;
      if (input.type !== undefined) updateData['type'] = input.type;
      if (input.isActive !== undefined) updateData['isActive'] = input.isActive;
      if (input.config !== undefined) updateData['config'] = input.config;
      if (input.whatsappPhoneNumber !== undefined) updateData['whatsappPhoneNumber'] = input.whatsappPhoneNumber;
      if (input.whatsappApiKey !== undefined) updateData['whatsappApiKey'] = input.whatsappApiKey;
      if (input.whatsappVerifyToken !== undefined) updateData['whatsappVerifyToken'] = input.whatsappVerifyToken;

      const results = await tx
        .update(schema.channels)
        .set(updateData)
        .where(eq(schema.channels.id, id))
        .returning();

      const channel = results[0];
      if (!channel) {
        throw new SylionError('Erreur lors de la mise à jour du channel', {
          
        });
      }

      // Invalider les caches
      await deleteCache(cacheKeys.channel(id));
      await deleteCache(cacheKeys.channelsByTenant(existing.tenantId));
      await deleteCache(cacheKeys.activeChannelsByTenant(existing.tenantId));

      logger.info('Channel updated successfully', { 
        channelId: id,
        tenantId: channel.tenantId,
        changes: Object.keys(input)
      });

      return channel;
    });
  }

  /**
   * Supprimer un channel (soft delete)
   */
  async deleteChannel(id: string): Promise<void> {
    logger.info('Deleting channel', { channelId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du channel
      const existingResults = await tx
        .select()
        .from(schema.channels)
        .where(eq(schema.channels.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.CHANNEL_NOT_FOUND, 'Channel non trouvé', {
          details: { channelId: id }
        });
      }

      // Soft delete - désactiver le channel
      await tx
        .update(schema.channels)
        .set({
          isActive: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.channels.id, id));

      // Invalider les caches
      await deleteCache(cacheKeys.channel(id));
      await deleteCache(cacheKeys.channelsByTenant(existing.tenantId));
      await deleteCache(cacheKeys.activeChannelsByTenant(existing.tenantId));

      logger.info('Channel deleted successfully', { channelId: id });
    });
  }

  /**
   * Obtenir un channel WhatsApp par numéro de téléphone
   */
  async getWhatsappChannelByPhone(tenantId: string, phoneNumber: string): Promise<Channel | null> {
    const results = await db
      .select()
      .from(schema.channels)
      .where(and(
        eq(schema.channels.tenantId, tenantId),
        eq(schema.channels.type, 'whatsapp'),
        eq(schema.channels.whatsappPhoneNumber, phoneNumber),
        eq(schema.channels.isActive, true)
      ))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Mettre à jour les statistiques d'un channel
   */
  async updateChannelStats(channelId: string, stats: { totalMessages?: number; totalConversations?: number }): Promise<void> {
    logger.debug('Updating channel stats', { channelId, stats });

    await withTransaction(async (tx) => {
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      if (stats.totalMessages !== undefined) {
        updateData['totalMessages'] = stats.totalMessages;
      }
      if (stats.totalConversations !== undefined) {
        updateData['totalConversations'] = stats.totalConversations;
      }

      if (stats.totalMessages !== undefined || stats.totalConversations !== undefined) {
        updateData['lastMessageAt'] = sql`NOW()`;
      }

      await tx
        .update(schema.channels)
        .set(updateData)
        .where(eq(schema.channels.id, channelId));

      // Invalider les caches du channel
      const channelResults = await tx
        .select({ tenantId: schema.channels.tenantId })
        .from(schema.channels)
        .where(eq(schema.channels.id, channelId))
        .limit(1);

      const channel = channelResults[0];
      if (channel) {
        await deleteCache(cacheKeys.channel(channelId));
        await deleteCache(cacheKeys.channelsByTenant(channel.tenantId));
        await deleteCache(cacheKeys.activeChannelsByTenant(channel.tenantId));
      }
    });
  }
}

/**
 * Instance singleton du service
 */
export const channelService = new ChannelService();