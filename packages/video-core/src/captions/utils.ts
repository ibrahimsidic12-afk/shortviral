/**
 * Format a timestamp (seconds) into subtitle format strings.
 * 
 * Supports:
 * - SRT: 00:01:30,500
 * - VTT: 00:01:30.500
 * - ASS: 0:01:30.50
 */
export function formatTimestamp(seconds: number, format: 'srt' | 'vtt' | 'ass'): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  switch (format) {
    case 'srt':
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
    case 'vtt':
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
    case 'ass':
      // ASS uses centiseconds and single-digit hours
      const cs = Math.round((seconds % 1) * 100);
      return `${hours}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(cs, 2)}`;
    default:
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
  }
}

function pad(num: number, size: number): string {
  return String(num).padStart(size, '0');
}

/**
 * Split transcript text into display lines with a maximum word count per line.
 * Tries to break at natural pause points (punctuation, conjunctions).
 */
export function splitIntoLines(
  words: Array<{ word: string; start: number; end: number }>,
  maxWordsPerLine: number = 4
): Array<{ text: string; startTime: number; endTime: number; words: typeof words }> {
  const lines: Array<{ text: string; startTime: number; endTime: number; words: typeof words }> = [];
  let currentWords: typeof words = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    currentWords.push(word);

    const isLastWord = i === words.length - 1;
    const atMaxWords = currentWords.length >= maxWordsPerLine;
    const atNaturalBreak = isNaturalBreakPoint(word.word, words[i + 1]?.word);

    if (isLastWord || atMaxWords || (currentWords.length >= 2 && atNaturalBreak)) {
      lines.push({
        text: currentWords.map(w => w.word).join(' '),
        startTime: currentWords[0]!.start,
        endTime: currentWords[currentWords.length - 1]!.end,
        words: [...currentWords],
      });
      currentWords = [];
    }
  }

  return lines;
}

/**
 * Check if a word represents a natural break point for subtitle lines.
 */
function isNaturalBreakPoint(currentWord: string, _nextWord?: string): boolean {
  // Break after punctuation
  if (/[.!?,;:]$/.test(currentWord)) return true;
  // Break after closing quotes/brackets
  if (/["')}\]]$/.test(currentWord)) return true;
  return false;
}
