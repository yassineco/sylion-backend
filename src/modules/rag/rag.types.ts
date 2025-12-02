/**
 * ================================
 * RAG Types - Sylion Backend
 * ================================
 * 
 * Types et interfaces pour le système RAG (Retrieval-Augmented Generation).
 * 
 * @module modules/rag/rag.types
 */

/**
 * ================================
 * Chunking Types
 * ================================
 */

/**
 * Options pour le chunking de texte
 */
export interface ChunkingOptions {
  /** Taille cible des chunks en tokens (défaut: 500) */
  chunkSize: number;
  /** Overlap entre les chunks en tokens (défaut: 50) */
  overlap: number;
  /** Taille minimale d'un chunk en tokens (défaut: 100) */
  minChunkSize: number;
  /** Séparateurs personnalisés (défaut: paragraphes, phrases) */
  separators?: string[];
}

/**
 * Options par défaut pour le chunking
 */
export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  chunkSize: 500,
  overlap: 50,
  minChunkSize: 100,
  separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', '],
};

/**
 * Représente un chunk de texte avec ses métadonnées
 */
export interface TextChunk {
  /** Contenu textuel du chunk */
  content: string;
  /** Index du chunk dans le document (0-based) */
  index: number;
  /** Nombre estimé de tokens */
  tokenCount: number;
  /** Métadonnées additionnelles */
  metadata: {
    /** Position de début dans le texte original */
    startPosition: number;
    /** Position de fin dans le texte original */
    endPosition: number;
    /** Ce chunk a-t-il un overlap avec le précédent? */
    hasOverlap: boolean;
  };
}

/**
 * ================================
 * Search Types
 * ================================
 */

/**
 * Options pour la recherche RAG
 */
export interface RagSearchOptions {
  /** Nombre maximum de résultats (défaut: 5) */
  maxResults: number;
  /** Seuil de similarité minimum (défaut: 0.7) */
  threshold: number;
  /** Nombre maximum de tokens pour le contexte (défaut: 2000) */
  maxContextTokens: number;
  /** Filtrer par IDs de documents spécifiques */
  documentIds?: string[];
}

/**
 * Options par défaut pour la recherche RAG
 */
export const DEFAULT_RAG_SEARCH_OPTIONS: RagSearchOptions = {
  maxResults: 5,
  threshold: 0.7,
  maxContextTokens: 2000,
};

/**
 * Résultat d'une recherche de chunk similaire
 */
export interface RagSearchResult {
  /** ID du chunk */
  chunkId: string;
  /** ID du document source */
  documentId: string;
  /** Nom du document source */
  documentName: string;
  /** Contenu du chunk */
  content: string;
  /** Score de similarité (0-1, plus élevé = plus similaire) */
  score: number;
  /** Index du chunk dans le document */
  chunkIndex: number;
  /** Nombre de tokens du chunk */
  tokenCount: number;
  /** Métadonnées du chunk */
  metadata: Record<string, unknown>;
}

/**
 * Contexte RAG construit à partir des résultats de recherche
 */
export interface RagContext {
  /** Chunks sélectionnés pour le contexte */
  chunks: RagSearchResult[];
  /** Nombre total de tokens dans le contexte */
  totalTokens: number;
  /** IDs des documents utilisés */
  documentsUsed: string[];
  /** Noms des documents utilisés */
  documentNames: string[];
  /** Requête originale */
  searchQuery: string;
  /** Nombre de résultats avant filtrage */
  totalResultsFound: number;
}

/**
 * ================================
 * Document Types
 * ================================
 */

/**
 * Types de documents supportés
 */
export type DocumentType = 'txt' | 'md' | 'pdf' | 'docx' | 'html';

/**
 * Statuts possibles d'un document
 */
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';

/**
 * Input pour l'upload d'un document
 */
export interface DocumentUploadInput {
  /** Nom du document */
  name: string;
  /** Type de document */
  type: DocumentType;
  /** Contenu textuel (pour txt/md) */
  content?: string;
  /** URL du fichier (pour storage externe) */
  storageUrl?: string;
  /** Métadonnées additionnelles */
  metadata?: Record<string, unknown>;
  /** Tags pour catégorisation */
  tags?: string[];
  /** Utilisateur qui upload */
  uploadedBy?: string;
}

/**
 * Document avec ses chunks pour l'indexation
 */
export interface DocumentWithChunks {
  /** ID du document */
  documentId: string;
  /** ID du tenant */
  tenantId: string;
  /** Chunks extraits */
  chunks: TextChunk[];
  /** Métadonnées du document */
  metadata: Record<string, unknown>;
}

/**
 * Résultat de l'indexation d'un document
 */
export interface DocumentIndexResult {
  /** ID du document */
  documentId: string;
  /** Succès de l'indexation */
  success: boolean;
  /** Nombre de chunks créés */
  chunksCreated: number;
  /** Nombre total de tokens */
  totalTokens: number;
  /** Message d'erreur si échec */
  error?: string;
  /** Durée de l'indexation en ms */
  processingTimeMs: number;
}

/**
 * ================================
 * Job Types
 * ================================
 */

/**
 * Payload pour le job d'indexation de document
 */
export interface RagIndexDocumentJobPayload {
  tenantId: string;
  documentId: string;
  documentUrl: string;
  metadata: {
    name: string;
    type: DocumentType;
    size: number;
    uploadedBy: string;
  };
}

/**
 * Payload pour le job de mise à jour des embeddings
 */
export interface RagUpdateEmbeddingsJobPayload {
  tenantId: string;
  documentId: string;
  forceReindex?: boolean;
}

/**
 * ================================
 * Configuration Types
 * ================================
 */

/**
 * Configuration RAG d'un assistant
 */
export interface AssistantRagConfig {
  /** RAG activé pour cet assistant */
  enabled: boolean;
  /** Seuil de similarité */
  threshold: number;
  /** Nombre max de résultats */
  maxResults: number;
  /** Tokens max pour le contexte */
  maxContextTokens?: number;
  /** IDs des documents spécifiques à utiliser (si vide, tous les docs du tenant) */
  documentIds?: string[];
  /** Configuration avancée */
  advanced?: {
    /** Inclure le nom du document dans le contexte */
    includeDocumentName?: boolean;
    /** Inclure le score de similarité */
    includeScore?: boolean;
    /** Format du contexte */
    contextFormat?: 'simple' | 'structured' | 'citations';
  };
}

/**
 * Configuration par défaut RAG pour un assistant
 */
export const DEFAULT_ASSISTANT_RAG_CONFIG: AssistantRagConfig = {
  enabled: false,
  threshold: 0.7,
  maxResults: 5,
  maxContextTokens: 2000,
  advanced: {
    includeDocumentName: true,
    includeScore: false,
    contextFormat: 'simple',
  },
};

/**
 * ================================
 * Error Types
 * ================================
 */

/**
 * Codes d'erreur RAG
 */
export enum RagErrorCode {
  DOCUMENT_NOT_FOUND = 'RAG_DOCUMENT_NOT_FOUND',
  DOCUMENT_PROCESSING_FAILED = 'RAG_DOCUMENT_PROCESSING_FAILED',
  EMBEDDING_FAILED = 'RAG_EMBEDDING_FAILED',
  SEARCH_FAILED = 'RAG_SEARCH_FAILED',
  INVALID_INPUT = 'RAG_INVALID_INPUT',
  TENANT_MISMATCH = 'RAG_TENANT_MISMATCH',
  CHUNK_TOO_SMALL = 'RAG_CHUNK_TOO_SMALL',
  NO_RESULTS = 'RAG_NO_RESULTS',
}

/**
 * Erreur spécifique au système RAG
 */
export class RagError extends Error {
  constructor(
    message: string,
    public readonly code: RagErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RagError';
  }
}
