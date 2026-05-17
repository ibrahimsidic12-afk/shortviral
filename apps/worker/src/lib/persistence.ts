import { prisma, VideoStatus, ClipStatus, JobStatus, Platform } from '@clip-ai/database';
import { logger } from './logger.js';

/**
 * Input data for creating a Transcript record.
 */
export interface CreateTranscriptInput {
  videoId: string;
  text: string;
  language: string;
  duration: number;
  segmentCount: number;
  wordCount: number;
  model: string;
  storageKey: string;
  processingTime: number;
}

/**
 * Clip settings shape stored as JSON in the database.
 */
export type ClipSettingsJson = {
  platform?: string;
  captionStyle?: string;
  captionAnimation?: string;
  autoReframe?: boolean;
  fadeIn?: boolean;
  fadeOut?: boolean;
  volume?: number;
  musicTrackId?: string | null;
  musicVolume?: number | null;
  [key: string]: string | number | boolean | null | undefined;
};

/**
 * Input data for a single clip to be created.
 */
export interface ClipInput {
  startTime: number;
  endTime: number;
  duration: number;
  hookText: string;
  reason: string;
  viralityScore: number;
  tags?: string[];
  settings?: ClipSettingsJson;
}

/**
 * Input data for batch-creating Clip records.
 */
export interface CreateClipsInput {
  videoId: string;
  userId: string;
  clips: ClipInput[];
}

/**
 * Maximum number of clips that can be created in a single batch call.
 */
const MAX_CLIPS_PER_BATCH = 20;

/**
 * Maximum size for job result JSON (64 KB).
 */
const MAX_RESULT_SIZE = 64 * 1024;

/**
 * Maximum length for error messages stored in the Job record.
 */
const MAX_ERROR_LENGTH = 2048;

/**
 * PersistenceService handles all database writes from the worker,
 * wrapping each operation in retry logic with exponential backoff.
 *
 * Retry strategy: up to 3 attempts with delays of 1s, 2s, 4s.
 * If all retries fail, the error is thrown to trigger BullMQ's
 * job-level retry mechanism.
 */
export class PersistenceService {
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000; // 1 second

  /**
   * Wraps a database operation with retry logic.
   * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
   * Throws the last error if all attempts fail.
   */
  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Database operation failed (attempt ${attempt + 1}/${this.maxRetries})`, {
          error: lastError.message,
        });
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * Updates a Job record to "active" status and sets the startedAt timestamp.
   * Called when any job begins processing.
   */
  async onJobStart(jobId: string): Promise<void> {
    await this.withRetry(() =>
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.active,
          startedAt: new Date(),
        },
      })
    );
  }

  /**
   * Updates a Job record to "completed" status, sets completedAt,
   * and stores the result JSON (truncated to 64KB if necessary).
   * Called when any job finishes successfully.
   */
  async onJobComplete(jobId: string, result: unknown): Promise<void> {
    // Serialize and enforce 64KB limit on result
    let resultJson: unknown = null;
    if (result !== undefined && result !== null) {
      const serialized = JSON.stringify(result);
      if (serialized.length > MAX_RESULT_SIZE) {
        resultJson = { truncated: true, message: 'Result exceeded 64KB limit' };
      } else {
        resultJson = result;
      }
    }

    await this.withRetry(() =>
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.completed,
          completedAt: new Date(),
          result: resultJson as any,
        },
      })
    );
  }

  /**
   * Updates a Job record to "failed" status, stores the error message
   * (truncated to 2048 characters), and updates the related Video or Clip
   * record status to "error".
   * Called when a job fails after exhausting its retry attempts.
   */
  async onJobFailed(
    jobId: string,
    error: string,
    relatedVideoId?: string,
    relatedClipId?: string
  ): Promise<void> {
    const truncatedError = error.length > MAX_ERROR_LENGTH
      ? error.slice(0, MAX_ERROR_LENGTH)
      : error;

    await this.withRetry(async () => {
      // Update the job record
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.failed,
          error: truncatedError,
        },
      });

      // Update related Video status to "error" if applicable
      if (relatedVideoId) {
        await prisma.video.update({
          where: { id: relatedVideoId },
          data: {
            status: VideoStatus.error,
            error: truncatedError,
          },
        });
      }

      // Update related Clip status to "error" if applicable
      if (relatedClipId) {
        await prisma.clip.update({
          where: { id: relatedClipId },
          data: {
            status: ClipStatus.error,
            error: truncatedError,
          },
        });
      }
    });
  }

  /**
   * Updates the Job record progress field with an integer value from 0 to 100.
   * Called periodically while a job is processing.
   */
  async onJobProgress(jobId: string, progress: number): Promise<void> {
    // Clamp progress to 0-100 range
    const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

    await this.withRetry(() =>
      prisma.job.update({
        where: { id: jobId },
        data: {
          progress: clampedProgress,
        },
      })
    );
  }

  /**
   * Creates a Transcript record and updates the Video status to "transcribing".
   * Uses a Prisma transaction to ensure atomicity — either both the Transcript
   * is created and the Video is updated, or neither change is applied.
   *
   * Returns the ID of the newly created Transcript record.
   */
  async createTranscript(data: CreateTranscriptInput): Promise<string> {
    return this.withRetry(async () => {
      const result = await prisma.$transaction(async (tx) => {
        // Create the Transcript record
        const transcript = await tx.transcript.create({
          data: {
            videoId: data.videoId,
            text: data.text,
            language: data.language,
            duration: data.duration,
            segmentCount: data.segmentCount,
            wordCount: data.wordCount,
            model: data.model,
            storageKey: data.storageKey,
            processingTime: data.processingTime,
          },
        });

        // Update the Video status to "transcribing"
        await tx.video.update({
          where: { id: data.videoId },
          data: {
            status: VideoStatus.transcribing,
          },
        });

        return transcript;
      });

      logger.info(`Created transcript ${result.id} for video ${data.videoId}`);
      return result.id;
    });
  }

  /**
   * Batch-creates Clip records with status "suggested" for detected highlights.
   * Caps at 20 clips per call. Updates the Video record status to "analyzing".
   * Uses a Prisma transaction for atomicity.
   *
   * Returns the IDs of the created Clip records.
   */
  async createClips(data: CreateClipsInput): Promise<string[]> {
    // Cap at MAX_CLIPS_PER_BATCH clips
    const clipsToCreate = data.clips.slice(0, MAX_CLIPS_PER_BATCH);

    return this.withRetry(async () => {
      const result = await prisma.$transaction(async (tx) => {
        // Create each clip individually to get back the generated IDs
        const createdClips = await Promise.all(
          clipsToCreate.map((clip) =>
            tx.clip.create({
              data: {
                videoId: data.videoId,
                userId: data.userId,
                startTime: clip.startTime,
                endTime: clip.endTime,
                duration: clip.duration,
                hookText: clip.hookText,
                reason: clip.reason,
                viralityScore: clip.viralityScore,
                tags: clip.tags ?? [],
                status: ClipStatus.suggested,
                settings: (clip.settings ?? {}) as any,
              },
              select: { id: true },
            })
          )
        );

        // Update the Video record status to "analyzing"
        await tx.video.update({
          where: { id: data.videoId },
          data: { status: VideoStatus.analyzing },
        });

        return createdClips.map((c) => c.id);
      });

      logger.info(`Created ${result.length} clips for video ${data.videoId}`, {
        videoId: data.videoId,
        clipCount: result.length,
      });

      return result;
    });
  }

  /**
   * Creates or replaces an Export record for a clip+platform combination,
   * and updates the Clip status to "rendered".
   * Uses a Prisma transaction for atomicity.
   *
   * Per Requirement 6.4: if an export already exists for the same clipId+platform,
   * it is replaced with the new data.
   *
   * @returns The export record ID
   */
  async createExport(data: {
    clipId: string;
    platform: Platform;
    url: string;
    storageKey: string;
    fileSize: number;
    resolution: string;
  }): Promise<string> {
    return this.withRetry(async () => {
      const result = await prisma.$transaction(async (tx) => {
        // Upsert the Export record (unique on clipId+platform)
        const exportRecord = await tx.export.upsert({
          where: {
            clipId_platform: {
              clipId: data.clipId,
              platform: data.platform,
            },
          },
          update: {
            url: data.url,
            storageKey: data.storageKey,
            fileSize: BigInt(data.fileSize),
            resolution: data.resolution,
            exportedAt: new Date(),
          },
          create: {
            clipId: data.clipId,
            platform: data.platform,
            url: data.url,
            storageKey: data.storageKey,
            fileSize: BigInt(data.fileSize),
            resolution: data.resolution,
          },
        });

        // Update the Clip status to "rendered"
        await tx.clip.update({
          where: { id: data.clipId },
          data: { status: ClipStatus.rendered },
        });

        return exportRecord;
      });

      logger.info(`Export created/updated for clip ${data.clipId} on ${data.platform}`, {
        exportId: result.id,
        fileSize: data.fileSize,
        resolution: data.resolution,
      });

      return result.id;
    });
  }
}

/**
 * Singleton instance of the PersistenceService for use across the worker.
 */
export const persistenceService = new PersistenceService();
