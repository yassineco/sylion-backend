/**
 * ================================
 * Embedding Service - Sylion Backend
 * ================================
 * 
 * Service pour la génération d'embeddings via Vertex AI.
 * Utilise le modèle text-embedding-004 (768 dimensions).
 * 
 * Authentification via Application Default Credentials (ADC).
 * 
 * @module lib/embedding
 */

import { config } from '@/config/env';
import { logger } from '@/lib/logger';
import { GoogleAuth } from 'google-auth-library';

/**
 * Configuration du service d'embeddings
 */
const EMBEDDING_CONFIG = {
  model: config.vertex.embeddingModel, // text-embedding-004
  dimensions: 768,
  maxBatchSize: 250,
  maxTextLength: 8192, // caractères max par texte
  rateLimitDelay: 100, // ms entre les requêtes batch
} as const;

/**
 * Interface pour les options d'embedding
 */
export interface EmbeddingOptions {
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' | 'SEMANTIC_SIMILARITY';
}

/**
 * Interface pour la réponse Vertex AI Embedding
 */
interface VertexEmbeddingResponse {
  predictions: Array<{
    embeddings: {
      values: number[];
      statistics?: {
        truncated: boolean;
        token_count: number;
      };
    };
  }>;
}

/**
 * Erreur spécifique au service d'embeddings
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * Client pour le service d'embeddings Vertex AI
 * Utilise Application Default Credentials (ADC) pour l'authentification
 */
class EmbeddingService {
  private apiEndpoint: string;
  private auth: GoogleAuth;

  constructor() {
    const projectId = config.gcp.projectId;
    const location = config.vertex.location;
    
    this.apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${EMBEDDING_CONFIG.model}:predict`;
    
    // Initialiser GoogleAuth avec ADC
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    logger.info('[EmbeddingService] Initialized with ADC', {
      projectId,
      location,
      model: EMBEDDING_CONFIG.model,
    });
  }

  /**
   * Obtenir un access token via ADC
   */
  private async getAccessToken(): Promise<string> {
    try {
      const client = await this.auth.getClient();
      const tokenResponse = await client.getAccessToken();
      
      if (!tokenResponse.token) {
        throw new EmbeddingError(
          'Failed to get access token from ADC',
          'AUTH_ERROR'
        );
      }
      
      return tokenResponse.token;
    } catch (error) {
      logger.error('[EmbeddingService] Error getting access token via ADC', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Générer un embedding pour un texte unique
   * 
   * @param text - Texte à encoder
   * @param options - Options d'embedding
   * @returns Vecteur de 768 dimensions
   */
  async generateEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new EmbeddingError(
        'Text cannot be empty',
        'INVALID_INPUT',
        { textLength: text?.length ?? 0 }
      );
    }

    // Tronquer si trop long
    const truncatedText = text.slice(0, EMBEDDING_CONFIG.maxTextLength);
    if (text.length > EMBEDDING_CONFIG.maxTextLength) {
      logger.warn('[EmbeddingService] Text truncated for embedding', {
        originalLength: text.length,
        truncatedLength: truncatedText.length,
      });
    }

    const embeddings = await this.generateBatchEmbeddings([truncatedText], options);
    
    if (!embeddings[0]) {
      throw new EmbeddingError(
        'No embedding returned',
        'EMPTY_RESPONSE'
      );
    }

    return embeddings[0];
  }

  /**
   * Générer des embeddings pour plusieurs textes (batch)
   * 
   * @param texts - Liste de textes à encoder
   * @param options - Options d'embedding
   * @returns Liste de vecteurs de 768 dimensions
   */
  async generateBatchEmbeddings(
    texts: string[],
    options: EmbeddingOptions = {}
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const { taskType = 'RETRIEVAL_DOCUMENT' } = options;

    // Diviser en batches si nécessaire
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += EMBEDDING_CONFIG.maxBatchSize) {
      batches.push(texts.slice(i, i + EMBEDDING_CONFIG.maxBatchSize));
    }

    const allEmbeddings: number[][] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]!;
      
      // Rate limiting entre les batches
      if (batchIndex > 0) {
        await this.delay(EMBEDDING_CONFIG.rateLimitDelay);
      }

      try {
        const accessToken = await this.getAccessToken();

        // Préparer les instances pour l'API
        const instances = batch.map(text => ({
          content: text.slice(0, EMBEDDING_CONFIG.maxTextLength),
          task_type: taskType,
        }));

        logger.debug('[EmbeddingService] Generating batch embeddings', {
          batchIndex,
          batchSize: batch.length,
          totalBatches: batches.length,
        });

        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new EmbeddingError(
            `Vertex AI API error: ${response.status}`,
            'API_ERROR',
            { status: response.status, error: errorText }
          );
        }

        const data: VertexEmbeddingResponse = await response.json();

        // Extraire les embeddings
        for (const prediction of data.predictions) {
          if (prediction.embeddings?.values) {
            allEmbeddings.push(prediction.embeddings.values);
          }
        }

        logger.debug('[EmbeddingService] Batch embeddings generated', {
          batchIndex,
          embeddingsGenerated: data.predictions.length,
        });

      } catch (error) {
        logger.error('[EmbeddingService] Error generating batch embeddings', {
          batchIndex,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return allEmbeddings;
  }

  /**
   * Délai async
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Vérifier la santé du service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const embedding = await this.generateEmbedding('test');
      return embedding.length === EMBEDDING_CONFIG.dimensions;
    } catch {
      return false;
    }
  }

  /**
   * Obtenir les informations du service account (pour diagnostic)
   */
  async getServiceAccountInfo(): Promise<{ email: string; projectId: string } | null> {
    try {
      const credentials = await this.auth.getCredentials();
      
      return {
        email: credentials.client_email || 'unknown',
        projectId: await this.auth.getProjectId() || config.gcp.projectId,
      };
    } catch (error) {
      logger.error('[EmbeddingService] Error getting service account info', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

/**
 * Instance singleton du service d'embeddings
 */
export const embeddingService = new EmbeddingService();

/**
 * Fonction helper pour générer un embedding
 */
export async function generateEmbedding(
  text: string,
  options?: EmbeddingOptions
): Promise<number[]> {
  return embeddingService.generateEmbedding(text, options);
}

/**
 * Fonction helper pour générer des embeddings en batch
 */
export async function generateBatchEmbeddings(
  texts: string[],
  options?: EmbeddingOptions
): Promise<number[][]> {
  return embeddingService.generateBatchEmbeddings(texts, options);
}

/**
 * Constantes exportées
 */
export const EMBEDDING_DIMENSIONS = EMBEDDING_CONFIG.dimensions;
export const EMBEDDING_MODEL = EMBEDDING_CONFIG.model;
