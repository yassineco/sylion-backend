/**
 * ================================
 * Assistant Service - Sylion Backend
 * ================================
 * 
 * Logique métier pour la gestion des assistants IA.
 * Aucune logique HTTP, uniquement business logic.
 */

import { and, eq, desc, sql } from 'drizzle-orm';
import { db, withTransaction } from '@/db/index';
import { schema } from '@/db/index';
import { logger } from '@/lib/logger';
import { SylionError, ErrorCodes } from '@/lib/http';
import { cacheKeys, setCache, getCache, deleteCache, cacheTTL } from '@/lib/redis';
import type {
  CreateAssistantInput,
  UpdateAssistantInput,
} from './assistant.types';
import type { Assistant } from '@/db/schema';

/**
 * Service pour la gestion des assistants
 */
export class AssistantService {
  
  /**
   * Créer un nouveau assistant
   */
  async createAssistant(tenantId: string, input: CreateAssistantInput): Promise<Assistant> {
    logger.info('Creating new assistant', { 
      tenantId,
      name: input.name, 
      model: input.model 
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

      // Si c'est l'assistant par défaut, désactiver l'ancien
      if (input.isDefault) {
        await tx
          .update(schema.assistants)
          .set({ isDefault: false })
          .where(and(
            eq(schema.assistants.tenantId, tenantId),
            eq(schema.assistants.isDefault, true)
          ));
      }

      // Créer l'assistant
      const results = await tx
        .insert(schema.assistants)
        .values({
          tenantId,
          name: input.name,
          description: input.description,
          isActive: input.isActive ?? true,
          isDefault: input.isDefault ?? false,
          model: input.model || 'gemini-1.5-pro',
          systemPrompt: input.systemPrompt,
          temperature: input.temperature ?? 0.7,
          maxTokens: input.maxTokens ?? 1024,
          enableRag: input.enableRag ?? false,
          ragThreshold: input.ragThreshold ?? 0.7,
          ragMaxResults: input.ragMaxResults ?? 5,
        })
        .returning();

      const assistant = results[0];
      if (!assistant) {
        throw new SylionError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Erreur lors de la création de l\'assistant');
      }

      // Invalider le cache des assistants du tenant
      await deleteCache(cacheKeys.assistantsByTenant(tenantId));

      logger.info('Assistant created successfully', { 
        assistantId: assistant.id,
        tenantId: assistant.tenantId,
        name: assistant.name
      });

      return assistant;
    });
  }

  /**
   * Obtenir un assistant par ID
   */
  async getAssistantById(id: string): Promise<Assistant | null> {
    const cacheKey = cacheKeys.assistant(id);
    
    // Essayer le cache d'abord
    const cached = await getCache<Assistant>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await db
      .select()
      .from(schema.assistants)
      .where(eq(schema.assistants.id, id))
      .limit(1);

    const assistant = results[0] || null;

    // Mettre en cache si trouvé
    if (assistant) {
      await setCache(cacheKey, assistant, cacheTTL.assistant);
    }

    return assistant;
  }

  /**
   * Obtenir tous les assistants d'un tenant
   */
  async getAssistantsByTenant(tenantId: string): Promise<Assistant[]> {
    const cacheKey = cacheKeys.assistantsByTenant(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Assistant[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const assistants = await db
      .select()
      .from(schema.assistants)
      .where(eq(schema.assistants.tenantId, tenantId))
      .orderBy(desc(schema.assistants.isDefault), desc(schema.assistants.createdAt));

    // Mettre en cache
    await setCache(cacheKey, assistants, cacheTTL.assistantList);

    return assistants;
  }

  /**
   * Obtenir les assistants actifs d'un tenant
   */
  async getActiveAssistantsByTenant(tenantId: string): Promise<Assistant[]> {
    const cacheKey = cacheKeys.activeAssistantsByTenant(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Assistant[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const assistants = await db
      .select()
      .from(schema.assistants)
      .where(and(
        eq(schema.assistants.tenantId, tenantId),
        eq(schema.assistants.isActive, true)
      ))
      .orderBy(desc(schema.assistants.isDefault), desc(schema.assistants.createdAt));

    // Mettre en cache
    await setCache(cacheKey, assistants, cacheTTL.assistantList);

    return assistants;
  }

  /**
   * Obtenir l'assistant par défaut d'un tenant
   */
  async getDefaultAssistant(tenantId: string): Promise<Assistant | null> {
    const cacheKey = cacheKeys.defaultAssistant(tenantId);
    
    // Essayer le cache d'abord
    const cached = await getCache<Assistant>(cacheKey);
    if (cached) {
      return cached;
    }

    const results = await db
      .select()
      .from(schema.assistants)
      .where(and(
        eq(schema.assistants.tenantId, tenantId),
        eq(schema.assistants.isDefault, true),
        eq(schema.assistants.isActive, true)
      ))
      .limit(1);

    const assistant = results[0] || null;

    // Mettre en cache si trouvé
    if (assistant) {
      await setCache(cacheKey, assistant, cacheTTL.assistant);
    }

    return assistant;
  }

  /**
   * Mettre à jour un assistant
   */
  async updateAssistant(id: string, input: UpdateAssistantInput): Promise<Assistant> {
    logger.info('Updating assistant', { assistantId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence de l'assistant
      const existingResults = await tx
        .select()
        .from(schema.assistants)
        .where(eq(schema.assistants.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.ASSISTANT_NOT_FOUND, 'Assistant non trouvé', {
          details: { assistantId: id }
        });
      }

      // Si on définit comme défaut, désactiver l'ancien
      if (input.isDefault && !existing.isDefault) {
        await tx
          .update(schema.assistants)
          .set({ isDefault: false })
          .where(and(
            eq(schema.assistants.tenantId, existing.tenantId),
            eq(schema.assistants.isDefault, true)
          ));
      }

      // Mettre à jour l'assistant
      const updateData: Record<string, any> = {
        updatedAt: sql`NOW()`,
      };

      // Ajouter les champs modifiés
      if (input.name !== undefined) updateData['name'] = input.name;
      if (input.description !== undefined) updateData['description'] = input.description;
      if (input.isActive !== undefined) updateData['isActive'] = input.isActive;
      if (input.isDefault !== undefined) updateData['isDefault'] = input.isDefault;
      if (input.model !== undefined) updateData['model'] = input.model;
      if (input.systemPrompt !== undefined) updateData['systemPrompt'] = input.systemPrompt;
      if (input.temperature !== undefined) updateData['temperature'] = input.temperature;
      if (input.maxTokens !== undefined) updateData['maxTokens'] = input.maxTokens;
      if (input.enableRag !== undefined) updateData['enableRag'] = input.enableRag;
      if (input.ragThreshold !== undefined) updateData['ragThreshold'] = input.ragThreshold;
      if (input.ragMaxResults !== undefined) updateData['ragMaxResults'] = input.ragMaxResults;

      const results = await tx
        .update(schema.assistants)
        .set(updateData)
        .where(eq(schema.assistants.id, id))
        .returning();

      const assistant = results[0];
      if (!assistant) {
        throw new SylionError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Erreur lors de la mise à jour de l\'assistant');
      }

      // Invalider les caches
      await deleteCache(cacheKeys.assistant(id));
      await deleteCache(cacheKeys.assistantsByTenant(existing.tenantId));
      await deleteCache(cacheKeys.activeAssistantsByTenant(existing.tenantId));
      await deleteCache(cacheKeys.defaultAssistant(existing.tenantId));

      logger.info('Assistant updated successfully', { 
        assistantId: id,
        tenantId: assistant.tenantId,
        changes: Object.keys(input)
      });

      return assistant;
    });
  }

  /**
   * Supprimer un assistant (soft delete)
   */
  async deleteAssistant(id: string): Promise<void> {
    logger.info('Deleting assistant', { assistantId: id });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence de l'assistant
      const existingResults = await tx
        .select()
        .from(schema.assistants)
        .where(eq(schema.assistants.id, id))
        .limit(1);

      const existing = existingResults[0];
      if (!existing) {
        throw new SylionError(ErrorCodes.ASSISTANT_NOT_FOUND, 'Assistant non trouvé', {
          details: { assistantId: id }
        });
      }

      // Ne pas permettre de supprimer l'assistant par défaut
      if (existing.isDefault) {
        throw new SylionError(ErrorCodes.VALIDATION_ERROR, 'Impossible de supprimer l\'assistant par défaut', {
          details: { assistantId: id }
        });
      }

      // Soft delete - désactiver l'assistant
      await tx
        .update(schema.assistants)
        .set({
          isActive: false,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.assistants.id, id));

      // Invalider les caches
      await deleteCache(cacheKeys.assistant(id));
      await deleteCache(cacheKeys.assistantsByTenant(existing.tenantId));
      await deleteCache(cacheKeys.activeAssistantsByTenant(existing.tenantId));

      logger.info('Assistant deleted successfully', { assistantId: id });
    });
  }

  /**
   * Définir un assistant comme défaut pour un tenant
   */
  async setDefaultAssistant(tenantId: string, assistantId: string): Promise<Assistant> {
    logger.info('Setting default assistant', { tenantId, assistantId });

    return await withTransaction(async (tx) => {
      // Vérifier l'existence de l'assistant et qu'il appartient au tenant
      const assistantResults = await tx
        .select()
        .from(schema.assistants)
        .where(and(
          eq(schema.assistants.id, assistantId),
          eq(schema.assistants.tenantId, tenantId),
          eq(schema.assistants.isActive, true)
        ))
        .limit(1);

      const assistant = assistantResults[0];
      if (!assistant) {
        throw new SylionError('Assistant non trouvé ou inactif', {
          details: { assistantId, tenantId }
        });
      }

      // Désactiver l'ancien assistant par défaut
      await tx
        .update(schema.assistants)
        .set({ isDefault: false })
        .where(and(
          eq(schema.assistants.tenantId, tenantId),
          eq(schema.assistants.isDefault, true)
        ));

      // Définir le nouvel assistant par défaut
      const results = await tx
        .update(schema.assistants)
        .set({
          isDefault: true,
          updatedAt: sql`NOW()`,
        })
        .where(eq(schema.assistants.id, assistantId))
        .returning();

      const updatedAssistant = results[0];
      if (!updatedAssistant) {
        throw new SylionError('Erreur lors de la définition de l\'assistant par défaut', {
          
        });
      }

      // Invalider les caches
      await deleteCache(cacheKeys.assistant(assistantId));
      await deleteCache(cacheKeys.assistantsByTenant(tenantId));
      await deleteCache(cacheKeys.activeAssistantsByTenant(tenantId));
      await deleteCache(cacheKeys.defaultAssistant(tenantId));

      logger.info('Default assistant set successfully', { 
        assistantId,
        tenantId
      });

      return updatedAssistant;
    });
  }
}

/**
 * Instance singleton du service
 */
export const assistantService = new AssistantService();