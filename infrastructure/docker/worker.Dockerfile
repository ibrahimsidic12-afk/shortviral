# ============================================
# ClipAI Worker - Production Dockerfile
# Multi-stage build for minimal image size
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY tsconfig.base.json ./

# Copy package sources
COPY packages/types/package.json packages/types/
COPY packages/regolo-client/package.json packages/regolo-client/
COPY packages/video-core/package.json packages/video-core/
COPY apps/worker/package.json apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/worker/ apps/worker/

# Build all packages
RUN pnpm --filter @clip-ai/types build
RUN pnpm --filter @clip-ai/regolo-client build
RUN pnpm --filter @clip-ai/video-core build
RUN pnpm --filter @clip-ai/worker build

# Stage 2: Production
FROM node:20-alpine AS runner

# Install FFmpeg (required for video processing)
RUN apk add --no-cache ffmpeg

RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

WORKDIR /app

# Copy built output
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/types/package.json packages/types/
COPY --from=builder /app/packages/regolo-client/dist packages/regolo-client/dist
COPY --from=builder /app/packages/regolo-client/package.json packages/regolo-client/
COPY --from=builder /app/packages/video-core/dist packages/video-core/dist
COPY --from=builder /app/packages/video-core/package.json packages/video-core/
COPY --from=builder /app/apps/worker/dist apps/worker/dist
COPY --from=builder /app/apps/worker/package.json apps/worker/
COPY --from=builder /app/apps/worker/node_modules apps/worker/node_modules

# Create temp directory for video processing
RUN mkdir -p /tmp/clipai

ENV NODE_ENV=production
ENV CONCURRENT_WORKERS=3

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["node", "apps/worker/dist/index.js"]
