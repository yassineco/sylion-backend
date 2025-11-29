/**
 * ================================
 * Tenant Controller - Sylion Backend
 * ================================
 * 
 * Controller pour la gestion des tenants.
 * Gère les requêtes HTTP et délègue à TenantService.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendError, sendSylionError, ErrorCodes } from '@/lib/http';
import { logger } from '@/lib/logger';
import { TenantService } from './tenant.service';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  UpdateQuotasSchema,
  TenantSearchSchema,
  type CreateTenantInput,
  type UpdateTenantInput,
  type UpdateQuotasInput,
  type TenantSearchInput,
} from './tenant.types';

/**
 * Controller pour la gestion des tenants
 */
export class TenantController {
  private tenantService = new TenantService();

  /**
   * Créer un nouveau tenant
   */
  async createTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const data = CreateTenantSchema.parse(request.body);
      
      const tenant = await this.tenantService.createTenant(data);
      
      logger.info('Tenant created via API', { 
        tenantId: tenant.id,
        requestId: request.requestId,
      });
      
      return sendSuccess(reply, tenant, 201);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create tenant',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Récupérer un tenant par ID
   */
  async getTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      const tenant = await this.tenantService.getTenantById(tenantId);
      
      return sendSuccess(reply, tenant);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to get tenant',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Récupérer un tenant par slug
   */
  async getTenantBySlug(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { slug } = request.params as { slug: string };
      
      const tenant = await this.tenantService.getTenantBySlug(slug);
      
      return sendSuccess(reply, tenant);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to get tenant',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Mettre à jour un tenant
   */
  async updateTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const data = UpdateTenantSchema.parse(request.body);
      
      const tenant = await this.tenantService.updateTenant(tenantId, data);
      
      logger.info('Tenant updated via API', { 
        tenantId,
        requestId: request.requestId,
      });
      
      return sendSuccess(reply, tenant);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to update tenant',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Mettre à jour les quotas d'un tenant
   */
  async updateTenantQuotas(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const data = UpdateQuotasSchema.parse(request.body);
      
      const tenant = await this.tenantService.updateTenantQuotas(tenantId, data);
      
      logger.info('Tenant quotas updated via API', { 
        tenantId,
        requestId: request.requestId,
      });
      
      return sendSuccess(reply, tenant);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to update tenant quotas',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Activer/désactiver un tenant
   */
  async toggleTenantStatus(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const { isActive } = request.body as { isActive: boolean };
      
      const tenant = await this.tenantService.toggleTenantStatus(tenantId, isActive);
      
      logger.info('Tenant status toggled via API', { 
        tenantId,
        isActive,
        requestId: request.requestId,
      });
      
      return sendSuccess(reply, tenant);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to toggle tenant status',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Rechercher des tenants
   */
  async searchTenants(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const params = TenantSearchSchema.parse(request.query);
      
      const result = await this.tenantService.searchTenants(params);
      
      return sendSuccess(reply, result.tenants, 200, {
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to search tenants',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Obtenir les statistiques d'un tenant
   */
  async getTenantStats(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      const stats = await this.tenantService.getTenantStats(tenantId);
      
      return sendSuccess(reply, stats);
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to get tenant stats',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Vérifier les quotas d'un tenant
   */
  async checkTenantQuota(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const { type, amount = 1 } = request.query as { type: 'messages' | 'aiRequests' | 'storage'; amount?: number };
      
      if (!['messages', 'aiRequests', 'storage'].includes(type)) {
        return sendError(
          reply,
          ErrorCodes.VALIDATION_ERROR,
          'Invalid quota type. Must be messages, aiRequests, or storage',
          400,
          undefined,
          request.requestId
        );
      }
      
      const canProceed = await this.tenantService.checkQuota(tenantId, type, Number(amount));
      
      return sendSuccess(reply, {
        tenantId,
        type,
        amount: Number(amount),
        canProceed,
      });
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to check tenant quota',
        500,
        undefined,
        request.requestId
      );
    }
  }

  /**
   * Supprimer un tenant
   */
  async deleteTenant(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      
      await this.tenantService.deleteTenant(tenantId);
      
      logger.info('Tenant deleted via API', { 
        tenantId,
        requestId: request.requestId,
      });
      
      return sendSuccess(reply, { 
        message: 'Tenant deleted successfully',
        tenantId,
      });
    } catch (error) {
      if (error instanceof Error) {
        return sendSylionError(reply, error as any, request.requestId);
      }
      return sendError(
        reply,
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to delete tenant',
        500,
        undefined,
        request.requestId
      );
    }
  }
}