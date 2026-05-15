import { createQueues, createWorkers, gracefulShutdown } from './queue/setup.js';
import { logger } from './lib/logger.js';

/**
 * Worker Entry Point
 * 
 * Starts BullMQ workers for all job types:
 * - transcribe: Audio → text via Regolo Whisper
 * - detect-highlights: Transcript → clip suggestions via LLM
 * - generate-captions: Clip → styled subtitle files
 * - render-clip: FFmpeg video composition
 * - generate-preview: Low-quality preview for instant feedback
 */
async function main() {
  logger.info('Starting ClipAI Worker...');

  // Initialize queues
  const queues = createQueues();
  logger.info(`Initialized ${Object.keys(queues).length} job queues`);

  // Start workers
  const workers = createWorkers();
  logger.info(`Started ${workers.length} workers`);

  // Health check log
  const interval = setInterval(() => {
    logger.debug('Worker heartbeat', {
      uptime: process.uptime(),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    });
  }, 30_000);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    clearInterval(interval);
    await gracefulShutdown(workers, queues);
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('Worker ready and listening for jobs');
}

main().catch((error) => {
  logger.error('Worker failed to start', error);
  process.exit(1);
});
