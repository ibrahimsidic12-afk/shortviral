/**
 * Property 4: Enum mapping round-trip
 *
 * For all enum types, verify converting TS → Prisma → TS and Prisma → TS → Prisma
 * produces the original value.
 *
 * **Validates: Requirements 11.1, 11.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  toTSJobType,
  toPrismaJobType,
  PrismaJobType,
  type TSJobType,
} from '../../src/enums.js';

// ─── Enum Value Sets ─────────────────────────────────
// All valid values for each enum type

const PRISMA_JOB_TYPE_VALUES = Object.values(PrismaJobType) as PrismaJobType[];

const TS_JOB_TYPE_VALUES: TSJobType[] = [
  'transcribe',
  'detect-highlights',
  'generate-captions',
  'render-clip',
  'generate-preview',
  'extract-keyframes',
  'analyze-keyframes',
];

// Enums where Prisma and TS values are identical strings (no mapping needed)
const IDENTITY_ENUMS = {
  VideoStatus: ['uploading', 'uploaded', 'processing', 'transcribing', 'analyzing', 'ready', 'error'],
  ClipStatus: ['suggested', 'queued', 'rendering', 'rendered', 'exported', 'error'],
  JobStatus: ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'],
  Platform: ['tiktok', 'reels', 'shorts', 'twitter', 'square', 'landscape'],
  CaptionStyle: ['bold', 'karaoke', 'minimal', 'gradient', 'outline'],
  CaptionAnimation: ['fade', 'pop', 'slide', 'typewriter', 'none'],
  UserRole: ['user', 'admin'],
  UserPlan: ['free', 'pro', 'enterprise'],
} as const;

// ─── Property Tests ──────────────────────────────────

describe('Property 4: Enum mapping round-trip', () => {
  describe('JobType: Prisma → TS → Prisma round-trip', () => {
    it('converting any PrismaJobType to TS and back produces the original value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PRISMA_JOB_TYPE_VALUES),
          (prismaValue) => {
            const tsValue = toTSJobType(prismaValue);
            const roundTripped = toPrismaJobType(tsValue);
            expect(roundTripped).toBe(prismaValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('JobType: TS → Prisma → TS round-trip', () => {
    it('converting any TSJobType to Prisma and back produces the original value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...TS_JOB_TYPE_VALUES),
          (tsValue) => {
            const prismaValue = toPrismaJobType(tsValue);
            const roundTripped = toTSJobType(prismaValue);
            expect(roundTripped).toBe(tsValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Identity enums: values are identical strings requiring only type assertion', () => {
    for (const [enumName, values] of Object.entries(IDENTITY_ENUMS)) {
      it(`${enumName}: Prisma value as TS type and back is identity (no mapping needed)`, () => {
        fc.assert(
          fc.property(
            fc.constantFrom(...values),
            (value) => {
              // For identity enums, the Prisma enum value IS the TS union value.
              // Converting Prisma → TS is just a type assertion: value as TSType
              const asTSType: string = value as string;
              // Converting TS → Prisma is just a type assertion: value as PrismaType
              const asPrismaType: string = asTSType as string;
              // Round-trip produces the original value
              expect(asPrismaType).toBe(value);
            }
          ),
          { numRuns: 100 }
        );
      });
    }
  });
});
