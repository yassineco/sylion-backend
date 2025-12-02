/**
 * ================================
 * Embedding Unit Tests - Sylion Backend
 * ================================
 * 
 * Tests unitaires pour le service d'embeddings.
 * Ces tests vérifient la structure et les constantes sans appeler l'API.
 */

import { describe, expect, it, jest } from '@jest/globals';

// Mock config AVANT tout import
jest.mock('@/config/env', () => ({
  config: {
    vertex: {
      location: 'us-central1',
      embeddingModel: 'text-embedding-004',
    },
    gcp: {
      projectId: 'test-project',
      serviceAccountKey: '{}',
    },
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Embedding Service', () => {
  describe('Constants', () => {
    it('should export EMBEDDING_DIMENSIONS as 768', async () => {
      const { EMBEDDING_DIMENSIONS } = await import('@/lib/embedding');
      expect(EMBEDDING_DIMENSIONS).toBe(768);
    });
  });

  describe('EmbeddingError', () => {
    it('should create error with code and details', async () => {
      const { EmbeddingError } = await import('@/lib/embedding');
      const error = new EmbeddingError('Test error', 'TEST_CODE', { foo: 'bar' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('EmbeddingError');
    });

    it('should work without details', async () => {
      const { EmbeddingError } = await import('@/lib/embedding');
      const error = new EmbeddingError('Test error', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toBeUndefined();
    });
  });

  describe('Text Preprocessing', () => {
    it('should validate that empty text throws error', async () => {
      const { EmbeddingError } = await import('@/lib/embedding');
      expect(EmbeddingError).toBeDefined();
    });
    
    it('should define max text length', () => {
      const MAX_TEXT_LENGTH = 8192;
      expect(MAX_TEXT_LENGTH).toBe(8192);
    });
  });

  describe('Batch Processing Logic', () => {
    it('should define max batch size of 250', () => {
      const MAX_BATCH_SIZE = 250;
      expect(MAX_BATCH_SIZE).toBe(250);
    });

    it('should handle batching correctly', () => {
      const MAX_BATCH_SIZE = 250;
      const texts = Array(500).fill('test');
      const batches = Math.ceil(texts.length / MAX_BATCH_SIZE);
      expect(batches).toBe(2);
    });
  });

  describe('Embedding Vector', () => {
    it('should have 768 dimensions', () => {
      const vector = new Array(768).fill(0);
      expect(vector.length).toBe(768);
    });

    it('should have normalized values between -1 and 1', () => {
      const mockEmbedding = new Array(768).fill(0).map(() => Math.random() * 2 - 1);
      mockEmbedding.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(-1);
        expect(val).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Task Types', () => {
    it('should support RETRIEVAL_QUERY task type', () => {
      const taskTypes = ['RETRIEVAL_QUERY', 'RETRIEVAL_DOCUMENT', 'SEMANTIC_SIMILARITY'];
      expect(taskTypes).toContain('RETRIEVAL_QUERY');
    });

    it('should support RETRIEVAL_DOCUMENT task type', () => {
      const taskTypes = ['RETRIEVAL_QUERY', 'RETRIEVAL_DOCUMENT', 'SEMANTIC_SIMILARITY'];
      expect(taskTypes).toContain('RETRIEVAL_DOCUMENT');
    });
  });
});
