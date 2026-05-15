import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10) * 1024 * 1024;

const ALLOWED_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
];

/**
 * POST /api/upload
 * Generate a presigned S3 upload URL for the client.
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
    const extension = filename.split('.').pop() || 'mp4';
    const storageKey = `uploads/${videoId}/original.${extension}`;

    // TODO: Generate real presigned URL with @aws-sdk/client-s3
    // For now, return a mock response structure
    const uploadUrl = `${process.env.S3_ENDPOINT || 'http://localhost:9000'}/${process.env.S3_BUCKET || 'clip-app-videos'}/${storageKey}`;

    return NextResponse.json({
      success: true,
      data: {
        videoId,
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
