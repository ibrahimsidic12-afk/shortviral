# Implementation Plan: Database Persistence Layer

## Overview

This plan implements a PostgreSQL persistence layer for the ClipAI monorepo using Prisma ORM. The `packages/database` package provides a shared Prisma client, schema, migrations, and enum utilities consumed by both `apps/web` and `apps/worker`. Tasks are ordered to establish infrastructure first, then models, then integration points, with property-based and unit tests woven in close to their implementation targets.

## Tasks

- [x] 1. Set up database package structure and configuration
  - [x] 1.1 Create `packages/database` package with package.json, tsconfig.json, and directory structure
    - Create `packages/database/package.json` with name `@clip-ai/database`, dependencies on `prisma`, `@prisma/client`, and dev dependencies on `vitest`, `fast-check`, `@clip-ai/types`
    - Create `packages/database/tsconfig.json` extending the root TypeScript config with strict mode
    - Create directory structure: `prisma/`, `src/`, `scripts/`, `__tests__/unit/`, `__tests__/property/`, `__tests__/integration/`
    - Create `packages/database/vitest.config.ts` for test configuration
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Add PostgreSQL service to Docker Compose and update environment configuration
    - Add a `postgres` service to `infrastructure/docker/docker-compose.yml` using `postgres:16-alpine`, exposed on port 5432, with a persistent named volume `postgres_data`, health check using `pg_isready` (interval 10s, timeout 5s, retries 5), and environment variables for user/password/database
    - Update `.env.example` to document `DATABASE_URL=postgresql://clipai:clipai@localhost:5432/clipai` and `DATABASE_POOL_SIZE=5`
    - _Requirements: 10.1, 10.3, 10.4_

  - [x] 1.3 Create Prisma schema with all enums and models
    - Create `packages/database/prisma/schema.prisma` with the full schema as defined in the design document
    - Include all enums: UserRole, UserPlan, VideoStatus, ClipStatus, JobType, JobStatus, Platform, CaptionStyle, CaptionAnimation
    - Include all models: User, Video, Transcript, Clip, Export, Job with proper relations, indexes, check constraints, cascade/setNull rules, and default values
    - _Requirements: 2.1–2.7, 3.1–3.9, 4.1–4.6, 5.1–5.10, 6.1–6.4, 7.1–7.7_

  - [x] 1.4 Create Prisma client singleton with environment-aware connection pooling
    - Create `packages/database/src/client.ts` implementing the singleton pattern from the design: global reuse in serverless environments (pool max 5), single instance in long-running environments (pool max 20)
    - Throw a descriptive error if `DATABASE_URL` is not set
    - Read `DATABASE_POOL_SIZE` environment variable with appropriate defaults and caps
    - _Requirements: 1.3, 1.4, 1.5, 1.9, 10.1, 10.2, 10.5, 10.6_

  - [x] 1.5 Create enum mapping utilities and type re-exports
    - Create `packages/database/src/enums.ts` with `toTSJobType`, `toPrismaJobType` mapping functions for JobType (underscore ↔ hyphen conversion), and `assertEnumAlignment` utility
    - Create `packages/database/src/types.ts` re-exporting Prisma-generated types
    - Create `packages/database/src/index.ts` as the main barrel export (prisma client, types, enums)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 1.6 Create build-time enum validation script and package scripts
    - Create `packages/database/scripts/validate-enums.ts` that compares Prisma enum values against `@clip-ai/types` union values and exits with code 1 on mismatch
    - Add scripts to `package.json`: `db:generate` (prisma generate), `db:migrate` (prisma migrate deploy), `build` (runs validate-enums then tsc), `db:push` (prisma db push for dev)
    - _Requirements: 1.6, 1.7, 1.8, 11.4, 11.5_

- [x] 2. Checkpoint - Verify package setup
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement worker persistence service
  - [x] 3.1 Create the PersistenceService class with retry logic
    - Create `apps/worker/src/lib/persistence.ts` implementing `PersistenceService` with `withRetry` method (3 attempts, exponential backoff: 1s, 2s, 4s)
    - Implement `onJobStart`, `onJobComplete`, `onJobFailed`, `onJobProgress` methods that update Job records
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 3.2 Implement transcript persistence in the worker
    - Add `createTranscript` method to PersistenceService that creates a Transcript record and updates the Video status
    - Integrate into `apps/worker/src/jobs/transcribe.job.ts` to persist results after transcription completes
    - _Requirements: 8.1_

  - [x] 3.3 Implement clip creation persistence in the worker
    - Add `createClips` method to PersistenceService that batch-creates Clip records with status "suggested" (max 20 per call)
    - Integrate into `apps/worker/src/jobs/detect-highlights.job.ts` to persist detected highlights
    - _Requirements: 8.2_

  - [x] 3.4 Implement export persistence in the worker
    - Add `createExport` method to PersistenceService that upserts an Export record (unique on clipId+platform) and updates Clip status to "rendered"
    - Integrate into `apps/worker/src/jobs/render-clip.job.ts` to persist render results
    - _Requirements: 8.3, 6.4_

  - [ ]* 3.5 Write property test for retry logic (Property 2)
    - **Property 2: Persistence retry with exponential backoff**
    - Generate random sequences of success/failure outcomes, verify: returns on first success, retries up to 3 times with correct delays, throws last error if all fail
    - **Validates: Requirements 8.8**

  - [ ]* 3.6 Write unit tests for PersistenceService
    - Test `onJobStart` sets status to "active" and startedAt timestamp
    - Test `onJobComplete` sets status to "completed", completedAt, and stores result (max 64KB)
    - Test `onJobFailed` sets status to "failed", stores truncated error (max 2048 chars), updates related entity status
    - Test `onJobProgress` updates progress integer 0-100
    - _Requirements: 8.4, 8.5, 8.6, 8.7_

- [x] 4. Implement web app query integration
  - [x] 4.1 Create database query utilities for the web app
    - Create `apps/web/lib/db.ts` that imports and re-exports the prisma client from `@clip-ai/database`
    - Implement `getVideosByUser(userId, page, pageSize)` returning paginated results with metadata (page, total, hasNext)
    - Implement `getVideoWithRelations(videoId, userId)` returning video with clips and transcript
    - Implement `getJobsByVideoId(videoId)` returning job list with type, status, progress
    - _Requirements: 9.1, 9.2, 9.7, 9.8_

  - [x] 4.2 Update the upload API route to persist Video records
    - Modify `apps/web/app/api/upload/route.ts` to create a Video record with status "uploading", the user's ID, original filename, and storage key, returning the generated video ID
    - _Requirements: 9.4_

  - [x] 4.3 Update the process API route to create Job records and validate video state
    - Modify `apps/web/app/api/videos/[id]/process/route.ts` to validate the video exists and is in "uploaded" status, create a Job record of type "transcribe" with status "waiting", and update Video status to "processing"
    - Return error with VALIDATION_ERROR code if video doesn't exist or isn't in "uploaded" status
    - Return error with NOT_FOUND code if video doesn't belong to authenticated user
    - _Requirements: 9.3, 9.5, 9.6_

  - [ ]* 4.4 Write property test for pagination metadata (Property 3)
    - **Property 3: Pagination metadata correctness**
    - Generate random video counts (0-100) and page numbers, verify: data.length, hasNext, total, and descending createdAt order
    - **Validates: Requirements 9.1**

  - [ ]* 4.5 Write unit tests for web app query utilities
    - Test `getVideosByUser` returns correct page size, ordering, and pagination metadata
    - Test `getVideoWithRelations` returns 404 for non-existent or unauthorized videos
    - Test `getJobsByVideoId` returns empty array when no jobs exist
    - _Requirements: 9.1, 9.2, 9.3, 9.7, 9.8_

- [x] 5. Checkpoint - Verify integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement enum validation and constraint tests
  - [x] 6.1 Write property test for enum round-trip mapping (Property 4)
    - **Property 4: Enum mapping round-trip**
    - For all enum types, verify converting TS → Prisma → TS and Prisma → TS → Prisma produces the original value
    - **Validates: Requirements 11.1, 11.3**

  - [ ]* 6.2 Write property test for clip time constraint (Property 1)
    - **Property 1: Clip time constraint enforcement**
    - Generate random (startTime, endTime) float pairs, verify: rejected when startTime >= endTime, accepted when startTime < endTime (both non-negative)
    - **Validates: Requirements 5.9**

  - [ ]* 6.3 Write integration tests for model constraints and cascades
    - Test unique email constraint on User (P2002 error)
    - Test unique videoId constraint on Transcript (P2002 error)
    - Test cascade delete: Video deletion removes Clips, Transcript, and sets Job videoId to null
    - Test cascade delete: Clip deletion removes Exports and sets Job clipId to null
    - Test check constraint: credits < 0 rejected, totalClips < 0 rejected
    - Test Export upsert on duplicate clipId+platform
    - _Requirements: 2.2, 2.7, 3.9, 4.3, 5.10, 6.3, 7.4, 7.5_

- [x] 7. Final wiring and cleanup
  - [x] 7.1 Wire worker event handlers to PersistenceService
    - Update `apps/worker/src/queue/setup.ts` to instantiate PersistenceService and call `onJobStart`/`onJobComplete`/`onJobFailed`/`onJobProgress` from worker event handlers
    - Ensure progress updates are throttled to at most every 5 seconds
    - _Requirements: 8.4, 8.5, 8.6, 8.7_

  - [x] 7.2 Add `@clip-ai/database` dependency to web app and worker packages
    - Update `apps/web/package.json` to add `@clip-ai/database` as a workspace dependency
    - Update `apps/worker/package.json` to add `@clip-ai/database` as a workspace dependency
    - Update root `turbo.json` or pipeline if needed to ensure `packages/database` builds before dependent apps
    - _Requirements: 1.1_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests require a running PostgreSQL instance (via Docker Compose)
- The `JobType` enum uses underscores in Prisma but hyphens in TypeScript — the mapping layer in `enums.ts` handles this transparently
- All code uses TypeScript strict mode consistent with the existing monorepo configuration

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "1.6"] },
    { "id": 3, "tasks": ["3.1", "4.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3"] },
    { "id": 5, "tasks": ["3.5", "3.6", "4.4", "4.5", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1", "7.2"] }
  ]
}
```
