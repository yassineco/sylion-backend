/**
 * ================================
 * Security Helpers - Sylion Backend
 * ================================
 * 
 * Utilitaires de sécurité pour l'isolation multi-tenant.
 */

import { ErrorCodes, SylionError } from './http';

/**
 * Interface pour les entités appartenant à un tenant
 */
export interface TenantOwnedEntity {
  tenantId: string;
}

/**
 * Vérifier que l'entité appartient bien au tenant
 */
export function assertTenantOwnership<T extends TenantOwnedEntity>(
  entity: T | null | undefined,
  tenantId: string,
  entityType: string = 'Resource'
): T {
  if (!entity) {
    throw new SylionError(
      ErrorCodes.NOT_FOUND, 
      `${entityType} non trouvé`,
      { details: { tenantId } }
    );
  }

  if (entity.tenantId !== tenantId) {
    throw new SylionError(
      ErrorCodes.FORBIDDEN,
      `Accès interdit : cette ressource n'appartient pas à votre tenant`,
      { details: { tenantId, resourceTenantId: entity.tenantId } }
    );
  }

  return entity;
}

/**
 * Extraire le tenantId depuis l'objet request
 * Utilise plusieurs stratégies pour récupérer le tenantId
 */
export function extractTenantId(request: any): string {
  // Strategy 1: tenantId dans les params de route
  if (request.params?.tenantId) {
    return request.params.tenantId;
  }

  // Strategy 2: tenantId dans le contexte d'authentification (futur)
  if (request.auth?.tenant?.id) {
    return request.auth.tenant.id;
  }

  // Strategy 3: tenantId dans les headers (pour les webhooks)
  if (request.headers['x-tenant-id']) {
    return request.headers['x-tenant-id'];
  }

  // Strategy 4: tenantId dans le query (fallback)
  if (request.query?.tenantId) {
    return request.query.tenantId;
  }

  throw new SylionError(
    ErrorCodes.BAD_REQUEST,
    'TenantId manquant dans la requête',
    { details: { availableParams: Object.keys(request.params || {}) } }
  );
}