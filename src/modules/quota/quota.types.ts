/**
 * ================================
 * Quota Types - Sylion Backend
 * ================================
 * 
 * Types et interfaces pour le système de quotas.
 * 
 * @module modules/quota/quota.types
 */

import type { PlanLimits } from '@/db/schema';

/**
 * Codes des plans disponibles
 */
export type PlanCode = 'starter' | 'pro' | 'business' | 'enterprise';

/**
 * Limites par défaut pour chaque plan
 */
export const DEFAULT_PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
  starter: {
    maxDocuments: 10,
    maxStorageMb: 50,
    maxDocSizeMb: 5,
    maxDailyIndexing: 5,
    maxDailyRagQueries: 100,
    maxDailyMessages: 500,
    maxTokensIn: 100000,
    maxTokensOut: 50000,
    ragEnabled: true,
    prioritySupport: false,
    customBranding: false,
  },
  pro: {
    maxDocuments: 100,
    maxStorageMb: 500,
    maxDocSizeMb: 25,
    maxDailyIndexing: 50,
    maxDailyRagQueries: 1000,
    maxDailyMessages: 5000,
    maxTokensIn: 1000000,
    maxTokensOut: 500000,
    ragEnabled: true,
    prioritySupport: true,
    customBranding: false,
  },
  business: {
    maxDocuments: 500,
    maxStorageMb: 2000,
    maxDocSizeMb: 50,
    maxDailyIndexing: 200,
    maxDailyRagQueries: 5000,
    maxDailyMessages: 25000,
    maxTokensIn: 5000000,
    maxTokensOut: 2500000,
    ragEnabled: true,
    prioritySupport: true,
    customBranding: true,
  },
  enterprise: {
    maxDocuments: -1, // Illimité
    maxStorageMb: -1,
    maxDocSizeMb: 100,
    maxDailyIndexing: -1,
    maxDailyRagQueries: -1,
    maxDailyMessages: -1,
    maxTokensIn: -1,
    maxTokensOut: -1,
    ragEnabled: true,
    prioritySupport: true,
    customBranding: true,
  },
};

/**
 * Compteurs d'usage journaliers
 */
export interface DailyUsage {
  docsIndexedCount: number;
  ragQueriesCount: number;
  messagesCount: number;
  tokensIn: number;
  tokensOut: number;
  aiRequestsCount: number;
  storageBytesAdded: number;
}

/**
 * Résultat de la vérification des quotas
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
  remaining?: number;
}

/**
 * Contexte du tenant avec ses limites
 */
export interface TenantQuotaContext {
  tenantId: string;
  planCode: PlanCode;
  limits: PlanLimits;
  currentDocumentsCount: number;
  currentStorageMb: number;
  dailyUsage: DailyUsage;
}

/**
 * Types de compteurs à incrémenter
 */
export type CounterType = 
  | 'docs_indexed'
  | 'rag_queries'
  | 'messages'
  | 'messages_inbound'
  | 'messages_outbound'
  | 'tokens_in'
  | 'tokens_out'
  | 'ai_requests'
  | 'storage_bytes';

/**
 * Codes d'erreur pour les quotas
 */
export enum QuotaErrorCode {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  RAG_DISABLED = 'RAG_DISABLED',
  DOCUMENT_TOO_LARGE = 'DOCUMENT_TOO_LARGE',
  DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED',
  STORAGE_LIMIT_REACHED = 'STORAGE_LIMIT_REACHED',
  DOCUMENTS_LIMIT_REACHED = 'DOCUMENTS_LIMIT_REACHED',
}

/**
 * Erreur spécifique aux quotas
 */
export class QuotaError extends Error {
  constructor(
    message: string,
    public readonly code: QuotaErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'QuotaError';
  }
}
