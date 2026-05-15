import ffmpeg from 'fluent-ffmpeg';
import { resolve } from 'path';

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  codec: string;
  audioCodec: string;
  size: number; // bytes
  format: string;
}

/**
 * Get detailed video metadata using ffprobe
 */
export async function getVideoInfo(inputPath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) {
        reject(new Error(`ffprobe error: ${err.message}`));
        return;
      }

      const videoStream = data.streams.find(s => s.codec_type === 'video');
      const audioStream = data.streams.find(s => s.codec_type === 'audio');

      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      // Parse framerate (can be "30/1" or "29.97")
      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        fps = parts.length === 2
          ? parseFloat(parts[0]!) / parseFloat(parts[1]!)
          : parseFloat(parts[0]!);
      }

      resolve({
        duration: parseFloat(data.format.duration || '0'),
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps: Math.round(fps * 100) / 100,
        bitrate: parseInt(data.format.bit_rate || '0', 10),
        codec: videoStream.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'none',
        size: parseInt(data.format.size || '0', 10),
        format: data.format.format_name || 'unknown',
      });
    });
  });
}

/**
 * Extract audio track from video for transcription.
 * Outputs mono 16kHz WAV (optimal for Whisper).
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string,
  options?: { sampleRate?: number; mono?: boolean; format?: string }
): Promise<string> {
  const sampleRate = options?.sampleRate ?? 16000;
  const format = options?.format ?? 'wav';

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)
      .noVideo()
      .audioChannels(options?.mono !== false ? 1 : 2) // mono by default for Whisper
      .audioFrequency(sampleRate)
      .audioCodec(format === 'wav' ? 'pcm_s16le' : 'libmp3lame')
      .format(format)
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error) => reject(new Error(`Audio extraction failed: ${err.message}`)));

    cmd.save(outputPath);
  });
}

/**
 * Extract keyframes at regular intervals for visual analysis.
 * Returns paths to extracted frame images.
 */
export async function extractKeyframes(
  inputPath: string,
  outputDir: string,
  options?: {
    interval?: number; // seconds between frames
    maxFrames?: number;
    width?: number;
    quality?: number; // 1-31, lower = better
  }
): Promise<Array<{ path: string; timestamp: number }>> {
  const interval = options?.interval ?? 5;
  const maxFrames = options?.maxFrames ?? 20;
  const width = options?.width ?? 640;
  const quality = options?.quality ?? 5;

  // First get duration
  const info = await getVideoInfo(inputPath);
  const totalFrames = Math.min(maxFrames, Math.ceil(info.duration / interval));

  const frames: Array<{ path: string; timestamp: number }> = [];

  // Extract frames using select filter for precise timing
  return new Promise((resolve, reject) => {
    const outputPattern = resolve(outputDir, 'frame_%04d.jpg');

    ffmpeg(inputPath)
      .outputOptions([
        `-vf select='not(mod(n\\,${Math.round(info.fps * interval)}))',scale=${width}:-1`,
        `-vsync vfr`,
        `-qscale:v ${quality}`,
        `-frames:v ${totalFrames}`,
      ])
      .on('end', () => {
        // Build frame list with timestamps
        for (let i = 0; i < totalFrames; i++) {
          const frameNum = String(i + 1).padStart(4, '0');
          frames.push({
            path: resolve(outputDir, `frame_${frameNum}.jpg`),
            timestamp: i * interval,
          });
        }
        resolve(frames);
      })
      .on('error', (err: Error) => reject(new Error(`Keyframe extraction failed: ${err.message}`)))
      .save(outputPattern);
  });
}
