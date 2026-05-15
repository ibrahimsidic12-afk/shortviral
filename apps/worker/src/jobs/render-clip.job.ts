import { Job } from 'bullmq';
import { renderClip, getPreset } from '@clip-ai/video-core';
import { downloadToTemp, uploadFromPath } from '../lib/storage.js';
import { logger } from '../lib/logger.js';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

interface RenderPayload {
  clipId: string;
  videoStorageKey: string;
  subtitleStorageKey?: string;
  preset: string;
  startTime: number;
  endTime: number;
  crop?: { x: number; y: number; width: number; height: number };
  fadeIn?: number;
  fadeOut?: number;
}

interface RenderResult {
  outputStorageKey: string;
  fileSize: number;
  duration: number;
}

/**
 * Render Clip Job Processor
 * 
 * Pipeline:
 * 1. Download source video from S3
 * 2. Download subtitle file (if specified)
 * 3. Render clip with FFmpeg (trim + crop + scale + captions + encode)
 * 4. Upload rendered clip to S3
 * 5. Cleanup temp files
 */
export async function processRenderClip(
  job: Job<RenderPayload, RenderResult>
): Promise<RenderResult> {
  const {
    clipId,
    videoStorageKey,
    subtitleStorageKey,
    preset: presetKey,
    startTime,
    endTime,
    crop,
    fadeIn = 0.3,
    fadeOut = 0.5,
  } = job.data;

  logger.info(`Starting render for clip: ${clipId}`, { preset: presetKey, startTime, endTime });
  await job.updateProgress(5);

  const tempFiles: string[] = [];

  try {
    // Step 1: Download source video
    const videoPath = await downloadToTemp(videoStorageKey);
    tempFiles.push(videoPath);
    logger.info(`Downloaded source video: ${videoPath}`);
    await job.updateProgress(20);

    // Step 2: Download subtitles (if available)
    let subtitlePath: string | undefined;
    if (subtitleStorageKey) {
      subtitlePath = await downloadToTemp(subtitleStorageKey, 'ass');
      tempFiles.push(subtitlePath);
      await job.updateProgress(25);
    }

    // Step 3: Render with FFmpeg
    const preset = getPreset(presetKey);
    const outputPath = join(tmpdir(), `clipai-render-${randomUUID()}.mp4`);
    tempFiles.push(outputPath);

    await renderClip({
      inputPath: videoPath,
      outputPath,
      startTime,
      endTime,
      preset,
      crop,
      subtitlePath,
      fadeIn,
      fadeOut,
      onProgress: (percent) => {
        // Map 25-85% of job progress to render progress
        const jobProgress = 25 + Math.round(percent * 0.6);
        job.updateProgress(jobProgress);
      },
    });

    logger.info(`Render complete: ${outputPath}`);
    await job.updateProgress(85);

    // Step 4: Upload rendered clip to S3
    const outputKey = `clips/${clipId}/rendered_${presetKey}.mp4`;
    const { url, size } = await uploadFromPath(outputPath, outputKey, 'video/mp4');

    logger.info(`Uploaded rendered clip: ${outputKey}`, { fileSize: size });
    await job.updateProgress(95);

    // Step 5: Cleanup
    await Promise.allSettled(tempFiles.map(f => unlink(f)));
    await job.updateProgress(100);

    return {
      outputStorageKey: outputKey,
      fileSize: size,
      duration: endTime - startTime,
    };
  } catch (error) {
    // Cleanup on error
    await Promise.allSettled(tempFiles.map(f => unlink(f)));
    throw error;
  }
}
