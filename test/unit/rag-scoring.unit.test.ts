/**
 * ================================
 * RAG Scoring Unit Tests - Sylion Backend
 * ================================
 * 
 * Tests unitaires pour les fonctions de scoring et formatage RAG.
 */

import {
    buildRagContext,
    formatContextForPrompt,
} from '@/modules/rag/rag.service';
import type { RagSearchResult } from '@/modules/rag/rag.types';
import { describe, expect, it } from '@jest/globals';

describe('RAG Scoring & Context', () => {
  // Fixtures
  const mockSearchResults: RagSearchResult[] = [
    {
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      documentName: 'Guide Inscription.pdf',
      content: 'Pour inscrire votre enfant, vous devez fournir les documents suivants: carte d\'identité, certificat de scolarité...',
      score: 0.92,
      chunkIndex: 0,
      tokenCount: 100,
      metadata: {},
    },
    {
      chunkId: 'chunk-2',
      documentId: 'doc-1',
      documentName: 'Guide Inscription.pdf',
      content: 'Les frais d\'inscription sont de 1500 DH pour la maternelle et 2000 DH pour le primaire.',
      score: 0.85,
      chunkIndex: 1,
      tokenCount: 80,
      metadata: {},
    },
    {
      chunkId: 'chunk-3',
      documentId: 'doc-2',
      documentName: 'Tarifs 2024.docx',
      content: 'Tarif mensuel: Maternelle 800 DH, Primaire 1000 DH, Collège 1200 DH.',
      score: 0.78,
      chunkIndex: 0,
      tokenCount: 60,
      metadata: {},
    },
  ];

  describe('buildRagContext', () => {
    it('should build context from search results', () => {
      const context = buildRagContext(mockSearchResults, 'inscription école', 2000);
      
      expect(context.chunks).toHaveLength(3);
      expect(context.totalTokens).toBe(240); // 100 + 80 + 60
      expect(context.documentsUsed).toHaveLength(2);
      expect(context.documentsUsed).toContain('doc-1');
      expect(context.documentsUsed).toContain('doc-2');
      expect(context.documentNames).toContain('Guide Inscription.pdf');
      expect(context.documentNames).toContain('Tarifs 2024.docx');
      expect(context.searchQuery).toBe('inscription école');
      expect(context.totalResultsFound).toBe(3);
    });

    it('should respect maxContextTokens limit', () => {
      const context = buildRagContext(mockSearchResults, 'test', 150);
      
      // Should only include first two chunks (100 + 80 = 180 > 150, so stops after first)
      // But first chunk (100) fits, second would exceed, so only first
      expect(context.totalTokens).toBeLessThanOrEqual(150);
      expect(context.chunks.length).toBeLessThan(mockSearchResults.length);
    });

    it('should always include at least one chunk even if over limit', () => {
      const largeChunk: RagSearchResult[] = [{
        chunkId: 'large',
        documentId: 'doc-large',
        documentName: 'Large Doc',
        content: 'Very large content',
        score: 0.9,
        chunkIndex: 0,
        tokenCount: 500, // Larger than limit
        metadata: {},
      }];
      
      const context = buildRagContext(largeChunk, 'test', 100);
      
      expect(context.chunks).toHaveLength(1);
      expect(context.totalTokens).toBe(500);
    });

    it('should handle empty results', () => {
      const context = buildRagContext([], 'test', 2000);
      
      expect(context.chunks).toHaveLength(0);
      expect(context.totalTokens).toBe(0);
      expect(context.documentsUsed).toHaveLength(0);
      expect(context.documentNames).toHaveLength(0);
    });

    it('should deduplicate documents', () => {
      const sameDocResults: RagSearchResult[] = [
        { ...mockSearchResults[0]! },
        { ...mockSearchResults[1]! }, // Same document as first
      ];
      
      const context = buildRagContext(sameDocResults, 'test', 2000);
      
      expect(context.documentsUsed).toHaveLength(1);
      expect(context.documentNames).toHaveLength(1);
    });
  });

  describe('formatContextForPrompt', () => {
    const context = buildRagContext(mockSearchResults, 'inscription', 2000);

    it('should format context in simple mode', () => {
      const formatted = formatContextForPrompt(context, { format: 'simple' });
      
      expect(formatted).toContain('Pour inscrire votre enfant');
      expect(formatted).toContain('[Source: Guide Inscription.pdf]');
    });

    it('should format context without document names', () => {
      const formatted = formatContextForPrompt(context, { 
        format: 'simple',
        includeDocumentName: false,
      });
      
      expect(formatted).not.toContain('[Source:');
      expect(formatted).toContain('Pour inscrire votre enfant');
    });

    it('should format context in structured mode', () => {
      const formatted = formatContextForPrompt(context, { format: 'structured' });
      
      expect(formatted).toContain('=== CONTEXTE DOCUMENTAIRE ===');
      expect(formatted).toContain('Documents utilisés:');
      expect(formatted).toContain('Nombre de passages: 3');
      expect(formatted).toContain('--- Passage 1 ---');
    });

    it('should format context with scores', () => {
      const formatted = formatContextForPrompt(context, { 
        format: 'structured',
        includeScore: true,
      });
      
      expect(formatted).toContain('Pertinence:');
      expect(formatted).toContain('92%'); // 0.92 * 100
    });

    it('should format context in citations mode', () => {
      const formatted = formatContextForPrompt(context, { format: 'citations' });
      
      expect(formatted).toContain('Références documentaires:');
      expect(formatted).toContain('[1]');
      expect(formatted).toContain('[2]');
      expect(formatted).toContain('[3]');
      expect(formatted).toContain('— Source:');
    });

    it('should return empty string for empty context', () => {
      const emptyContext = buildRagContext([], 'test', 2000);
      const formatted = formatContextForPrompt(emptyContext);
      
      expect(formatted).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle chunks with special characters', () => {
      const specialChunk: RagSearchResult = {
        chunkId: 'special',
        documentId: 'doc-special',
        documentName: 'Test "Special" Doc.pdf',
        content: 'Content with "quotes", <tags>, and émojis 🎉',
        score: 0.9,
        chunkIndex: 0,
        tokenCount: 50,
        metadata: {},
      };
      
      const context = buildRagContext([specialChunk], 'test', 2000);
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('émojis 🎉');
      expect(formatted).toContain('"quotes"');
    });

    it('should handle very long document names', () => {
      const longNameChunk: RagSearchResult = {
        chunkId: 'long-name',
        documentId: 'doc-long',
        documentName: 'A'.repeat(200) + '.pdf',
        content: 'Content',
        score: 0.9,
        chunkIndex: 0,
        tokenCount: 10,
        metadata: {},
      };
      
      const context = buildRagContext([longNameChunk], 'test', 2000);
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('[Source:');
      expect(formatted.length).toBeGreaterThan(200);
    });

    it('should handle Arabic content', () => {
      const arabicChunk: RagSearchResult = {
        chunkId: 'arabic',
        documentId: 'doc-ar',
        documentName: 'دليل التسجيل.pdf',
        content: 'مرحبا بكم في مدرستنا. للتسجيل، يرجى تقديم الوثائق التالية.',
        score: 0.88,
        chunkIndex: 0,
        tokenCount: 50,
        metadata: {},
      };
      
      const context = buildRagContext([arabicChunk], 'تسجيل', 2000);
      const formatted = formatContextForPrompt(context);
      
      expect(formatted).toContain('مرحبا بكم');
      expect(context.searchQuery).toBe('تسجيل');
    });
  });
});
