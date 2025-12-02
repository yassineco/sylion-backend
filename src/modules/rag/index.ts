/**
 * ================================
 * RAG Module - Sylion Backend
 * ================================
 * 
 * Export centralisé du module RAG.
 * 
 * @module modules/rag
 */

// Types
export * from './rag.types';

// Chunker
export {
    chunkText,
    estimateTokenCount,
    extractPreview, getChunkStats, validateChunk, type ChunkStats
} from './chunker';

// Services
export { documentService } from './document.service';
export { ragService } from './rag.service';

// Re-export des fonctions principales pour accès direct
export {
    buildRagContext, formatContextForPrompt, getRelevantContext, getTenantRagStats, hasTenantDocuments, searchSimilarChunks
} from './rag.service';

export {
    createDocument, deleteDocument, getDocumentById,
    getDocumentsByTenant, indexDocument, reindexDocument,
    uploadAndIndexDocument
} from './document.service';

