export type Platform = 'tiktok' | 'reels' | 'shorts' | 'twitter' | 'square' | 'landscape';

export interface ExportPreset {
  platform: Platform;
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  maxDuration: number; // seconds
  /** Recommended file size limit (bytes) */
  maxFileSize: number;
  description: string;
}

export const PLATFORM_PRESETS: Record<Platform, ExportPreset> = {
  tiktok: {
    platform: 'tiktok',
    label: 'TikTok',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 180,
    maxFileSize: 287 * 1024 * 1024, // 287 MB
    description: 'Vertical video for TikTok (up to 3 min)',
  },
  reels: {
    platform: 'reels',
    label: 'Instagram Reels',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 90,
    maxFileSize: 250 * 1024 * 1024,
    description: 'Vertical video for Instagram Reels (up to 90s)',
  },
  shorts: {
    platform: 'shorts',
    label: 'YouTube Shorts',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 60,
    maxFileSize: 500 * 1024 * 1024,
    description: 'Vertical video for YouTube Shorts (up to 60s)',
  },
  twitter: {
    platform: 'twitter',
    label: 'Twitter/X',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    maxDuration: 140,
    maxFileSize: 512 * 1024 * 1024,
    description: 'Landscape video for Twitter/X (up to 2:20)',
  },
  square: {
    platform: 'square',
    label: 'Square',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    maxDuration: 60,
    maxFileSize: 250 * 1024 * 1024,
    description: 'Square format for feed posts',
  },
  landscape: {
    platform: 'landscape',
    label: 'Landscape (16:9)',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    maxDuration: 600,
    maxFileSize: 1024 * 1024 * 1024, // 1 GB
    description: 'Standard landscape format for YouTube/web',
  },
};
