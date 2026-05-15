import ffmpeg from 'fluent-ffmpeg';
import type { OutputPreset } from '../formats.js';

/**
 * FFmpegBuilder - Fluent builder for constructing FFmpeg commands.
 * Optimized for video clipping operations with preset support.
 */
export class FFmpegBuilder {
  private command: ffmpeg.FfmpegCommand;
  private inputPath: string;

  constructor(inputPath: string) {
    this.inputPath = inputPath;
    this.command = ffmpeg(inputPath);
  }

  /**
   * Set input time range (clip trimming)
   */
  trim(startTime: number, endTime: number): this {
    // Use -ss before input for fast seeking
    this.command = ffmpeg()
      .input(this.inputPath)
      .seekInput(startTime)
      .duration(endTime - startTime);
    return this;
  }

  /**
   * Apply output preset (resolution, codec, bitrate)
   */
  applyPreset(preset: OutputPreset): this {
    this.command
      .size(`${preset.width}x${preset.height}`)
      .videoCodec(preset.videoCodec)
      .audioCodec(preset.audioCodec)
      .videoBitrate(preset.videoBitrate)
      .audioBitrate(preset.audioBitrate)
      .fps(preset.fps)
      .outputOptions([
        `-preset ${preset.preset}`,
        `-crf ${preset.crf}`,
        `-pix_fmt ${preset.pixelFormat}`,
        '-movflags +faststart', // Enable streaming playback
      ]);
    return this;
  }

  /**
   * Scale video with padding (letterbox/pillarbox) to match target aspect ratio
   */
  scaleAndPad(width: number, height: number, bgColor = 'black'): this {
    this.command.outputOptions([
      `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${bgColor}`,
    ]);
    return this;
  }

  /**
   * Crop video to region (for reframing)
   */
  crop(x: number, y: number, width: number, height: number): this {
    this.command.outputOptions([
      `-vf crop=${width}:${height}:${x}:${y}`,
    ]);
    return this;
  }

  /**
   * Burn subtitles into video using ASS format
   */
  burnSubtitles(subtitlePath: string): this {
    // Escape path for FFmpeg filter
    const escapedPath = subtitlePath.replace(/([:\\'])/g, '\\$1');
    this.command.outputOptions([
      `-vf ass='${escapedPath}'`,
    ]);
    return this;
  }

  /**
   * Add text overlay (for hook text, watermarks, etc.)
   */
  addTextOverlay(
    text: string,
    options: {
      x?: string;
      y?: string;
      fontSize?: number;
      fontColor?: string;
      borderW?: number;
      startTime?: number;
      endTime?: number;
    } = {}
  ): this {
    const {
      x = '(w-text_w)/2',
      y = 'h-th-50',
      fontSize = 48,
      fontColor = 'white',
      borderW = 3,
      startTime,
      endTime,
    } = options;

    let filter = `drawtext=text='${text.replace(/'/g, "'\\\\\\''")}'`;
    filter += `:x=${x}:y=${y}`;
    filter += `:fontsize=${fontSize}:fontcolor=${fontColor}`;
    filter += `:borderw=${borderW}:bordercolor=black`;

    if (startTime !== undefined && endTime !== undefined) {
      filter += `:enable='between(t,${startTime},${endTime})'`;
    }

    this.command.outputOptions([`-vf ${filter}`]);
    return this;
  }

  /**
   * Set output format options for web delivery
   */
  optimizeForWeb(): this {
    this.command.outputOptions([
      '-movflags +faststart',
      '-brand mp42',
    ]);
    return this;
  }

  /**
   * Add fade in/out transitions
   */
  addFades(fadeInDuration = 0.5, fadeOutDuration = 0.5, totalDuration?: number): this {
    const filters: string[] = [];
    filters.push(`fade=t=in:st=0:d=${fadeInDuration}`);
    if (totalDuration) {
      filters.push(`fade=t=out:st=${totalDuration - fadeOutDuration}:d=${fadeOutDuration}`);
    }
    this.command.outputOptions([`-vf ${filters.join(',')}`]);
    return this;
  }

  /**
   * Execute the command and save to output path.
   * Returns a promise that resolves when complete.
   */
  async save(outputPath: string): Promise<{ outputPath: string; duration: number }> {
    return new Promise((resolve, reject) => {
      let duration = 0;

      this.command
        .on('codecData', (data: { duration?: string }) => {
          if (data.duration) {
            const parts = data.duration.split(':');
            duration = (
              parseFloat(parts[0] || '0') * 3600 +
              parseFloat(parts[1] || '0') * 60 +
              parseFloat(parts[2] || '0')
            );
          }
        })
        .on('end', () => resolve({ outputPath, duration }))
        .on('error', (err: Error) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .save(outputPath);
    });
  }

  /**
   * Get the underlying fluent-ffmpeg command for advanced use
   */
  getCommand(): ffmpeg.FfmpegCommand {
    return this.command;
  }
}
