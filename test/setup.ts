// Set NODE_ENV to 'test' BEFORE any imports to ensure proper environment setup
process.env.NODE_ENV = 'test';

import { config } from 'dotenv';

// Load test environment variables from .env.test
// This must happen before any imports that depend on env config
config({ path: '.env.test' });

import { DatabaseTestHelper } from './helpers/database.helper';

// Global test setup
beforeAll(async () => {
  // Additional test environment setup
  process.env.LOG_LEVEL = 'error'; // Reduce noise during tests
  
  // Initialize test database
  try {
    await DatabaseTestHelper.initialize();
  } catch (error) {
    console.error('Failed to initialize test database:', error);
    throw error;
  }
});

afterAll(async () => {
  // Global cleanup - clean up any remaining test data
  try {
    await DatabaseTestHelper.cleanup();
  } catch (error) {
    console.warn('Global cleanup warning:', error);
  }
});

// Global test configuration
jest.setTimeout(15000); // Increase timeout for integration tests

// Mock external services by default
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Redis to avoid external dependencies in tests
jest.mock('../src/lib/redis', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(0),
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