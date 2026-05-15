/**
 * Output format presets for different social media platforms.
 * Each preset defines resolution, aspect ratio, codec settings, and platform-specific optimizations.
 */

export interface OutputPreset {
  name: string;
  platform: 'tiktok' | 'reels' | 'shorts' | 'twitter' | 'square' | 'landscape';
  width: number;
  height: number;
  aspectRatio: string;
  maxDuration: number; // seconds
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  videoCodec: string;
  audioCodec: string;
  pixelFormat: string;
  // FFmpeg-specific optimization flags
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  crf: number; // Constant Rate Factor (0-51, lower = better quality)
}

export const PRESETS: Record<string, OutputPreset> = {
  // 9:16 Vertical (TikTok, Reels, Shorts)
  'tiktok-1080': {
    name: 'TikTok HD',
    platform: 'tiktok',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 180,
    fps: 30,
    videoBitrate: '4M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'fast',
    crf: 23,
  },

  'reels-1080': {
    name: 'Instagram Reels HD',
    platform: 'reels',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 90,
    fps: 30,
    videoBitrate: '5M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'fast',
    crf: 22,
  },

  'shorts-1080': {
    name: 'YouTube Shorts HD',
    platform: 'shorts',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    maxDuration: 60,
    fps: 30,
    videoBitrate: '6M',
    audioBitrate: '192k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'medium',
    crf: 20,
  },

  // 1:1 Square
  'square-1080': {
    name: 'Square HD',
    platform: 'square',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    maxDuration: 60,
    fps: 30,
    videoBitrate: '4M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'fast',
    crf: 23,
  },

  // 16:9 Landscape (YouTube, Twitter)
  'landscape-1080': {
    name: 'Landscape HD',
    platform: 'landscape',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    maxDuration: 600,
    fps: 30,
    videoBitrate: '6M',
    audioBitrate: '192k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'medium',
    crf: 21,
  },

  'twitter-720': {
    name: 'Twitter/X Video',
    platform: 'twitter',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    maxDuration: 140,
    fps: 30,
    videoBitrate: '3M',
    audioBitrate: '128k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'fast',
    crf: 24,
  },

  // High quality export
  'export-4k': {
    name: '4K Export',
    platform: 'landscape',
    width: 3840,
    height: 2160,
    aspectRatio: '16:9',
    maxDuration: 600,
    fps: 30,
    videoBitrate: '20M',
    audioBitrate: '320k',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    pixelFormat: 'yuv420p',
    preset: 'slow',
    crf: 18,
  },
};

/**
 * Get a preset by key, with fallback to tiktok-1080
 */
export function getPreset(key: string): OutputPreset {
  return PRESETS[key] || PRESETS['tiktok-1080']!;
}
