/**
 * ================================
 * Embedding Service - Sylion Backend
 * ================================
 * 
 * Service pour la génération d'embeddings via Vertex AI.
 * Utilise le modèle text-embedding-004 (768 dimensions).
 * 
 * @module lib/embedding
 */

import { config } from '@/config/env';
import { logger } from '@/lib/logger';

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
 */
class EmbeddingService {
  private apiEndpoint: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const projectId = config.gcp.projectId;
    const location = config.vertex.location;
    this.apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${EMBEDDING_CONFIG.model}:predict`;
  }

  /**
   * Obtenir ou rafraîchir le token d'accès GCP
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Réutiliser le token s'il est encore valide (avec marge de 5 min)
    if (this.accessToken && this.tokenExpiry > now + 300000) {
      return this.accessToken;
    }

    try {
      // Parse la clé de service account
      const serviceAccountKey = JSON.parse(config.gcp.serviceAccountKey);
      
      // Créer le JWT pour l'authentification
      const jwt = await this.createJWT(serviceAccountKey);
      
      // Échanger le JWT contre un access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new EmbeddingError(
          'Failed to get access token',
          'AUTH_ERROR',
          { error }
        );
      }

      const tokenData = await tokenResponse.json();
      this.accessToken = tokenData.access_token as string;
      this.tokenExpiry = now + (tokenData.expires_in * 1000);

      return this.accessToken!;
    } catch (error) {
      logger.error('Error getting GCP access token', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Créer un JWT pour l'authentification GCP
   */
  private async createJWT(serviceAccountKey: {
    client_email: string;
    private_key: string;
  }): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600, // 1 heure
    };

    // Encoder header et payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Signer avec la clé privée
    const signature = await this.signRS256(
      signatureInput,
      serviceAccountKey.private_key
    );

    return `${signatureInput}.${signature}`;
  }

  /**
   * Encoder en base64url
   */
  private base64UrlEncode(str: string): string {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Signer avec RS256
   */
  private async signRS256(data: string, privateKey: string): Promise<string> {
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    const signature = sign.sign(privateKey, 'base64');
    return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
      logger.warn('Text truncated for embedding', {
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

        logger.debug('Generating batch embeddings', {
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

        logger.debug('Batch embeddings generated', {
          batchIndex,
          embeddingsGenerated: data.predictions.length,
        });

      } catch (error) {
        logger.error('Error generating batch embeddings', {
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
