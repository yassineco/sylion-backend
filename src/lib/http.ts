/**
 * ================================
 * HTTP Utils & Error Handling
 * ================================
 */

import { FastifyReply } from 'fastify';
import { logger } from '@/lib/logger';

/**
 * Codes d'erreur standardisés pour Sylion
 */
export enum ErrorCodes {
  // Erreurs générales
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  BAD_REQUEST = 'BAD_REQUEST',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Erreurs métier - Tenant
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_INACTIVE = 'TENANT_INACTIVE',
  TENANT_QUOTA_EXCEEDED = 'TENANT_QUOTA_EXCEEDED',
  TENANT_CREATE_FAILED = 'TENANT_CREATE_FAILED',
  TENANT_SLUG_EXISTS = 'TENANT_SLUG_EXISTS',
  
  // Erreurs métier - Channel
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  CHANNEL_INACTIVE = 'CHANNEL_INACTIVE',
  CHANNEL_CONFIG_INVALID = 'CHANNEL_CONFIG_INVALID',
  
  // Erreurs métier - Assistant
  ASSISTANT_NOT_FOUND = 'ASSISTANT_NOT_FOUND',
  ASSISTANT_CONFIG_INVALID = 'ASSISTANT_CONFIG_INVALID',
  
  // Erreurs métier - Conversation
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  CONVERSATION_ENDED = 'CONVERSATION_ENDED',
  
  // Erreurs métier - Message
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  MESSAGE_PROCESSING_FAILED = 'MESSAGE_PROCESSING_FAILED',
  
  // Erreurs intégrations
  WHATSAPP_API_ERROR = 'WHATSAPP_API_ERROR',
  VERTEX_AI_ERROR = 'VERTEX_AI_ERROR',
  RAG_ERROR = 'RAG_ERROR',
  
  // Erreurs infrastructure
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
  
  // Gestion des quotas
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  QUOTA_INVALID = 'QUOTA_INVALID',
}

export type ErrorCode = ErrorCodes;

/**
 * Interface pour les réponses d'erreur standardisées
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
    requestId?: string;
    timestamp: string;
  };
}

/**
 * Interface pour les réponses de succès standardisées
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  metadata?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    requestId?: string;
    timestamp: string;
  };
}

/**
 * Interface pour le contexte de logging
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * Classe d'erreur personnalisée pour Sylion
 */
export class SylionError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SylionError';
    this.code = code;
    this.details = details || {};
    this.timestamp = new Date().toISOString();
    
    // Préserver la stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SylionError);
    }
  }
}

/**
 * Fonction pour envoyer une réponse de succès standardisée
 */
export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode: number = 200,
  metadata?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    requestId?: string;
    timestamp?: string;
  }
): FastifyReply {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    metadata: {
      ...metadata,
      timestamp: metadata?.timestamp || new Date().toISOString(),
    },
  };

  return reply.status(statusCode).send(response);
}

/**
 * Fonction pour mapper les codes d'erreur aux statuts HTTP
 */
export function getHttpStatusCode(errorCode: ErrorCode): number {
  const statusCodeMap: Record<ErrorCode, number> = {
    // 400 - Bad Request
    [ErrorCodes.VALIDATION_ERROR]: 400,
    [ErrorCodes.BAD_REQUEST]: 400,
    [ErrorCodes.CHANNEL_CONFIG_INVALID]: 400,
    [ErrorCodes.ASSISTANT_CONFIG_INVALID]: 400,
    [ErrorCodes.TENANT_CREATE_FAILED]: 400,
    [ErrorCodes.TENANT_SLUG_EXISTS]: 400,
    
    // 401 - Unauthorized
    [ErrorCodes.UNAUTHORIZED]: 401,
    
    // 403 - Forbidden
    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.TENANT_INACTIVE]: 403,
    [ErrorCodes.CHANNEL_INACTIVE]: 403,
    
    // 404 - Not Found
    [ErrorCodes.NOT_FOUND]: 404,
    [ErrorCodes.TENANT_NOT_FOUND]: 404,
    [ErrorCodes.CHANNEL_NOT_FOUND]: 404,
    [ErrorCodes.ASSISTANT_NOT_FOUND]: 404,
    [ErrorCodes.CONVERSATION_NOT_FOUND]: 404,
    [ErrorCodes.MESSAGE_NOT_FOUND]: 404,
    
    // 409 - Conflict
    [ErrorCodes.CONVERSATION_ENDED]: 409,
    
    // 429 - Too Many Requests
    [ErrorCodes.TOO_MANY_REQUESTS]: 429,
    [ErrorCodes.TENANT_QUOTA_EXCEEDED]: 429,
    [ErrorCodes.QUOTA_EXCEEDED]: 429,
    
    // 500 - Internal Server Error
    [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
    [ErrorCodes.DATABASE_ERROR]: 500,
    [ErrorCodes.REDIS_ERROR]: 500,
    [ErrorCodes.QUEUE_ERROR]: 500,
    [ErrorCodes.WHATSAPP_API_ERROR]: 500,
    [ErrorCodes.VERTEX_AI_ERROR]: 500,
    [ErrorCodes.RAG_ERROR]: 500,
    [ErrorCodes.MESSAGE_PROCESSING_FAILED]: 500,
    [ErrorCodes.QUOTA_INVALID]: 500,
  };

  return statusCodeMap[errorCode] || 500;
}

/**
 * Fonction pour envoyer une réponse d'erreur standardisée
 */
export function sendError(
  reply: FastifyReply,
  code: ErrorCode,
  message: string,
  details?: Record<string, any>,
  requestId?: string
): FastifyReply {
  const httpStatus = getHttpStatusCode(code);

  logger.error(`HTTP Error ${httpStatus}`, {
    errorCode: code,
    statusCode: httpStatus,
    message,
    details: details || {},
    requestId: requestId || '',
  });

  return reply.status(httpStatus).send({
    success: false,
    error: {
      code,
      message,
      details: details || {},
      requestId: requestId || '',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Fonction pour envoyer une erreur depuis une SylionError
 */
export function sendSylionError(
  reply: FastifyReply,
  error: SylionError,
  requestId?: string
): FastifyReply {
  return sendError(
    reply,
    error.code,
    error.message,
    error.details,
    requestId
  );
}

/**
 * Helper pour valider que l'utilisateur est authentifié
 */
export function requireAuth(user?: any): void {
  if (!user) {
    throw new SylionError(
      ErrorCodes.UNAUTHORIZED,
      'Authentification requise'
    );
  }
}

/**
 * Helper pour valider les permissions
 */
export function requirePermission(
  user: any,
  permission: string
): void {
  requireAuth(user);
  
  if (!user.permissions?.includes(permission)) {
    throw new SylionError(
      ErrorCodes.FORBIDDEN,
      `Permission requise: ${permission}`
    );
  }
}

/**
 * Helper pour créer une pagination standardisée
 */
export function createPaginationMeta(
  params: { page: number; limit: number; total: number }
) {
  const { page, limit, total } = params;
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages: totalPages,
  };
}

/**
 * Generate unique request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract request ID from request object
 */
export function extractRequestId(request: any): string {
  return request.requestId || request.id || generateRequestId();
}

/**
 * Validate pagination parameters - alias for parsePagination
 */
export const validatePagination = parsePagination;

/**
 * Helper pour valider et parser une pagination
 */
export function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Middleware d'erreur globale pour Fastify
 */
export function errorHandler(
  error: Error,
  request: any,
  reply: FastifyReply
) {
  // Si c'est une SylionError, la traiter spécialement
  if (error instanceof SylionError) {
    return sendSylionError(reply, error, request.id);
  }

  // Pour les erreurs de validation Fastify
  if ((error as any).statusCode === 400) {
    return sendError(
      reply,
      ErrorCodes.VALIDATION_ERROR,
      'Données invalides',
      { validation: error.message },
      request.id
    );
  }

  // Pour les autres erreurs
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    requestId: request.id,
    url: request.url,
    method: request.method,
  });

  return sendError(
    reply,
    ErrorCodes.INTERNAL_SERVER_ERROR,
    'Une erreur interne est survenue',
    undefined,
    request.id
  );
}