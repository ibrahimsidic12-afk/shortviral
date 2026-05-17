# Requirements Document

## Introduction

ClipAI is a monorepo that turns long-form videos into short, AI-suggested clips. The current codebase wires together a Next.js 14 web app, a BullMQ-on-Redis worker, an `@clip-ai/video-core` ffmpeg package, and a `@clip-ai/regolo-client` package, but the pieces do not connect end-to-end. Uploads go to a fake URL, processing returns mock data, the editor is fully static, the worker has no database to write to, and several configuration and code-level bugs prevent the apps from building or running cleanly.

This spec defines the requirements to make a single user (no auth) able to: upload a video, see it processed by the worker (transcribe → detect highlights → generate captions), open it in the editor, view AI-suggested clips, trigger a render, and download the rendered clip — with all state persisted in Postgres via a new `packages/db` workspace using Prisma. The work also covers fixing identified bugs in the existing code, replacing mock data with real API calls, and making the dev tooling cross-platform for Windows/PowerShell users.

This is a holistic remediation: when there is a conflict between the stub behavior and a real implementation, the real implementation wins.

## Glossary

- **Web_App**: The Next.js 14 App Router application at `apps/web`.
- **Worker_App**: The BullMQ-based background job runner at `apps/worker`.
- **Video_Core**: The `@clip-ai/video-core` package providing ffmpeg helpers.
- **Regolo_Client**: The `@clip-ai/regolo-client` package wrapping the Regolo (OpenAI-compatible) API.
- **DB_Package**: A new `packages/db` workspace exporting a Prisma client and schema, consumed by both Web_App and Worker_App.
- **Object_Store**: The S3-compatible object store (MinIO locally, S3 in deployment) holding source videos, extracted audio, transcripts, and rendered clips.
- **Job_Queue**: The BullMQ queue system backed by Redis. Queues used: `transcribe`, `detect-highlights`, `generate-captions`, `render-clip`. The `generate-preview` queue is included only if a worker is implemented for it.
- **DEV_USER_ID**: A hardcoded user identifier used in single-user dev mode in lieu of authentication. The DB schema retains a `userId` foreign key on owned resources so real auth can replace this constant later without a schema migration.
- **Source_Video**: The original video file uploaded by the user.
- **Transcript**: The structured time-coded transcript produced by the transcribe job.
- **Clip**: An AI-suggested or user-confirmed time range (start/end) on a Source_Video, optionally rendered to an output file.
- **Render_Job**: A BullMQ job in the `render-clip` queue that produces an MP4 output for a Clip.
- **Presigned_PUT_URL**: An S3 presigned URL that allows the browser to upload directly to Object_Store without proxying through the Web_App.
- **Presigned_GET_URL**: An S3 presigned URL that allows the browser to read an object from Object_Store directly.
- **Storage_Key**: The object key (path) within Object_Store, e.g. `videos/{videoId}/source.mp4`.

## Requirements

### Requirement 1: Single-User Development Mode

**User Story:** As a developer running ClipAI locally, I want the app to work without an authentication system, so that I can exercise the full pipeline without standing up auth infrastructure.

#### Acceptance Criteria

1. THE Web_App SHALL associate every created Video, Transcript, Clip, and Render_Job with a single DEV_USER_ID exported from a shared module.
2. THE DB_Package schema SHALL define a `User` table and a `userId` foreign key on every owned resource so that authentication can later replace DEV_USER_ID without schema changes.
3. WHEN the database is freshly migrated, THE DB_Package seed SHALL insert exactly one user row whose id equals DEV_USER_ID.
4. THE Web_App SHALL NOT require any login, session, or token to access any route or API endpoint in this iteration.

### Requirement 2: Database Package and Persistence

**User Story:** As a developer, I want a single shared database package, so that the Web_App and Worker_App read and write the same data through one schema.

#### Acceptance Criteria

1. THE Repository SHALL contain a new `packages/db` workspace package named `@clip-ai/db` that exports a Prisma client instance and generated types.
2. THE DB_Package schema SHALL define tables for User, Video, Transcript, and Clip with appropriate foreign keys and status enums.
3. THE DB_Package SHALL include a documented decision on whether persistent job state lives in a `Job` table or is derived from BullMQ, and the schema SHALL reflect that decision.
4. THE Web_App SHALL depend on `@clip-ai/db` via the workspace protocol and SHALL use it for all persistence.
5. THE Worker_App SHALL depend on `@clip-ai/db` via the workspace protocol and SHALL use it for all persistence.
6. THE Repository SHALL provide a single `prisma migrate dev` flow that creates the schema and runs the seed.
7. WHERE the developer runs the seed against an already-seeded database, THE seed SHALL be idempotent and SHALL NOT fail or duplicate the dev user.

### Requirement 3: Path Alias Resolution in Web App

**User Story:** As a developer, I want imports like `@/components/...` to resolve, so that the Web_App typechecks and builds.

#### Acceptance Criteria

1. THE `apps/web/tsconfig.json` `paths` configuration SHALL map `@/*` to the directories where the source actually lives so that imports of `@/components/*`, `@/lib/*`, and `@/app/*` resolve.
2. WHEN `pnpm typecheck` is run from the repository root, THE Web_App SHALL complete typechecking with no module-resolution errors for path-aliased imports.

### Requirement 4: Direct-To-Storage Upload via Presigned URLs

**User Story:** As a user, I want my video to upload directly to object storage, so that uploads are not bottlenecked by the web server.

#### Acceptance Criteria

1. WHEN the browser requests an upload from `POST /api/upload` with a file name, content type, and size, THE Web_App SHALL respond with a Presigned_PUT_URL targeting Object_Store and a stable Storage_Key for the new Source_Video.
2. THE `POST /api/upload` response SHALL include a `videoId` that corresponds to a newly created `Video` row owned by DEV_USER_ID with status `uploading`.
3. THE response body shape returned by `POST /api/upload` SHALL match exactly the shape consumed by `components/video/video-upload.tsx`; either the route or the component SHALL be changed so the two agree, and the agreed shape SHALL be documented in the design.
4. THE Web_App SHALL NOT proxy upload bytes through the Next.js server; THE browser SHALL `PUT` directly to the Presigned_PUT_URL returned by the API.
5. WHEN the file size in the upload request exceeds the configured `MAX_FILE_SIZE_MB`, THEN THE Web_App SHALL reject the request with a descriptive error and SHALL NOT create a `Video` row.
6. IF the presigned URL cannot be generated (storage misconfiguration, network failure), THEN THE Web_App SHALL respond with a 5xx error and a descriptive message and SHALL NOT leave an orphaned `Video` row in `uploading` status.
7. WHEN the browser PUT to Object_Store completes successfully, THE browser SHALL notify the Web_App so the `Video` status transitions out of `uploading`.

### Requirement 5: Trigger Real Processing Pipeline

**User Story:** As a user, I want clicking "process" on an uploaded video to actually start AI processing, so that I get real transcripts and clip suggestions instead of mock data.

#### Acceptance Criteria

1. WHEN `POST /api/videos/[id]/process` is called for a Video owned by DEV_USER_ID, THE Web_App SHALL enqueue a job on the `transcribe` queue against the shared Redis used by Worker_App.
2. THE enqueued job payload SHALL contain the information needed by Worker_App to fetch the Source_Video from Object_Store and write back its results.
3. THE `POST /api/videos/[id]/process` response SHALL reflect a real enqueued job (e.g. job id and the new Video status), not a hardcoded mock response.
4. WHEN the same Video is re-submitted to `POST /api/videos/[id]/process` while a prior job is still in flight, THE Web_App SHALL either return the existing job's status or reject the request, and the chosen behavior SHALL be documented in the design.
5. IF the target Video does not exist or is not owned by DEV_USER_ID, THEN THE Web_App SHALL respond with a 404 and SHALL NOT enqueue a job.

### Requirement 6: Worker Pipeline Persists State

**User Story:** As a user, I want the worker's work to be saved, so that I can come back and see results without re-running the pipeline.

#### Acceptance Criteria

1. WHEN the `transcribe` job completes successfully, THE Worker_App SHALL persist a `Transcript` row linked to the Video and SHALL update the Video status to reflect that transcription is done.
2. WHEN the `detect-highlights` job completes successfully, THE Worker_App SHALL persist one `Clip` row per suggested highlight, each linked to the Video, with start/end times and a status of `suggested`.
3. WHEN the `generate-captions` job completes successfully, THE Worker_App SHALL persist caption data linked to the corresponding Clip and SHALL update that Clip's status accordingly.
4. THE Worker_App SHALL replace the existing "TODO: save to database" comments in each processor with real DB_Package writes.
5. IF any worker job fails after exhausting its retries, THEN THE Worker_App SHALL update the related Video or Clip status to a terminal `failed` state with an error message persisted for display.
6. THE Worker_App SHALL NOT write status duplicates or partial updates if the same job is retried; status transitions SHALL be safe under retry.

### Requirement 7: Generate-Captions Resolves Storage Keys From Database

**User Story:** As a developer, I want the captions job to read the correct transcript file, so that captions are generated from real data instead of failing to find a file.

#### Acceptance Criteria

1. WHEN `generate-captions` runs, THE Worker_App SHALL look up the Transcript's Storage_Key via DB_Package using the clip or transcript id from the job payload.
2. THE Worker_App SHALL pass a concrete Storage_Key (not a glob pattern) to the storage download helper.
3. IF the Transcript or its Storage_Key cannot be found, THEN THE Worker_App SHALL fail the job with a descriptive error and SHALL NOT attempt to download a non-existent key.

### Requirement 8: Transcribe Job Payload Contract Is Consistent

**User Story:** As a developer, I want the transcribe job's input contract to be unambiguous, so that the field names match the data they actually carry.

#### Acceptance Criteria

1. THE Web_App and Worker_App SHALL share a single, named TypeScript type for the `transcribe` job payload, exported from a shared package.
2. THE field that carries the Source_Video Storage_Key SHALL have a name that accurately describes its content; if the field continues to carry the video key, it SHALL NOT be named `audioStorageKey`.
3. THE design SHALL document whether the transcribe job (a) accepts a video key and extracts audio internally, or (b) requires an audio key written by an upstream extraction step, and the implementation SHALL match the documented choice.

### Requirement 9: Worker Queue Setup Has No Dead Code

**User Story:** As a developer, I want the worker to compile under strict TypeScript settings, so that unused imports do not block the build.

#### Acceptance Criteria

1. THE `apps/worker/src/queue/setup.ts` file SHALL NOT contain unused imports.
2. WHEN `pnpm typecheck` is run with the worker's existing strict options including `noUnusedLocals`, THE Worker_App SHALL pass without warnings related to unused imports in the queue setup.
3. THE `generate-preview` queue SHALL either have a corresponding worker processor implemented, or SHALL be removed; the chosen path SHALL be documented in the design.

### Requirement 10: List Videos From Database

**User Story:** As a user, I want the dashboard to show my real uploaded videos, so that I can see what is actually in the system.

#### Acceptance Criteria

1. THE Web_App SHALL expose `GET /api/videos` that returns a list of Videos owned by DEV_USER_ID, ordered most-recent first.
2. THE `GET /api/videos` response SHALL include, for each Video, the fields needed by the dashboard list (at minimum: id, title or filename, duration if known, status, and createdAt).
3. THE `components/video/video-list.tsx` component SHALL fetch its data from `GET /api/videos` and SHALL NOT render hardcoded demo data.
4. WHEN the list is empty, THE Web_App SHALL display an empty state instead of demo entries.

### Requirement 11: Single Video Detail Endpoint

**User Story:** As a user, I want the editor to load real metadata for the video I opened, so that the editor reflects my actual upload.

#### Acceptance Criteria

1. THE Web_App SHALL expose `GET /api/videos/[id]` that returns a single Video owned by DEV_USER_ID, including its current status, Transcript status, and a Presigned_GET_URL for the Source_Video.
2. IF the Video does not exist or is not owned by DEV_USER_ID, THEN THE Web_App SHALL respond with a 404.
3. THE Presigned_GET_URL returned SHALL be valid for at least the duration of a normal editing session and the design SHALL document the chosen expiration.

### Requirement 12: AI-Suggested Clips Endpoint

**User Story:** As a user, I want to see real AI-suggested clips for my video, so that I can pick which ones to render.

#### Acceptance Criteria

1. THE Web_App SHALL expose `GET /api/videos/[id]/clips` that returns all Clips owned by DEV_USER_ID for the given Video.
2. THE response SHALL include, for each Clip, at minimum: id, start time, end time, suggested title or summary if available, status, and (when rendered) a download URL.
3. THE editor UI SHALL fetch suggestions from this endpoint and SHALL NOT render hardcoded data.
4. IF the Video has no clips yet (e.g. processing not finished), THEN THE endpoint SHALL return an empty list and SHALL NOT error.

### Requirement 13: Functional Editor With Real Video Playback

**User Story:** As a user, I want to play my video in the editor and scrub through it, so that I can see the AI suggestions in context.

#### Acceptance Criteria

1. THE editor page SHALL render a real HTML `<video>` element whose source is the Presigned_GET_URL returned by `GET /api/videos/[id]`.
2. THE editor's clip-range scrubber SHALL be bound to the actual playback time of the `<video>` element so that moving the scrubber seeks the video and playback updates the scrubber.
3. THE editor SHALL render the AI-suggested clips fetched from `GET /api/videos/[id]/clips` and SHALL allow the user to select one to load its start/end into the scrubber.
4. WHILE the Video's processing is not complete, THE editor SHALL communicate the in-progress state to the user instead of showing an empty or broken suggestions list.

### Requirement 14: Trigger Render and Track Progress

**User Story:** As a user, I want to click "Export Clip" and get a downloadable file, so that I can actually use the clip the AI suggested.

#### Acceptance Criteria

1. WHEN the user clicks Export Clip in the editor, THE Web_App SHALL accept `POST /api/clips/[id]/render` and SHALL enqueue a job on the `render-clip` queue.
2. THE `POST /api/clips/[id]/render` response SHALL include the clip id and a status indicating the render is queued.
3. THE Web_App SHALL expose `GET /api/clips/[id]` that returns the Clip's current render status, progress percentage if available, and a download URL once the render is complete.
4. THE editor SHALL display render progress to the user using the `GET /api/clips/[id]` endpoint until the render reaches a terminal state.
5. WHEN the render completes successfully, THE Worker_App SHALL upload the output to Object_Store, persist the output Storage_Key on the Clip, and set the Clip status to `rendered`.
6. IF the render job fails after retries, THEN THE Web_App SHALL surface the failure status and error message to the user via `GET /api/clips/[id]`.
7. THE design SHALL document whether progress is delivered via polling or SSE; the implementation SHALL match the documented choice.

### Requirement 15: Download Rendered Clip

**User Story:** As a user, I want to download the rendered clip, so that I can use it outside the app.

#### Acceptance Criteria

1. WHEN a Clip is in `rendered` status, THE `GET /api/clips/[id]` response SHALL include a Presigned_GET_URL for the rendered output.
2. THE editor SHALL expose this URL to the user as a download action.
3. IF a Clip is not yet `rendered`, THEN THE response SHALL omit the download URL or mark it null and the UI SHALL NOT offer a download action.

### Requirement 16: Disposition of the Unused Regolo Helper

**User Story:** As a developer, I want the codebase to not contain dead code, so that maintenance is straightforward.

#### Acceptance Criteria

1. THE Web_App SHALL either integrate `apps/web/lib/regolo.ts` into a real call path or SHALL remove the file.
2. THE design SHALL document the chosen disposition and the reasoning.

### Requirement 17: Single-Filter FFmpeg Builder Behavior Is Correct or Documented

**User Story:** As a developer using `@clip-ai/video-core`, I want video filters to compose correctly, so that calling multiple filter helpers does not silently drop earlier filters.

#### Acceptance Criteria

1. THE `FFmpegBuilder` SHALL either accumulate video filters from helpers (`crop`, `burnSubtitles`, `addTextOverlay`, `addFades`, presets) and apply them as a single composed filter chain on `save()`, OR THE builder SHALL document that it supports only one filter helper per build and callers SHALL be directed to `render.ts` for multi-filter cases.
2. WHERE the builder accumulates filters, calling any combination of `crop`, `burnSubtitles`, `addTextOverlay`, and `addFades` on the same builder SHALL preserve every applied filter in the produced output.
3. THE choice between (1a) accumulate vs (1b) document-only SHALL be made in the design and reflected in the implementation.

### Requirement 18: Cross-Platform Clean Script

**User Story:** As a Windows developer, I want `pnpm clean` to work in PowerShell, so that I do not need a POSIX shell to manage the repo.

#### Acceptance Criteria

1. THE root `package.json` `clean` script SHALL succeed on Windows PowerShell, macOS, and Linux without modification.
2. THE `clean` script SHALL NOT depend on the POSIX `rm -rf` binary.
3. WHEN `pnpm clean` is run from the repository root, THE script SHALL remove `node_modules` and the per-package build artifacts that the existing script targets.

### Requirement 19: Committed Lockfile Enables Worker Image Build

**User Story:** As a developer building the worker container, I want `pnpm install --frozen-lockfile` to succeed, so that the Dockerfile builds reproducibly.

#### Acceptance Criteria

1. THE Repository SHALL contain a committed `pnpm-lock.yaml` at the workspace root that resolves all workspace and external dependencies.
2. WHEN the worker Dockerfile builds, the `pnpm install --frozen-lockfile` step SHALL succeed without lockfile drift errors.

### Requirement 20: Updated Dev Runbook

**User Story:** As a developer onboarding to ClipAI, I want a clear runbook for the new end-to-end flow, so that I can get the app running locally without guesswork.

#### Acceptance Criteria

1. THE Repository README or a referenced runbook SHALL describe the steps required to start the new end-to-end pipeline locally, including starting docker compose, running Prisma migrations, seeding the dev user, and starting the Web_App and Worker_App.
2. THE runbook SHALL list the environment variables that must be set, including those needed by the new presigned-URL flow and the Postgres connection.
3. THE runbook SHALL describe how to verify the pipeline end-to-end (upload, process, view suggestions, render, download).

### Requirement 21: Out of Scope (Negative Requirements)

**User Story:** As a developer reviewing this spec, I want the explicit non-goals captured, so that future contributors do not expand scope by accident.

#### Acceptance Criteria

1. THE spec SHALL NOT introduce authentication, multi-user separation, or session management in this iteration.
2. THE spec SHALL NOT introduce billing, credits, or quota enforcement in this iteration.
3. THE spec SHALL NOT introduce production deployment automation beyond the existing Dockerfile.
4. THE spec SHALL NOT introduce music tracks or background music features.
5. THE spec SHALL NOT introduce speaker diarization.
6. THE spec SHALL NOT introduce real face-tracking smart reframing; a static center-crop fallback is acceptable.
7. THE spec SHALL NOT wire vision keyframe analysis into the live pipeline in this iteration.
