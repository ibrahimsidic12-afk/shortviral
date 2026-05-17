import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/videos/:id/status
 * Server-Sent Events endpoint for real-time video processing status.
 * Streams job progress updates to the client until all jobs complete or fail.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let attempts = 0;
      const maxAttempts = 120; // 2 minutes at 1s intervals
      const pollInterval = 1000;

      const poll = async () => {
        try {
          const video = await prisma.video.findUnique({
            where: { id: videoId },
            select: {
              status: true,
              error: true,
              jobs: {
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                  id: true,
                  type: true,
                  status: true,
                  progress: true,
                  error: true,
                },
              },
              _count: { select: { clips: true } },
            },
          });

          if (!video) {
            sendEvent({ type: 'error', message: 'Video not found' });
            controller.close();
            return;
          }

          sendEvent({
            type: 'status',
            videoStatus: video.status,
            error: video.error,
            clipCount: video._count.clips,
            jobs: video.jobs.map(j => ({
              id: j.id,
              type: j.type,
              status: j.status,
              progress: j.progress,
              error: j.error,
            })),
          });

          // Stop streaming if video reached a terminal state
          if (video.status === 'ready' || video.status === 'error') {
            sendEvent({ type: 'complete', finalStatus: video.status });
            controller.close();
            return;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            sendEvent({ type: 'timeout', message: 'Status polling timed out' });
            controller.close();
            return;
          }

          // Schedule next poll
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          await poll();
        } catch (error) {
          sendEvent({ type: 'error', message: (error as Error).message });
          controller.close();
        }
      };

      await poll();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
