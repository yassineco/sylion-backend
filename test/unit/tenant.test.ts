/**
 * Sample unit test for TenantService
 * This is a minimal test to verify the test setup works
 */

// Vitest globals are enabled via vitest config

describe('TenantService', () => {
  describe('Sample Tests', () => {
    it('should pass a basic test', () => {
      expect(1 + 1).toBe(2);
    });

    it('should handle async operations', async () => {
      const result = await Promise.resolve('test');
      expect(result).toBe('test');
    });

    it('should work with mocked modules', async () => {
      // This verifies that our setup.unit.ts mocking works
      const { logger } = await import('@/lib/logger');
      
      logger.info('test message');
      expect(logger.info).toHaveBeenCalledWith('test message');
    });
  });

  describe('Environment Setup', () => {
    it('should have test environment configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.LOG_LEVEL).toBe('error');
    });
  });
});