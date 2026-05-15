import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/videos/:id/process
 * Trigger AI processing pipeline for uploaded video.
 * Enqueues transcription → highlight detection → caption generation jobs.
 */
export async function POST(
  request: NextRequest,
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

    // TODO: Validate video exists in database
    // TODO: Enqueue BullMQ job: 'transcribe' → which cascades into highlight detection

    // For now, return success response
    return NextResponse.json({
      success: true,
      data: {
        videoId,
        status: 'processing',
        message: 'Video processing pipeline started',
        jobs: [
          { type: 'transcribe', status: 'queued' },
          { type: 'detect-highlights', status: 'waiting' },
          { type: 'generate-captions', status: 'waiting' },
        ],
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
