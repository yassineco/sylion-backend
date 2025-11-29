/**
 * ================================
 * Tenant Service - Sylion Backend
 * ================================
 * 
 * Logique métier pour la gestion des tenants.
 * Aucune logique HTTP, uniquement business logic.
 */

import { and, eq, ilike, desc, asc, count, sql } from 'drizzle-orm';
import { db, withTransaction, type DbTransaction } from '@/db/index';
import { schema } from '@/db/index';
import { logger } from '@/lib/logger';
import { SylionError, ErrorCodes } from '@/lib/http';
import { parsePagination, createPaginationMeta } from '@/lib/http';
import { cacheKeys, setCache, getCache, deleteCache, cacheTTL } from '@/lib/redis';
import type {
  CreateTenantInput,
  UpdateTenantInput,
  UpdateQuotasInput,
  TenantSearchInput,
  TenantWithStats,
  TenantListResponse,
  TenantStats,
} from './tenant.types';
import type { Tenant } from '@/db/schema';

/**
 * Service pour la gestion des tenants
 */
export class TenantService {
  
  /**
   * Créer un nouveau tenant
   */
  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    logger.info('Creating new tenant', { 
      name: input.name, 
      slug: input.slug, 
      plan: input.plan 
    });

    return await withTransaction(async (tx) => {
      // Vérifier l'unicité du slug
      const existingTenant = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, input.slug))
        .limit(1);

      if (existingTenant.length > 0) {
        throw new SylionError(ErrorCodes.TENANT_SLUG_EXISTS, 'Un tenant avec ce slug existe déjà', {
          details: { slug: input.slug }
        });
      }

      // Créer le tenant
      const results = await tx
        .insert(schema.tenants)
        .values({
          name: input.name,
          slug: input.slug,
          plan: input.plan || 'free',
          isActive: input.isActive ?? true,
          quotaMessages: input.quotaMessages ?? 1000,
          quotaAiRequests: input.quotaAiRequests ?? 100,
          quotaStorageMb: input.quotaStorageMb ?? 100,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          billingAddress: input.billingAddress,
          webhookUrl: input.webhookUrl,
          settings: input.settings || {},
        })
        .returning();

      const tenant = results[0];
      if (!tenant) {
        throw new SylionError(ErrorCodes.TENANT_CREATE_FAILED, 'Erreur lors de la création du tenant');
      }

      // Invalider le cache
      await deleteCache(cacheKeys.tenantList);

      logger.info('Tenant created successfully', { 
        tenantId: tenant.id,
        slug: tenant.slug 
      });

      return tenant;
    });
  }

  /**
   * Obtenir un tenant par ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const cacheKey = cacheKeys.tenant(id);
    
    // Essayer le cache d'abord
    const cached = await getCache<Tenant>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, id))
      .limit(1);

    const tenant = results[0] || null;

    // Mettre en cache si trouvé
    if (tenant) {
      await setCache(cacheKey, tenant, cacheTTL.tenant);
    }

    return tenant;
  }

  /**
   * Obtenir un tenant par slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const cacheKey = cacheKeys.tenantBySlug(slug);
    
    // Essayer le cache d'abord
    const cached = await getCache<Tenant>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);

    const tenant = results[0] || null;

    // Mettre en cache si trouvé
    if (tenant) {
      await setCache(cacheKey, tenant, cacheTTL.tenant);
      await setCache(cacheKeys.tenant(tenant.id), tenant, cacheTTL.tenant);
    }

    return tenant;
  }

  /**
   * Mettre à jour un tenant
   */
  async updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
    logger.info('Updating tenant', { tenantId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du tenant
      const existingResults = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.TENANT_NOT_FOUND, 'Tenant non trouvé', {
          details: { tenantId: id }
        });
      }

      // Si le slug change, vérifier l'unicité
      if (input.slug && input.slug !== existing.slug) {
        const slugExistsResults = await tx
          .select()
          .from(schema.tenants)
          .where(and(
            eq(schema.tenants.slug, input.slug),
            sql`${schema.tenants.id} != ${id}`
          ))
          .limit(1);

        if (slugExistsResults.length > 0) {
          throw new SylionError('Un tenant avec ce slug existe déjà', {
            details: { slug: input.slug }
          });
        }
      }

      // Mettre à jour le tenant
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      // Ajouter les champs modifiés
      if (input.name !== undefined) updateData['name'] = input.name;
      if (input.slug !== undefined) updateData['slug'] = input.slug;
      if (input.plan !== undefined) updateData['plan'] = input.plan;
      if (input.isActive !== undefined) updateData['isActive'] = input.isActive;
      if (input.quotaMessages !== undefined) updateData['quotaMessages'] = input.quotaMessages;
      if (input.quotaAiRequests !== undefined) updateData['quotaAiRequests'] = input.quotaAiRequests;
      if (input.quotaStorageMb !== undefined) updateData['quotaStorageMb'] = input.quotaStorageMb;
      if (input.contactEmail !== undefined) updateData['contactEmail'] = input.contactEmail;
      if (input.contactPhone !== undefined) updateData['contactPhone'] = input.contactPhone;
      if (input.billingAddress !== undefined) updateData['billingAddress'] = input.billingAddress;
      if (input.webhookUrl !== undefined) updateData['webhookUrl'] = input.webhookUrl;
      if (input.settings !== undefined) updateData['settings'] = input.settings;

      const results = await tx
        .update(schema.tenants)
        .set(updateData)
        .where(eq(schema.tenants.id, id))
        .returning();

      const tenant = results[0];
      if (!tenant) {
        throw new SylionError('Erreur lors de la mise à jour du tenant', {
          
        });
      }

      // Invalider les caches
      await deleteCache(cacheKeys.tenant(id));
      await deleteCache(cacheKeys.tenantBySlug(existing.slug));
      if (tenant.slug !== existing.slug) {
        await deleteCache(cacheKeys.tenantBySlug(tenant.slug));
      }
      await deleteCache(cacheKeys.tenantList);

      logger.info('Tenant updated successfully', { 
        tenantId: id,
        changes: Object.keys(input)
      });

      return tenant;
    });
  }

  /**
   * Supprimer un tenant (soft delete)
   */
  async deleteTenant(id: string): Promise<void> {
    logger.info('Deleting tenant', { tenantId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du tenant
      const existingResults = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.TENANT_NOT_FOUND, 'Tenant non trouvé', {
          details: { tenantId: id }
        });
      }

      // Soft delete - désactiver le tenant
      await tx
        .update(schema.tenants)
        .set({
          isActive: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.tenants.id, id));

      // Invalider les caches
      await deleteCache(cacheKeys.tenant(id));
      await deleteCache(cacheKeys.tenantBySlug(existing.slug));
      await deleteCache(cacheKeys.tenantList);

      logger.info('Tenant deleted successfully', { tenantId: id });
    });
  }

  /**
   * Obtenir l'utilisation des quotas d'un tenant
   */
  async getUsage(tenantId: string): Promise<TenantStats> {
    const cacheKey = cacheKeys.tenantUsage(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<TenantStats>(cacheKey);
    if (cached) {
      return cached;
    }

    // Récupérer les données du tenant
    const tenantResults = await db
      .select({
        quotaMessages: schema.tenants.quotaMessages,
        quotaAiRequests: schema.tenants.quotaAiRequests,
        quotaStorageMb: schema.tenants.quotaStorageMb,
        usedMessages: schema.tenants.usedMessages,
        usedAiRequests: schema.tenants.usedAiRequests,
        usedStorageMb: schema.tenants.usedStorageMb,
      })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    const tenant = tenantResults[0];
    if (!tenant) {
      throw new SylionError(ErrorCodes.TENANT_NOT_FOUND, 'Tenant non trouvé', {
        details: { tenantId }
      });
    }

    // Calculer les statistiques détaillées
    const channelsResults = await db
      .select({ count: count() })
      .from(schema.channels)
      .where(and(
        eq(schema.channels.tenantId, tenantId),
        eq(schema.channels.isActive, true)
      ));

    const assistantsResults = await db
      .select({ count: count() })
      .from(schema.assistants)
      .where(and(
        eq(schema.assistants.tenantId, tenantId),
        eq(schema.assistants.isActive, true)
      ));

    const conversationsResults = await db
      .select({ count: count() })
      .from(schema.conversations)
      .where(eq(schema.conversations.tenantId, tenantId));

    const stats: TenantStats = {
      quotas: {
        messages: tenant.quotaMessages,
        aiRequests: tenant.quotaAiRequests,
        storageMb: tenant.quotaStorageMb,
      },
      usage: {
        messages: tenant.usedMessages,
        aiRequests: tenant.usedAiRequests,
        storageMb: tenant.usedStorageMb,
      },
      stats: {
        totalChannels: channelsResults[0]?.count || 0,
        totalAssistants: assistantsResults[0]?.count || 0,
        totalConversations: conversationsResults[0]?.count || 0,
      },
    };

    // Mettre en cache
    await setCache(cacheKey, stats, cacheTTL.stats);

    return stats;
  }

  /**
   * Rechercher des tenants avec pagination
   */
  async searchTenants(input: TenantSearchInput): Promise<TenantListResponse> {
    const { page = 1, limit = 10, search, plan, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = input;
    
    const { page, limit, offset } = parsePagination({ page, limit });
    
    // Utiliser les valeurs parsées
    const validatedLimit = limit;

    // Construire la requête
    let query = db
      .select({
        id: schema.tenants.id,
        name: schema.tenants.name,
        slug: schema.tenants.slug,
        plan: schema.tenants.plan,
        isActive: schema.tenants.isActive,
        quotaMessages: schema.tenants.quotaMessages,
        quotaAiRequests: schema.tenants.quotaAiRequests,
        quotaStorageMb: schema.tenants.quotaStorageMb,
        usedMessages: schema.tenants.usedMessages,
        usedAiRequests: schema.tenants.usedAiRequests,
        usedStorageMb: schema.tenants.usedStorageMb,
        contactEmail: schema.tenants.contactEmail,
        createdAt: schema.tenants.createdAt,
        updatedAt: schema.tenants.updatedAt,
        lastActiveAt: schema.tenants.lastActiveAt,
      })
      .from(schema.tenants);

    // Appliquer les filtres
    const conditions = [];
    
    if (search) {
      conditions.push(
        sql`(${schema.tenants.name} ILIKE ${`%${search}%`} OR ${schema.tenants.slug} ILIKE ${`%${search}%`})`
      );
    }
    
    if (plan) {
      conditions.push(eq(schema.tenants.plan, plan));
    }
    
    if (isActive !== undefined) {
      conditions.push(eq(schema.tenants.isActive, isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Appliquer le tri
    const sortColumn = schema.tenants[sortBy as keyof typeof schema.tenants];
    if (sortColumn) {
      query = query.orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn));
    }

    // Paginer
    query = query.limit(validatedLimit).offset(offset);

    // Exécuter la requête
    const results = await query;

    // Compter le total
    let countQuery = db
      .select({ count: count() })
      .from(schema.tenants);

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }

    const countResults = await countQuery;
    const total = countResults[0]?.count || 0;

    // Créer la réponse
    const tenants: TenantWithStats[] = results.map(tenant => ({
      ...tenant,
      stats: {
        usagePercentages: {
          messages: tenant.quotaMessages > 0 ? (tenant.usedMessages / tenant.quotaMessages) * 100 : 0,
          aiRequests: tenant.quotaAiRequests > 0 ? (tenant.usedAiRequests / tenant.quotaAiRequests) * 100 : 0,
          storage: tenant.quotaStorageMb > 0 ? (tenant.usedStorageMb / tenant.quotaStorageMb) * 100 : 0,
        },
      },
    }));

    return {
      tenants,
      pagination: createPaginationMeta({
        page,
        limit: validatedLimit,
        total,
      }),
    };
  }

  /**
   * Mettre à jour les quotas d'un tenant
   */
  async updateQuotas(tenantId: string, input: UpdateQuotasInput): Promise<Tenant> {
    logger.info('Updating tenant quotas', { tenantId });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence du tenant
      const existingResults = await tx
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (existingResults.length === 0) {
        throw new SylionError(ErrorCodes.TENANT_NOT_FOUND, 'Tenant non trouvé', {
          details: { tenantId }
        });
      }

      // Mettre à jour les quotas
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      if (input.quotaMessages !== undefined) updateData['quotaMessages'] = input.quotaMessages;
      if (input.quotaAiRequests !== undefined) updateData['quotaAiRequests'] = input.quotaAiRequests;
      if (input.quotaStorageMb !== undefined) updateData['quotaStorageMb'] = input.quotaStorageMb;

      const results = await tx
        .update(schema.tenants)
        .set(updateData)
        .where(eq(schema.tenants.id, tenantId))
        .returning();

      const tenant = results[0];
      if (!tenant) {
        throw new SylionError('Erreur lors de la mise à jour des quotas', {
          
        });
      }

      // Invalider les caches
      await deleteCache(cacheKeys.tenant(tenantId));
      await deleteCache(cacheKeys.tenantUsage(tenantId));

      logger.info('Tenant quotas updated successfully', { 
        tenantId,
        quotas: input
      });

      return tenant;
    });
  }
}

/**
 * Instance singleton du service
 */
export const tenantService = new TenantService();