/**
 * ================================
 * Knowledge Indexer Worker - Sylion Backend
 * ================================
 * 
 * Worker BullMQ pour l'indexation des documents knowledge.
 * Gère le chunking, génération d'embeddings et mise à jour des statuts.
 * 
 * @module jobs/knowledge.worker
 */

import { db, schema } from '@/db/index';
import { generateBatchEmbeddings } from '@/lib/embedding';
import { logger } from '@/lib/logger';
import { knowledgeService } from '@/modules/admin/knowledge.service';
import { quotaService } from '@/modules/quota';
import { chunkText, getChunkStats } from '@/modules/rag/chunker';
import type { RagIndexDocumentJobPayload, RagUpdateEmbeddingsJobPayload } from '@/modules/rag/rag.types';
import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';

/**
 * Interface pour le résultat d'indexation
 */
interface KnowledgeIndexResult {
  success: boolean;
  chunksCreated: number;
  totalTokens?: number;
  processingTimeMs?: number;
  error?: string;
}

/**
 * Handler pour l'indexation d'un document knowledge
 * 
 * Workflow:
 * 1. Vérifier les quotas d'indexation
 * 2. Mettre le statut en "indexing"
 * 3. Récupérer le contenu du document
 * 4. Découper en chunks
 * 5. Générer les embeddings
 * 6. Stocker les chunks dans knowledge_chunks
 * 7. Mettre à jour le statut en "indexed" ou "error"
 * 8. Incrémenter le compteur d'indexation
 */
export async function processKnowledgeIndexDocument(
  job: Job<RagIndexDocumentJobPayload>
): Promise<KnowledgeIndexResult> {
  const { tenantId, documentId, metadata } = job.data;
  const startTime = Date.now();

  logger.info('Starting knowledge document indexation', {
    jobId: job.id,
    documentId,
    tenantId,
    documentName: metadata.name,
  });

  try {
    // 1. Vérifier les quotas d'indexation
    await quotaService.assertCanIndexDocument(tenantId);

    // 2. Mettre le statut en "indexing"
    await knowledgeService.updateDocumentStatus(documentId, 'indexing');

    // 3. Récupérer le contenu du document
    const content = await knowledgeService.getDocumentContent(tenantId, documentId);
    if (!content || content.trim().length === 0) {
      await knowledgeService.updateDocumentStatus(documentId, 'error', {
        errorReason: 'Document has no content',
      });
      return {
        success: false,
        chunksCreated: 0,
        error: 'Document has no content',
      };
    }

    // 4. Découper en chunks
    const chunks = chunkText(content);
    const stats = getChunkStats(chunks);

    logger.info('Document chunked', {
      jobId: job.id,
      documentId,
      chunksCreated: chunks.length,
      totalTokens: stats.totalTokens,
    });

    if (chunks.length === 0) {
      await knowledgeService.updateDocumentStatus(documentId, 'error', {
        errorReason: 'No chunks created from document',
      });
      return {
        success: false,
        chunksCreated: 0,
        error: 'No chunks created from document',
      };
    }

    // 5. Générer les embeddings en batch
    const chunkContents = chunks.map(c => c.content);
    const embeddings = await generateBatchEmbeddings(chunkContents, {
      taskType: 'RETRIEVAL_DOCUMENT',
    });

    logger.info('Embeddings generated', {
      jobId: job.id,
      documentId,
      embeddingsCount: embeddings.length,
    });

    // 6. Supprimer les anciens chunks (si reindexation)
    await db
      .delete(schema.knowledgeChunks)
      .where(eq(schema.knowledgeChunks.documentId, documentId));

    // 7. Insérer les nouveaux chunks avec embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i];

      if (!embedding) {
        logger.warn('Missing embedding for chunk', { documentId, chunkIndex: i });
        continue;
      }

      // Insérer le chunk avec l'embedding sous forme de string pour pgvector
      const embeddingString = `[${embedding.join(',')}]`;

      await db.execute(sql`
        INSERT INTO knowledge_chunks (
          id, document_id, tenant_id, content, chunk_index, 
          embedding, metadata, token_count, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${documentId},
          ${tenantId},
          ${chunk.content},
          ${chunk.index},
          ${embeddingString}::vector,
          ${JSON.stringify(chunk.metadata)}::jsonb,
          ${chunk.tokenCount},
          NOW(),
          NOW()
        )
      `);
    }

    const processingTimeMs = Date.now() - startTime;

    // 8. Mettre à jour le statut en "indexed"
    await knowledgeService.updateDocumentStatus(documentId, 'indexed', {
      chunkCount: chunks.length,
      totalTokens: stats.totalTokens,
      indexedAt: new Date(),
    });

    // 9. Incrémenter le compteur d'indexation
    await quotaService.incrementDailyCounter(tenantId, 'docs_indexed', 1);

    logger.info('Knowledge document indexed successfully', {
      jobId: job.id,
      documentId,
      tenantId,
      chunksCreated: chunks.length,
      totalTokens: stats.totalTokens,
      processingTimeMs,
    });

    return {
      success: true,
      chunksCreated: chunks.length,
      totalTokens: stats.totalTokens,
      processingTimeMs,
    };

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mettre le statut en "error"
    await knowledgeService.updateDocumentStatus(documentId, 'error', {
      errorReason: errorMessage,
    });

    logger.error('Knowledge document indexation failed', {
      jobId: job.id,
      documentId,
      tenantId,
      error: errorMessage,
      processingTimeMs,
    });

    return {
      success: false,
      chunksCreated: 0,
      error: errorMessage,
      processingTimeMs,
    };
  }
}

/**
 * Handler pour la réindexation d'un document knowledge
 */
export async function processKnowledgeReindex(
  job: Job<RagUpdateEmbeddingsJobPayload>
): Promise<KnowledgeIndexResult> {
  const { tenantId, documentId } = job.data;

  logger.info('Processing knowledge reindex job', {
    jobId: job.id,
    documentId,
    tenantId,
  });

  // Récupérer les métadonnées du document
  const document = await knowledgeService.getDocumentById(tenantId, documentId);
  if (!document) {
    logger.error('Document not found for reindexing', { documentId, tenantId });
    return {
      success: false,
      chunksCreated: 0,
      error: 'Document not found',
    };
  }

  // Réutiliser le handler d'indexation
  return processKnowledgeIndexDocument({
    ...job,
    data: {
      tenantId,
      documentId,
      documentUrl: '',
      metadata: {
        name: document.name,
        type: document.type,
        size: document.sizeBytes,
        uploadedBy: document.uploadedBy || 'admin',
      },
    },
  } as Job<RagIndexDocumentJobPayload>);
}
