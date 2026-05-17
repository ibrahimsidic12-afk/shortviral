import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Force dynamic rendering — these routes need database access at runtime
export const dynamic = 'force-dynamic';

/**
 * GET /api/videos/:id
 * Returns a single video with its clips, transcript, and job status.
 */
export async function GET(
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

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        clips: {
          orderBy: { viralityScore: 'desc' },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            duration: true,
            hookText: true,
            viralityScore: true,
            tags: true,
            status: true,
            exports: {
              select: {
                id: true,
                platform: true,
                url: true,
                resolution: true,
                exportedAt: true,
              },
            },
          },
        },
        transcript: {
          select: {
            id: true,
            language: true,
            duration: true,
            wordCount: true,
            segmentCount: true,
          },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            status: true,
            progress: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        video: {
          id: video.id,
          originalName: video.originalName,
          status: video.status,
          url: video.url,
          thumbnailUrl: video.thumbnailUrl,
          metadata: video.metadata,
          tags: video.tags,
          error: video.error,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
        },
        clips: video.clips,
        transcript: video.transcript,
        jobs: video.jobs,
      },
    });
  } catch (error) {
    console.error('Video detail error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch video' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/videos/:id
 * Update video metadata (tags, name).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;
    const body = await request.json();
    const { tags, originalName } = body as { tags?: string[]; originalName?: string };

    const updateData: Record<string, unknown> = {};
    if (tags !== undefined) updateData.tags = tags;
    if (originalName !== undefined) updateData.originalName = originalName;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No fields to update' } },
        { status: 400 }
      );
    }

    const video = await prisma.video.update({
      where: { id: videoId },
      data: updateData,
      select: { id: true, originalName: true, tags: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, data: video });
  } catch (error) {
    console.error('Video update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update video' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/videos/:id
 * Delete a video and all associated data, queue S3 cleanup.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const videoId = params.id;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        storageKey: true,
        clips: { select: { id: true } },
        transcript: { select: { storageKey: true } },
      },
    });

    if (!video) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
        { status: 404 }
      );
    }

    // Collect all S3 keys to clean up
    const keysToDelete: string[] = [video.storageKey];
    if (video.transcript?.storageKey) {
      keysToDelete.push(video.transcript.storageKey);
    }
    for (const clip of video.clips) {
      // Caption files follow pattern: captions/{clipId}/*.ass
      keysToDelete.push(`captions/${clip.id}/`);
      // Rendered clips follow pattern: clips/{clipId}/*.mp4
      keysToDelete.push(`clips/${clip.id}/`);
    }

    // Cascade delete handles clips, transcript, exports, jobs
    await prisma.video.delete({ where: { id: videoId } });

    // Queue S3 cleanup as a background job (best-effort, don't block response)
    try {
      const { S3Client, DeleteObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_PROVIDER !== 'r2',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || '',
          secretAccessKey: process.env.S3_SECRET_KEY || '',
        },
      });
      const bucket = process.env.S3_BUCKET || 'clip-app-videos';

      // Delete known keys and prefixes
      for (const key of keysToDelete) {
        if (key.endsWith('/')) {
          // It's a prefix — list and delete all objects under it
          const listed = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: key,
          }));
          if (listed.Contents) {
            await Promise.allSettled(
              listed.Contents.map(obj =>
                s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key! }))
              )
            );
          }
        } else {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
        }
      }

      // Also clean up the uploads/{videoId}/ prefix
      const uploadPrefix = `uploads/${videoId}/`;
      const uploadListed = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: uploadPrefix,
      }));
      if (uploadListed.Contents) {
        await Promise.allSettled(
          uploadListed.Contents.map(obj =>
            s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key! }))
          )
        );
      }
    } catch (s3Error) {
      // S3 cleanup is best-effort — log but don't fail the request
      console.warn('S3 cleanup failed (will be orphaned):', (s3Error as Error).message);
    }

    return NextResponse.json({ success: true, data: { deleted: videoId } });
  } catch (error) {
    console.error('Video delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete video' } },
      { status: 500 }
    );
  }
}
