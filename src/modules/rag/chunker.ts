/**
 * ================================
 * Chunker - Sylion Backend
 * ================================
 * 
 * Service de découpage intelligent de texte en chunks pour RAG.
 * Optimisé pour la recherche sémantique et l'injection dans les prompts LLM.
 * 
 * @module modules/rag/chunker
 */

import { logger } from '@/lib/logger';
import {
    type ChunkingOptions,
    DEFAULT_CHUNKING_OPTIONS,
    type TextChunk
} from './rag.types';

/**
 * Ratio approximatif caractères/tokens pour estimation
 * Basé sur des textes en français/anglais
 */
const CHARS_PER_TOKEN_RATIO = 4;

/**
 * Estimer le nombre de tokens dans un texte
 * 
 * Note: C'est une estimation approximative.
 * Pour plus de précision, utiliser un tokenizer comme tiktoken.
 * 
 * @param text - Texte à analyser
 * @returns Nombre estimé de tokens
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // Estimation simple basée sur les caractères
  // Plus précis que le comptage de mots pour les langues mixtes
  const charCount = text.length;
  const estimatedTokens = Math.ceil(charCount / CHARS_PER_TOKEN_RATIO);
  
  // Ajustement pour les espaces et ponctuation
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  
  // Moyenne entre les deux méthodes
  return Math.ceil((estimatedTokens + wordCount * 1.3) / 2);
}

/**
 * Diviser le texte par un séparateur en gardant le séparateur à la fin
 */
function splitBySeparator(text: string, separator: string): string[] {
  if (separator === '') return [text];
  
  const parts: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    const index = remaining.indexOf(separator);
    if (index === -1) {
      parts.push(remaining);
      break;
    }
    // Inclure le séparateur à la fin du segment
    parts.push(remaining.slice(0, index + separator.length));
    remaining = remaining.slice(index + separator.length);
  }
  
  return parts.filter(p => p.length > 0);
}

/**
 * Fusionner des segments jusqu'à atteindre la taille cible
 */
function mergeSegmentsToChunkSize(
  segments: string[],
  targetTokens: number
): string[] {
  const merged: string[] = [];
  let current = '';
  let currentTokens = 0;
  
  for (const segment of segments) {
    const segmentTokens = estimateTokenCount(segment);
    
    if (currentTokens + segmentTokens <= targetTokens) {
      current += segment;
      currentTokens += segmentTokens;
    } else {
      if (current) {
        merged.push(current);
      }
      current = segment;
      currentTokens = segmentTokens;
    }
  }
  
  if (current) {
    merged.push(current);
  }
  
  return merged;
}

/**
 * Ajouter l'overlap entre les chunks
 */
function addOverlap(chunks: string[], overlapTokens: number): string[] {
  if (chunks.length <= 1 || overlapTokens <= 0) {
    return chunks;
  }
  
  const result: string[] = [];
  const overlapChars = overlapTokens * CHARS_PER_TOKEN_RATIO;
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i]!;
    
    // Ajouter du texte du chunk précédent au début (sauf pour le premier)
    if (i > 0) {
      const prevChunk = chunks[i - 1]!;
      const overlapText = prevChunk.slice(-overlapChars);
      
      // Trouver le début d'un mot pour un overlap propre
      const wordBoundary = overlapText.search(/\s/);
      if (wordBoundary > 0) {
        chunk = overlapText.slice(wordBoundary).trimStart() + chunk;
      }
    }
    
    result.push(chunk);
  }
  
  return result;
}

/**
 * Découper un texte en chunks optimisés pour RAG
 * 
 * Algorithme:
 * 1. Split par séparateurs hiérarchiques (paragraphes > phrases)
 * 2. Fusionner les segments jusqu'à la taille cible
 * 3. Ajouter l'overlap entre chunks consécutifs
 * 4. Filtrer les chunks trop petits
 * 
 * @param text - Texte à découper
 * @param options - Options de chunking (optionnel)
 * @returns Liste de chunks avec métadonnées
 */
export function chunkText(
  text: string,
  options: Partial<ChunkingOptions> = {}
): TextChunk[] {
  const opts: ChunkingOptions = {
    ...DEFAULT_CHUNKING_OPTIONS,
    ...options,
  };

  // Validation des entrées
  if (!text || text.trim().length === 0) {
    logger.warn('Empty text provided to chunker');
    return [];
  }

  // Nettoyer le texte
  const cleanedText = text
    .replace(/\r\n/g, '\n')  // Normaliser les retours à la ligne
    .replace(/\t/g, '  ')     // Convertir tabs en espaces
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines consécutives
    .trim();

  const totalTokens = estimateTokenCount(cleanedText);

  // Si le texte est déjà assez petit, retourner un seul chunk
  if (totalTokens <= opts.chunkSize) {
    if (totalTokens < opts.minChunkSize) {
      logger.debug('Text too small for chunking', { tokenCount: totalTokens });
      // Retourner quand même si non-vide
      if (cleanedText.length > 0) {
        return [{
          content: cleanedText,
          index: 0,
          tokenCount: totalTokens,
          metadata: {
            startPosition: 0,
            endPosition: cleanedText.length,
            hasOverlap: false,
          },
        }];
      }
      return [];
    }
    
    return [{
      content: cleanedText,
      index: 0,
      tokenCount: totalTokens,
      metadata: {
        startPosition: 0,
        endPosition: cleanedText.length,
        hasOverlap: false,
      },
    }];
  }

  // Découpage hiérarchique par séparateurs
  const separators = opts.separators || DEFAULT_CHUNKING_OPTIONS.separators!;
  let segments = [cleanedText];

  for (const separator of separators) {
    const newSegments: string[] = [];
    for (const segment of segments) {
      const segmentTokens = estimateTokenCount(segment);
      if (segmentTokens > opts.chunkSize) {
        // Segment trop grand, découper avec ce séparateur
        newSegments.push(...splitBySeparator(segment, separator));
      } else {
        newSegments.push(segment);
      }
    }
    segments = newSegments;
  }

  // Fusionner les petits segments jusqu'à la taille cible
  const mergedChunks = mergeSegmentsToChunkSize(segments, opts.chunkSize);

  // Ajouter l'overlap
  const chunksWithOverlap = addOverlap(mergedChunks, opts.overlap);

  // Construire les objets TextChunk avec métadonnées
  const result: TextChunk[] = [];
  let position = 0;

  for (let i = 0; i < chunksWithOverlap.length; i++) {
    const content = chunksWithOverlap[i]!.trim();
    const tokenCount = estimateTokenCount(content);

    // Filtrer les chunks trop petits (sauf le dernier)
    if (tokenCount < opts.minChunkSize && i < chunksWithOverlap.length - 1) {
      continue;
    }

    if (content.length > 0) {
      result.push({
        content,
        index: result.length,
        tokenCount,
        metadata: {
          startPosition: position,
          endPosition: position + content.length,
          hasOverlap: i > 0 && opts.overlap > 0,
        },
      });
    }

    // Calculer la position approximative dans le texte original
    position += content.length;
  }

  logger.debug('Text chunked successfully', {
    originalTokens: totalTokens,
    chunksCreated: result.length,
    avgChunkSize: Math.round(totalTokens / result.length),
  });

  return result;
}

/**
 * Extraire un aperçu du texte (premiers N tokens)
 * 
 * @param text - Texte source
 * @param maxTokens - Nombre max de tokens (défaut: 100)
 * @returns Aperçu du texte
 */
export function extractPreview(text: string, maxTokens: number = 100): string {
  if (!text) return '';
  
  const maxChars = maxTokens * CHARS_PER_TOKEN_RATIO;
  
  if (text.length <= maxChars) {
    return text.trim();
  }
  
  // Couper à la limite et trouver la fin d'une phrase/mot
  let preview = text.slice(0, maxChars);
  
  // Chercher la dernière phrase complète
  const lastSentenceEnd = Math.max(
    preview.lastIndexOf('. '),
    preview.lastIndexOf('! '),
    preview.lastIndexOf('? ')
  );
  
  if (lastSentenceEnd > maxChars * 0.5) {
    preview = preview.slice(0, lastSentenceEnd + 1);
  } else {
    // Sinon, couper au dernier mot complet
    const lastSpace = preview.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.7) {
      preview = preview.slice(0, lastSpace);
    }
    preview += '...';
  }
  
  return preview.trim();
}

/**
 * Valider qu'un chunk respecte les contraintes
 */
export function validateChunk(chunk: TextChunk, options: Partial<ChunkingOptions> = {}): boolean {
  const opts = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  
  if (!chunk.content || chunk.content.trim().length === 0) {
    return false;
  }
  
  if (chunk.tokenCount < opts.minChunkSize) {
    return false;
  }
  
  // Un chunk ne devrait pas dépasser 2x la taille cible
  if (chunk.tokenCount > opts.chunkSize * 2) {
    return false;
  }
  
  return true;
}

/**
 * Statistiques sur un ensemble de chunks
 */
export interface ChunkStats {
  totalChunks: number;
  totalTokens: number;
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
  chunksWithOverlap: number;
}

/**
 * Calculer les statistiques d'un ensemble de chunks
 */
export function getChunkStats(chunks: TextChunk[]): ChunkStats {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalTokens: 0,
      avgTokensPerChunk: 0,
      minTokens: 0,
      maxTokens: 0,
      chunksWithOverlap: 0,
    };
  }
  
  const tokenCounts = chunks.map(c => c.tokenCount);
  const totalTokens = tokenCounts.reduce((sum, t) => sum + t, 0);
  
  return {
    totalChunks: chunks.length,
    totalTokens,
    avgTokensPerChunk: Math.round(totalTokens / chunks.length),
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    chunksWithOverlap: chunks.filter(c => c.metadata.hasOverlap).length,
  };
}
