// test/setup.unit.ts
// Setup for UNIT tests only - NO database initialization
// Mocks all external dependencies (logger, redis, etc.)

// CRITICAL: Set NODE_ENV=test BEFORE any imports to enable test-safe env validation
process.env.NODE_ENV = 'test';

// Set required env vars with dummy values BEFORE config/env.ts is imported
// These are needed to pass Zod validation in test mode
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || 'test_whatsapp_api_key_dummy_value';
process.env.WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'test_verify_token_dummy';
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'test-project';
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/tmp/test-credentials.json';
process.env.GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'test-bucket';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_at_least_32_characters_long';
process.env.LOG_LEVEL = 'error';

import { config } from 'dotenv';
import { vi } from 'vitest';

// Load test environment variables (optional, may not exist in CI)
config({ path: '.env.test' });

// Mock logger - no external calls
vi.mock('../src/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Mock Redis - no external calls
vi.mock('../src/lib/redis', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(true),
  deleteCache: vi.fn().mockResolvedValue(true),
  deleteCachePattern: vi.fn().mockResolvedValue(0),
  cacheKeys: {
    tenant: (id: string) => `test:tenant:${id}`,
    tenantBySlug: (slug: string) => `test:tenant:slug:${slug}`,
    tenantList: 'test:tenants:list',
    tenantUsage: (tenantId: string) => `test:tenant:${tenantId}:usage`,
    channel: (id: string) => `test:channel:${id}`,
    channelsByTenant: (tenantId: string) => `test:channels:tenant:${tenantId}`,
    activeChannelsByTenant: (tenantId: string) => `test:channels:active:tenant:${tenantId}`,
    assistant: (id: string) => `test:assistant:${id}`,
    assistantsByTenant: (tenantId: string) => `test:assistants:tenant:${tenantId}`,
    activeAssistantsByTenant: (tenantId: string) => `test:assistants:active:tenant:${tenantId}`,
    defaultAssistant: (tenantId: string) => `test:assistant:default:tenant:${tenantId}`,
    conversation: (id: string) => `test:conversation:${id}`,
    conversationsByTenant: (tenantId: string) => `test:conversations:tenant:${tenantId}`,
    conversationsByChannel: (channelId: string) => `test:conversations:channel:${channelId}`,
    message: (messageId: string) => `test:message:${messageId}`,
    messagesByConversation: (conversationId: string) => `test:messages:conversation:${conversationId}`,
    user: (userId: string) => `test:user:${userId}`,
    session: (sessionId: string) => `test:session:${sessionId}`,
    quota: (tenantId: string, period: string) => `test:quota:${tenantId}:${period}`,
    rateLimit: (identifier: string) => `test:ratelimit:${identifier}`,
  },
  cacheTTL: {
    tenant: 3600,
    channel: 1800,
    assistant: 1800,
    conversation: 3600,
    message: 300,
    user: 1800,
    session: 86400,
    quota: 300,
    rateLimit: 300,
    channelList: 600,
    assistantList: 600,
    conversationList: 300,
    messageList: 300,
    stats: 300,
  },
}));

// Mock jobs/queue system
vi.mock('../src/jobs/index', () => ({
  addJob: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
}));
