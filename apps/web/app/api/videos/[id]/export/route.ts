import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { toPrismaJobType } from '@clip-ai/database';

// Force dynamic rendering — these routes need database access at runtime
export const dynamic = 'force-dynamic';

/**
 * POST /api/videos/:id/export
 * Queue a render job for a clip with the specified settings.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;
    const body = await request.json();
    const { clipId, startTime, endTime, platform, captionStyle } = body as {
      clipId?: string;
      startTime: number;
      endTime: number;
      platform: string;
      captionStyle: string;
    };

    // Validate
    if (startTime === undefined || endTime === undefined || !platform) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: startTime, endTime, platform' } },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'endTime must be greater than startTime' } },
        { status: 400 }
      );
    }

    // Verify video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, storageKey: true, status: true },
    });

    if (!video) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
        { status: 404 }
      );
    }

    // Create a render job
    const job = await prisma.job.create({
      data: {
        type: toPrismaJobType('render-clip'),
        status: 'waiting',
        videoId: video.id,
        clipId: clipId || null,
        payload: {
          videoStorageKey: video.storageKey,
          startTime,
          endTime,
          platform,
          captionStyle,
          preset: getPresetKey(platform),
        },
      },
    });

    // Update clip status if provided
    if (clipId) {
      await prisma.clip.update({
        where: { id: clipId },
        data: { status: 'queued' },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        message: 'Export job queued successfully',
      },
    });
  } catch (error) {
    console.error('Export route error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to queue export' } },
      { status: 500 }
    );
  }
}

/**
 * Maps platform name to the correct video-core preset key.
 */
function getPresetKey(platform: string): string {
  const mapping: Record<string, string> = {
    tiktok: 'tiktok-1080',
    reels: 'reels-1080',
    shorts: 'shorts-1080',
    twitter: 'twitter-720',
    square: 'square-1080',
    landscape: 'landscape-1080',
  };
  return mapping[platform] || 'tiktok-1080';
}
