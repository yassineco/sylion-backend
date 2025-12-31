/**
 * ================================
 * Knowledge Routes - Admin API
 * ================================
 * 
 * Routes pour la gestion des documents de connaissances (RAG admin).
 * 
 * @module modules/admin/knowledge.routes
 */

import { ErrorCodes, sendError, sendSuccess } from '@/lib/http';
import { logger } from '@/lib/logger';
import { QuotaError } from '@/modules/quota';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { knowledgeService } from './knowledge.service';
import type {
    KnowledgeDocumentSearchParams,
    KnowledgeDocumentUploadInput,
} from './knowledge.types';

/**
 * Extraire le tenantId depuis les headers ou params
 */
function getTenantId(request: FastifyRequest): string {
  // En mode admin, on peut passer le tenantId en header ou en query
  const tenantId = (request.headers['x-tenant-id'] as string) ||
    (request.query as any).tenantId;

  if (!tenantId) {
    throw new Error('Missing tenant ID');
  }

  return tenantId;
}

/**
 * Mapper les types MIME vers les types de document
 */
function getDocTypeFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'text/plain': 'txt',
    'text/markdown': 'md',
    'text/html': 'html',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/json': 'json',
  };
  return mimeMap[mimeType] || 'txt';
}

/**
 * Enregistrement des routes knowledge admin
 */
export async function registerKnowledgeRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ================================
  // GET /documents - Lister les documents
  // ================================
  fastify.get('/documents', {
    schema: {
      tags: ['Admin - Knowledge'],
      summary: 'List knowledge documents',
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status: { type: 'string', enum: ['uploaded', 'indexing', 'indexed', 'error'] },
          type: { type: 'string' },
          search: { type: 'string' },
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
                documents: { type: 'array' },
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                pages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const params = request.query as KnowledgeDocumentSearchParams;
      
      const result = await knowledgeService.listDocuments(tenantId, params);
      
      return sendSuccess(reply, result);
    } catch (error) {
      logger.error('Failed to list documents', { error });
      return sendError(reply, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to list documents');
    }
  });

  // ================================
  // GET /documents/:id - Récupérer un document
  // ================================
  fastify.get('/documents/:id', {
    schema: {
      tags: ['Admin - Knowledge'],
      summary: 'Get a knowledge document by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      
      const document = await knowledgeService.getDocumentById(tenantId, id);
      
      if (!document) {
        return sendError(reply, ErrorCodes.NOT_FOUND, 'Document not found');
      }
      
      return sendSuccess(reply, document);
    } catch (error) {
      logger.error('Failed to get document', { error });
      return sendError(reply, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get document');
    }
  });

  // ================================
  // POST /documents - Upload documents (multipart)
  // ================================
  fastify.post('/documents', {
    schema: {
      tags: ['Admin - Knowledge'],
      summary: 'Upload knowledge documents',
      consumes: ['multipart/form-data'],
    },
  }, async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const parts = request.parts();
      
      const documentsToUpload: KnowledgeDocumentUploadInput[] = [];
      let uploadedBy: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file') {
          // C'est un fichier
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const content = buffer.toString('utf8');
          
          documentsToUpload.push({
            name: part.filename || 'untitled',
            originalName: part.filename || 'untitled',
            type: getDocTypeFromMime(part.mimetype),
            mimeType: part.mimetype,
            sizeBytes: buffer.length,
            content,
            uploadedBy,
          });
        } else if (part.fieldname === 'uploadedBy') {
          // Champ uploadedBy
          uploadedBy = part.value as string;
        }
      }

      if (documentsToUpload.length === 0) {
        return sendError(reply, ErrorCodes.BAD_REQUEST, 'No files provided');
      }

      // Ajouter uploadedBy à tous les documents
      for (const doc of documentsToUpload) {
        doc.uploadedBy = uploadedBy;
      }

      const result = await knowledgeService.uploadMultipleDocuments(tenantId, documentsToUpload);
      
      // Enqueue les jobs d'indexation pour les documents uploadés avec succès
      const { addJob } = await import('@/jobs/index');
      for (const doc of result.successful) {
        await addJob('rag:index-document', {
          tenantId,
          documentId: doc.id,
          documentUrl: '', // Storage URI sera lu depuis le document
          metadata: {
            name: doc.name,
            type: 'txt',
            size: 0,
            uploadedBy: uploadedBy || 'admin',
          },
        });
      }
      
      return sendSuccess(reply, result, 201);
    } catch (error) {
      if (error instanceof QuotaError) {
        return sendError(reply, ErrorCodes.QUOTA_EXCEEDED, error.message, error.details);
      }
      logger.error('Failed to upload documents', { error });
      return sendError(reply, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to upload documents');
    }
  });

  // ================================
  // DELETE /documents/:id - Supprimer un document
  // ================================
  fastify.delete('/documents/:id', {
    schema: {
      tags: ['Admin - Knowledge'],
      summary: 'Delete a knowledge document',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      
      const deleted = await knowledgeService.deleteDocument(tenantId, id);
      
      if (!deleted) {
        return sendError(reply, ErrorCodes.NOT_FOUND, 'Document not found');
      }
      
      return sendSuccess(reply, { deleted: true, id });
    } catch (error) {
      logger.error('Failed to delete document', { error });
      return sendError(reply, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete document');
    }
  });

  // ================================
  // POST /documents/:id/reindex - Réindexer un document
  // ================================
  fastify.post('/documents/:id/reindex', {
    schema: {
      tags: ['Admin - Knowledge'],
      summary: 'Reindex a knowledge document',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      const { id } = request.params as { id: string };
      
      // Vérifier que le document existe
      const document = await knowledgeService.getDocumentById(tenantId, id);
      if (!document) {
        return sendError(reply, ErrorCodes.NOT_FOUND, 'Document not found');
      }
      
      // Mettre le statut en indexing
      await knowledgeService.updateDocumentStatus(id, 'indexing');
      
      // Enqueue le job de réindexation
      const { addJob } = await import('@/jobs/index');
      await addJob('rag:update-embeddings', {
        tenantId,
        documentId: id,
        forceReindex: true,
      });
      
      return sendSuccess(reply, { 
        id, 
        status: 'indexing',
        message: 'Reindexing started' 
      });
    } catch (error) {
      if (error instanceof QuotaError) {
        return sendError(reply, ErrorCodes.QUOTA_EXCEEDED, error.message, error.details);
      }
      logger.error('Failed to reindex document', { error });
      return sendError(reply, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to reindex document');
    }
  });

  // ================================
  // GET /stats - Statistiques des documents
  // ================================
  fastify.get('/stats', {
    schema: {
      tags: ['Admin - Knowledge'],
      summary: 'Get knowledge statistics for a tenant',
    },
  }, async (request, reply) => {
    try {
      const tenantId = getTenantId(request);
      
      // Récupérer les stats
      const { quotaService } = await import('@/modules/quota');
      const context = await quotaService.getTenantLimits(tenantId);
      
      const stats = {
        documentsCount: context.currentDocumentsCount,
        storageMb: context.currentStorageMb,
        limits: {
          maxDocuments: context.limits.maxDocuments,
          maxStorageMb: context.limits.maxStorageMb,
          maxDocSizeMb: context.limits.maxDocSizeMb,
          ragEnabled: context.limits.ragEnabled,
        },
        dailyUsage: context.dailyUsage,
        planCode: context.planCode,
      };
      
      return sendSuccess(reply, stats);
    } catch (error) {
      logger.error('Failed to get stats', { error });
      return sendError(reply, ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get stats');
    }
  });

  logger.info('Knowledge admin routes registered');
}
