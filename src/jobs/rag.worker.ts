/**
 * ================================
 * RAG Worker - Sylion Backend
 * ================================
 * 
 * Handlers BullMQ pour les jobs RAG.
 * Indexation de documents et mise à jour des embeddings.
 * Supporte les documents legacy ET les nouveaux knowledge documents.
 * 
 * @module jobs/rag.worker
 */

import { logger } from '@/lib/logger';
import { documentService } from '@/modules/rag/document.service';
import type { RagIndexDocumentJobPayload, RagUpdateEmbeddingsJobPayload } from '@/modules/rag/rag.types';
import { Job } from 'bullmq';

// Import des nouveaux handlers knowledge
import { processKnowledgeIndexDocument, processKnowledgeReindex } from './knowledge.worker';

/**
 * Handler pour l'indexation d'un document
 * 
 * Job: rag:index-document
 * 
 * Workflow:
 * 1. Vérifie si c'est un document knowledge ou legacy
 * 2. Récupère le document depuis la DB
 * 3. Extrait le contenu textuel
 * 4. Découpe en chunks
 * 5. Génère les embeddings via Vertex AI
 * 6. Stocke les chunks avec embeddings dans document_chunks ou knowledge_chunks
 * 7. Met à jour le statut du document
 */
export async function processRagIndexDocument(
  job: Job<RagIndexDocumentJobPayload>
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  const { tenantId, documentId, metadata } = job.data;

  logger.info('Processing RAG index document job', {
    jobId: job.id,
    documentId,
    tenantId,
    documentName: metadata.name,
    documentType: metadata.type,
  });

  // Essayer d'abord avec les knowledge documents (nouveau système)
  try {
    const { knowledgeService } = await import('@/modules/admin/knowledge.service');
    const knowledgeDoc = await knowledgeService.getDocumentById(tenantId, documentId);
    
    if (knowledgeDoc) {
      // C'est un knowledge document - utiliser le nouveau worker
      return processKnowledgeIndexDocument(job);
    }
  } catch (error) {
    // Si le module knowledge n'est pas disponible, continuer avec l'ancien système
    logger.debug('Knowledge service not available, falling back to legacy', { documentId });
  }

  // Fallback: utiliser l'ancien système (documents legacy)
  try {
    // Indexer le document
    const result = await documentService.indexDocument(documentId, tenantId);

    if (!result.success) {
      logger.error('Document indexation failed', {
        jobId: job.id,
        documentId,
        tenantId,
        error: result.error,
      });

      // Retourner l'erreur mais ne pas throw pour éviter les retry inutiles
      // si c'est une erreur de contenu
      return {
        success: false,
        chunksCreated: 0,
        error: result.error,
      };
    }

    logger.info('Document indexed successfully via job', {
      jobId: job.id,
      documentId,
      tenantId,
      chunksCreated: result.chunksCreated,
      totalTokens: result.totalTokens,
      processingTimeMs: result.processingTimeMs,
    });

    return {
      success: true,
      chunksCreated: result.chunksCreated,
    };

  } catch (error) {
    logger.error('RAG index document job failed', {
      jobId: job.id,
      documentId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error; // Laisser BullMQ gérer les retry
  }
}

/**
 * Handler pour la mise à jour des embeddings d'un document
 * 
 * Job: rag:update-embeddings
 * 
 * Utilisé pour:
 * - Reindexer après changement de modèle d'embedding
 * - Corriger des erreurs d'indexation
 * - Forcer une mise à jour des chunks
 */
export async function processRagUpdateEmbeddings(
  job: Job<RagUpdateEmbeddingsJobPayload>
): Promise<{ success: boolean; chunksCreated: number; error?: string }> {
  const { tenantId, documentId, forceReindex } = job.data;

  logger.info('Processing RAG update embeddings job', {
    jobId: job.id,
    documentId,
    tenantId,
    forceReindex,
  });

  // Essayer d'abord avec les knowledge documents (nouveau système)
  try {
    const { knowledgeService } = await import('@/modules/admin/knowledge.service');
    const knowledgeDoc = await knowledgeService.getDocumentById(tenantId, documentId);
    
    if (knowledgeDoc) {
      // C'est un knowledge document - utiliser le nouveau worker
      return processKnowledgeReindex(job);
    }
  } catch (error) {
    // Si le module knowledge n'est pas disponible, continuer avec l'ancien système
    logger.debug('Knowledge service not available, falling back to legacy', { documentId });
  }

  // Fallback: utiliser l'ancien système (documents legacy)
  try {
    // Vérifier que le document existe
    const document = await documentService.getDocumentById(documentId, tenantId);
    
    if (!document) {
      logger.error('Document not found for embedding update', {
        jobId: job.id,
        documentId,
        tenantId,
      });
      return {
        success: false,
        chunksCreated: 0,
        error: 'Document not found',
      };
    }

    // Reindexer le document
    const result = await documentService.reindexDocument(documentId, tenantId);

    if (!result.success) {
      logger.error('Embedding update failed', {
        jobId: job.id,
        documentId,
        tenantId,
        error: result.error,
      });
      return {
        success: false,
        chunksCreated: 0,
        error: result.error,
      };
    }

    logger.info('Embeddings updated successfully', {
      jobId: job.id,
      documentId,
      tenantId,
      chunksCreated: result.chunksCreated,
      processingTimeMs: result.processingTimeMs,
    });

    return {
      success: true,
      chunksCreated: result.chunksCreated,
    };

  } catch (error) {
    logger.error('RAG update embeddings job failed', {
      jobId: job.id,
      documentId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

/**
 * Export des handlers pour enregistrement dans jobs/index.ts
 */
export const ragWorkerHandlers = {
  'rag:index-document': processRagIndexDocument,
  'rag:update-embeddings': processRagUpdateEmbeddings,
};
