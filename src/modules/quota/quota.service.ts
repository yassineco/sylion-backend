/**
 * ================================
 * Quota Service - Sylion Backend
 * ================================
 * 
 * Service pour la gestion des quotas et limites par plan.
 * Vérifie les limites avant les opérations et incrémente les compteurs.
 * 
 * @module modules/quota/quota.service
 */

import { db, schema } from '@/db/index';
import type { PlanLimits } from '@/db/schema';
import { logger } from '@/lib/logger';
import { and, eq, sql } from 'drizzle-orm';
import {
    DEFAULT_PLAN_LIMITS,
    QuotaError,
    QuotaErrorCode,
    type CounterType,
    type DailyUsage,
    type PlanCode,
    type QuotaCheckResult,
    type TenantQuotaContext,
} from './quota.types';

/**
 * Obtenir la date du jour au format YYYY-MM-DD
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Récupérer les limites d'un plan depuis la base de données
 * Fallback sur les limites par défaut si le plan n'existe pas en DB
 */
export async function getPlanLimits(planCode: string): Promise<PlanLimits> {
  try {
    const planRows = await db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.code, planCode))
      .limit(1);

    if (planRows.length > 0 && planRows[0]) {
      const plan = planRows[0];
      const limitsJson = plan.limitsJson as PlanLimits;
      
      // Fusionner avec les defaults pour éviter les valeurs manquantes
      return {
        ...DEFAULT_PLAN_LIMITS[planCode as PlanCode] || DEFAULT_PLAN_LIMITS.starter,
        ...limitsJson,
      };
    }

    // Fallback sur les limites par défaut
    return DEFAULT_PLAN_LIMITS[planCode as PlanCode] || DEFAULT_PLAN_LIMITS.starter;
  } catch (error) {
    logger.error('Error fetching plan limits', { planCode, error });
    return DEFAULT_PLAN_LIMITS[planCode as PlanCode] || DEFAULT_PLAN_LIMITS.starter;
  }
}

/**
 * Récupérer les limites du tenant
 */
export async function getTenantLimits(tenantId: string): Promise<TenantQuotaContext> {
  // Récupérer le tenant
  const tenantRows = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1);

  if (!tenantRows.length || !tenantRows[0]) {
    throw new QuotaError(
      'Tenant not found',
      QuotaErrorCode.TENANT_NOT_FOUND,
      { tenantId }
    );
  }

  const tenant = tenantRows[0];
  const planCode = (tenant.planCode || 'starter') as PlanCode;
  
  // Récupérer les limites du plan
  const limits = await getPlanLimits(planCode);

  // Récupérer l'usage journalier
  const dailyUsage = await getDailyUsage(tenantId);

  return {
    tenantId,
    planCode,
    limits,
    currentDocumentsCount: tenant.documentsCount,
    currentStorageMb: parseFloat(tenant.documentsStorageMb as string) || 0,
    dailyUsage,
  };
}

/**
 * Récupérer les compteurs d'usage journaliers du tenant
 */
export async function getDailyUsage(tenantId: string): Promise<DailyUsage> {
  const today = getTodayDate();

  const usageRows = await db
    .select()
    .from(schema.usageCountersDaily)
    .where(
      and(
        eq(schema.usageCountersDaily.tenantId, tenantId),
        eq(schema.usageCountersDaily.date, today)
      )
    )
    .limit(1);

  if (usageRows.length > 0 && usageRows[0]) {
    const usage = usageRows[0];
    return {
      docsIndexedCount: usage.docsIndexedCount,
      ragQueriesCount: usage.ragQueriesCount,
      messagesCount: usage.messagesCount,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      aiRequestsCount: usage.aiRequestsCount,
      storageBytesAdded: usage.storageBytesAdded,
    };
  }

  // Pas encore de compteur pour aujourd'hui
  return {
    docsIndexedCount: 0,
    ragQueriesCount: 0,
    messagesCount: 0,
    tokensIn: 0,
    tokensOut: 0,
    aiRequestsCount: 0,
    storageBytesAdded: 0,
  };
}

/**
 * Vérifier si le tenant peut uploader un document
 */
export async function assertCanUploadDocument(
  tenantId: string,
  fileSizeBytes: number
): Promise<void> {
  const context = await getTenantLimits(tenantId);
  const { limits, currentDocumentsCount, currentStorageMb } = context;

  // Vérifier si RAG est activé
  if (!limits.ragEnabled) {
    throw new QuotaError(
      'RAG is not enabled for your plan',
      QuotaErrorCode.RAG_DISABLED,
      { planCode: context.planCode }
    );
  }

  // Vérifier la taille du fichier
  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  if (limits.maxDocSizeMb > 0 && fileSizeMb > limits.maxDocSizeMb) {
    throw new QuotaError(
      `File size ${fileSizeMb.toFixed(2)}MB exceeds maximum allowed ${limits.maxDocSizeMb}MB`,
      QuotaErrorCode.DOCUMENT_TOO_LARGE,
      { fileSizeMb, maxDocSizeMb: limits.maxDocSizeMb }
    );
  }

  // Vérifier le nombre de documents
  if (limits.maxDocuments > 0 && currentDocumentsCount >= limits.maxDocuments) {
    throw new QuotaError(
      `Document limit reached: ${currentDocumentsCount}/${limits.maxDocuments}`,
      QuotaErrorCode.DOCUMENTS_LIMIT_REACHED,
      { currentDocumentsCount, maxDocuments: limits.maxDocuments }
    );
  }

  // Vérifier le storage total
  const newStorageMb = currentStorageMb + fileSizeMb;
  if (limits.maxStorageMb > 0 && newStorageMb > limits.maxStorageMb) {
    throw new QuotaError(
      `Storage limit would be exceeded: ${newStorageMb.toFixed(2)}MB/${limits.maxStorageMb}MB`,
      QuotaErrorCode.STORAGE_LIMIT_REACHED,
      { currentStorageMb, newStorageMb, maxStorageMb: limits.maxStorageMb }
    );
  }

  logger.debug('Upload allowed', {
    tenantId,
    fileSizeMb,
    currentDocumentsCount,
    currentStorageMb,
  });
}

/**
 * Vérifier si le tenant peut indexer un document
 */
export async function assertCanIndexDocument(tenantId: string): Promise<void> {
  const context = await getTenantLimits(tenantId);
  const { limits, dailyUsage } = context;

  // Vérifier si RAG est activé
  if (!limits.ragEnabled) {
    throw new QuotaError(
      'RAG is not enabled for your plan',
      QuotaErrorCode.RAG_DISABLED,
      { planCode: context.planCode }
    );
  }

  // Vérifier la limite d'indexation journalière
  if (limits.maxDailyIndexing > 0 && dailyUsage.docsIndexedCount >= limits.maxDailyIndexing) {
    throw new QuotaError(
      `Daily indexing limit reached: ${dailyUsage.docsIndexedCount}/${limits.maxDailyIndexing}`,
      QuotaErrorCode.DAILY_LIMIT_REACHED,
      { 
        currentCount: dailyUsage.docsIndexedCount, 
        maxDailyIndexing: limits.maxDailyIndexing,
        type: 'indexing'
      }
    );
  }

  logger.debug('Indexing allowed', {
    tenantId,
    dailyIndexedCount: dailyUsage.docsIndexedCount,
    maxDailyIndexing: limits.maxDailyIndexing,
  });
}

/**
 * Vérifier si le tenant peut exécuter une requête RAG
 */
export async function assertCanRunRagQuery(tenantId: string): Promise<void> {
  const context = await getTenantLimits(tenantId);
  const { limits, dailyUsage } = context;

  // Vérifier si RAG est activé
  if (!limits.ragEnabled) {
    throw new QuotaError(
      'RAG is not enabled for your plan',
      QuotaErrorCode.RAG_DISABLED,
      { planCode: context.planCode }
    );
  }

  // Vérifier la limite de requêtes RAG journalières
  if (limits.maxDailyRagQueries > 0 && dailyUsage.ragQueriesCount >= limits.maxDailyRagQueries) {
    throw new QuotaError(
      `Daily RAG queries limit reached: ${dailyUsage.ragQueriesCount}/${limits.maxDailyRagQueries}`,
      QuotaErrorCode.DAILY_LIMIT_REACHED,
      { 
        currentCount: dailyUsage.ragQueriesCount, 
        maxDailyRagQueries: limits.maxDailyRagQueries,
        type: 'rag_queries'
      }
    );
  }

  logger.debug('RAG query allowed', {
    tenantId,
    dailyRagQueriesCount: dailyUsage.ragQueriesCount,
    maxDailyRagQueries: limits.maxDailyRagQueries,
  });
}

/**
 * Vérifier si le tenant peut envoyer un message
 */
export async function assertCanSendMessage(tenantId: string): Promise<void> {
  const context = await getTenantLimits(tenantId);
  const { limits, dailyUsage } = context;

  // Vérifier la limite de messages journaliers
  if (limits.maxDailyMessages > 0 && dailyUsage.messagesCount >= limits.maxDailyMessages) {
    throw new QuotaError(
      `Daily messages limit reached: ${dailyUsage.messagesCount}/${limits.maxDailyMessages}`,
      QuotaErrorCode.DAILY_LIMIT_REACHED,
      { 
        currentCount: dailyUsage.messagesCount, 
        maxDailyMessages: limits.maxDailyMessages,
        type: 'messages'
      }
    );
  }

  logger.debug('Message allowed', {
    tenantId,
    dailyMessagesCount: dailyUsage.messagesCount,
    maxDailyMessages: limits.maxDailyMessages,
  });
}

/**
 * Incrémenter un compteur journalier
 */
export async function incrementDailyCounter(
  tenantId: string,
  counterType: CounterType,
  amount: number = 1
): Promise<void> {
  const today = getTodayDate();

  try {
    // Mapping des types de compteurs vers les colonnes
    const columnMap: Record<CounterType, string> = {
      'docs_indexed': 'docs_indexed_count',
      'rag_queries': 'rag_queries_count',
      'messages': 'messages_count',
      'messages_inbound': 'messages_inbound',
      'messages_outbound': 'messages_outbound',
      'tokens_in': 'tokens_in',
      'tokens_out': 'tokens_out',
      'ai_requests': 'ai_requests_count',
      'storage_bytes': 'storage_bytes_added',
    };

    const column = columnMap[counterType];

    // Upsert: créer si n'existe pas, sinon incrémenter
    await db.execute(sql`
      INSERT INTO usage_counters_daily (id, tenant_id, date, ${sql.raw(column)}, created_at, updated_at)
      VALUES (gen_random_uuid(), ${tenantId}, ${today}::date, ${amount}, NOW(), NOW())
      ON CONFLICT (tenant_id, date) 
      DO UPDATE SET 
        ${sql.raw(column)} = usage_counters_daily.${sql.raw(column)} + ${amount},
        updated_at = NOW()
    `);

    logger.debug('Daily counter incremented', {
      tenantId,
      counterType,
      amount,
      date: today,
    });
  } catch (error) {
    logger.error('Failed to increment daily counter', {
      tenantId,
      counterType,
      amount,
      error,
    });
    // Ne pas throw - l'incrémentation des compteurs ne doit pas bloquer l'opération
  }
}

/**
 * Mettre à jour les compteurs de documents du tenant
 */
export async function updateTenantDocumentStats(
  tenantId: string,
  documentsDelta: number,
  storageMbDelta: number
): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE tenants
      SET 
        documents_count = documents_count + ${documentsDelta},
        documents_storage_mb = documents_storage_mb + ${storageMbDelta},
        updated_at = NOW()
      WHERE id = ${tenantId}
    `);

    logger.debug('Tenant document stats updated', {
      tenantId,
      documentsDelta,
      storageMbDelta,
    });
  } catch (error) {
    logger.error('Failed to update tenant document stats', {
      tenantId,
      documentsDelta,
      storageMbDelta,
      error,
    });
  }
}

/**
 * Vérifier les quotas (version générique pour check sans throw)
 */
export async function checkQuota(
  tenantId: string,
  checkType: 'upload' | 'index' | 'rag_query' | 'message',
  options: { fileSizeBytes?: number } = {}
): Promise<QuotaCheckResult> {
  try {
    switch (checkType) {
      case 'upload':
        await assertCanUploadDocument(tenantId, options.fileSizeBytes || 0);
        break;
      case 'index':
        await assertCanIndexDocument(tenantId);
        break;
      case 'rag_query':
        await assertCanRunRagQuery(tenantId);
        break;
      case 'message':
        await assertCanSendMessage(tenantId);
        break;
    }
    return { allowed: true };
  } catch (error) {
    if (error instanceof QuotaError) {
      return {
        allowed: false,
        reason: error.message,
        currentUsage: error.details?.currentCount as number,
        limit: error.details?.maxDailyIndexing as number || 
               error.details?.maxDailyRagQueries as number ||
               error.details?.maxDailyMessages as number,
      };
    }
    throw error;
  }
}

/**
 * Export du service quota comme singleton
 */
export const quotaService = {
  getPlanLimits,
  getTenantLimits,
  getDailyUsage,
  assertCanUploadDocument,
  assertCanIndexDocument,
  assertCanRunRagQuery,
  assertCanSendMessage,
  incrementDailyCounter,
  updateTenantDocumentStats,
  checkQuota,
};
