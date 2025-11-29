/**
 * ================================
 * Tenant Routes - Sylion Backend
 * ================================
 * 
 * Définition des routes pour la gestion des tenants.
 */

import { FastifyInstance } from 'fastify';
import { TenantController } from './tenant.controller';

/**
 * Enregistrement des routes pour les tenants
 */
export async function registerTenantRoutes(fastify: FastifyInstance): Promise<void> {
  const tenantController = new TenantController();

  // ================================
  // Routes CRUD de base
  // ================================

  // Créer un tenant
  fastify.post('/', {
    schema: {
      tags: ['Tenants'],
      summary: 'Create a new tenant',
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 255 },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$', minLength: 2, maxLength: 100 },
          plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          billingAddress: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              postalCode: { type: 'string' },
            },
          },
          webhookUrl: { type: 'string', format: 'uri' },
          settings: { type: 'object' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                isActive: { type: 'boolean' },
                plan: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
  }, tenantController.createTenant.bind(tenantController));

  // Récupérer un tenant par ID
  fastify.get('/:tenantId', {
    schema: {
      tags: ['Tenants'],
      summary: 'Get a tenant by ID',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              // Schema complet du tenant
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
  }, tenantController.getTenant.bind(tenantController));

  // Récupérer un tenant par slug
  fastify.get('/slug/:slug', {
    schema: {
      tags: ['Tenants'],
      summary: 'Get a tenant by slug',
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
  }, tenantController.getTenantBySlug.bind(tenantController));

  // Mettre à jour un tenant
  fastify.put('/:tenantId', {
    schema: {
      tags: ['Tenants'],
      summary: 'Update a tenant',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 255 },
          plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          billingAddress: { type: 'object' },
          webhookUrl: { type: 'string', format: 'uri' },
          settings: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
  }, tenantController.updateTenant.bind(tenantController));

  // Supprimer un tenant
  fastify.delete('/:tenantId', {
    schema: {
      tags: ['Tenants'],
      summary: 'Delete a tenant',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' },
          },
        },
      },
    },
  }, tenantController.deleteTenant.bind(tenantController));

  // ================================
  // Routes de recherche et listing
  // ================================

  // Rechercher des tenants
  fastify.get('/', {
    schema: {
      tags: ['Tenants'],
      summary: 'Search tenants with pagination',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'pro', 'enterprise'] },
          isActive: { type: 'boolean' },
          sortBy: { type: 'string', enum: ['name', 'createdAt', 'lastActiveAt', 'plan'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { type: 'object' },
            },
            meta: {
              type: 'object',
              properties: {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    pages: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, tenantController.searchTenants.bind(tenantController));

  // ================================
  // Routes spécialisées
  // ================================

  // Mettre à jour les quotas
  fastify.patch('/:tenantId/quotas', {
    schema: {
      tags: ['Tenants'],
      summary: 'Update tenant quotas',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['quotaMessages', 'quotaAiRequests', 'quotaStorageMb'],
        properties: {
          quotaMessages: { type: 'integer', minimum: 0, maximum: 1000000 },
          quotaAiRequests: { type: 'integer', minimum: 0, maximum: 100000 },
          quotaStorageMb: { type: 'integer', minimum: 0, maximum: 10000 },
        },
      },
    },
  }, tenantController.updateTenantQuotas.bind(tenantController));

  // Activer/désactiver un tenant
  fastify.patch('/:tenantId/status', {
    schema: {
      tags: ['Tenants'],
      summary: 'Toggle tenant status',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['isActive'],
        properties: {
          isActive: { type: 'boolean' },
        },
      },
    },
  }, tenantController.toggleTenantStatus.bind(tenantController));

  // Obtenir les statistiques d'un tenant
  fastify.get('/:tenantId/stats', {
    schema: {
      tags: ['Tenants'],
      summary: 'Get tenant statistics',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalChannels: { type: 'integer' },
                activeChannels: { type: 'integer' },
                totalAssistants: { type: 'integer' },
                totalConversations: { type: 'integer' },
                totalMessages: { type: 'integer' },
                usageCurrentMonth: {
                  type: 'object',
                  properties: {
                    messages: { type: 'integer' },
                    aiRequests: { type: 'integer' },
                    storageMb: { type: 'integer' },
                  },
                },
                quotaUsagePercent: {
                  type: 'object',
                  properties: {
                    messages: { type: 'number' },
                    aiRequests: { type: 'number' },
                    storage: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, tenantController.getTenantStats.bind(tenantController));

  // Vérifier les quotas
  fastify.get('/:tenantId/quota/check', {
    schema: {
      tags: ['Tenants'],
      summary: 'Check tenant quota availability',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['messages', 'aiRequests', 'storage'] },
          amount: { type: 'integer', minimum: 1, default: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                tenantId: { type: 'string' },
                type: { type: 'string' },
                amount: { type: 'integer' },
                canProceed: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, tenantController.checkTenantQuota.bind(tenantController));
}