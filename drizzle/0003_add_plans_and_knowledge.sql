-- ================================
-- Migration: Add Plans, Knowledge Documents, and Usage Tracking
-- ================================
-- 
-- This migration adds:
-- 1. plans table for DB-driven pricing/limits
-- 2. knowledge_documents table (new RAG system)
-- 3. knowledge_chunks table (new RAG chunks)
-- 4. usage_counters_daily table (daily quota tracking)
-- 5. Updates to tenants table (plan_code, documents_count, documents_storage_mb)
--
-- Run with: psql $DATABASE_URL -f drizzle/0003_add_plans_and_knowledge.sql
-- ================================

-- ================================
-- 0. Required Extensions
-- ================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ================================
-- 1. Plans Table
-- ================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  limits_json JSONB NOT NULL DEFAULT '{}',
  price_monthly DECIMAL(10, 2),
  price_currency VARCHAR(3) DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS plans_code_idx ON plans(code);
CREATE INDEX IF NOT EXISTS plans_active_idx ON plans(is_active);

-- ================================
-- 2. Update Tenants Table
-- ================================
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS plan_code VARCHAR(50) NOT NULL DEFAULT 'starter';

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS documents_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS documents_storage_mb DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS tenants_plan_code_idx ON tenants(plan_code);

-- ================================
-- 3. Knowledge Documents Table
-- ================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT NOT NULL DEFAULT 0,
  hash VARCHAR(64) NOT NULL,
  storage_uri TEXT,
  storage_url TEXT,
  original_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  error_reason TEXT,
  processed_at TIMESTAMP,
  indexed_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}',
  tags JSONB NOT NULL DEFAULT '[]',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_tenant_idx ON knowledge_documents(tenant_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_type_idx ON knowledge_documents(type);
CREATE INDEX IF NOT EXISTS knowledge_documents_status_idx ON knowledge_documents(status);
CREATE INDEX IF NOT EXISTS knowledge_documents_hash_idx ON knowledge_documents(tenant_id, hash);
CREATE INDEX IF NOT EXISTS knowledge_documents_uploaded_by_idx ON knowledge_documents(uploaded_by);

-- Add UNIQUE constraint (tenant_id, hash) for deduplication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'knowledge_documents_tenant_hash_unique'
      AND table_name = 'knowledge_documents'
      AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE knowledge_documents 
    ADD CONSTRAINT knowledge_documents_tenant_hash_unique 
    UNIQUE (tenant_id, hash);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ================================
-- 4. Knowledge Chunks Table (with vector)
-- ================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(768), -- Vertex AI embedding dimension
  metadata JSONB NOT NULL DEFAULT '{}',
  token_count INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_document_idx ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_tenant_idx ON knowledge_chunks(tenant_id);

-- Add UNIQUE constraint (document_id, chunk_index) for chunk ordering (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'knowledge_chunks_document_index_unique'
      AND table_name = 'knowledge_chunks'
      AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE knowledge_chunks 
    ADD CONSTRAINT knowledge_chunks_document_index_unique 
    UNIQUE (document_id, chunk_index);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create HNSW index for fast similarity search (if not exists)
-- Note: This requires the pgvector extension
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'knowledge_chunks_embedding_idx'
  ) THEN
    CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- ================================
-- 5. Usage Counters Daily Table
-- ================================
CREATE TABLE IF NOT EXISTS usage_counters_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  docs_indexed_count INTEGER NOT NULL DEFAULT 0,
  rag_queries_count INTEGER NOT NULL DEFAULT 0,
  messages_count INTEGER NOT NULL DEFAULT 0,
  messages_inbound INTEGER NOT NULL DEFAULT 0,
  messages_outbound INTEGER NOT NULL DEFAULT 0,
  tokens_in BIGINT NOT NULL DEFAULT 0,
  tokens_out BIGINT NOT NULL DEFAULT 0,
  ai_requests_count INTEGER NOT NULL DEFAULT 0,
  storage_bytes_added BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_daily_tenant_date_idx ON usage_counters_daily(tenant_id, date);
CREATE INDEX IF NOT EXISTS usage_counters_daily_date_idx ON usage_counters_daily(date);

-- ================================
-- 6. Seed Default Plans
-- ================================
INSERT INTO plans (code, name, description, limits_json, price_monthly, sort_order) VALUES
('starter', 'Starter', 'Plan gratuit pour démarrer avec Sylion AI. Idéal pour les tests et petits projets.', 
 '{"maxDocuments": 10, "maxStorageMb": 50, "maxDocSizeMb": 5, "maxDailyIndexing": 5, "maxDailyRagQueries": 100, "maxDailyMessages": 500, "maxTokensIn": 100000, "maxTokensOut": 50000, "ragEnabled": true, "prioritySupport": false, "customBranding": false}',
 NULL, 1),
('pro', 'Pro', 'Plan professionnel pour les PME. Inclut RAG avancé et support prioritaire.',
 '{"maxDocuments": 100, "maxStorageMb": 500, "maxDocSizeMb": 25, "maxDailyIndexing": 50, "maxDailyRagQueries": 1000, "maxDailyMessages": 5000, "maxTokensIn": 1000000, "maxTokensOut": 500000, "ragEnabled": true, "prioritySupport": true, "customBranding": false}',
 49.00, 2),
('business', 'Business', 'Plan business pour les entreprises. Volumes élevés et branding personnalisé.',
 '{"maxDocuments": 500, "maxStorageMb": 2000, "maxDocSizeMb": 50, "maxDailyIndexing": 200, "maxDailyRagQueries": 5000, "maxDailyMessages": 25000, "maxTokensIn": 5000000, "maxTokensOut": 2500000, "ragEnabled": true, "prioritySupport": true, "customBranding": true}',
 199.00, 3),
('enterprise', 'Enterprise', 'Plan entreprise sur mesure. Limites illimitées et support dédié.',
 '{"maxDocuments": -1, "maxStorageMb": -1, "maxDocSizeMb": 100, "maxDailyIndexing": -1, "maxDailyRagQueries": -1, "maxDailyMessages": -1, "maxTokensIn": -1, "maxTokensOut": -1, "ragEnabled": true, "prioritySupport": true, "customBranding": true}',
 NULL, 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  limits_json = EXCLUDED.limits_json,
  price_monthly = EXCLUDED.price_monthly,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- Add FK constraint tenants.plan_code -> plans.code (idempotent)
-- NOTE: Must be AFTER seed to ensure plans exist for FK validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tenants_plan_code_fk'
      AND table_name = 'tenants'
      AND constraint_schema = 'public'
  ) THEN
    -- Normalize any unknown plan_code to starter before FK validation
    UPDATE tenants
    SET plan_code = 'starter'
    WHERE plan_code IS NULL
       OR plan_code NOT IN (SELECT code FROM plans);
    ALTER TABLE tenants 
    ADD CONSTRAINT tenants_plan_code_fk 
    FOREIGN KEY (plan_code) REFERENCES plans(code) ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ================================
-- 7. Update existing tenants to have plan_code based on plan column
-- (Only if column tenants.plan exists - safe for fresh installs)
-- ================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'plan'
  ) THEN
    UPDATE tenants SET plan_code = 'pro' WHERE plan = 'pro';
    UPDATE tenants SET plan_code = 'business' WHERE plan = 'enterprise';
    UPDATE tenants SET plan_code = 'starter' WHERE plan IN ('free', 'starter');
  END IF;
END $$;

-- ================================
-- Done
-- ================================
SELECT 'Migration completed successfully!' as status;
