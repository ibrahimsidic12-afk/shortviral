import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering — this route reads request headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/videos
 * Returns paginated list of videos for the authenticated user.
 * Supports filtering by status and search by name.
 *
 * Query params:
 *   page (default: 1)
 *   pageSize (default: 20, max: 50)
 *   status (optional: filter by video status)
 *   search (optional: search by original filename)
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Replace with real authenticated user ID from auth middleware
    const userId = request.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    // Try to query the database; if unavailable, return empty list
    try {
      const { prisma } = await import('@/lib/db');

      const where: Record<string, unknown> = { userId };
      if (status) where.status = status;
      if (search) where.originalName = { contains: search, mode: 'insensitive' };

      const skip = (page - 1) * pageSize;

      const [data, total] = await Promise.all([
        prisma.video.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          select: {
            id: true,
            originalName: true,
            status: true,
            thumbnailUrl: true,
            metadata: true,
            tags: true,
            error: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { clips: true } },
          },
        }),
        prisma.video.count({ where }),
      ]);

      // Flatten _count into clipCount
      const videos = data.map(({ _count, ...video }) => ({
        ...video,
        clipCount: _count.clips,
      }));

      return NextResponse.json({
        success: true,
        data: {
          data: videos,
          page,
          pageSize,
          total,
          hasNext: page * pageSize < total,
        },
      });
    } catch (dbError) {
      // Database not available — return empty list so the UI still works
      console.warn('Database unavailable, returning empty video list:', (dbError as Error).message);
      return NextResponse.json({
        success: true,
        data: { data: [], page: 1, pageSize: 20, total: 0, hasNext: false },
      });
    }
  } catch (error) {
    console.error('Videos list error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch videos' } },
      { status: 500 }
    );
  }
}
