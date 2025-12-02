/**
 * ================================
 * RAG Service - Sylion Backend
 * ================================
 * 
 * Service principal pour la recherche et le contexte RAG.
 * Gère la recherche vectorielle et la construction du contexte pour les LLMs.
 * 
 * @module modules/rag/rag.service
 */

import { db } from '@/db/index';
import { generateEmbedding } from '@/lib/embedding';
import { logger } from '@/lib/logger';
import { sql } from 'drizzle-orm';
import {
    DEFAULT_ASSISTANT_RAG_CONFIG,
    DEFAULT_RAG_SEARCH_OPTIONS,
    RagError,
    RagErrorCode,
    type AssistantRagConfig,
    type RagContext,
    type RagSearchOptions,
    type RagSearchResult,
} from './rag.types';

/**
 * Rechercher les chunks similaires à une requête
 * 
 * Utilise pgvector pour la recherche par similarité cosinus.
 * Filtre par tenant_id pour l'isolation multi-tenant.
 * 
 * @param tenantId - ID du tenant
 * @param queryEmbedding - Vecteur de la requête
 * @param options - Options de recherche
 * @returns Liste de chunks triés par similarité décroissante
 */
export async function searchSimilarChunks(
  tenantId: string,
  queryEmbedding: number[],
  options: Partial<RagSearchOptions> = {}
): Promise<RagSearchResult[]> {
  const opts = { ...DEFAULT_RAG_SEARCH_OPTIONS, ...options };

  try {
    logger.debug('Searching similar chunks', {
      tenantId,
      embeddingDim: queryEmbedding.length,
      maxResults: opts.maxResults,
      threshold: opts.threshold,
    });

    // Construire la requête pgvector
    // 1 - (embedding <=> query) donne la similarité cosinus (0-1)
    const embeddingString = `[${queryEmbedding.join(',')}]`;
    
    const query = sql`
      SELECT 
        dc.id as chunk_id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        dc.token_count,
        dc.metadata,
        d.name as document_name,
        1 - (dc.embedding <=> ${embeddingString}::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.tenant_id = ${tenantId}
        AND d.status = 'indexed'
        AND dc.embedding IS NOT NULL
        AND 1 - (dc.embedding <=> ${embeddingString}::vector) >= ${opts.threshold}
      ORDER BY dc.embedding <=> ${embeddingString}::vector
      LIMIT ${opts.maxResults}
    `;

    const results = await db.execute(query);

    const searchResults: RagSearchResult[] = (results as unknown as any[]).map(row => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentName: row.document_name,
      content: row.content,
      score: parseFloat(row.similarity),
      chunkIndex: row.chunk_index,
      tokenCount: row.token_count,
      metadata: row.metadata || {},
    }));

    logger.debug('Similar chunks found', {
      tenantId,
      resultsCount: searchResults.length,
      topScore: searchResults[0]?.score,
    });

    return searchResults;

  } catch (error) {
    logger.error('Error searching similar chunks', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new RagError(
      'Failed to search similar chunks',
      RagErrorCode.SEARCH_FAILED,
      { tenantId, error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Construire le contexte RAG à partir des résultats de recherche
 * 
 * Sélectionne les chunks jusqu'à atteindre la limite de tokens.
 * Déduplique les documents utilisés.
 * 
 * @param chunks - Résultats de recherche
 * @param searchQuery - Requête originale
 * @param maxContextTokens - Limite de tokens (défaut: 2000)
 * @returns Contexte RAG construit
 */
export function buildRagContext(
  chunks: RagSearchResult[],
  searchQuery: string,
  maxContextTokens: number = 2000
): RagContext {
  const selectedChunks: RagSearchResult[] = [];
  let totalTokens = 0;
  const documentsUsed = new Set<string>();
  const documentNames = new Set<string>();

  // Sélectionner les chunks jusqu'à la limite de tokens
  for (const chunk of chunks) {
    if (totalTokens + chunk.tokenCount > maxContextTokens) {
      // Vérifier si on peut encore ajouter au moins un chunk
      if (selectedChunks.length === 0) {
        // Forcer l'ajout du premier chunk même s'il dépasse
        selectedChunks.push(chunk);
        totalTokens += chunk.tokenCount;
        documentsUsed.add(chunk.documentId);
        documentNames.add(chunk.documentName);
      }
      break;
    }

    selectedChunks.push(chunk);
    totalTokens += chunk.tokenCount;
    documentsUsed.add(chunk.documentId);
    documentNames.add(chunk.documentName);
  }

  return {
    chunks: selectedChunks,
    totalTokens,
    documentsUsed: Array.from(documentsUsed),
    documentNames: Array.from(documentNames),
    searchQuery,
    totalResultsFound: chunks.length,
  };
}

/**
 * Obtenir le contexte RAG pertinent pour un message utilisateur
 * 
 * Pipeline complet:
 * 1. Génère l'embedding de la requête
 * 2. Recherche les chunks similaires
 * 3. Construit le contexte
 * 
 * @param tenantId - ID du tenant
 * @param assistantId - ID de l'assistant (pour récupérer la config RAG)
 * @param userMessage - Message utilisateur
 * @param ragConfig - Configuration RAG (optionnel, sinon utilise les défauts)
 * @returns Contexte RAG ou null si RAG désactivé/aucun résultat
 */
export async function getRelevantContext(
  tenantId: string,
  assistantId: string,
  userMessage: string,
  ragConfig?: Partial<AssistantRagConfig>
): Promise<RagContext | null> {
  const config = { ...DEFAULT_ASSISTANT_RAG_CONFIG, ...ragConfig };

  // Vérifier que RAG est activé
  if (!config.enabled) {
    logger.debug('RAG is disabled for this assistant', { assistantId });
    return null;
  }

  // Vérifier que le message n'est pas vide
  if (!userMessage || userMessage.trim().length === 0) {
    logger.debug('Empty user message, skipping RAG', { assistantId });
    return null;
  }

  try {
    logger.info('Getting relevant RAG context', {
      tenantId,
      assistantId,
      messageLength: userMessage.length,
      threshold: config.threshold,
      maxResults: config.maxResults,
    });

    // 1. Générer l'embedding de la requête
    const queryEmbedding = await generateEmbedding(userMessage, {
      taskType: 'RETRIEVAL_QUERY',
    });

    // 2. Rechercher les chunks similaires
    const searchResults = await searchSimilarChunks(tenantId, queryEmbedding, {
      maxResults: config.maxResults,
      threshold: config.threshold,
      documentIds: config.documentIds,
    });

    // 3. Vérifier qu'on a des résultats
    if (searchResults.length === 0) {
      logger.debug('No relevant chunks found', {
        tenantId,
        assistantId,
        threshold: config.threshold,
      });
      return null;
    }

    // 4. Construire le contexte
    const context = buildRagContext(
      searchResults,
      userMessage,
      config.maxContextTokens
    );

    logger.info('RAG context built successfully', {
      tenantId,
      assistantId,
      chunksUsed: context.chunks.length,
      documentsUsed: context.documentsUsed.length,
      totalTokens: context.totalTokens,
    });

    return context;

  } catch (error) {
    logger.error('Error getting relevant context', {
      tenantId,
      assistantId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Ne pas faire échouer la requête, retourner null
    return null;
  }
}

/**
 * Formater le contexte RAG pour injection dans le prompt
 * 
 * Génère un texte structuré à injecter dans le prompt système du LLM.
 * 
 * @param context - Contexte RAG
 * @param options - Options de formatage
 * @returns Texte formaté pour le prompt
 */
export function formatContextForPrompt(
  context: RagContext,
  options: {
    includeDocumentName?: boolean;
    includeScore?: boolean;
    format?: 'simple' | 'structured' | 'citations';
  } = {}
): string {
  const {
    includeDocumentName = true,
    includeScore = false,
    format = 'simple',
  } = options;

  if (context.chunks.length === 0) {
    return '';
  }

  const lines: string[] = [];

  switch (format) {
    case 'simple':
      // Format simple : juste le contenu des chunks
      for (const chunk of context.chunks) {
        if (includeDocumentName) {
          lines.push(`[Source: ${chunk.documentName}]`);
        }
        lines.push(chunk.content);
        lines.push('');
      }
      break;

    case 'structured':
      // Format structuré avec métadonnées
      lines.push('=== CONTEXTE DOCUMENTAIRE ===');
      lines.push(`Documents utilisés: ${context.documentNames.join(', ')}`);
      lines.push(`Nombre de passages: ${context.chunks.length}`);
      lines.push('');
      
      for (let i = 0; i < context.chunks.length; i++) {
        const chunk = context.chunks[i]!;
        lines.push(`--- Passage ${i + 1} ---`);
        if (includeDocumentName) {
          lines.push(`Document: ${chunk.documentName}`);
        }
        if (includeScore) {
          lines.push(`Pertinence: ${(chunk.score * 100).toFixed(0)}%`);
        }
        lines.push('');
        lines.push(chunk.content);
        lines.push('');
      }
      break;

    case 'citations':
      // Format avec citations numérotées
      lines.push('Références documentaires:');
      lines.push('');
      
      for (let i = 0; i < context.chunks.length; i++) {
        const chunk = context.chunks[i]!;
        const citation = `[${i + 1}]`;
        lines.push(`${citation} ${chunk.content}`);
        if (includeDocumentName) {
          lines.push(`   — Source: ${chunk.documentName}`);
        }
        lines.push('');
      }
      break;
  }

  return lines.join('\n').trim();
}

/**
 * Vérifier si un tenant a des documents indexés
 */
export async function hasTenantDocuments(tenantId: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM documents 
      WHERE tenant_id = ${tenantId} 
        AND status = 'indexed'
    `);
    
    const rows = result as unknown as any[];
    const count = parseInt(rows[0]?.count || '0', 10);
    return count > 0;
    
  } catch (error) {
    logger.error('Error checking tenant documents', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Obtenir les statistiques RAG d'un tenant
 */
export async function getTenantRagStats(tenantId: string): Promise<{
  documentsCount: number;
  indexedDocumentsCount: number;
  chunksCount: number;
  totalTokens: number;
}> {
  try {
    const docsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'indexed' THEN 1 ELSE 0 END) as indexed
      FROM documents 
      WHERE tenant_id = ${tenantId}
    `);

    const chunksResult = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(token_count), 0) as tokens
      FROM document_chunks 
      WHERE tenant_id = ${tenantId}
    `);

    const docsRows = docsResult as unknown as any[];
    const chunksRows = chunksResult as unknown as any[];
    const docsRow = docsRows[0];
    const chunksRow = chunksRows[0];

    return {
      documentsCount: parseInt(docsRow?.total || '0', 10),
      indexedDocumentsCount: parseInt(docsRow?.indexed || '0', 10),
      chunksCount: parseInt(chunksRow?.count || '0', 10),
      totalTokens: parseInt(chunksRow?.tokens || '0', 10),
    };

  } catch (error) {
    logger.error('Error getting tenant RAG stats', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      documentsCount: 0,
      indexedDocumentsCount: 0,
      chunksCount: 0,
      totalTokens: 0,
    };
  }
}

/**
 * Export du service RAG comme singleton
 */
export const ragService = {
  searchSimilarChunks,
  buildRagContext,
  getRelevantContext,
  formatContextForPrompt,
  hasTenantDocuments,
  getTenantRagStats,
};
