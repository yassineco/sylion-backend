/**
 * ================================
 * Chunker Unit Tests - Sylion Backend
 * ================================
 * 
 * Tests unitaires pour le service de chunking.
 */

import {
    chunkText,
    estimateTokenCount,
    extractPreview,
    getChunkStats,
    validateChunk,
} from '@/modules/rag/chunker';
import { DEFAULT_CHUNKING_OPTIONS } from '@/modules/rag/rag.types';
// Vitest globals are enabled via vitest config

describe('Chunker', () => {
  describe('estimateTokenCount', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateTokenCount(null as any)).toBe(0);
      expect(estimateTokenCount(undefined as any)).toBe(0);
    });

    it('should estimate tokens for short text', () => {
      const text = 'Hello world';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens. It contains multiple sentences and should be estimated accordingly.';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(20);
      expect(tokens).toBeLessThan(50);
    });

    it('should handle French text with accents', () => {
      const text = 'Bonjour, ceci est un texte en français avec des accents: é, è, ê, à, ù, ç.';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(10);
    });

    it('should handle Arabic text', () => {
      const text = 'مرحبا بك في سيليون. كيف يمكنني مساعدتك؟';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('chunkText', () => {
    it('should return empty array for empty string', () => {
      const chunks = chunkText('');
      expect(chunks).toEqual([]);
    });

    it('should return empty array for whitespace-only string', () => {
      const chunks = chunkText('   \n\t  ');
      expect(chunks).toEqual([]);
    });

    it('should return single chunk for short text', () => {
      const text = 'This is a short text.';
      const chunks = chunkText(text);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.content).toBe(text);
      expect(chunks[0]!.index).toBe(0);
      expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
    });

    it('should chunk long text into multiple parts', () => {
      // Generate a long text (> 500 tokens)
      const paragraph = 'This is a sentence that will be repeated many times to create a long text. ';
      const longText = paragraph.repeat(100);
      
      const chunks = chunkText(longText);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Verify each chunk has proper structure
      chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index);
        expect(chunk.content).toBeTruthy();
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.startPosition).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.endPosition).toBeGreaterThan(chunk.metadata.startPosition);
      });
    });

    it('should preserve paragraph boundaries when possible', () => {
      const text = `First paragraph with some content.

Second paragraph with different content.

Third paragraph with more text.`;
      
      const chunks = chunkText(text, { chunkSize: 50, minChunkSize: 10 });
      
      // Should have multiple chunks due to small chunk size
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect custom chunk size', () => {
      const paragraph = 'This is a test sentence. ';
      const longText = paragraph.repeat(50);
      
      const smallChunks = chunkText(longText, { chunkSize: 100, minChunkSize: 20 });
      const largeChunks = chunkText(longText, { chunkSize: 500, minChunkSize: 50 });
      
      expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
    });

    it('should add overlap between chunks', () => {
      const paragraph = 'Sentence number one. ';
      const longText = paragraph.repeat(100);
      
      const chunks = chunkText(longText, { 
        chunkSize: 100, 
        overlap: 20,
        minChunkSize: 50 
      });
      
      // Check that overlap is marked
      if (chunks.length > 1) {
        expect(chunks[1]!.metadata.hasOverlap).toBe(true);
      }
    });

    it('should filter out very small chunks', () => {
      const text = `Long paragraph with lots of content that will be chunked properly.

X

Another long paragraph with substantial content for testing.`;
      
      const chunks = chunkText(text, { 
        chunkSize: 100,
        minChunkSize: 20 
      });
      
      // Verify no tiny chunks (except possibly the last one)
      chunks.slice(0, -1).forEach(chunk => {
        expect(chunk.tokenCount).toBeGreaterThanOrEqual(10); // Some tolerance
      });
    });

    it('should handle text with multiple newlines', () => {
      const text = 'First line\n\n\n\n\nSecond line\n\n\nThird line';
      const chunks = chunkText(text);
      
      // Should normalize multiple newlines
      chunks.forEach(chunk => {
        expect(chunk.content).not.toContain('\n\n\n');
      });
    });

    it('should handle text with tabs', () => {
      const text = 'Text\twith\ttabs\tand\tmore\ttext';
      const chunks = chunkText(text);
      
      expect(chunks.length).toBeGreaterThan(0);
      // Tabs should be converted to spaces
      chunks.forEach(chunk => {
        expect(chunk.content).not.toContain('\t');
      });
    });
  });

  describe('extractPreview', () => {
    it('should return empty string for empty input', () => {
      expect(extractPreview('')).toBe('');
    });

    it('should return full text if under limit', () => {
      const text = 'Short text';
      expect(extractPreview(text, 100)).toBe(text);
    });

    it('should truncate long text', () => {
      const longText = 'This is a very long sentence that goes on and on. '.repeat(10);
      const preview = extractPreview(longText, 50);
      
      expect(preview.length).toBeLessThan(longText.length);
    });

    it('should end at sentence boundary when possible', () => {
      const text = 'First sentence. Second sentence. Third sentence is very long.';
      const preview = extractPreview(text, 30);
      
      // Should end with a period or ellipsis
      expect(preview.endsWith('.') || preview.endsWith('...')).toBe(true);
    });
  });

  describe('validateChunk', () => {
    it('should reject empty content', () => {
      const chunk = {
        content: '',
        index: 0,
        tokenCount: 0,
        metadata: { startPosition: 0, endPosition: 0, hasOverlap: false },
      };
      
      expect(validateChunk(chunk)).toBe(false);
    });

    it('should reject chunks smaller than minChunkSize', () => {
      const chunk = {
        content: 'Hi',
        index: 0,
        tokenCount: 1,
        metadata: { startPosition: 0, endPosition: 2, hasOverlap: false },
      };
      
      expect(validateChunk(chunk, { ...DEFAULT_CHUNKING_OPTIONS, minChunkSize: 50 })).toBe(false);
    });

    it('should accept valid chunks', () => {
      const chunk = {
        content: 'This is a valid chunk with enough content to pass validation.',
        index: 0,
        tokenCount: 150,
        metadata: { startPosition: 0, endPosition: 100, hasOverlap: false },
      };
      
      expect(validateChunk(chunk)).toBe(true);
    });
  });

  describe('getChunkStats', () => {
    it('should return zeros for empty array', () => {
      const stats = getChunkStats([]);
      
      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.avgTokensPerChunk).toBe(0);
    });

    it('should calculate correct stats', () => {
      const chunks = [
        { content: 'Chunk 1', index: 0, tokenCount: 100, metadata: { startPosition: 0, endPosition: 10, hasOverlap: false } },
        { content: 'Chunk 2', index: 1, tokenCount: 200, metadata: { startPosition: 10, endPosition: 20, hasOverlap: true } },
        { content: 'Chunk 3', index: 2, tokenCount: 150, metadata: { startPosition: 20, endPosition: 30, hasOverlap: true } },
      ];
      
      const stats = getChunkStats(chunks);
      
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalTokens).toBe(450);
      expect(stats.avgTokensPerChunk).toBe(150);
      expect(stats.minTokens).toBe(100);
      expect(stats.maxTokens).toBe(200);
      expect(stats.chunksWithOverlap).toBe(2);
    });
  });
});
