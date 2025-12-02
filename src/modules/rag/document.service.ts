/**
 * ================================
 * Document Service - Sylion Backend
 * ================================
 * 
 * Service pour la gestion du cycle de vie des documents RAG.
 * Upload, traitement, indexation et suppression.
 * 
 * @module modules/rag/document.service
 */

import { db, schema } from '@/db/index';
import { generateBatchEmbeddings } from '@/lib/embedding';
import { logger } from '@/lib/logger';
import * as crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { chunkText, getChunkStats } from './chunker';
import {
    type DocumentIndexResult,
    type DocumentStatus,
    type DocumentUploadInput,
    RagError,
    RagErrorCode
} from './rag.types';

/**
 * Calculer le hash SHA-256 d'un contenu
 */
function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Créer un nouveau document (sans indexation)
 * 
 * @param tenantId - ID du tenant
 * @param input - Données du document
 * @returns Document créé
 */
export async function createDocument(
  tenantId: string,
  input: DocumentUploadInput
): Promise<typeof schema.documents.$inferSelect> {
  const content = input.content || '';
  const hash = calculateHash(content);
  const size = Buffer.byteLength(content, 'utf8');

  logger.info('Creating document', {
    tenantId,
    name: input.name,
    type: input.type,
    size,
  });

  try {
    // Vérifier si un document avec le même hash existe déjà
    const existingDocs = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.tenantId, tenantId),
          eq(schema.documents.hash, hash)
        )
      )
      .limit(1);

    if (existingDocs.length > 0) {
      logger.warn('Document with same content already exists', {
        tenantId,
        existingDocId: existingDocs[0]!.id,
        hash,
      });
      return existingDocs[0]!;
    }

    // Créer le document
    const insertResult = await db
      .insert(schema.documents)
      .values({
        tenantId,
        name: input.name,
        type: input.type,
        size,
        hash,
        storageUrl: input.storageUrl || `memory://${hash}`, // URL fictive pour contenu en mémoire
        originalUrl: input.storageUrl,
        status: 'pending' as DocumentStatus,
        metadata: {
          ...input.metadata,
          originalContent: content, // Stocker le contenu pour MVP
        },
        tags: input.tags || [],
        uploadedBy: input.uploadedBy,
      })
      .returning();

    const document = insertResult[0];
    if (!document) {
      throw new RagError(
        'Failed to create document',
        RagErrorCode.DOCUMENT_PROCESSING_FAILED
      );
    }

    logger.info('Document created', {
      documentId: document.id,
      tenantId,
      name: document.name,
    });

    return document;

  } catch (error) {
    if (error instanceof RagError) throw error;
    
    logger.error('Error creating document', {
      tenantId,
      name: input.name,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new RagError(
      'Failed to create document',
      RagErrorCode.DOCUMENT_PROCESSING_FAILED,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Indexer un document (chunking + embeddings)
 * 
 * @param documentId - ID du document à indexer
 * @param tenantId - ID du tenant (pour vérification)
 * @returns Résultat de l'indexation
 */
export async function indexDocument(
  documentId: string,
  tenantId: string
): Promise<DocumentIndexResult> {
  const startTime = Date.now();

  logger.info('Starting document indexation', { documentId, tenantId });

  try {
    // 1. Récupérer le document
    const documents = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.id, documentId),
          eq(schema.documents.tenantId, tenantId)
        )
      )
      .limit(1);

    const document = documents[0];
    if (!document) {
      throw new RagError(
        'Document not found',
        RagErrorCode.DOCUMENT_NOT_FOUND,
        { documentId, tenantId }
      );
    }

    // 2. Vérifier le tenant
    if (document.tenantId !== tenantId) {
      throw new RagError(
        'Document belongs to different tenant',
        RagErrorCode.TENANT_MISMATCH,
        { documentId, expectedTenant: tenantId, actualTenant: document.tenantId }
      );
    }

    // 3. Mettre à jour le statut en "processing"
    await db
      .update(schema.documents)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(schema.documents.id, documentId));

    // 4. Extraire le contenu
    const metadata = document.metadata as Record<string, any>;
    const content = metadata?.['originalContent'] as string;

    if (!content || content.trim().length === 0) {
      throw new RagError(
        'Document has no content',
        RagErrorCode.DOCUMENT_PROCESSING_FAILED,
        { documentId }
      );
    }

    // 5. Découper en chunks
    const chunks = chunkText(content);
    const stats = getChunkStats(chunks);

    logger.info('Document chunked', {
      documentId,
      chunksCreated: chunks.length,
      totalTokens: stats.totalTokens,
      avgTokensPerChunk: stats.avgTokensPerChunk,
    });

    if (chunks.length === 0) {
      throw new RagError(
        'No chunks created from document',
        RagErrorCode.CHUNK_TOO_SMALL,
        { documentId, contentLength: content.length }
      );
    }

    // 6. Générer les embeddings en batch
    const chunkContents = chunks.map(c => c.content);
    const embeddings = await generateBatchEmbeddings(chunkContents, {
      taskType: 'RETRIEVAL_DOCUMENT',
    });

    logger.info('Embeddings generated', {
      documentId,
      embeddingsCount: embeddings.length,
    });

    // 7. Supprimer les anciens chunks (si reindexation)
    await db
      .delete(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId));

    // 8. Insérer les nouveaux chunks avec embeddings
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
        INSERT INTO document_chunks (
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

    // 9. Mettre à jour le document comme indexé
    await db
      .update(schema.documents)
      .set({
        status: 'indexed',
        chunkCount: chunks.length,
        totalTokens: stats.totalTokens,
        processedAt: new Date(),
        indexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, documentId));

    const processingTimeMs = Date.now() - startTime;

    logger.info('Document indexed successfully', {
      documentId,
      tenantId,
      chunksCreated: chunks.length,
      totalTokens: stats.totalTokens,
      processingTimeMs,
    });

    return {
      documentId,
      success: true,
      chunksCreated: chunks.length,
      totalTokens: stats.totalTokens,
      processingTimeMs,
    };

  } catch (error) {
    const processingTimeMs = Date.now() - startTime;

    // Marquer le document comme failed
    await db
      .update(schema.documents)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(schema.documents.id, documentId));

    if (error instanceof RagError) {
      return {
        documentId,
        success: false,
        chunksCreated: 0,
        totalTokens: 0,
        error: error.message,
        processingTimeMs,
      };
    }

    logger.error('Document indexation failed', {
      documentId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs,
    });

    return {
      documentId,
      success: false,
      chunksCreated: 0,
      totalTokens: 0,
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs,
    };
  }
}

/**
 * Récupérer un document par ID
 */
export async function getDocumentById(
  documentId: string,
  tenantId: string
): Promise<typeof schema.documents.$inferSelect | null> {
  const documents = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, documentId),
        eq(schema.documents.tenantId, tenantId)
      )
    )
    .limit(1);

  return documents[0] || null;
}

/**
 * Récupérer tous les documents d'un tenant
 */
export async function getDocumentsByTenant(
  tenantId: string,
  options: { status?: DocumentStatus; limit?: number; offset?: number } = {}
): Promise<typeof schema.documents.$inferSelect[]> {
  let query = db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.tenantId, tenantId));

  if (options.status) {
    query = db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.tenantId, tenantId),
          eq(schema.documents.status, options.status)
        )
      );
  }

  // Note: limit/offset ajoutés directement sur la query
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  const results = await db.execute(sql`
    SELECT * FROM documents 
    WHERE tenant_id = ${tenantId}
    ${options.status ? sql`AND status = ${options.status}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return results as unknown as any[];
}

/**
 * Supprimer un document et ses chunks
 */
export async function deleteDocument(
  documentId: string,
  tenantId: string
): Promise<boolean> {
  logger.info('Deleting document', { documentId, tenantId });

  try {
    // Vérifier que le document existe et appartient au tenant
    const document = await getDocumentById(documentId, tenantId);
    if (!document) {
      throw new RagError(
        'Document not found',
        RagErrorCode.DOCUMENT_NOT_FOUND,
        { documentId, tenantId }
      );
    }

    // Supprimer les chunks (cascade devrait le faire, mais on est sûr)
    await db
      .delete(schema.documentChunks)
      .where(eq(schema.documentChunks.documentId, documentId));

    // Supprimer le document
    await db
      .delete(schema.documents)
      .where(eq(schema.documents.id, documentId));

    logger.info('Document deleted', { documentId, tenantId });
    return true;

  } catch (error) {
    if (error instanceof RagError) throw error;
    
    logger.error('Error deleting document', {
      documentId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Réindexer un document
 */
export async function reindexDocument(
  documentId: string,
  tenantId: string
): Promise<DocumentIndexResult> {
  logger.info('Reindexing document', { documentId, tenantId });
  return indexDocument(documentId, tenantId);
}

/**
 * Upload et indexer un document en une seule opération
 * 
 * Utilisation pour le MVP (seeding direct sans queue)
 */
export async function uploadAndIndexDocument(
  tenantId: string,
  input: DocumentUploadInput
): Promise<DocumentIndexResult> {
  // 1. Créer le document
  const document = await createDocument(tenantId, input);

  // 2. Indexer immédiatement
  return indexDocument(document.id, tenantId);
}

/**
 * Export du service document comme singleton
 */
export const documentService = {
  createDocument,
  indexDocument,
  getDocumentById,
  getDocumentsByTenant,
  deleteDocument,
  reindexDocument,
  uploadAndIndexDocument,
};
