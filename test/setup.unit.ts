// test/setup.unit.ts
// Setup for UNIT tests only - NO database initialization
// Mocks all external dependencies (logger, redis, etc.)

process.env.NODE_ENV = 'test';

import { config } from 'dotenv';
import { vi } from 'vitest';

// Load test environment variables
config({ path: '.env.test' });

// Reduce log noise
process.env.LOG_LEVEL = 'error';

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
