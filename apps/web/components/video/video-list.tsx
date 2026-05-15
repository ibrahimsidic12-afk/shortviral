'use client';

import type { Video } from '@clip-ai/types';

// Demo data - will be replaced with real API calls
const DEMO_VIDEOS: Partial<Video>[] = [
  {
    id: 'demo-1',
    originalName: 'podcast-episode-42.mp4',
    status: 'ready',
    metadata: { duration: 3654, width: 1920, height: 1080, fps: 30, bitrate: 5000000, codec: 'h264', audioCodec: 'aac', fileSize: 1200000000, format: 'mp4' },
    tags: ['podcast', 'interview'],
    createdAt: '2025-01-15T10:30:00Z',
  },
  {
    id: 'demo-2',
    originalName: 'keynote-presentation.mov',
    status: 'processing',
    metadata: { duration: 2400, width: 1920, height: 1080, fps: 30, bitrate: 8000000, codec: 'h264', audioCodec: 'aac', fileSize: 2400000000, format: 'mov' },
    tags: ['presentation'],
    createdAt: '2025-01-14T14:00:00Z',
  },
  {
    id: 'demo-3',
    originalName: 'tutorial-react-hooks.mp4',
    status: 'transcribing',
    metadata: { duration: 1800, width: 1920, height: 1080, fps: 60, bitrate: 6000000, codec: 'h264', audioCodec: 'aac', fileSize: 1350000000, format: 'mp4' },
    tags: ['tutorial', 'coding'],
    createdAt: '2025-01-14T09:15:00Z',
  },
];

export function VideoList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DEMO_VIDEOS.map((video) => (
        <VideoCard key={video.id} video={video as Video} />
      ))}
    </div>
  );
}

function VideoCard({ video }: { video: Video }) {
  const statusColors: Record<string, string> = {
    ready: 'bg-green-500/10 text-green-400',
    processing: 'bg-yellow-500/10 text-yellow-400',
    transcribing: 'bg-blue-500/10 text-blue-400',
    error: 'bg-red-500/10 text-red-400',
    uploaded: 'bg-surface-500/10 text-surface-400',
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <a
      href={`/editor/${video.id}`}
      className="group p-4 rounded-xl bg-surface-900/50 border border-surface-800 hover:border-brand-500/30 transition-all duration-200"
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video rounded-lg bg-surface-800 mb-3 overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-10 h-10 text-surface-600 group-hover:text-brand-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
          </svg>
        </div>
        {video.metadata && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs text-white font-mono">
            {formatDuration(video.metadata.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate">{video.originalName}</p>
          <p className="text-surface-400 text-xs mt-1">
            {new Date(video.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[video.status] || statusColors['uploaded']}`}>
          {video.status}
        </span>
      </div>

      {/* Tags */}
      {video.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {video.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-md bg-surface-800 text-surface-400 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
