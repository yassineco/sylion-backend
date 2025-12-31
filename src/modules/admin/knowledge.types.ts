/**
 * ================================
 * Knowledge Types - Sylion Backend
 * ================================
 * 
 * Types pour la gestion des documents de connaissances (RAG admin).
 * 
 * @module modules/admin/knowledge.types
 */

/**
 * Statuts possibles d'un document knowledge
 */
export type KnowledgeDocumentStatus = 'uploaded' | 'indexing' | 'indexed' | 'error';

/**
 * Input pour l'upload d'un document
 */
export interface KnowledgeDocumentUploadInput {
  name: string;
  originalName: string;
  type: string;
  mimeType: string;
  sizeBytes: number;
  content?: string; // Pour les fichiers texte
  storageUri?: string; // URI de stockage
  tags?: string[];
  uploadedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Document knowledge avec son statut
 */
export interface KnowledgeDocumentResponse {
  id: string;
  tenantId: string;
  name: string;
  originalName: string | null;
  type: string;
  mimeType: string | null;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  errorReason: string | null;
  chunkCount: number;
  totalTokens: number;
  tags: string[];
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  indexedAt: Date | null;
}

/**
 * Réponse paginée de la liste des documents
 */
export interface KnowledgeDocumentListResponse {
  documents: KnowledgeDocumentResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Paramètres de recherche des documents
 */
export interface KnowledgeDocumentSearchParams {
  page?: number;
  limit?: number;
  status?: KnowledgeDocumentStatus;
  type?: string;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'status' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Résultat de l'upload multiple
 */
export interface MultiUploadResult {
  successful: Array<{
    id: string;
    name: string;
    status: KnowledgeDocumentStatus;
  }>;
  failed: Array<{
    name: string;
    error: string;
  }>;
  totalUploaded: number;
  totalFailed: number;
}
