/**
 * ================================
 * Tenant Types - Sylion Backend
 * ================================
 * 
 * Types et interfaces pour la gestion des tenants.
 */

import { z } from 'zod';
import type { Tenant, NewTenant } from '@/db/schema';

/**
 * Schema de validation pour création d'un tenant
 */
export const CreateTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
  isActive: z.boolean().default(true),
  quotaMessages: z.number().min(0).max(1000000).default(1000),
  quotaAiRequests: z.number().min(0).max(100000).default(100),
  quotaStorageMb: z.number().min(0).max(10000).default(100),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(10).max(20).optional(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  webhookUrl: z.string().url().optional(),
  settings: z.record(z.any()).default({}),
});

/**
 * Schema de validation pour mise à jour d'un tenant
 */
export const UpdateTenantSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  isActive: z.boolean().optional(),
  quotaMessages: z.number().min(0).max(1000000).optional(),
  quotaAiRequests: z.number().min(0).max(100000).optional(),
  quotaStorageMb: z.number().min(0).max(10000).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(10).max(20).optional(),
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
  }).optional(),
  webhookUrl: z.string().url().optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * Schema de validation pour les quotas
 */
export const UpdateQuotasSchema = z.object({
  quotaMessages: z.number().min(0).max(1000000),
  quotaAiRequests: z.number().min(0).max(100000),
  quotaStorageMb: z.number().min(0).max(10000),
});

/**
 * Schema de validation pour les paramètres de recherche
 */
export const TenantSearchSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'createdAt', 'lastActiveAt', 'plan']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Types dérivés des schemas
 */
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>;
export type UpdateQuotasInput = z.infer<typeof UpdateQuotasSchema>;
export type TenantSearchInput = z.infer<typeof TenantSearchSchema>;

/**
 * Interface pour les statistiques d'un tenant
 */
export interface TenantStats {
  quotas: {
    messages: number;
    aiRequests: number;
    storageMb: number;
  };
  usage: {
    messages: number;
    aiRequests: number;
    storageMb: number;
  };
  stats: {
    totalChannels: number;
    totalAssistants: number;
    totalConversations: number;
  };
}

/**
 * Interface pour la réponse d'un tenant avec stats
 */
export interface TenantWithStats extends Omit<Tenant, 'settings' | 'billingAddress' | 'webhookUrl'> {
  stats: {
    usagePercentages: {
      messages: number;
      aiRequests: number;
      storage: number;
    };
  };
  contactPhone: string | null;
  billingAddress?: any;
  webhookUrl?: string | null;
  settings?: any;
}

/**
 * Interface pour la liste paginée de tenants
 */
export interface TenantListResponse {
  tenants: TenantWithStats[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Énumérations utiles
 */
export const TenantPlan = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const TenantStatus = {
  ACTIVE: true,
  INACTIVE: false,
} as const;

/**
 * Configuration des quotas par plan
 */
export const PlanQuotas = {
  [TenantPlan.FREE]: {
    quotaMessages: 1000,
    quotaAiRequests: 100,
    quotaStorageMb: 100,
  },
  [TenantPlan.PRO]: {
    quotaMessages: 10000,
    quotaAiRequests: 2000,
    quotaStorageMb: 1000,
  },
  [TenantPlan.ENTERPRISE]: {
    quotaMessages: 100000,
    quotaAiRequests: 20000,
    quotaStorageMb: 10000,
  },
} as const;