/**
 * Regolo Model Catalog
 * 
 * Models available via Regolo's OpenAI-compatible API.
 * Use getModelByCapability() to select the best model for each task.
 */

export interface ModelInfo {
  id: string;
  name: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  description: string;
}

export type ModelCapability = 
  | 'transcription'
  | 'chat'
  | 'vision'
  | 'video-understanding'
  | 'json-output'
  | 'code'
  | 'reasoning';

export const REGOLO_MODELS = {
  // Transcription (Whisper-based)
  WHISPER_LARGE_V3: {
    id: 'faster-whisper-large-v3',
    name: 'Faster Whisper Large V3',
    capabilities: ['transcription'] as ModelCapability[],
    contextWindow: 0, // Audio models don't have context windows
    description: 'Fast, accurate speech-to-text with word-level timestamps',
  },

  // Large Language Models (for highlight detection + caption styling)
  LLAMA_3_3_70B: {
    id: 'Llama-3.3-70B-Instruct',
    name: 'Llama 3.3 70B Instruct',
    capabilities: ['chat', 'json-output', 'reasoning'] as ModelCapability[],
    contextWindow: 128_000,
    description: 'High-quality reasoning and instruction following',
  },

  QWEN_2_5_72B: {
    id: 'Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B Instruct',
    capabilities: ['chat', 'json-output', 'reasoning', 'code'] as ModelCapability[],
    contextWindow: 128_000,
    description: 'Strong multilingual model with excellent JSON output',
  },

  // Vision / Multimodal (for keyframe analysis)
  QWEN_VL: {
    id: 'Qwen2.5-VL-72B-Instruct',
    name: 'Qwen 2.5 VL 72B',
    capabilities: ['chat', 'vision', 'video-understanding', 'json-output'] as ModelCapability[],
    contextWindow: 32_000,
    description: 'Multimodal model for image/video frame analysis',
  },

  // Lightweight / Fast (for simple formatting tasks)
  LLAMA_3_1_8B: {
    id: 'Llama-3.1-8B-Instruct',
    name: 'Llama 3.1 8B Instruct',
    capabilities: ['chat', 'json-output'] as ModelCapability[],
    contextWindow: 128_000,
    description: 'Fast, lightweight model for simple tasks',
  },
} as const;

/**
 * Select the best model for a given capability.
 * Priority: largest/most capable model first.
 */
export function getModelByCapability(
  capability: ModelCapability,
  options?: { preferSpeed?: boolean }
): ModelInfo {
  const allModels = Object.values(REGOLO_MODELS);
  const matching = allModels.filter(m => m.capabilities.includes(capability));

  if (matching.length === 0) {
    throw new Error(`No model found with capability: ${capability}`);
  }

  if (options?.preferSpeed) {
    // Return smallest context window (proxy for model size/speed)
    return matching.sort((a, b) => a.contextWindow - b.contextWindow)[0]!;
  }

  // Return largest context window (proxy for quality)
  return matching.sort((a, b) => b.contextWindow - a.contextWindow)[0]!;
}
