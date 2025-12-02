-- ================================
-- Migration: Add vector column to document_chunks
-- ================================
-- 
-- Prérequis: Extension pgvector déjà installée
-- Voir: scripts/init-extensions.sql
--
-- Ce script transforme la colonne embedding de TEXT vers VECTOR(768)
-- pour permettre la recherche vectorielle avec pgvector.

-- 1. Supprimer l'ancienne colonne embedding (TEXT)
ALTER TABLE document_chunks 
  DROP COLUMN IF EXISTS embedding;

-- 2. Ajouter la nouvelle colonne embedding (VECTOR 768 dimensions)
-- text-embedding-004 de Vertex AI produit des vecteurs de 768 dimensions
ALTER TABLE document_chunks 
  ADD COLUMN embedding vector(768);

-- 3. Créer l'index IVFFLAT pour recherche rapide par similarité cosinus
-- lists=100 est optimal pour jusqu'à ~1M vecteurs
-- Pour plus de vecteurs, augmenter lists (sqrt(n) est une bonne heuristique)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
  ON document_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- 4. Index sur tenant_id pour filtrage rapide
CREATE INDEX IF NOT EXISTS document_chunks_tenant_idx 
  ON document_chunks (tenant_id);

-- 5. Index composite pour le pattern de requête commun
CREATE INDEX IF NOT EXISTS document_chunks_tenant_doc_idx 
  ON document_chunks (tenant_id, document_id);

-- 6. Index sur document_id pour les jointures
CREATE INDEX IF NOT EXISTS document_chunks_document_idx 
  ON document_chunks (document_id);

-- Note: Pour requêter avec pgvector:
-- SELECT *, 1 - (embedding <=> query_vector) as similarity
-- FROM document_chunks
-- WHERE tenant_id = $1
-- ORDER BY embedding <=> query_vector
-- LIMIT 5;
