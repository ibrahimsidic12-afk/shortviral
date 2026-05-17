/**
 * @clip-ai/database
 *
 * Main entry point for the shared database package.
 * Exports the Prisma client singleton, generated types, and enum utilities.
 */

// ─── Prisma Client Singleton ─────────────────────────
export { prisma } from './client.js';

// ─── Prisma-Generated Types & Enums ──────────────────
export type {
  User,
  Video,
  Clip,
  Transcript,
  Export,
  Job,
} from './types.js';

export {
  VideoStatus,
  ClipStatus,
  JobStatus,
  JobType,
  Platform,
  CaptionStyle,
  CaptionAnimation,
  UserRole,
  UserPlan,
} from './types.js';

// ─── Enum Mapping Utilities ──────────────────────────
export {
  toTSJobType,
  toPrismaJobType,
  assertEnumAlignment,
} from './enums.js';

// Re-export the local enum type definitions for use before prisma generate
export type { PrismaJobType, TSJobType } from './enums.js';
