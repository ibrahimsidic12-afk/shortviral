/**
 * Smart reframing: calculate crop regions for converting landscape → portrait.
 * Uses speaker/face position to keep the subject centered.
 */

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SubjectPosition {
  /** Normalized X position (0-1, where 0.5 = center) */
  x: number;
  /** Normalized Y position (0-1, where 0.5 = center) */
  y: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp in seconds */
  timestamp: number;
}

/**
 * Calculate the optimal crop region for reframing.
 * Converts landscape (16:9) to portrait (9:16) while keeping subject in frame.
 */
export function calculateCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: { width: number; height: number },
  subjectPosition?: SubjectPosition,
  options?: {
    /** Smoothing factor for movement (0-1, higher = smoother) */
    smoothing?: number;
    /** Padding around subject (0-1 of crop size) */
    padding?: number;
  }
): CropRegion {
  const padding = options?.padding ?? 0.1;

  // Calculate target crop dimensions
  const targetRatio = targetAspectRatio.width / targetAspectRatio.height;
  const sourceRatio = sourceWidth / sourceHeight;

  let cropWidth: number;
  let cropHeight: number;

  if (sourceRatio > targetRatio) {
    // Source is wider than target → crop width (most common: 16:9 → 9:16)
    cropHeight = sourceHeight;
    cropWidth = Math.round(sourceHeight * targetRatio);
  } else {
    // Source is taller than target → crop height
    cropWidth = sourceWidth;
    cropHeight = Math.round(sourceWidth / targetRatio);
  }

  // Ensure crop doesn't exceed source
  cropWidth = Math.min(cropWidth, sourceWidth);
  cropHeight = Math.min(cropHeight, sourceHeight);

  // Calculate position based on subject
  let centerX: number;
  let centerY: number;

  if (subjectPosition && subjectPosition.confidence > 0.3) {
    // Position crop around subject
    centerX = Math.round(subjectPosition.x * sourceWidth);
    centerY = Math.round(subjectPosition.y * sourceHeight);
  } else {
    // Default: center crop (rule of thirds - slightly above center)
    centerX = Math.round(sourceWidth / 2);
    centerY = Math.round(sourceHeight * 0.45);
  }

  // Apply padding — constrain subject to inner region of crop
  const paddingX = Math.round(cropWidth * padding);
  const paddingY = Math.round(cropHeight * padding);

  // Calculate top-left corner of crop
  let x = centerX - Math.round(cropWidth / 2);
  let y = centerY - Math.round(cropHeight / 2);

  // Clamp to bounds (with padding consideration)
  x = Math.max(paddingX, Math.min(x, sourceWidth - cropWidth - paddingX));
  y = Math.max(paddingY, Math.min(y, sourceHeight - cropHeight - paddingY));

  // Final clamp to ensure we never go out of source bounds
  x = Math.max(0, Math.min(x, sourceWidth - cropWidth));
  y = Math.max(0, Math.min(y, sourceHeight - cropHeight));

  return { x, y, width: cropWidth, height: cropHeight };
}

/**
 * Generate smooth crop keyframes from a series of subject positions.
 * Prevents jarring jumps in the crop region between frames.
 */
export function generateSmoothCropKeyframes(
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: { width: number; height: number },
  positions: SubjectPosition[],
  options?: { smoothing?: number; padding?: number }
): Array<{ timestamp: number; crop: CropRegion }> {
  const smoothing = options?.smoothing ?? 0.7;
  const keyframes: Array<{ timestamp: number; crop: CropRegion }> = [];

  let prevCrop: CropRegion | null = null;

  for (const pos of positions) {
    const rawCrop = calculateCrop(sourceWidth, sourceHeight, targetAspectRatio, pos, options);

    if (prevCrop) {
      // Apply exponential smoothing
      const smoothedCrop: CropRegion = {
        x: Math.round(prevCrop.x * smoothing + rawCrop.x * (1 - smoothing)),
        y: Math.round(prevCrop.y * smoothing + rawCrop.y * (1 - smoothing)),
        width: rawCrop.width,
        height: rawCrop.height,
      };

      // Clamp smoothed values
      smoothedCrop.x = Math.max(0, Math.min(smoothedCrop.x, sourceWidth - smoothedCrop.width));
      smoothedCrop.y = Math.max(0, Math.min(smoothedCrop.y, sourceHeight - smoothedCrop.height));

      keyframes.push({ timestamp: pos.timestamp, crop: smoothedCrop });
      prevCrop = smoothedCrop;
    } else {
      keyframes.push({ timestamp: pos.timestamp, crop: rawCrop });
      prevCrop = rawCrop;
    }
  }

  return keyframes;
}
