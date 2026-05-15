export interface CaptionWord {
  word: string;
  startTime: number;
  endTime: number;
  highlight?: boolean;
}

export interface CaptionLine {
  startTime: number;
  endTime: number;
  text: string;
  words?: CaptionWord[];
  position?: { x: number; y: number };
}
