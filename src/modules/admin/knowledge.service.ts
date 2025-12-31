/**
 * ================================
 * Knowledge Service - Sylion Backend
 * ================================
 * 
 * Service pour la gestion des documents de connaissances (RAG admin).
 * Upload, listing, suppression et reindexation.
 * 
 * @module modules/admin/knowledge.service
 */

import { db, schema } from '@/db/index';
import { logger } from '@/lib/logger';
import { quotaService } from '@/modules/quota';
import * as crypto from 'crypto';
import { and, count, desc, eq } from 'drizzle-orm';
import type {
    KnowledgeDocumentListResponse,
    KnowledgeDocumentResponse,
    KnowledgeDocumentSearchParams,
    KnowledgeDocumentStatus,
    KnowledgeDocumentUploadInput,
    MultiUploadResult,
} from './knowledge.types';

/**
 * Calculer le hash SHA-256 d'un contenu
 */
function calculateHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Convertir un document DB en réponse API
 */
function toDocumentResponse(doc: typeof schema.knowledgeDocuments.$inferSelect): KnowledgeDocumentResponse {
  return {
    id: doc.id,
    tenantId: doc.tenantId,
    name: doc.name,
    originalName: doc.originalName,
    type: doc.type,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status as KnowledgeDocumentStatus,
    errorReason: doc.errorReason,
    chunkCount: doc.chunkCount,
    totalTokens: doc.totalTokens,
    tags: (doc.tags as string[]) || [],
    uploadedBy: doc.uploadedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    indexedAt: doc.indexedAt,
  };
}

/**
 * Lister les documents d'un tenant avec pagination et filtres
 */
export async function listDocuments(
  tenantId: string,
  params: KnowledgeDocumentSearchParams = {}
): Promise<KnowledgeDocumentListResponse> {
  const {
    page = 1,
    limit = 20,
    status,
    type,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  const offset = (page - 1) * limit;

  // Construire les conditions
  const conditions = [eq(schema.knowledgeDocuments.tenantId, tenantId)];
  
  if (status) {
    conditions.push(eq(schema.knowledgeDocuments.status, status));
  }
  
  if (type) {
    conditions.push(eq(schema.knowledgeDocuments.type, type));
  }

  // Compter le total
  const totalResult = await db
    .select({ count: count() })
    .from(schema.knowledgeDocuments)
    .where(and(...conditions));

  const total = totalResult[0]?.count || 0;

  // Récupérer les documents
  let query = db
    .select()
    .from(schema.knowledgeDocuments)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset);

  // Appliquer le tri (on utilise toujours desc par défaut pour createdAt)
  const documents = await db
    .select()
    .from(schema.knowledgeDocuments)
    .where(and(...conditions))
    .orderBy(desc(schema.knowledgeDocuments.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    documents: documents.map(toDocumentResponse),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Récupérer un document par ID
 */
export async function getDocumentById(
  tenantId: string,
  documentId: string
): Promise<KnowledgeDocumentResponse | null> {
  const documents = await db
    .select()
    .from(schema.knowledgeDocuments)
    .where(
      and(
        eq(schema.knowledgeDocuments.id, documentId),
        eq(schema.knowledgeDocuments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!documents.length || !documents[0]) {
    return null;
  }

  return toDocumentResponse(documents[0]);
}

/**
 * Créer un nouveau document (upload)
 */
export async function createDocument(
  tenantId: string,
  input: KnowledgeDocumentUploadInput
): Promise<KnowledgeDocumentResponse> {
  // Vérifier les quotas avant upload
  await quotaService.assertCanUploadDocument(tenantId, input.sizeBytes);

  const content = input.content || '';
  const hash = calculateHash(content + input.name + Date.now());

  logger.info('Creating knowledge document', {
    tenantId,
    name: input.name,
    type: input.type,
    sizeBytes: input.sizeBytes,
  });

  // Vérifier si un document avec le même hash existe déjà
  const existingDocs = await db
    .select()
    .from(schema.knowledgeDocuments)
    .where(
      and(
        eq(schema.knowledgeDocuments.tenantId, tenantId),
        eq(schema.knowledgeDocuments.hash, hash)
      )
    )
    .limit(1);

  if (existingDocs.length > 0 && existingDocs[0]) {
    logger.warn('Document with same hash already exists', {
      tenantId,
      existingDocId: existingDocs[0].id,
    });
    return toDocumentResponse(existingDocs[0]);
  }

  // Créer le document
  const insertResult = await db
    .insert(schema.knowledgeDocuments)
    .values({
      tenantId,
      name: input.name,
      originalName: input.originalName,
      type: input.type,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      hash,
      storageUri: input.storageUri,
      storageUrl: input.storageUri, // Compatibilité
      status: 'uploaded',
      metadata: {
        ...input.metadata,
        originalContent: content, // Stocker le contenu pour indexation
      },
      tags: input.tags || [],
      uploadedBy: input.uploadedBy,
    })
    .returning();

  const document = insertResult[0];
  if (!document) {
    throw new Error('Failed to create document');
  }

  // Mettre à jour les stats du tenant
  await quotaService.updateTenantDocumentStats(
    tenantId,
    1,
    input.sizeBytes / (1024 * 1024)
  );

  logger.info('Knowledge document created', {
    documentId: document.id,
    tenantId,
    name: document.name,
  });

  return toDocumentResponse(document);
}

/**
 * Upload multiple documents
 */
export async function uploadMultipleDocuments(
  tenantId: string,
  documents: KnowledgeDocumentUploadInput[]
): Promise<MultiUploadResult> {
  const result: MultiUploadResult = {
    successful: [],
    failed: [],
    totalUploaded: 0,
    totalFailed: 0,
  };

  for (const doc of documents) {
    try {
      const created = await createDocument(tenantId, doc);
      result.successful.push({
        id: created.id,
        name: created.name,
        status: created.status,
      });
      result.totalUploaded++;
    } catch (error) {
      result.failed.push({
        name: doc.name,
        error: error instanceof Error ? error.message : String(error),
      });
      result.totalFailed++;
    }
  }

  return result;
}

/**
 * Supprimer un document
 */
export async function deleteDocument(
  tenantId: string,
  documentId: string
): Promise<boolean> {
  logger.info('Deleting knowledge document', { tenantId, documentId });

  // Récupérer le document pour les stats
  const document = await getDocumentById(tenantId, documentId);
  if (!document) {
    logger.warn('Document not found for deletion', { tenantId, documentId });
    return false;
  }

  // Supprimer les chunks
  await db
    .delete(schema.knowledgeChunks)
    .where(eq(schema.knowledgeChunks.documentId, documentId));

  // Supprimer le document
  await db
    .delete(schema.knowledgeDocuments)
    .where(
      and(
        eq(schema.knowledgeDocuments.id, documentId),
        eq(schema.knowledgeDocuments.tenantId, tenantId)
      )
    );

  // Mettre à jour les stats du tenant
  await quotaService.updateTenantDocumentStats(
    tenantId,
    -1,
    -document.sizeBytes / (1024 * 1024)
  );

  logger.info('Knowledge document deleted', { tenantId, documentId });
  return true;
}

/**
 * Mettre à jour le statut d'un document
 */
export async function updateDocumentStatus(
  documentId: string,
  status: KnowledgeDocumentStatus,
  options: {
    errorReason?: string;
    chunkCount?: number;
    totalTokens?: number;
    indexedAt?: Date;
  } = {}
): Promise<void> {
  const updateData: Record<string, any> = {
    status,
    updatedAt: new Date(),
  };

  if (options.errorReason !== undefined) {
    updateData.errorReason = options.errorReason;
  }
  if (options.chunkCount !== undefined) {
    updateData.chunkCount = options.chunkCount;
  }
  if (options.totalTokens !== undefined) {
    updateData.totalTokens = options.totalTokens;
  }
  if (options.indexedAt !== undefined) {
    updateData.indexedAt = options.indexedAt;
  }

  await db
    .update(schema.knowledgeDocuments)
    .set(updateData)
    .where(eq(schema.knowledgeDocuments.id, documentId));

  logger.debug('Document status updated', { documentId, status, options });
}

/**
 * Récupérer le contenu d'un document pour indexation
 */
export async function getDocumentContent(
  tenantId: string,
  documentId: string
): Promise<string | null> {
  const documents = await db
    .select()
    .from(schema.knowledgeDocuments)
    .where(
      and(
        eq(schema.knowledgeDocuments.id, documentId),
        eq(schema.knowledgeDocuments.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!documents.length || !documents[0]) {
    return null;
  }

  const metadata = documents[0].metadata as Record<string, any>;
  return metadata?.originalContent as string || null;
}

/**
 * Export du service knowledge comme singleton
 */
export const knowledgeService = {
  listDocuments,
  getDocumentById,
  createDocument,
  uploadMultipleDocuments,
  deleteDocument,
  updateDocumentStatus,
  getDocumentContent,
};
