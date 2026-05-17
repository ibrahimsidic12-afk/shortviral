# Requirements Document

## Introduction

The YouTube URL Import feature extends ClipAI's video ingestion capabilities by allowing users to paste a YouTube URL directly in the dashboard. The system downloads the video server-side via a BullMQ worker job, stores it in S3-compatible storage, and feeds it into the existing processing pipeline (Transcribe → Detect Highlights → Generate Captions → Render Clips → Export). This provides an alternative to the existing drag-and-drop file upload, enabling users to clip content from YouTube without manually downloading videos first.

## Glossary

- **Dashboard**: The main ClipAI web interface where users upload videos and manage clips (Next.js App Router page at `/dashboard`)
- **URL_Input**: The UI component on the Dashboard that accepts a YouTube video URL from the user
- **URL_Validator**: The server-side module responsible for parsing and validating YouTube URL formats
- **Download_Worker**: The BullMQ job processor that downloads video content from YouTube and stores it in S3
- **Video_Record**: The Prisma Video model row representing a video in the PostgreSQL database
- **Processing_Pipeline**: The existing sequence of BullMQ jobs: Transcribe → Detect Highlights → Generate Captions → Render Clips
- **S3_Storage**: The S3-compatible object storage (MinIO locally, AWS S3 in production) used for video files
- **yt-dlp**: A command-line tool for downloading videos from YouTube and other platforms
- **Progress_Channel**: The mechanism (polling or server-sent events) used to communicate download progress from the worker to the UI

## Requirements

### Requirement 1: YouTube URL Input

**User Story:** As a ClipAI user, I want to paste a YouTube URL in the dashboard, so that I can import YouTube videos for AI clipping without downloading them manually.

#### Acceptance Criteria

1. THE Dashboard SHALL display a URL_Input field alongside the existing file upload component
2. THE URL_Input SHALL accept text input up to 2048 characters and provide a submit action via a submit button and the Enter key
3. WHEN a user submits a URL via the URL_Input, THE Dashboard SHALL send the URL to the API for validation and processing, where a valid URL matches a standard YouTube video URL format (e.g., youtube.com/watch?v= or youtu.be/ domains with a video ID)
4. IF the submitted URL does not match a valid YouTube URL format, THEN THE Dashboard SHALL display an error message indicating the URL is not a recognized YouTube video link, without sending the URL to the API
5. WHILE a download is in progress for a submitted URL, THE URL_Input SHALL be available for new submissions

### Requirement 2: YouTube URL Validation

**User Story:** As a ClipAI user, I want the system to validate my YouTube URL before attempting download, so that I receive immediate feedback on invalid links.

#### Acceptance Criteria

1. WHEN a URL is submitted, THE URL_Validator SHALL verify the URL matches a recognized YouTube format and return a validation result within 500ms
2. THE URL_Validator SHALL accept the following YouTube URL formats: `youtube.com/watch?v=VIDEO_ID`, `youtu.be/VIDEO_ID`, `youtube.com/shorts/VIDEO_ID`, and `youtube.com/embed/VIDEO_ID`, with or without `https://` or `http://` protocol prefix, and with or without `www.` subdomain prefix
3. WHEN a URL does not match any recognized YouTube format, THE URL_Validator SHALL return an error response with code `INVALID_URL` and a message indicating the expected URL format
4. THE URL_Validator SHALL extract the video ID (11-character string consisting of characters a-z, A-Z, 0-9, hyphens, and underscores) from the submitted URL
5. WHEN a URL contains additional query parameters (e.g., timestamps, playlists), THE URL_Validator SHALL extract only the video ID and ignore other parameters
6. IF the submitted URL is empty, contains only whitespace, or is null, THEN THE URL_Validator SHALL return an error response with code `INVALID_URL` without attempting format matching
7. WHEN validation succeeds, THE URL_Validator SHALL return a success response containing the extracted video ID and the normalized full YouTube URL
8. IF the URL matches a recognized YouTube format but the extracted video ID does not conform to the 11-character format, THEN THE URL_Validator SHALL return an error response with code `INVALID_URL` and a message indicating the video ID is malformed

### Requirement 3: Video Download Job

**User Story:** As a ClipAI user, I want the system to download YouTube videos on the server, so that I do not need to handle large file downloads on my device.

#### Acceptance Criteria

1. WHEN a YouTube URL matching the pattern `https://(www.)youtube.com/watch?v=` or `https://youtu.be/` is submitted, THE API SHALL create a Video_Record with status `downloading` and enqueue a download job to the Download_Worker
2. IF the submitted URL does not match a supported YouTube URL pattern, THEN THE API SHALL reject the request with an error message indicating an invalid URL without creating a Video_Record
3. WHEN the Download_Worker picks up a download job, THE Download_Worker SHALL download the video using yt-dlp at the best available quality up to 1080p resolution in MP4 format (re-muxing if necessary) to ensure compatibility with the Processing_Pipeline
4. THE Download_Worker SHALL store the downloaded video file in S3_Storage using the key pattern `uploads/{videoId}/original.{extension}`
5. WHEN the download completes successfully, THE Download_Worker SHALL update the Video_Record status from `downloading` to `uploaded`
6. WHILE a download is in progress, THE Download_Worker SHALL report progress percentage to the Job record at intervals of no more than 10 seconds
7. IF the download fails after exhausting the maximum retry attempts (3 attempts), THEN THE Download_Worker SHALL update the Video_Record status to `error` and store an error description in the Video_Record error field
8. IF the source video duration exceeds 180 minutes, THEN THE Download_Worker SHALL reject the download, set the Video_Record status to `error`, and store an error description indicating the video exceeds the maximum allowed duration

### Requirement 4: Pipeline Integration

**User Story:** As a ClipAI user, I want downloaded YouTube videos to be processed the same way as uploaded videos, so that I get AI-generated clips regardless of the import method.

#### Acceptance Criteria

1. WHEN the Download_Worker completes a download and the Video_Record status is `uploaded`, THE system SHALL enqueue a transcription job with the Video_Record's `videoId` and `storageKey` within 30 seconds of download completion, and update the Video_Record status to `processing`
2. THE Processing_Pipeline SHALL execute the same ordered sequence of job stages (transcribe, detect-highlights, generate-captions, render-clip) for YouTube-imported videos as for directly uploaded videos, using the same job parameters and producing the same output artifacts
3. THE Video_Record for a YouTube import SHALL store the original YouTube URL (maximum 2048 characters) and video title (maximum 255 characters) in the `metadata` JSON field before the transcription job is enqueued
4. IF the system fails to enqueue the transcription job after the Download_Worker completes, THEN THE system SHALL set the Video_Record status to `error`, store an error message indicating the enqueue failure reason, and retain the downloaded video file in storage for retry

### Requirement 5: Download Progress Display

**User Story:** As a ClipAI user, I want to see the download progress of my YouTube import, so that I know the system is working and can estimate wait time.

#### Acceptance Criteria

1. WHILE a YouTube video is downloading, THE Dashboard SHALL display a progress bar with the current download percentage as an integer from 0 to 100
2. WHILE a YouTube video is downloading, THE Dashboard SHALL poll the video status endpoint at an interval no greater than 3 seconds to retrieve progress updates, and SHALL stop polling once the video status is no longer "downloading"
3. WHEN the download completes successfully, THE Dashboard SHALL transition the display from the download progress bar to the "processing" status indicator within the next polling cycle
4. IF the video title has not yet been retrieved, THEN THE Dashboard SHALL display the source URL alongside the progress bar until the title becomes available
5. WHEN the video title is retrieved, THE Dashboard SHALL replace the source URL with the YouTube video title alongside the progress bar
6. IF the download fails while in progress, THEN THE Dashboard SHALL display an error status indicator in place of the progress bar and stop polling

### Requirement 6: Error Handling

**User Story:** As a ClipAI user, I want clear error messages when a YouTube import fails, so that I can understand what went wrong and take corrective action.

#### Acceptance Criteria

1. IF the YouTube video is unavailable (deleted, private, or region-restricted), THEN THE Download_Worker SHALL update the Video_Record status to `error` and store an error message in the Video_Record `error` field indicating the unavailability reason (deleted, private, or region-restricted)
2. IF the download fails due to a network error or timeout, THEN THE Download_Worker SHALL retry up to 3 times with exponential backoff starting at 5 seconds before updating the Video_Record status to `error` with a message indicating network failure
3. IF the video exceeds the maximum allowed duration (configured via `MAX_VIDEO_DURATION_SECONDS` environment variable, default 1800 seconds), THEN THE Download_Worker SHALL reject the download without writing to S3_Storage and update the Video_Record status to `error` with a message indicating the video exceeds the duration limit
4. IF yt-dlp reports a copyright restriction preventing download, THEN THE Download_Worker SHALL update the Video_Record status to `error` with a message indicating the video cannot be downloaded due to copyright restrictions
5. WHEN a download job fails after all retry attempts are exhausted, THE Dashboard SHALL display the error message stored in the Video_Record `error` field to the user within the video card for that record
6. IF the downloaded file exceeds the maximum file size limit (configured via `MAX_FILE_SIZE_MB` environment variable, default 500 MB), THEN THE Download_Worker SHALL delete the partial file from S3_Storage and update the Video_Record status to `error` with a message indicating the file exceeds the size limit
7. IF the Download_Worker fails to delete the partial file from S3_Storage during error cleanup, THEN THE Download_Worker SHALL still update the Video_Record status to `error` and log the cleanup failure without blocking the error status update

### Requirement 7: Terms of Service Compliance

**User Story:** As a ClipAI product owner, I want the application to display appropriate disclaimers about YouTube content usage, so that users understand their responsibilities regarding copyright and terms of service.

#### Acceptance Criteria

1. THE Dashboard SHALL display a static disclaimer text within the same visual section as the URL_Input stating that users are responsible for ensuring they have the right to use the imported content
2. THE Dashboard SHALL include in the disclaimer text that the feature is intended for importing the user's own content or content they have explicit permission to use
3. WHEN a user submits a YouTube URL for the first time in a browser session, THE Dashboard SHALL present the disclaimer in a confirmation dialog that requires the user to explicitly accept (e.g., button click) before the download is initiated
4. IF the user dismisses or declines the disclaimer confirmation dialog, THEN THE Dashboard SHALL cancel the URL submission and not initiate the download
5. WHEN a user has already accepted the disclaimer in the current browser session, THE Dashboard SHALL proceed with subsequent YouTube URL submissions without showing the confirmation dialog again

### Requirement 8: Video Metadata Retrieval

**User Story:** As a ClipAI user, I want the system to capture YouTube video metadata during import, so that my imported videos are properly labeled and organized.

#### Acceptance Criteria

1. WHEN a YouTube download job starts, THE Download_Worker SHALL retrieve the video title, duration (in seconds), and thumbnail URL from YouTube within 15 seconds before starting the file download
2. WHEN metadata is retrieved, THE Download_Worker SHALL update the Video_Record with the video title (truncated to 255 characters if longer) as `originalName`, and store duration (in seconds) and thumbnail URL in the metadata JSON field
3. IF metadata retrieval fails or times out, THEN THE Download_Worker SHALL proceed with the download using the video ID as a fallback for `originalName` and set duration and thumbnailUrl to null in the Video_Record
4. WHEN a YouTube download job starts, THE Download_Worker SHALL store the source YouTube URL in the Video_Record metadata field under the key `sourceUrl`

### Requirement 9: Unified Upload Interface

**User Story:** As a ClipAI user, I want a single combined upload area where I can either drop a file or paste a YouTube URL, so that I can import videos from any source without switching between separate UI sections.

#### Acceptance Criteria

1. THE Dashboard SHALL display a single Upload_Section containing a file drop area and a YouTube URL_Input field within the same bordered container, with no other upload entry points present elsewhere on the Dashboard
2. THE Upload_Section SHALL display the file drop area above the URL_Input, with a visible label listing the supported file extensions MP4, MOV, AVI, MKV, and WEBM, and indicating a maximum file size of 2048 MB (2 GB)
3. THE Upload_Section SHALL display a horizontal divider between the file drop area and the URL_Input that contains the centered text "or"
4. THE URL_Input SHALL display the placeholder text "Or paste a YouTube link" when the field is empty and unfocused
5. WHEN a user drops or selects a file in the file drop area, THE Upload_Section SHALL clear any text present in the URL_Input field within 100 ms of the file being accepted
6. WHEN a user enters one or more characters in the URL_Input via paste or keyboard input, THE Upload_Section SHALL clear any previously selected file from the file drop area within 100 ms of the input event
7. THE Upload_Section SHALL display exactly one primary action button labeled "Generate clips" that, when activated, submits the currently held input (the selected file if present, otherwise the URL text)
8. WHILE the file drop area holds no selected file AND the URL_Input is empty or contains a string that does not match a YouTube URL pattern (a URL whose host is one of youtube.com, www.youtube.com, m.youtube.com, or youtu.be and that contains a non-empty video identifier), THE Upload_Section SHALL render the "Generate clips" button in a disabled, non-interactive state
9. IF the user drops a file whose extension is not one of MP4, MOV, AVI, MKV, or WEBM, or whose size exceeds 2048 MB, THEN THE Upload_Section SHALL reject the file, leave the file drop area empty, and display an inline error message indicating the unsupported format or size limit
10. IF the user activates the "Generate clips" button while the URL_Input contains a string that does not match the YouTube URL pattern defined in criterion 8, THEN THE Upload_Section SHALL block submission and display an inline error message indicating an invalid YouTube URL

### Requirement 10: Custom AI Instructions

**User Story:** As a ClipAI user, I want to provide custom instructions describing what kind of clips I want, so that the AI can focus on the moments most relevant to my needs.

#### Acceptance Criteria

1. THE Upload_Section SHALL display a Custom_Instructions text field with a label of "Add custom instructions" followed by the text "(optional)"
2. THE Custom_Instructions field SHALL accept multiline text input up to 1000 Unicode code points after trimming leading and trailing whitespace
3. THE Custom_Instructions field SHALL display placeholder text providing an example of useful instructions (e.g., "Find all the moments when X mentioned Y, shared advice, or made a key point")
4. WHEN a user submits an upload or URL with Custom_Instructions text containing at least one non-whitespace character after trimming, THE Dashboard SHALL include the trimmed instructions in the API request as a `customInstructions` field
5. WHEN a user submits an upload or URL with Custom_Instructions text that is empty or contains only whitespace, THE Dashboard SHALL omit the `customInstructions` field from the API request body
6. WHEN the API receives a `customInstructions` value, THE API SHALL store it in the Video_Record `metadata` field under the key `customInstructions`
7. IF the API receives a `customInstructions` value exceeding 1000 Unicode code points, THEN THE API SHALL reject the request with a VALIDATION_ERROR response and not create a Video_Record
8. WHEN the highlight detection job runs for a video that has `customInstructions` in its metadata, THE highlight detection job SHALL pass those instructions to the LLM as the `criteria` parameter to bias the highlight selection toward the user's stated focus
9. WHILE the user is typing in the Custom_Instructions field, THE Dashboard SHALL display a character count indicator showing the current length and the 1000-character limit
10. IF Custom_Instructions exceeds 1000 Unicode code points, THEN THE Dashboard SHALL display the character count in an error state and disable the "Generate clips" submit button until the text is shortened to within the limit
11. THE Custom_Instructions field SHALL preserve its current value when the user switches between file upload and URL input modes within the same session
