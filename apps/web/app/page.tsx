import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto animate-fade-in">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-sm font-medium mb-6 ring-1 ring-brand-500/20">
          <svg className="w-3.5 h-3.5 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          Powered by Regolo AI
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
          Turn Videos into
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600">
            {' '}Viral Clips
          </span>
        </h1>

        <p className="text-lg md:text-xl text-surface-300 mb-10 max-w-2xl mx-auto leading-relaxed">
          Upload any video. AI finds the best moments, adds stunning captions,
          and exports clips ready for TikTok, Reels, and Shorts.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get Started Free
          </Link>
          <Link
            href="#features"
            className="px-8 py-3.5 bg-surface-800 hover:bg-surface-700 text-white font-medium rounded-xl transition-all duration-200 border border-surface-700 hover:border-surface-600"
          >
            See How It Works
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto w-full scroll-mt-20">
        <FeatureCard
          icon="lightning"
          title="AI Highlight Detection"
          description="Our AI watches your video and finds the most engaging, shareable moments automatically."
        />
        <FeatureCard
          icon="caption"
          title="Animated Captions"
          description="Word-level karaoke-style captions that keep viewers engaged. Multiple styles to choose from."
        />
        <FeatureCard
          icon="resize"
          title="Smart Reframing"
          description="Auto-crops landscape videos to portrait, keeping the speaker perfectly centered."
        />
      </div>

      {/* How It Works */}
      <div className="mt-24 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
          Three steps to viral clips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StepCard step={1} title="Upload" description="Drop any video up to 500MB. We support MP4, MOV, AVI, MKV, and WebM." />
          <StepCard step={2} title="AI Analyzes" description="Transcription, highlight detection, and virality scoring happen automatically." />
          <StepCard step={3} title="Export" description="Pick your clips, choose a caption style, and export for any platform." />
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-12 justify-center mt-20 text-center">
        <Stat value="10x" label="Faster than manual editing" />
        <Stat value="95%" label="Transcription accuracy" />
        <Stat value="6" label="Export formats" />
      </div>

      {/* Footer CTA */}
      <div className="mt-24 mb-12 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/25"
        >
          Start Clipping Now
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  const icons: Record<string, string> = {
    lightning: 'M13 2L3 14h9l-1 10L21 10h-9l1-8z',
    caption: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z',
    resize: 'M21 3H3v18h18V3zM15 3v18M9 3v18M3 9h18M3 15h18',
  };

  return (
    <div className="p-6 rounded-2xl bg-surface-900/50 border border-surface-800 hover:border-brand-500/30 transition-colors duration-300">
      <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icons[icon]} />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-surface-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-surface-400 mt-1">{label}</div>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
        <span className="text-brand-400 font-bold text-sm">{step}</span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-surface-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
