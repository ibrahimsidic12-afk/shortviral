import IORedis from 'ioredis';

let redis: IORedis | null = null;

/**
 * Get or create Redis connection singleton.
 * Used by BullMQ for job queue management.
 */
export function getRedisConnection(): IORedis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    redis = new IORedis(url, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected');
    });

    redis.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });
  }

  return redis;
}
