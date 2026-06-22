import { Github, Twitter, ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { HeroSection } from './HeroSection';
import { BlueprintBackground } from './BlueprintBackground';
import { FeatureProcess } from './FeatureProcess';
import { ExampleGallery } from './ExampleGallery';

interface LandingPageProps {
  onStart: (prompt: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="light min-h-screen bg-vibe-paper text-vibe-ink relative">
      <BlueprintBackground />

      {/* Nav */}
      <nav className="relative z-20 w-full px-6 py-4 flex items-center justify-between border-b border-vibe-subtle/50 bg-white/50 backdrop-blur-sm">
        <Logo />
        <div className="flex items-center gap-6">
          <a href="#examples" className="text-sm font-medium text-vibe-slate hover:text-vibe-cobalt transition-colors">Examples</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="text-sm font-medium text-vibe-slate hover:text-vibe-cobalt transition-colors inline-flex items-center gap-1">
            GitHub <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      <main className="relative z-10">
        <HeroSection onStart={onStart} />
        <FeatureProcess />
        <div id="examples">
          <ExampleGallery onSelect={onStart} />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-vibe-subtle bg-white px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Logo showWordmark={false} size={28} />
            <span className="font-display font-bold text-vibe-ink text-sm">VibeCAD</span>
          </div>
          <p className="text-xs text-vibe-muted text-center md:text-left">
            Open-source parametric CAD. Built with CadQuery, OpenCASCADE, React, and Three.js.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-vibe-slate hover:text-vibe-cobalt transition-colors">
              <Github className="w-5 h-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-vibe-slate hover:text-vibe-cobalt transition-colors">
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
