import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @prisma/client so we don't need a generated client for unit tests.
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {
      _options: unknown;
      constructor(options?: unknown) {
        this._options = options;
      }
    },
  };
});

describe('client.ts internals', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Set DATABASE_URL by default so module-level getClient() doesn't throw
    process.env = { ...originalEnv, DATABASE_URL: 'postgresql://test:test@localhost:5432/test' };
    // Clear serverless env vars by default
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.SERVERLESS;
    delete process.env.DATABASE_POOL_SIZE;
    // Clear the global singleton
    const g = globalThis as unknown as { __prisma: unknown };
    g.__prisma = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolvePoolSize', () => {
    it('returns 5 as default for serverless environments', async () => {
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(true)).toBe(5);
    });

    it('returns 20 as default for long-running environments', async () => {
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(false)).toBe(20);
    });

    it('caps serverless pool size at 5 even if DATABASE_POOL_SIZE is higher', async () => {
      process.env.DATABASE_POOL_SIZE = '10';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(true)).toBe(5);
    });

    it('caps long-running pool size at 20 even if DATABASE_POOL_SIZE is higher', async () => {
      process.env.DATABASE_POOL_SIZE = '50';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(false)).toBe(20);
    });

    it('respects DATABASE_POOL_SIZE when within range for serverless', async () => {
      process.env.DATABASE_POOL_SIZE = '3';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(true)).toBe(3);
    });

    it('respects DATABASE_POOL_SIZE when within range for long-running', async () => {
      process.env.DATABASE_POOL_SIZE = '15';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(false)).toBe(15);
    });

    it('enforces minimum pool size of 1', async () => {
      process.env.DATABASE_POOL_SIZE = '0';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(true)).toBe(1);
      expect(_resolvePoolSize(false)).toBe(1);
    });

    it('handles negative DATABASE_POOL_SIZE by clamping to 1', async () => {
      process.env.DATABASE_POOL_SIZE = '-5';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(true)).toBe(1);
    });

    it('falls back to default when DATABASE_POOL_SIZE is not a number', async () => {
      process.env.DATABASE_POOL_SIZE = 'abc';
      const { _resolvePoolSize } = await import('../../src/client.js');
      expect(_resolvePoolSize(true)).toBe(5);
      expect(_resolvePoolSize(false)).toBe(20);
    });
  });

  describe('appendConnectionLimit', () => {
    it('appends connection_limit to a URL without query params', async () => {
      const { _appendConnectionLimit } = await import('../../src/client.js');
      const result = _appendConnectionLimit(
        'postgresql://user:pass@localhost:5432/db',
        5
      );
      expect(result).toBe(
        'postgresql://user:pass@localhost:5432/db?connection_limit=5'
      );
    });

    it('appends connection_limit with & when URL already has query params', async () => {
      const { _appendConnectionLimit } = await import('../../src/client.js');
      const result = _appendConnectionLimit(
        'postgresql://user:pass@localhost:5432/db?schema=public',
        10
      );
      expect(result).toBe(
        'postgresql://user:pass@localhost:5432/db?schema=public&connection_limit=10'
      );
    });

    it('does not duplicate connection_limit if already present', async () => {
      const { _appendConnectionLimit } = await import('../../src/client.js');
      const url = 'postgresql://user:pass@localhost:5432/db?connection_limit=3';
      const result = _appendConnectionLimit(url, 10);
      expect(result).toBe(url);
    });

    it('handles connection_limit in the middle of query params', async () => {
      const { _appendConnectionLimit } = await import('../../src/client.js');
      const url =
        'postgresql://user:pass@localhost:5432/db?connection_limit=3&schema=public';
      const result = _appendConnectionLimit(url, 10);
      expect(result).toBe(url);
    });
  });

  describe('isServerlessEnvironment', () => {
    it('returns true when VERCEL is set', async () => {
      process.env.VERCEL = '1';
      const { _isServerlessEnvironment } = await import('../../src/client.js');
      expect(_isServerlessEnvironment()).toBe(true);
    });

    it('returns true when AWS_LAMBDA_FUNCTION_NAME is set', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function';
      const { _isServerlessEnvironment } = await import('../../src/client.js');
      expect(_isServerlessEnvironment()).toBe(true);
    });

    it('returns true when SERVERLESS is set', async () => {
      process.env.SERVERLESS = 'true';
      const { _isServerlessEnvironment } = await import('../../src/client.js');
      expect(_isServerlessEnvironment()).toBe(true);
    });

    it('returns false when no serverless env vars are set', async () => {
      const { _isServerlessEnvironment } = await import('../../src/client.js');
      expect(_isServerlessEnvironment()).toBe(false);
    });
  });

  describe('createPrismaClient', () => {
    it('throws a descriptive error when DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      // Need to set it temporarily for module load, then unset for the test
      process.env.DATABASE_URL = 'postgresql://temp:temp@localhost:5432/temp';
      const { _createPrismaClient } = await import('../../src/client.js');
      // Now remove it and call the function directly
      delete process.env.DATABASE_URL;
      expect(() => _createPrismaClient()).toThrow(
        '[database] DATABASE_URL environment variable is not set.'
      );
    });

    it('includes helpful context in the error message', async () => {
      process.env.DATABASE_URL = 'postgresql://temp:temp@localhost:5432/temp';
      const { _createPrismaClient } = await import('../../src/client.js');
      delete process.env.DATABASE_URL;
      expect(() => _createPrismaClient()).toThrow(
        'Cannot initialize Prisma client without a connection string.'
      );
    });

    it('creates a PrismaClient when DATABASE_URL is set', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      const { _createPrismaClient } = await import('../../src/client.js');
      const client = _createPrismaClient();
      expect(client).toBeDefined();
    });

    it('appends connection_limit to the URL for long-running env', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      const { _createPrismaClient } = await import('../../src/client.js');
      const client = _createPrismaClient() as unknown as {
        _options: { datasources: { db: { url: string } } };
      };
      expect(client._options.datasources.db.url).toContain(
        'connection_limit=20'
      );
    });

    it('uses pool size 5 in serverless environments', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      process.env.VERCEL = '1';
      const { _createPrismaClient } = await import('../../src/client.js');
      const client = _createPrismaClient() as unknown as {
        _options: { datasources: { db: { url: string } } };
      };
      expect(client._options.datasources.db.url).toContain(
        'connection_limit=5'
      );
    });

    it('respects custom DATABASE_POOL_SIZE within cap', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      process.env.DATABASE_POOL_SIZE = '10';
      const { _createPrismaClient } = await import('../../src/client.js');
      const client = _createPrismaClient() as unknown as {
        _options: { datasources: { db: { url: string } } };
      };
      expect(client._options.datasources.db.url).toContain(
        'connection_limit=10'
      );
    });
  });

  describe('getClient (singleton behavior)', () => {
    it('reuses the global instance in serverless environments', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      process.env.VERCEL = '1';

      const { _getClient } = await import('../../src/client.js');
      const client1 = _getClient();
      const client2 = _getClient();
      expect(client1).toBe(client2);
    });

    it('creates a new instance each call in long-running environments', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';

      const { _createPrismaClient } = await import('../../src/client.js');
      const client1 = _createPrismaClient();
      const client2 = _createPrismaClient();
      // Each call creates a new instance
      expect(client1).not.toBe(client2);
    });
  });

  describe('module-level prisma export', () => {
    it('throws at module load when DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      await expect(import('../../src/client.js')).rejects.toThrow(
        'DATABASE_URL environment variable is not set'
      );
    });
  });
});
