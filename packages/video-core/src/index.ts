// FFmpeg utilities
export { FFmpegBuilder } from './ffmpeg/builder.js';
export { extractAudio, extractKeyframes, getVideoInfo } from './ffmpeg/extract.js';
export { renderClip, burnCaptions } from './ffmpeg/render.js';

// Caption generation
export { generateSRT, generateVTT, generateASS } from './captions/generators.js';
export { formatTimestamp, splitIntoLines } from './captions/utils.js';

// Format presets
export { PRESETS, getPreset, type OutputPreset } from './formats.js';

// Reframing
export { calculateCrop, type CropRegion } from './reframing/crop.js';
