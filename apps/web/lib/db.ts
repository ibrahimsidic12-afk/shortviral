/**
 * Database query utilities for the web app.
 *
 * Provides typed, paginated queries for videos, clips, transcripts, and jobs.
 * All functions use the shared Prisma client from @clip-ai/database.
 */

import { prisma, toTSJobType } from '@clip-ai/database';
import type { Video, Clip, Transcript } from '@clip-ai/database';

// ─── Re-export prisma client for direct use in API routes ────
export { prisma } from '@clip-ai/database';

// ─── Types ───────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  total: number;
  hasNext: boolean;
}

export type VideoWithRelations = Video & {
  clips: Clip[];
  transcript: Transcript | null;
};

export interface JobSummary {
  id: string;
  type: string;
  status: string;
  progress: number;
}

// ─── Constants ───────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_PAGE = 1;

// ─── Query Functions ─────────────────────────────────

/**
 * Returns videos for a user, paginated, ordered by createdAt desc.
 *
 * @param userId - The authenticated user's ID
 * @param page - Page number (1-indexed), defaults to 1
 * @param pageSize - Number of results per page, defaults to 20
 */
export async function getVideosByUser(
  userId: string,
  page: number = DEFAULT_PAGE,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<PaginatedResult<Video>> {
  const currentPage = Math.max(1, Math.floor(page));
  const size = Math.max(1, Math.floor(pageSize));
  const skip = (currentPage - 1) * size;

  const [data, total] = await Promise.all([
    prisma.video.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: size,
    }),
    prisma.video.count({ where: { userId } }),
  ]);

  return {
    data,
    page: currentPage,
    total,
    hasNext: currentPage * size < total,
  };
}

/**
 * Returns a single video with its clips and transcript, or null if not found
 * or the video doesn't belong to the specified user.
 *
 * @param videoId - The video's UUID
 * @param userId - The authenticated user's ID (for authorization check)
 */
export async function getVideoWithRelations(
  videoId: string,
  userId: string
): Promise<VideoWithRelations | null> {
  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      userId,
    },
    include: {
      clips: true,
      transcript: true,
    },
  });

  return video;
}

/**
 * Returns all jobs for a video, mapped to a summary format with
 * type converted from Prisma enum (underscores) to TS format (hyphens).
 *
 * @param videoId - The video's UUID
 */
export async function getJobsByVideoId(videoId: string): Promise<JobSummary[]> {
  const jobs = await prisma.job.findMany({
    where: { videoId },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return jobs.map((job) => ({
    id: job.id,
    type: toTSJobType(job.type),
    status: job.status,
    progress: job.progress,
  }));
}
