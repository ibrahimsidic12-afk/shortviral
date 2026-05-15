# ClipAI - AI-Powered Video Clipping App

> Transform long-form videos into viral short-form clips with AI-powered highlight detection, animated captions, and smart reframing.

Built with **Regolo API** for transcription and AI analysis, **FFmpeg** for video processing, and **Next.js 14** for the frontend.

---

## Architecture

```
clip-ai-app/
├── apps/
│   ├── web/          # Next.js 14 App Router frontend
│   └── worker/       # BullMQ background job processor
├── packages/
│   ├── regolo-client/  # Typed Regolo API SDK wrapper
│   ├── video-core/     # FFmpeg utilities, captions, presets
│   └── types/          # Shared TypeScript definitions
└── infrastructure/
    └── docker/         # Docker Compose for local dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| AI/ML | Regolo API (Whisper, Llama 3.3, Qwen 2.5 VL) |
| Video | FFmpeg, fluent-ffmpeg |
| Queue | BullMQ + Redis |
| Storage | S3-compatible (AWS S3 / MinIO) |
| Language | TypeScript (strict mode) |
| Monorepo | pnpm workspaces + Turborepo |

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose
- Regolo API key ([get one here](https://regolo.ai))

### Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/clip-ai-app.git
cd clip-ai-app
pnpm install

# 2. Start infrastructure (Redis + MinIO)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your REGOLO_API_KEY

# 4. Build packages
pnpm build

# 5. Start development
pnpm dev
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Web App | http://localhost:3000 | Next.js frontend |
| MinIO Console | http://localhost:9001 | Storage browser |
| Bull Board | http://localhost:3100 | Queue dashboard |
| Redis | localhost:6379 | Job queue |

## Processing Pipeline

```
Upload → Extract Audio → Transcribe (Regolo Whisper)
  → Detect Highlights (Regolo LLM)
    → Generate Captions (ASS/SRT)
      → Render Clips (FFmpeg)
        → Export (TikTok/Reels/Shorts)
```

## Key Features

- **AI Highlight Detection** - Finds the most engaging moments using LLM reasoning
- **Word-Level Captions** - Karaoke-style animated subtitles from Whisper timestamps
- **Smart Reframing** - Auto-crops 16:9 → 9:16 with speaker tracking
- **Multi-Platform Export** - TikTok, Reels, Shorts, Twitter presets
- **Job Pipeline** - Reliable BullMQ processing with retries and progress tracking
- **Privacy-First** - Regolo's zero data retention policy

## Environment Variables

See `.env.example` for all configuration options.

## Development

```bash
# Run all apps in dev mode
pnpm dev

# Build all packages
pnpm build

# Type check entire monorepo
pnpm typecheck

# Run specific app
pnpm --filter @clip-ai/web dev
pnpm --filter @clip-ai/worker dev
```

## License

MIT
