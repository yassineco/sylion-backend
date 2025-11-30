/**
 * Database Test Helper
 * Provides utilities for managing test database connections and cleanup
 */

import { db, schema } from '../../src/db/index';
import { logger } from '../../src/lib/logger';

export class DatabaseTestHelper {
  /**
   * Initialize test database
   * Ensure the database is clean and ready for tests
   */
  static async initialize(): Promise<void> {
    try {
      // Test database connection
      await db.select().from(schema.tenants).limit(1);
      logger.info('Test database connection established');
    } catch (error) {
      logger.error('Failed to connect to test database:', error);
      throw new Error('Test database connection failed');
    }
  }

  /**
   * Clean up all test data
   * Use with caution - only for test environments
   */
  static async cleanup(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database cleanup only allowed in test environment');
    }

    try {
      // Delete in reverse order of dependencies to avoid foreign key constraints
      await db.delete(schema.documents);
      await db.delete(schema.messages);
      await db.delete(schema.conversations);
      await db.delete(schema.assistants);
      await db.delete(schema.channels);
      await db.delete(schema.tenants);
      
      logger.debug('Test database cleaned up');
    } catch (error) {
      logger.warn('Database cleanup warning:', error);
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Create a test tenant with minimal required data
   */
  static async createTestTenant(suffix: string = 'default') {
    const tenant = await db
      .insert(schema.tenants)
      .values({
        name: `Test Tenant ${suffix}`,
        slug: `test-tenant-${suffix}-${Date.now()}`,
        plan: 'pro',
        contactEmail: `test-${suffix}@example.com`,
        isActive: true
      })
      .returning();

    return tenant[0];
  }

  /**
   * Create a test channel for a tenant
   */
  static async createTestChannel(tenantId: string, suffix: string = 'default') {
    const channel = await db
      .insert(schema.channels)
      .values({
        tenantId,
        name: `Test Channel ${suffix}`,
        type: 'whatsapp',
        isActive: true,
        whatsappPhoneNumber: `+123456789${suffix}`,
        whatsappApiKey: `test-key-${suffix}`
      })
      .returning();

    return channel[0];
  }

  /**
   * Create a test assistant for a tenant
   */
  static async createTestAssistant(tenantId: string, suffix: string = 'default') {
    const assistant = await db
      .insert(schema.assistants)
      .values({
        tenantId,
        name: `Test Assistant ${suffix}`,
        systemPrompt: `You are a test assistant for ${suffix}`,
        model: 'gemini-1.5-pro',
        isActive: true,
        isDefault: true
      })
      .returning();

    return assistant[0];
  }
}