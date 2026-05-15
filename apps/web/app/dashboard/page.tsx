import { VideoUpload } from '@/components/video/video-upload';
import { VideoList } from '@/components/video/video-list';

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-white font-semibold text-lg">ClipAI</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="/dashboard" className="text-white text-sm font-medium">Dashboard</a>
            <a href="/dashboard" className="text-surface-400 text-sm hover:text-white transition-colors">My Clips</a>
            <a href="/dashboard" className="text-surface-400 text-sm hover:text-white transition-colors">Settings</a>
          </nav>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 text-xs font-medium">
              Pro Plan
            </div>
            <div className="w-8 h-8 rounded-full bg-surface-700" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Upload Section */}
        <section className="mb-12">
          <h1 className="text-2xl font-bold text-white mb-2">Upload Video</h1>
          <p className="text-surface-400 mb-6">
            Upload a video and our AI will find the best moments, add captions, and create clips.
          </p>
          <VideoUpload />
        </section>

        {/* Recent Videos */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Recent Videos</h2>
            <button className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
              View All
            </button>
          </div>
          <VideoList />
        </section>
      </main>
    </div>
  );
}
