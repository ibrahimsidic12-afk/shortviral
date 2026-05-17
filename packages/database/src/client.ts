import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined;
};

/**
 * Detects whether the current environment is serverless
 * (Vercel, AWS Lambda, or explicitly marked via SERVERLESS env var).
 */
function isServerlessEnvironment(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.SERVERLESS
  );
}

/**
 * Resolves the effective connection pool size based on environment.
 *
 * - Serverless: default 5, capped at 5
 * - Long-running: default 20, capped at 20
 * - Minimum is always 1
 *
 * Reads from DATABASE_POOL_SIZE environment variable.
 */
function resolvePoolSize(isServerless: boolean): number {
  const maxPool = isServerless ? 5 : 20;
  const defaultPool = maxPool;

  const envValue = process.env.DATABASE_POOL_SIZE;
  const parsed = envValue ? parseInt(envValue, 10) : defaultPool;

  // Guard against NaN from invalid env values
  const effective = Number.isNaN(parsed) ? defaultPool : parsed;

  return Math.max(1, Math.min(effective, maxPool));
}

/**
 * Appends `connection_limit` to the DATABASE_URL if not already present.
 */
function appendConnectionLimit(url: string, poolSize: number): string {
  // Check if connection_limit is already specified in the URL
  if (/[?&]connection_limit=/i.test(url)) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=${poolSize}`;
}

/**
 * Creates a new PrismaClient instance with environment-appropriate configuration.
 *
 * @throws Error if DATABASE_URL is not set
 */
function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      '[database] DATABASE_URL environment variable is not set. ' +
        'Cannot initialize Prisma client without a connection string.'
    );
  }

  const isServerless = isServerlessEnvironment();
  const poolSize = resolvePoolSize(isServerless);
  const urlWithPool = appendConnectionLimit(databaseUrl, poolSize);

  return new PrismaClient({
    datasources: {
      db: { url: urlWithPool },
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });
}

/**
 * Returns the Prisma client instance using the appropriate strategy:
 *
 * - Serverless: attaches to globalThis to survive hot reloads, pool max 5
 * - Long-running: creates a single instance per process, pool max 20
 *
 * Uses lazy initialization to avoid throwing at module import time
 * (e.g., during Next.js build when DATABASE_URL is not set).
 */
function getClient(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = createPrismaClient();
  }
  return globalForPrisma.__prisma;
}

/**
 * Lazy-initialized Prisma client proxy.
 * Defers actual client creation until first property access,
 * allowing the module to be imported at build time without DATABASE_URL.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Export internals for testing
export {
  createPrismaClient as _createPrismaClient,
  getClient as _getClient,
  resolvePoolSize as _resolvePoolSize,
  appendConnectionLimit as _appendConnectionLimit,
  isServerlessEnvironment as _isServerlessEnvironment,
};
