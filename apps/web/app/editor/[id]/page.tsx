import { ClipEditor } from '@/components/editor/clip-editor';

interface EditorPageProps {
  params: { id: string };
}

export default function EditorPage({ params }: EditorPageProps) {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Editor Header */}
      <header className="border-b border-surface-800 bg-surface-950/80 backdrop-blur-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-surface-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-white font-medium">Clip Editor</h1>
            <span className="text-xs text-surface-500 font-mono">#{params.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 text-sm text-surface-300 hover:text-white border border-surface-700 rounded-lg transition-colors">
              Preview
            </button>
            <button className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors">
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <ClipEditor videoId={params.id} />
    </div>
  );
}
