'use client';

import { useState } from 'react';

interface ClipEditorProps {
  videoId: string;
}

export function ClipEditor({ videoId }: ClipEditorProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(30);
  const [captionStyle, setCaptionStyle] = useState<string>('bold');
  const [platform, setPlatform] = useState<string>('tiktok');

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
      {/* Left: Video Preview */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface-950">
        {/* Video Container (9:16 aspect) */}
        <div className="relative w-full max-w-[360px] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-surface-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <p className="text-surface-500 text-sm">Video Preview</p>
              <p className="text-surface-600 text-xs mt-1">ID: {videoId}</p>
            </div>
          </div>

          {/* Caption Preview Overlay */}
          <div className="absolute bottom-8 left-4 right-4 text-center">
            <p className="text-white text-lg font-black leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              AI-generated captions will appear here
            </p>
          </div>
        </div>
      </div>

      {/* Right: Controls Panel */}
      <div className="w-full lg:w-96 border-l border-surface-800 bg-surface-900/50 overflow-y-auto">
        <div className="p-6 space-y-8">
          {/* Platform Selector */}
          <section>
            <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Platform</h3>
            <div className="grid grid-cols-3 gap-2">
              {['tiktok', 'reels', 'shorts'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    platform === p
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </section>

          {/* Timeline Controls */}
          <section>
            <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Clip Range</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-surface-400 block mb-1">Start</label>
                  <input
                    type="number"
                    value={clipStart}
                    onChange={(e) => setClipStart(Number(e.target.value))}
                    min={0}
                    step={0.1}
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-surface-400 block mb-1">End</label>
                  <input
                    type="number"
                    value={clipEnd}
                    onChange={(e) => setClipEnd(Number(e.target.value))}
                    min={clipStart}
                    step={0.1}
                    className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="text-xs text-surface-400 text-center">
                Duration: {(clipEnd - clipStart).toFixed(1)}s
              </div>
            </div>
          </section>

          {/* Caption Style */}
          <section>
            <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">Caption Style</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'bold', label: 'Bold', preview: 'Aa' },
                { id: 'karaoke', label: 'Karaoke', preview: 'Aa' },
                { id: 'minimal', label: 'Minimal', preview: 'Aa' },
                { id: 'gradient', label: 'Gradient', preview: 'Aa' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setCaptionStyle(style.id)}
                  className={`p-3 rounded-xl border transition-all ${
                    captionStyle === style.id
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-surface-700 bg-surface-800 hover:border-surface-600'
                  }`}
                >
                  <div className={`text-2xl font-black mb-1 ${
                    captionStyle === style.id ? 'text-brand-400' : 'text-white'
                  }`}>
                    {style.preview}
                  </div>
                  <div className="text-xs text-surface-400">{style.label}</div>
                </button>
              ))}
            </div>
          </section>

          {/* AI Suggestions */}
          <section>
            <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-3">
              AI Suggestions
            </h3>
            <div className="space-y-2">
              {[
                { time: '0:45 - 1:15', score: 92, hook: 'The secret nobody talks about...' },
                { time: '3:20 - 4:05', score: 87, hook: 'Here is what actually happened...' },
                { time: '7:10 - 7:55', score: 81, hook: 'This changed everything for me...' },
              ].map((suggestion, i) => (
                <button
                  key={i}
                  className="w-full p-3 rounded-xl bg-surface-800/50 border border-surface-700 hover:border-brand-500/30 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-surface-400">{suggestion.time}</span>
                    <span className="text-xs font-medium text-green-400">{suggestion.score}% viral</span>
                  </div>
                  <p className="text-sm text-white group-hover:text-brand-300 transition-colors">
                    &ldquo;{suggestion.hook}&rdquo;
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* Export Button */}
          <button className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-brand-600/20">
            Export Clip
          </button>
        </div>
      </div>
    </div>
  );
}
