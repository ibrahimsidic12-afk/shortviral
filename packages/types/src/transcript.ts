export interface TranscriptWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number; // 0-1
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
  /** Speaker ID if diarization is available */
  speaker?: string;
}

export interface Transcript {
  id: string;
  videoId: string;
  /** Full text of transcript */
  text: string;
  /** Detected language */
  language: string;
  /** Total audio duration */
  duration: number;
  /** Segment-level data */
  segments: TranscriptSegment[];
  /** Word-level data (flat, all words) */
  words: TranscriptWord[];
  /** Model used for transcription */
  model: string;
  /** Processing time in ms */
  processingTime: number;
  createdAt: string;
}
