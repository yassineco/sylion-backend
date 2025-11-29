-- ================================
-- PostgreSQL Extensions Setup
-- ================================

-- Enable pgvector extension for RAG embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;