import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { toPrismaJobType } from '@clip-ai/database';

// Force dynamic rendering — these routes need database access at runtime
export const dynamic = 'force-dynamic';

/**
 * POST /api/videos/:id/process
 * Trigger AI processing pipeline for uploaded video.
 * Validates video exists and is in "uploaded" status, creates a Job record
 * of type "transcribe" with status "waiting", and updates Video status to "processing".
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Video ID required' } },
        { status: 400 }
      );
    }

    // Look up the video by ID
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { user: { select: { id: true, credits: true } } },
    });

    // If video doesn't exist, return 404 with NOT_FOUND code
    if (!video) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
        { status: 404 }
      );
    }

    // Check user has credits remaining
    if (video.user.credits <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_CREDITS',
            message: 'No processing credits remaining. Upgrade your plan to continue.',
          },
        },
        { status: 402 }
      );
    }

    // TODO: Validate video belongs to authenticated user once auth is implemented
    // When auth is added, check video.userId against the authenticated user's ID
    // and return NOT_FOUND if they don't match.

    // If video isn't in "uploaded" status, return 400 with VALIDATION_ERROR code
    if (video.status !== 'uploaded') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Video must be in "uploaded" status to process. Current status: "${video.status}"`,
          },
        },
        { status: 400 }
      );
    }

    // Use a Prisma transaction to create Job, update Video, and decrement credits atomically
    const job = await prisma.$transaction(async (tx) => {
      // Create a Job record of type "transcribe" with status "waiting"
      const newJob = await tx.job.create({
        data: {
          type: toPrismaJobType('transcribe'),
          status: 'waiting',
          videoId: video.id,
          payload: { storageKey: video.storageKey },
        },
      });

      // Update Video status to "processing"
      await tx.video.update({
        where: { id: video.id },
        data: { status: 'processing' },
      });

      // Decrement user credits
      await tx.user.update({
        where: { id: video.user.id },
        data: { credits: { decrement: 1 } },
      });

      return newJob;
    });

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        status: 'processing',
        message: 'Video processing pipeline started',
        job: {
          id: job.id,
          type: 'transcribe',
          status: job.status,
        },
      },
    });
  } catch (error) {
    console.error('Process route error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to start processing' } },
      { status: 500 }
    );
  }
}
