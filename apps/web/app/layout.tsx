import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ClipAI - AI-Powered Video Clipping',
  description: 'Transform long videos into viral short-form clips with AI-powered highlights, captions, and smart reframing.',
  keywords: ['video clipping', 'AI', 'short-form', 'TikTok', 'Reels', 'Shorts'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-surface-950">
          {children}
        </div>
      </body>
    </html>
  );
}
