import ffmpeg from 'fluent-ffmpeg';
import type { OutputPreset } from '../formats.js';

export interface RenderClipOptions {
  inputPath: string;
  outputPath: string;
  startTime: number;
  endTime: number;
  preset: OutputPreset;
  /** Optional crop region for reframing (before scaling) */
  crop?: { x: number; y: number; width: number; height: number };
  /** Optional subtitle file to burn in */
  subtitlePath?: string;
  /** Fade transitions */
  fadeIn?: number;
  fadeOut?: number;
  /** Progress callback (0-100) */
  onProgress?: (percent: number) => void;
}

/**
 * Render a clip with full pipeline: trim → crop → scale → subtitles → encode
 * This is the main "do everything" function for producing final clips.
 */
export async function renderClip(options: RenderClipOptions): Promise<string> {
  const {
    inputPath,
    outputPath,
    startTime,
    endTime,
    preset,
    crop,
    subtitlePath,
    fadeIn = 0,
    fadeOut = 0,
    onProgress,
  } = options;

  const duration = endTime - startTime;

  return new Promise((resolve, reject) => {
    // Build filter chain
    const videoFilters: string[] = [];

    // 1. Crop (if reframing)
    if (crop) {
      videoFilters.push(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`);
    }

    // 2. Scale to target resolution
    videoFilters.push(
      `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`
    );
    videoFilters.push(
      `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black`
    );

    // 3. Fade transitions
    if (fadeIn > 0) {
      videoFilters.push(`fade=t=in:st=0:d=${fadeIn}`);
    }
    if (fadeOut > 0) {
      videoFilters.push(`fade=t=out:st=${duration - fadeOut}:d=${fadeOut}`);
    }

    // 4. Subtitles (must be last in filter chain)
    if (subtitlePath) {
      const escapedPath = subtitlePath.replace(/([:\\'])/g, '\\$1').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
      videoFilters.push(`ass='${escapedPath}'`);
    }

    const cmd = ffmpeg()
      .input(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .videoCodec(preset.videoCodec)
      .audioCodec(preset.audioCodec)
      .videoBitrate(preset.videoBitrate)
      .audioBitrate(preset.audioBitrate)
      .fps(preset.fps)
      .outputOptions([
        `-preset ${preset.preset}`,
        `-crf ${preset.crf}`,
        `-pix_fmt ${preset.pixelFormat}`,
        '-movflags +faststart',
        '-threads 0', // Use all available cores
      ]);

    // Apply video filter chain
    if (videoFilters.length > 0) {
      cmd.outputOptions([`-vf ${videoFilters.join(',')}`]);
    }

    // Progress reporting
    if (onProgress) {
      cmd.on('progress', (progress: { percent?: number }) => {
        onProgress(Math.min(100, Math.round(progress.percent || 0)));
      });
    }

    cmd
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error) => reject(new Error(`Render failed: ${err.message}`)))
      .save(outputPath);
  });
}

export interface BurnCaptionsOptions {
  inputPath: string;
  outputPath: string;
  subtitlePath: string;
  /** Keep original quality (re-encode only video stream) */
  preserveQuality?: boolean;
  onProgress?: (percent: number) => void;
}

/**
 * Burn caption/subtitle file into video.
 * Supports ASS, SRT, and VTT formats.
 */
export async function burnCaptions(options: BurnCaptionsOptions): Promise<string> {
  const { inputPath, outputPath, subtitlePath, preserveQuality = true, onProgress } = options;

  return new Promise((resolve, reject) => {
    const escapedPath = subtitlePath.replace(/([:\\'])/g, '\\$1');

    // Detect subtitle format from extension
    const ext = subtitlePath.split('.').pop()?.toLowerCase();
    const subtitleFilter = ext === 'ass'
      ? `ass='${escapedPath}'`
      : `subtitles='${escapedPath}'`;

    const cmd = ffmpeg(inputPath)
      .outputOptions([`-vf ${subtitleFilter}`]);

    if (preserveQuality) {
      cmd.outputOptions([
        '-c:v libx264',
        '-crf 18',
        '-preset fast',
        '-c:a copy', // Don't re-encode audio
      ]);
    }

    if (onProgress) {
      cmd.on('progress', (progress: { percent?: number }) => {
        onProgress(Math.min(100, Math.round(progress.percent || 0)));
      });
    }

    cmd
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error) => reject(new Error(`Caption burn failed: ${err.message}`)))
      .save(outputPath);
  });
}
