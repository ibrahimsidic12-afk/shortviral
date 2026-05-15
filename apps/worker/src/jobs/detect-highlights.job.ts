import { Job } from 'bullmq';
import { RegoloClient } from '@clip-ai/regolo-client';
import { downloadToTemp } from '../lib/storage.js';
import { logger } from '../lib/logger.js';
import { readFile } from 'fs/promises';

interface HighlightPayload {
  videoId: string;
  transcriptId: string;
  maxClips?: number;
  targetPlatform?: string;
  criteria?: string;
}

interface HighlightResult {
  clipIds: string[];
  count: number;
}

/**
 * Highlight Detection Job Processor
 * 
 * Pipeline:
 * 1. Load transcript from storage
 * 2. Send to Regolo LLM for highlight analysis
 * 3. Score and rank clip candidates
 * 4. Store clip suggestions in database
 */
export async function processHighlightDetection(
  job: Job<HighlightPayload, HighlightResult>
): Promise<HighlightResult> {
  const { videoId, transcriptId, maxClips = 5, targetPlatform = 'all', criteria } = job.data;

  logger.info(`Starting highlight detection for video: ${videoId}`);
  await job.updateProgress(10);

  // Step 1: Load transcript
  const transcriptKey = `transcripts/${videoId}/${transcriptId}.json`;
  const transcriptPath = await downloadToTemp(transcriptKey, 'json');
  const transcriptData = JSON.parse(await readFile(transcriptPath, 'utf-8'));
  await job.updateProgress(20);

  // Step 2: Analyze with Regolo LLM
  const regolo = new RegoloClient({
    apiKey: process.env.REGOLO_API_KEY || '',
    baseURL: process.env.REGOLO_BASE_URL,
  });

  const highlights = await regolo.detectHighlights(
    transcriptData.text,
    transcriptData.duration,
    {
      maxClips,
      targetPlatform: targetPlatform as 'tiktok' | 'reels' | 'shorts' | 'all',
      criteria,
      minDuration: 15,
      maxDuration: 90,
    }
  );
  await job.updateProgress(70);

  logger.info(`Found ${highlights.clips.length} highlight candidates`, {
    videoId,
    processingTime: highlights.processingTime,
    topScore: highlights.clips[0]?.viralityScore,
  });

  // Step 3: Store clip suggestions
  // TODO: Save to database (Prisma/Drizzle)
  // For now, we simulate clip IDs
  const clipIds = highlights.clips.map((clip, index) => {
    const clipId = `clip-${videoId.slice(0, 8)}-${index}`;
    logger.info(`Clip ${index + 1}: ${clip.startTime}s-${clip.endTime}s (score: ${clip.viralityScore})`, {
      hookText: clip.hookText,
      tags: clip.tags,
    });
    return clipId;
  });

  await job.updateProgress(90);

  // Step 4: Enqueue caption generation for each clip
  const { Queue } = await import('bullmq');
  const { getRedisConnection } = await import('../lib/redis.js');
  const captionQueue = new Queue('generate-captions', {
    connection: getRedisConnection(),
  });

  for (const clipId of clipIds) {
    await captionQueue.add('generate-captions', {
      clipId,
      transcriptId,
      style: 'bold', // Default style
    }, { priority: 3 });
  }

  await captionQueue.close();
  await job.updateProgress(100);

  return { clipIds, count: clipIds.length };
}
