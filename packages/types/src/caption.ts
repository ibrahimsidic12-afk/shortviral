export type CaptionStyle = 'bold' | 'karaoke' | 'minimal' | 'gradient' | 'outline';
export type CaptionAnimation = 'fade' | 'pop' | 'slide' | 'typewriter' | 'none';
export type CaptionPosition = 'top' | 'center' | 'bottom';

export interface Caption {
  id: string;
  clipId: string;
  /** Style preset */
  style: CaptionStyle;
  animation: CaptionAnimation;
  position: CaptionPosition;
  /** Custom settings overrides */
  settings: {
    fontSize: number;
    fontFamily: string;
    fontWeight: 'normal' | 'bold' | 'black';
    primaryColor: string; // hex
    secondaryColor?: string; // hex (for gradient/highlight)
    outlineColor: string; // hex
    backgroundColor?: string; // hex with alpha
    outlineWidth: number;
    maxWordsPerLine: number;
    /** Vertical margin from edge (px) */
    marginV: number;
  };
  /** Generated subtitle file storage key */
  subtitleStorageKey?: string;
  /** Subtitle format */
  format: 'ass' | 'srt' | 'vtt';
  createdAt: string;
  updatedAt: string;
}
