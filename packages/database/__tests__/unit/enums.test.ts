import { describe, it, expect } from 'vitest';
import {
  toTSJobType,
  toPrismaJobType,
  assertEnumAlignment,
  PrismaJobType,
} from '../../src/enums.js';

describe('enums.ts', () => {
  describe('toTSJobType', () => {
    it('maps transcribe to transcribe', () => {
      expect(toTSJobType('transcribe')).toBe('transcribe');
    });

    it('maps detect_highlights to detect-highlights', () => {
      expect(toTSJobType('detect_highlights')).toBe('detect-highlights');
    });

    it('maps generate_captions to generate-captions', () => {
      expect(toTSJobType('generate_captions')).toBe('generate-captions');
    });

    it('maps render_clip to render-clip', () => {
      expect(toTSJobType('render_clip')).toBe('render-clip');
    });

    it('maps generate_preview to generate-preview', () => {
      expect(toTSJobType('generate_preview')).toBe('generate-preview');
    });

    it('maps extract_keyframes to extract-keyframes', () => {
      expect(toTSJobType('extract_keyframes')).toBe('extract-keyframes');
    });

    it('maps analyze_keyframes to analyze-keyframes', () => {
      expect(toTSJobType('analyze_keyframes')).toBe('analyze-keyframes');
    });

    it('throws for an unknown Prisma JobType', () => {
      expect(() => toTSJobType('unknown' as PrismaJobType)).toThrow(
        '[database] Unknown Prisma JobType: "unknown"'
      );
    });
  });

  describe('toPrismaJobType', () => {
    it('maps transcribe to transcribe', () => {
      expect(toPrismaJobType('transcribe')).toBe('transcribe');
    });

    it('maps detect-highlights to detect_highlights', () => {
      expect(toPrismaJobType('detect-highlights')).toBe('detect_highlights');
    });

    it('maps generate-captions to generate_captions', () => {
      expect(toPrismaJobType('generate-captions')).toBe('generate_captions');
    });

    it('maps render-clip to render_clip', () => {
      expect(toPrismaJobType('render-clip')).toBe('render_clip');
    });

    it('maps generate-preview to generate_preview', () => {
      expect(toPrismaJobType('generate-preview')).toBe('generate_preview');
    });

    it('maps extract-keyframes to extract_keyframes', () => {
      expect(toPrismaJobType('extract-keyframes')).toBe('extract_keyframes');
    });

    it('maps analyze-keyframes to analyze_keyframes', () => {
      expect(toPrismaJobType('analyze-keyframes')).toBe('analyze_keyframes');
    });

    it('throws for an unknown TypeScript JobType', () => {
      expect(() => toPrismaJobType('unknown' as any)).toThrow(
        '[database] Unknown TypeScript JobType: "unknown"'
      );
    });
  });

  describe('round-trip conversion', () => {
    const allPrismaValues = Object.values(PrismaJobType);

    it('converts all Prisma values to TS and back without loss', () => {
      for (const prismaVal of allPrismaValues) {
        const tsVal = toTSJobType(prismaVal);
        const backToPrisma = toPrismaJobType(tsVal);
        expect(backToPrisma).toBe(prismaVal);
      }
    });

    it('converts all TS values to Prisma and back without loss', () => {
      const allTSValues = allPrismaValues.map(toTSJobType);
      for (const tsVal of allTSValues) {
        const prismaVal = toPrismaJobType(tsVal);
        const backToTS = toTSJobType(prismaVal);
        expect(backToTS).toBe(tsVal);
      }
    });
  });

  describe('assertEnumAlignment', () => {
    it('does not throw when enums are aligned', () => {
      expect(() =>
        assertEnumAlignment(
          'TestEnum',
          ['a', 'b', 'c'],
          ['a', 'b', 'c']
        )
      ).not.toThrow();
    });

    it('does not throw when order differs but values match', () => {
      expect(() =>
        assertEnumAlignment(
          'TestEnum',
          ['c', 'a', 'b'],
          ['a', 'b', 'c']
        )
      ).not.toThrow();
    });

    it('throws when Prisma has extra values', () => {
      expect(() =>
        assertEnumAlignment(
          'TestEnum',
          ['a', 'b', 'c', 'd'],
          ['a', 'b', 'c']
        )
      ).toThrow('Enum mismatch for TestEnum');
    });

    it('throws when TypeScript has extra values', () => {
      expect(() =>
        assertEnumAlignment(
          'TestEnum',
          ['a', 'b'],
          ['a', 'b', 'c']
        )
      ).toThrow('Enum mismatch for TestEnum');
    });

    it('throws when values differ', () => {
      expect(() =>
        assertEnumAlignment(
          'TestEnum',
          ['a', 'b', 'x'],
          ['a', 'b', 'c']
        )
      ).toThrow('Enum mismatch for TestEnum');
    });

    it('includes enum name in error message', () => {
      expect(() =>
        assertEnumAlignment(
          'VideoStatus',
          ['a'],
          ['b']
        )
      ).toThrow('VideoStatus');
    });
  });
});
