# Requirements Document

## Introduction

This feature adds a PostgreSQL database with Prisma ORM to the ClipAI monorepo, replacing the current lack of persistence. The database schema covers users, videos, clips, transcripts, and jobs — enabling the worker pipeline to persist results and the web app to query real data instead of hardcoded demos. The schema aligns with existing TypeScript types in `packages/types/src/`.

## Glossary

- **Database_Package**: The shared Prisma package (`packages/database`) providing the client, schema, and migrations to all apps in the monorepo
- **Prisma_Client**: The auto-generated, type-safe database client used by the web app and worker to read/write records
- **Schema**: The Prisma schema file defining models, relations, enums, and indexes for PostgreSQL
- **Migration_Engine**: Prisma Migrate, responsible for generating and applying SQL migrations from schema changes
- **Worker**: The BullMQ-based background processor (`apps/worker`) that runs transcription, highlight detection, caption generation, and render jobs
- **Web_App**: The Next.js 14 application (`apps/web`) serving the dashboard and API routes
- **Video_Record**: A database row representing an uploaded video and its processing state
- **Clip_Record**: A database row representing a detected or user-created clip segment from a video
- **Transcript_Record**: A database row representing the transcription output for a video
- **Job_Record**: A database row tracking a background processing job's lifecycle
- **User_Record**: A database row representing an authenticated user account
- **Export_Record**: A database row representing a rendered clip export for a specific platform

## Requirements

### Requirement 1: Database Package Structure

**User Story:** As a developer, I want a shared database package in the monorepo, so that both the web app and worker can access the same Prisma client and schema without duplication.

#### Acceptance Criteria

1. THE Database_Package SHALL reside at `packages/database` and be importable as `@clip-ai/database` by other workspace packages
2. THE Database_Package SHALL contain the Prisma schema file, generated Prisma_Client, and a `migrations` directory tracking all applied schema migrations
3. THE Database_Package SHALL export a singleton Prisma_Client instance that attaches to the global object in serverless environments to persist across hot reloads, and creates a single long-lived instance in non-serverless environments
4. WHEN the Database_Package is imported in a serverless environment, THE Prisma_Client SHALL reuse an existing global instance if one exists, limiting the connection pool to a maximum of 5 connections per serverless function instance
5. WHEN the Database_Package is imported in a long-running environment, THE Prisma_Client SHALL create a single instance with a connection pool of up to 20 connections
6. THE Database_Package SHALL include a `db:migrate` script that applies pending migrations to the database identified by the `DATABASE_URL` environment variable
7. IF the `db:migrate` script fails to apply a migration, THEN THE Database_Package SHALL exit with a non-zero exit code and output an error message indicating the migration name and failure reason
8. THE Database_Package SHALL include a `db:generate` script that regenerates the Prisma_Client from the schema
9. IF the `DATABASE_URL` environment variable is not set when the Prisma_Client is instantiated, THEN THE Database_Package SHALL throw an error indicating that the database connection string is missing

### Requirement 2: User Model

**User Story:** As a developer, I want a User model in the database, so that videos and clips can be associated with their owner.

#### Acceptance Criteria

1. THE Schema SHALL define a User model with fields: id (UUID primary key, auto-generated), email (string, unique, max 254 characters), name (string, required, max 100 characters), avatarUrl (string, nullable), role (enum: user, admin), plan (enum: free, pro, enterprise), credits (non-negative integer), totalClips (non-negative integer), createdAt (timestamp), updatedAt (timestamp)
2. THE User model SHALL enforce a unique constraint on the email field
3. THE User model SHALL default the role field to "user" and the plan field to "free"
4. THE User model SHALL default credits to 10 and totalClips to 0
5. WHEN a User_Record is created, THE Schema SHALL auto-set createdAt and updatedAt timestamps to the current server time
6. WHEN a User_Record is modified, THE Schema SHALL auto-update the updatedAt timestamp to the current server time
7. IF a User_Record update would set credits or totalClips below 0, THEN THE Schema SHALL reject the update with a constraint violation error

### Requirement 3: Video Model

**User Story:** As a developer, I want a Video model in the database, so that uploaded videos and their processing state are persisted and queryable.

#### Acceptance Criteria

1. THE Schema SHALL define a Video model with fields: id (UUID primary key), userId (foreign key to User), originalName (string, max 255 characters), storageKey (string, max 1024 characters), url (nullable string), thumbnailUrl (nullable string), status (enum: uploading, uploaded, processing, transcribing, analyzing, ready, error), error (nullable text), tags (text array), createdAt (timestamp), updatedAt (timestamp)
2. THE Schema SHALL define a metadata field on the Video model as an embedded JSON column storing: duration (float, seconds), width (integer, pixels), height (integer, pixels), fps (float), bitrate (integer, bits per second), codec (string), audioCodec (string), fileSize (bigint, bytes), format (string)
3. THE Video model SHALL have a many-to-one relationship with User (a user owns many videos)
4. THE Video model SHALL have a one-to-many relationship with Clip_Record
5. THE Video model SHALL have a one-to-one relationship with Transcript_Record
6. THE Video model SHALL define database indexes on the userId and status fields
7. WHEN a Video_Record is created, THE Schema SHALL default the status to "uploading" and the tags field to an empty array
8. WHEN a Video_Record is modified, THE Schema SHALL auto-update the updatedAt timestamp
9. IF a Video_Record is deleted, THEN THE Schema SHALL cascade the deletion to all related Clip_Records, Transcript_Record, and Job_Records

### Requirement 4: Transcript Model

**User Story:** As a developer, I want a Transcript model in the database, so that transcription results are queryable without fetching JSON from S3.

#### Acceptance Criteria

1. THE Schema SHALL define a Transcript model with fields: id (UUID primary key), videoId (foreign key to Video, unique), text (full text content, maximum 500,000 characters), language (string, maximum 10 characters), duration (float, range 0.0 to 86,400.0 seconds), segmentCount (integer, range 0 to 100,000), wordCount (integer, range 0 to 100,000), model (string, maximum 100 characters), storageKey (S3 key for full segment/word data, maximum 512 characters), processingTime (integer, milliseconds, range 0 to 86,400,000), createdAt (timestamp)
2. THE Transcript model SHALL enforce a one-to-one relationship with Video via a unique constraint on videoId
3. IF a Transcript record is created with a videoId that already has an associated Transcript, THEN THE Schema SHALL reject the operation with a unique constraint violation error
4. IF a Transcript record is created with a videoId that does not reference an existing Video record, THEN THE Schema SHALL reject the operation with a foreign key constraint violation error
5. THE Transcript model SHALL store the full text in the text field and reference the S3 location in the storageKey field for detailed word-level and segment-level data
6. WHEN a Transcript record is created, THE Schema SHALL auto-set the createdAt field to the current UTC timestamp

### Requirement 5: Clip Model

**User Story:** As a developer, I want a Clip model in the database, so that AI-suggested clips and their render state are persisted and queryable.

#### Acceptance Criteria

1. THE Schema SHALL define a Clip model with fields: id (UUID primary key), videoId (foreign key to Video), userId (foreign key to User), startTime (float), endTime (float), duration (float), hookText (string, max 500 characters), reason (string, max 1000 characters), viralityScore (integer 0-100), tags (text array), status (enum: suggested, queued, rendering, rendered, exported, error), renderProgress (integer 0-100, nullable), previewUrl (nullable), error (nullable text), createdAt (timestamp), updatedAt (timestamp)
2. THE Schema SHALL define a ClipSettings model (or embedded JSON field) storing: platform, captionStyle, captionAnimation, autoReframe, fadeIn, fadeOut, volume, musicTrackId (nullable), musicVolume (nullable)
3. THE Clip model SHALL have a many-to-one relationship with Video
4. THE Clip model SHALL have a many-to-one relationship with User
5. THE Clip model SHALL have a one-to-many relationship with Export_Record
6. THE Clip model SHALL index videoId, userId, and status fields for efficient queries
7. WHEN a Clip_Record is created, THE Schema SHALL default the status to "suggested"
8. WHEN a Clip_Record is modified, THE Schema SHALL auto-update the updatedAt timestamp
9. THE Clip model SHALL enforce that startTime is less than endTime via a database check constraint
10. IF a Clip_Record is deleted, THEN THE Schema SHALL cascade the deletion to all related Export_Records

### Requirement 6: Export Model

**User Story:** As a developer, I want an Export model in the database, so that rendered clip outputs for each platform are tracked.

#### Acceptance Criteria

1. THE Schema SHALL define an Export model with fields: id (UUID primary key), clipId (foreign key to Clip), platform (enum: tiktok, reels, shorts, twitter, square, landscape), url (string, max 2048 characters), storageKey (string, max 512 characters), fileSize (bigint, bytes, range 1 to 1,073,741,824), resolution (string in "WxH" format, e.g. "1080x1920"), exportedAt (timestamp)
2. THE Export model SHALL have a many-to-one relationship with Clip, with cascade deletion when the parent Clip is removed
3. THE Export model SHALL enforce a unique constraint on the combination of clipId and platform, allowing at most one export record per clip per platform
4. WHEN an export is created for a clipId and platform combination that already exists, THE System SHALL replace the existing export record with the new export data

### Requirement 7: Job Model

**User Story:** As a developer, I want a Job model in the database, so that the dashboard can display real-time processing status without querying Redis directly.

#### Acceptance Criteria

1. THE Schema SHALL define a Job model with fields: id (UUID primary key), type (enum: transcribe, detect-highlights, generate-captions, render-clip, generate-preview, extract-keyframes, analyze-keyframes), status (enum: waiting, active, completed, failed, delayed, paused), videoId (foreign key to Video, nullable), clipId (foreign key to Clip, nullable), payload (JSON, max 1 MB), result (JSON, nullable, max 1 MB), error (nullable text, max 2000 characters), attempts (integer, minimum 0), maxAttempts (integer, range 1-10), progress (integer 0-100), priority (integer, range 0-2147483647 where lower values indicate higher priority), createdAt (timestamp), startedAt (nullable timestamp), completedAt (nullable timestamp)
2. THE Job model SHALL have a many-to-one relationship with Video (nullable, for video-level jobs)
3. THE Job model SHALL have a many-to-one relationship with Clip (nullable, for clip-level jobs)
4. IF a referenced Video record is deleted, THEN THE Schema SHALL set the Job's videoId field to null
5. IF a referenced Clip record is deleted, THEN THE Schema SHALL set the Job's clipId field to null
6. THE Job model SHALL index the type, status, and videoId fields for efficient status queries
7. WHEN a Job record is created, THE Schema SHALL default status to "waiting", attempts to 0, progress to 0, priority to 0, and maxAttempts to 3

### Requirement 8: Worker Persistence Integration

**User Story:** As a developer, I want the worker to persist job results to the database, so that processing outcomes are durable and queryable by the web app.

#### Acceptance Criteria

1. WHEN the transcribe job completes, THE Worker SHALL create a Transcript record with the transcription result, set the Video_Record transcriptId field to the new transcript's ID, and update the Video_Record status to "transcribing"
2. WHEN the detect-highlights job completes, THE Worker SHALL create a Clip record with status "suggested" for each detected highlight (up to the maxClips value from the job payload, maximum 20) and update the Video_Record status to "analyzing"
3. WHEN the render-clip job completes, THE Worker SHALL create a ClipExport entry on the corresponding Clip record containing the output storage key, file size in bytes, and rendered resolution, and update the Clip record status to "rendered"
4. WHEN any job starts, THE Worker SHALL update the corresponding Job record status to "active" and set the startedAt field to the current UTC timestamp
5. WHEN any job completes, THE Worker SHALL update the corresponding Job record status to "completed", set completedAt to the current UTC timestamp, and store the result as a JSON object no larger than 64 KB
6. IF a job fails after exhausting its configured maximum retry attempts (3 for standard jobs, 2 for render-clip jobs), THEN THE Worker SHALL update the Job record status to "failed", store the error message (truncated to 2048 characters if longer), and update the related Video_Record or Clip record status to "error" with the same error message
7. WHILE a job is processing, THE Worker SHALL update the Job record progress field with an integer value from 0 to 100 representing current completion percentage, at intervals no greater than 5 seconds between updates
8. IF the database write for any persistence operation fails, THEN THE Worker SHALL retry the write up to 3 times with exponential backoff starting at 1 second, and if all retries fail, THE Worker SHALL throw the error to trigger the job's own retry mechanism

### Requirement 9: Web App Query Integration

**User Story:** As a developer, I want the web app to query videos, clips, and job status from the database, so that the dashboard displays real data instead of hardcoded demos.

#### Acceptance Criteria

1. WHEN the dashboard page loads, THE Web_App SHALL query Video_Records for the authenticated user, ordered by createdAt descending, returning at most 20 records per page with pagination metadata (page, total, hasNext)
2. WHEN a video detail page loads, THE Web_App SHALL query the Video_Record with its related Clip_Records and Transcript_Record for the authenticated user
3. IF the requested Video_Record does not exist or does not belong to the authenticated user, THEN THE Web_App SHALL return an error response with a NOT_FOUND code and no record data
4. WHEN the upload API creates a video, THE Web_App SHALL persist a Video_Record with status "uploading", the authenticated user's ID, the original filename, and the generated storage key, and return the generated video ID
5. WHEN the process API is called for a video, THE Web_App SHALL create a Job_Record of type "transcribe" with status "waiting" and update the Video_Record status to "processing"
6. IF the process API is called for a video that does not exist or is not in "uploaded" status, THEN THE Web_App SHALL return an error response with a VALIDATION_ERROR code and not create a Job_Record
7. WHEN the job status endpoint is called with a videoId, THE Web_App SHALL return all Job_Records associated with that videoId, including each job's type, status, and progress fields
8. IF no Job_Records exist for the requested videoId, THEN THE Web_App SHALL return a successful response with an empty list

### Requirement 10: Database Connection and Environment Configuration

**User Story:** As a developer, I want clear environment configuration for the database connection, so that local development, CI, and production environments are properly supported.

#### Acceptance Criteria

1. THE Database_Package SHALL read the connection string from the `DATABASE_URL` environment variable
2. THE Database_Package SHALL support connection pooling via Prisma's built-in connection pool with a default pool size of 5 connections and a configurable range of 1 to 20 connections via the `DATABASE_POOL_SIZE` environment variable
3. THE docker-compose.yml SHALL include a PostgreSQL service for local development exposed on port 5432, with a persistent named volume for data, and a health check using `pg_isready` with an interval of 10 seconds, a timeout of 5 seconds, and 5 retries
4. THE .env.example file SHALL document the DATABASE_URL format as `postgresql://<user>:<password>@<host>:<port>/<database>` and include a default local value pointing to the docker-compose PostgreSQL service
5. IF the `DATABASE_URL` environment variable is not set, THEN THE Prisma_Client SHALL throw an error indicating that the variable is missing
6. IF the `DATABASE_URL` is set but the database is unreachable within 5 seconds, THEN THE Prisma_Client SHALL throw an error indicating that the connection failed and include the host and port that were attempted

### Requirement 11: Schema Alignment with Existing Types

**User Story:** As a developer, I want the Prisma-generated types to align with the existing TypeScript types in `packages/types`, so that no type conflicts arise across the monorepo.

#### Acceptance Criteria

1. THE Schema enum values SHALL contain identical string literals, in the same set, as the corresponding TypeScript union types in `packages/types`: VideoStatus (7 values), ClipStatus (6 values), JobStatus (6 values), JobType (7 values), Platform (6 values), CaptionStyle (5 values), CaptionAnimation (5 values), UserRole (2 values), and UserPlan (3 values)
2. THE Schema field names SHALL use camelCase naming and SHALL map one-to-one to the property names defined in the corresponding TypeScript interfaces in `packages/types`, with optional interface properties represented as nullable fields in the schema
3. THE Database_Package SHALL export a type-safe mapping function for each enum type that converts between the Prisma-generated enum and the corresponding `@clip-ai/types` union type without runtime transformation (i.e., the values are identical strings requiring only a type assertion)
4. WHEN a new enum value is added to `packages/types`, THE Schema SHALL be updated within the same pull request to maintain alignment
5. THE Database_Package SHALL include a build-time validation step that fails the build if any Prisma-generated enum type contains values that differ from the corresponding union type exported by `@clip-ai/types`
