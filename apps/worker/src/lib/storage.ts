import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: true, // Required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
});

const BUCKET = process.env.S3_BUCKET || 'clip-app-videos';

/**
 * Download a file from S3 to a local temp path.
 */
export async function downloadToTemp(storageKey: string, extension?: string): Promise<string> {
  const ext = extension || storageKey.split('.').pop() || 'tmp';
  const tempPath = join(tmpdir(), `clipai-${randomUUID()}.${ext}`);

  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: storageKey })
  );

  if (!response.Body) {
    throw new Error(`Empty response for key: ${storageKey}`);
  }

  // Stream to disk efficiently
  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  await mkdir(dirname(tempPath), { recursive: true });
  await writeFile(tempPath, Buffer.concat(chunks));

  return tempPath;
}

/**
 * Upload a local file to S3.
 */
export async function uploadFromPath(
  localPath: string,
  storageKey: string,
  contentType?: string
): Promise<{ url: string; size: number }> {
  const { readFile, stat } = await import('fs/promises');
  const fileBuffer = await readFile(localPath);
  const fileStats = await stat(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }),
    { expiresIn: 7 * 24 * 3600 } // 7 day URL
  );

  return { url, size: fileStats.size };
}

/**
 * Upload a buffer directly to S3.
 */
export async function uploadBuffer(
  buffer: Buffer,
  storageKey: string,
  contentType?: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );

  return storageKey;
}

/**
 * Delete a file from S3.
 */
export async function deleteObject(storageKey: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey })
  );
}

/**
 * Generate a presigned URL for downloading.
 */
export async function getPresignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }),
    { expiresIn }
  );
}
