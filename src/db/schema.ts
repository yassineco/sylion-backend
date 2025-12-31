/**
 * ================================
 * Database Schema - Sylion Backend
 * ================================
 * 
 * Schéma de base de données PostgreSQL avec Drizzle ORM.
 * Architecture multi-tenant avec support pgvector pour RAG.
 */

import { sql } from 'drizzle-orm';
import {
    bigint,
    boolean,
    date,
    decimal,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

/**
 * ================================
 * Plans - Configuration des offres (DB-driven limits)
 * ================================
 */
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 50 }).notNull().unique(), // starter, pro, business, enterprise
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Limites en JSON pour flexibilité maximale
  limitsJson: jsonb('limits_json').notNull().default('{}'),
  /*
   * Structure limits_json:
   * {
   *   maxDocuments: number,           // Max documents RAG
   *   maxStorageMb: number,           // Max storage en MB
   *   maxDocSizeMb: number,           // Max taille par document en MB
   *   maxDailyIndexing: number,       // Max indexations/jour
   *   maxDailyRagQueries: number,     // Max requêtes RAG/jour
   *   maxDailyMessages: number,       // Max messages/jour
   *   maxTokensIn: number,            // Max tokens input/jour
   *   maxTokensOut: number,           // Max tokens output/jour
   *   ragEnabled: boolean,            // RAG activé
   *   prioritySupport: boolean,       // Support prioritaire
   *   customBranding: boolean,        // Branding personnalisé
   * }
   */
  
  // Prix (pour affichage)
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }),
  priceCurrency: varchar('price_currency', { length: 3 }).default('EUR'),
  
  // État
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  codeIdx: uniqueIndex('plans_code_idx').on(table.code),
  activeIdx: index('plans_active_idx').on(table.isActive),
}));

/**
 * Interface TypeScript pour les limites du plan
 */
export interface PlanLimits {
  maxDocuments: number;
  maxStorageMb: number;
  maxDocSizeMb: number;
  maxDailyIndexing: number;
  maxDailyRagQueries: number;
  maxDailyMessages: number;
  maxTokensIn: number;
  maxTokensOut: number;
  ragEnabled: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
}

/**
 * ================================
 * Tenants - Configuration multi-tenant
 * ================================
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  
  // Configuration
  isActive: boolean('is_active').notNull().default(true),
  plan: varchar('plan', { length: 50 }).notNull().default('free'), // Legacy: free, pro, enterprise
  planCode: varchar('plan_code', { length: 50 }).notNull().default('starter'), // Nouveau: starter, pro, business, enterprise
  
  // Quotas mensuels (legacy - sera remplacé par planCode)
  quotaMessages: integer('quota_messages').notNull().default(1000),
  quotaAiRequests: integer('quota_ai_requests').notNull().default(100),
  quotaStorageMb: integer('quota_storage_mb').notNull().default(100),
  
  // Tracking usage (legacy)
  usedMessages: integer('used_messages').notNull().default(0),
  usedAiRequests: integer('used_ai_requests').notNull().default(0),
  usedStorageMb: integer('used_storage_mb').notNull().default(0),
  
  // Usage RAG documents
  documentsCount: integer('documents_count').notNull().default(0),
  documentsStorageMb: decimal('documents_storage_mb', { precision: 10, scale: 2 }).notNull().default('0'),
  
  // Contact & billing
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  billingAddress: jsonb('billing_address'),
  
  // Configuration technique
  webhookUrl: text('webhook_url'),
  settings: jsonb('settings').notNull().default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at'),
}, (table: any) => ({
  slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
  activeIdx: index('tenants_active_idx').on(table.isActive),
  planIdx: index('tenants_plan_idx').on(table.plan),
  planCodeIdx: index('tenants_plan_code_idx').on(table.planCode),
}));

/**
 * ================================
 * Channels - Configuration des canaux de communication
 * ================================
 */
export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Configuration du canal
  type: varchar('type', { length: 50 }).notNull(), // whatsapp, web, voice
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  
  // Configuration spécifique au type
  config: jsonb('config').notNull().default('{}'), // API keys, webhooks, etc.
  
  // Pour WhatsApp
  whatsappPhoneNumber: varchar('whatsapp_phone_number', { length: 50 }),
  whatsappApiKey: text('whatsapp_api_key'), // Chiffré
  whatsappVerifyToken: varchar('whatsapp_verify_token', { length: 255 }),
  
  // Statistiques
  totalMessages: integer('total_messages').notNull().default(0),
  totalConversations: integer('total_conversations').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastMessageAt: timestamp('last_message_at'),
}, (table: any) => ({
  tenantIdx: index('channels_tenant_idx').on(table.tenantId),
  typeIdx: index('channels_type_idx').on(table.type),
  activeIdx: index('channels_active_idx').on(table.isActive),
  whatsappPhoneIdx: index('channels_whatsapp_phone_idx').on(table.whatsappPhoneNumber),
}));

/**
 * ================================
 * Assistants - Configuration des assistants IA
 * ================================
 */
export const assistants = pgTable('assistants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Configuration de base
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  
  // Configuration IA
  model: varchar('model', { length: 100 }).notNull().default('gemini-1.5-pro'),
  systemPrompt: text('system_prompt').notNull(),
  temperature: decimal('temperature', { precision: 3, scale: 2 }).notNull().default('0.7'),
  maxTokens: integer('max_tokens').notNull().default(1024),
  
  // Configuration RAG
  enableRag: boolean('enable_rag').notNull().default(false),
  ragThreshold: decimal('rag_threshold', { precision: 3, scale: 2 }).notNull().default('0.7'),
  ragMaxResults: integer('rag_max_results').notNull().default(5),
  
  // Paramètres avancés
  conversationConfig: jsonb('conversation_config').notNull().default('{}'),
  ragConfig: jsonb('rag_config').notNull().default('{}'),
  
  // Statistiques
  totalConversations: integer('total_conversations').notNull().default(0),
  totalMessages: integer('total_messages').notNull().default(0),
  avgResponseTime: integer('avg_response_time').notNull().default(0), // ms
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
}, (table: any) => ({
  tenantIdx: index('assistants_tenant_idx').on(table.tenantId),
  activeIdx: index('assistants_active_idx').on(table.isActive),
  defaultIdx: index('assistants_default_idx').on(table.isDefault),
  modelIdx: index('assistants_model_idx').on(table.model),
}));

/**
 * ================================
 * Conversations - Sessions de chat
 * ================================
 */
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id').notNull().references(() => assistants.id, { onDelete: 'cascade' }),
  
  // Informations utilisateur
  userIdentifier: varchar('user_identifier', { length: 255 }).notNull(), // Phone number, user ID, etc.
  userName: varchar('user_name', { length: 255 }),
  userMetadata: jsonb('user_metadata').notNull().default('{}'),
  
  // État de la conversation
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, ended, paused
  title: varchar('title', { length: 255 }),
  summary: text('summary'),
  
  // Statistiques
  messageCount: integer('message_count').notNull().default(0),
  totalTokensUsed: integer('total_tokens_used').notNull().default(0),
  
  // Context tracking pour RAG
  context: jsonb('context').notNull().default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  lastMessageAt: timestamp('last_message_at'),
}, (table: any) => ({
  tenantIdx: index('conversations_tenant_idx').on(table.tenantId),
  channelIdx: index('conversations_channel_idx').on(table.channelId),
  assistantIdx: index('conversations_assistant_idx').on(table.assistantId),
  userIdx: index('conversations_user_idx').on(table.userIdentifier),
  statusIdx: index('conversations_status_idx').on(table.status),
  lastMessageIdx: index('conversations_last_message_idx').on(table.lastMessageAt),
}));

/**
 * ================================
 * Messages - Messages individuels
 * ================================
 */
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  
  // Type et direction
  type: varchar('type', { length: 50 }).notNull(), // text, image, audio, document, system
  direction: varchar('direction', { length: 10 }).notNull(), // inbound, outbound
  
  // Contenu
  content: text('content').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'), // URLs, file info, etc.
  
  // Message externe (WhatsApp, etc.)
  externalId: varchar('external_id', { length: 255 }),
  externalTimestamp: timestamp('external_timestamp'),
  
  // Processing
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, processed, failed, delivered
  processedAt: timestamp('processed_at'),
  
  // IA Response info (pour les messages sortants)
  aiModel: varchar('ai_model', { length: 100 }),
  tokensUsed: integer('tokens_used').notNull().default(0),
  processingTime: integer('processing_time').notNull().default(0), // ms
  ragUsed: boolean('rag_used').notNull().default(false),
  ragResults: jsonb('rag_results'), // Documents trouvés par RAG
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  typeIdx: index('messages_type_idx').on(table.type),
  directionIdx: index('messages_direction_idx').on(table.direction),
  statusIdx: index('messages_status_idx').on(table.status),
  externalIdx: index('messages_external_idx').on(table.externalId),
  createdIdx: index('messages_created_idx').on(table.createdAt),
}));

/**
 * ================================
 * Knowledge Documents - Stockage RAG (anciennement Documents)
 * ================================
 */
export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Informations du document
  name: varchar('name', { length: 255 }).notNull(),
  originalName: varchar('original_name', { length: 255 }), // Nom original du fichier uploadé
  type: varchar('type', { length: 50 }).notNull(), // pdf, docx, txt, html, md, etc.
  mimeType: varchar('mime_type', { length: 100 }), // application/pdf, text/plain, etc.
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  hash: varchar('hash', { length: 64 }).notNull(), // SHA-256 pour déduplication
  
  // Stockage
  storageUri: text('storage_uri'), // GCS/S3 URI: gs://bucket/path ou s3://bucket/path
  storageUrl: text('storage_url'), // URL accessible (legacy ou signed URL)
  originalUrl: text('original_url'), // URL d'origine si applicable
  
  // Statut de traitement
  status: varchar('status', { length: 50 }).notNull().default('uploaded'), 
  // uploaded -> indexing -> indexed | error
  errorReason: text('error_reason'), // Message d'erreur si status = error
  
  // Processing
  processedAt: timestamp('processed_at'),
  indexedAt: timestamp('indexed_at'),
  
  // Métadonnées
  metadata: jsonb('metadata').notNull().default('{}'),
  tags: jsonb('tags').notNull().default('[]'),
  
  // Statistiques d'indexation
  chunkCount: integer('chunk_count').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  
  // Utilisateur qui a uploadé
  uploadedBy: varchar('uploaded_by', { length: 255 }),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  tenantIdx: index('knowledge_documents_tenant_idx').on(table.tenantId),
  typeIdx: index('knowledge_documents_type_idx').on(table.type),
  statusIdx: index('knowledge_documents_status_idx').on(table.status),
  hashIdx: index('knowledge_documents_hash_idx').on(table.tenantId, table.hash),
  uploadedByIdx: index('knowledge_documents_uploaded_by_idx').on(table.uploadedBy),
}));

/**
 * ================================
 * Knowledge Chunks - Chunks pour RAG avec embeddings
 * ================================
 */
export const knowledgeChunks = pgTable('knowledge_chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Contenu du chunk
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(), // Position dans le document
  
  // Embedding vector (pgvector)
  embedding: text('embedding'), // JSON array des embeddings - sera converti en vector plus tard
  
  // Métadonnées du chunk
  metadata: jsonb('metadata').notNull().default('{}'),
  tokenCount: integer('token_count').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  documentIdx: index('knowledge_chunks_document_idx').on(table.documentId),
  tenantIdx: index('knowledge_chunks_tenant_idx').on(table.tenantId),
}));

/**
 * ================================
 * Documents - Stockage RAG (LEGACY - garder pour compatibilité)
 * ================================
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Informations du document
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // pdf, docx, txt, html, etc.
  size: integer('size').notNull(), // bytes
  hash: varchar('hash', { length: 64 }).notNull(), // SHA-256 pour déduplication
  
  // Stockage
  storageUrl: text('storage_url').notNull(), // GCS URL
  originalUrl: text('original_url'), // URL d'origine si applicable
  
  // Processing
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, processing, indexed, failed
  processedAt: timestamp('processed_at'),
  indexedAt: timestamp('indexed_at'),
  
  // Métadonnées
  metadata: jsonb('metadata').notNull().default('{}'),
  tags: jsonb('tags').notNull().default('[]'),
  
  // Statistiques
  chunkCount: integer('chunk_count').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  
  // Utilisateur qui a uploadé
  uploadedBy: varchar('uploaded_by', { length: 255 }),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  tenantIdx: index('documents_tenant_idx').on(table.tenantId),
  typeIdx: index('documents_type_idx').on(table.type),
  statusIdx: index('documents_status_idx').on(table.status),
  hashIdx: uniqueIndex('documents_hash_idx').on(table.hash),
  uploadedByIdx: index('documents_uploaded_by_idx').on(table.uploadedBy),
}));

/**
 * ================================
 * Document Chunks - Chunks pour RAG avec embeddings (LEGACY)
 * ================================
 */
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Contenu du chunk
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(), // Position dans le document
  
  // Embedding vector (pgvector) - temporairement en text pour éviter les erreurs
  embedding: text('embedding'), // JSON array des embeddings - sera converti en vector plus tard
  
  // Métadonnées du chunk
  metadata: jsonb('metadata').notNull().default('{}'),
  tokenCount: integer('token_count').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  documentIdx: index('document_chunks_document_idx').on(table.documentId),
  tenantIdx: index('document_chunks_tenant_idx').on(table.tenantId),
  // embeddingIdx sera ajouté après migration vers pgvector
}));

/**
 * ================================
 * Usage Counters Daily - Tracking quotas journaliers
 * ================================
 */
export const usageCountersDaily = pgTable('usage_counters_daily', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Date du compteur (jour)
  date: date('date').notNull(),
  
  // Compteurs RAG
  docsIndexedCount: integer('docs_indexed_count').notNull().default(0),
  ragQueriesCount: integer('rag_queries_count').notNull().default(0),
  
  // Compteurs messages
  messagesCount: integer('messages_count').notNull().default(0),
  messagesInbound: integer('messages_inbound').notNull().default(0),
  messagesOutbound: integer('messages_outbound').notNull().default(0),
  
  // Compteurs tokens
  tokensIn: bigint('tokens_in', { mode: 'number' }).notNull().default(0),
  tokensOut: bigint('tokens_out', { mode: 'number' }).notNull().default(0),
  
  // Compteurs AI
  aiRequestsCount: integer('ai_requests_count').notNull().default(0),
  
  // Compteurs storage (en bytes ajoutés ce jour)
  storageBytesAdded: bigint('storage_bytes_added', { mode: 'number' }).notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  tenantDateIdx: uniqueIndex('usage_counters_daily_tenant_date_idx').on(table.tenantId, table.date),
  dateIdx: index('usage_counters_daily_date_idx').on(table.date),
}));

/**
 * ================================
 * Quotas Tracking - Suivi d'usage détaillé (LEGACY)
 * ================================
 */
export const quotaUsage = pgTable('quota_usage', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  
  // Période de tracking
  period: varchar('period', { length: 20 }).notNull(), // hour, day, month
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Compteurs
  messages: integer('messages').notNull().default(0),
  aiRequests: integer('ai_requests').notNull().default(0),
  tokensUsed: integer('tokens_used').notNull().default(0),
  ragQueries: integer('rag_queries').notNull().default(0),
  
  // Détail par service
  breakdown: jsonb('breakdown').notNull().default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table: any) => ({
  tenantPeriodIdx: uniqueIndex('quota_usage_tenant_period_idx').on(table.tenantId, table.period, table.periodStart),
  periodIdx: index('quota_usage_period_idx').on(table.period, table.periodStart),
}));

/**
 * Export des types Drizzle
 */
export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

export type Assistant = typeof assistants.$inferSelect;
export type NewAssistant = typeof assistants.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

export type UsageCounterDaily = typeof usageCountersDaily.$inferSelect;
export type NewUsageCounterDaily = typeof usageCountersDaily.$inferInsert;

export type QuotaUsage = typeof quotaUsage.$inferSelect;
export type NewQuotaUsage = typeof quotaUsage.$inferInsert;