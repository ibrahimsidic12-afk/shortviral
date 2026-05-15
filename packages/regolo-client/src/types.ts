export interface RegoloConfig {
  apiKey: string;
  baseURL?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  timestampGranularities?: ('word' | 'segment')[];
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: TranscriptionWord[];
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: TranscriptionSegment[];
  words?: TranscriptionWord[];
}

export interface HighlightOptions {
  model?: string;
  maxClips?: number;
  minDuration?: number;
  maxDuration?: number;
  criteria?: string;
  targetPlatform?: 'tiktok' | 'reels' | 'shorts' | 'all';
}

export interface ClipSuggestion {
  startTime: number;
  endTime: number;
  duration: number;
  hookText: string;
  reason: string;
  viralityScore: number; // 0-100
  tags: string[];
}

export interface HighlightResult {
  clips: ClipSuggestion[];
  totalDuration: number;
  processingTime: number;
}

export interface CaptionStyleOptions {
  style: 'bold' | 'karaoke' | 'minimal' | 'gradient' | 'outline';
  model?: string;
  maxWordsPerLine?: number;
  fontSize?: 'small' | 'medium' | 'large';
  position?: 'top' | 'center' | 'bottom';
  color?: string;
  backgroundColor?: string;
}

export interface StyledCaption {
  startTime: number;
  endTime: number;
  text: string;
  words: {
    word: string;
    startTime: number;
    endTime: number;
    highlight: boolean;
  }[];
  style: {
    fontSize: number;
    fontWeight: string;
    color: string;
    backgroundColor?: string;
    position: { x: number; y: number };
    animation?: 'fade' | 'pop' | 'slide' | 'none';
  };
}

export interface CaptionResult {
  captions: StyledCaption[];
  totalWords: number;
  format: string;
}
