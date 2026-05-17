import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '@/lib/db';

// Force dynamic rendering — this route uses runtime env vars and database
export const dynamic = 'force-dynamic';

const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_PROVIDER !== 'r2', // R2 uses virtual-hosted style
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
});

const BUCKET = process.env.S3_BUCKET || 'clip-app-videos';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10) * 1024 * 1024;

const ALLOWED_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
];

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

/**
 * POST /api/upload
 * Generate a presigned S3 upload URL for the client and persist a Video record.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, contentType, size } = body as {
      filename: string;
      contentType: string;
      size: number;
    };

    // Validation
    if (!filename || !contentType || !size) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNSUPPORTED_FORMAT', message: 'Unsupported video format' } },
        { status: 400 }
      );
    }

    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: { code: 'FILE_TOO_LARGE', message: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` } },
        { status: 400 }
      );
    }

    // Generate video ID and storage key
    const videoId = randomUUID();
    const safeName = sanitizeFilename(filename);
    const extension = safeName.split('.').pop() || 'mp4';
    const storageKey = `uploads/${videoId}/original.${extension}`;

    // TODO: Replace with real authenticated user ID from auth middleware
    const userId = request.headers.get('x-user-id') || '00000000-0000-0000-0000-000000000000';

    // Ensure the dev user exists (foreign key constraint requires a valid User)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'dev@localhost',
        name: 'Dev User',
      },
    });

    // Persist Video record with status "uploading"
    const video = await prisma.video.create({
      data: {
        id: videoId,
        userId,
        originalName: filename,
        storageKey,
        status: 'uploading',
        tags: [],
      },
    });

    // Generate real presigned URL for client-side upload
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      ContentType: contentType,
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 3600 });

    return NextResponse.json({
      success: true,
      data: {
        videoId: video.id,
        uploadUrl,
        storageKey,
        expiresIn: 3600, // URL valid for 1 hour
      },
    });
  } catch (error) {
    console.error('Upload route error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
