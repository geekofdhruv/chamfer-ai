import { useState, useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { NutToggle } from '@/components/hardware/NutToggle';

interface HeroSectionProps {
  onStart: (prompt: string) => void;
  initialPrompt?: string;
}

const EXAMPLES = [
  'a 12-tooth spur gear',
  'a wall bracket for a shelf',
  'a 60 mm electronics enclosure',
  'a pipe connector',
];

export function HeroSection({ onStart, initialPrompt = '' }: HeroSectionProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [focused, setFocused] = useState(false);
  const [showWireframe, setShowWireframe] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setShowWireframe(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) onStart(prompt.trim());
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-vibe-paper to-vibe-paper" />

      <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
        {/* Logo badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-vibe-cyanotype/10 bg-white/60 backdrop-blur-sm mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <Sparkles className="w-4 h-4 text-vibe-copper" />
          <span className="text-xs font-medium text-vibe-slate uppercase tracking-wider">Open-source text-to-CAD</span>
        </div>

        {/* Headline */}
        <h1 className={`font-display font-bold text-vibe-ink text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          CAD by
          <br />
          <span className="text-vibe-cobalt">description.</span>
        </h1>

        {/* Subheadline */}
        <p className={`text-lg md:text-xl text-vibe-slate max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          Type a part. VibeCAD generates CadQuery Python, runs it on a real OpenCASCADE B-rep kernel, and gives you a manufacturable 3D model — STEP, STL, and GLB.
        </p>

        {/* Input card */}
        <div className={`max-w-2xl mx-auto transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <form onSubmit={handleSubmit} className={`relative rounded-2xl border-2 transition-all duration-300 bg-white shadow-lg ${focused ? 'border-vibe-cobalt shadow-vibe-cobalt/15' : 'border-vibe-subtle hover:border-vibe-cyanotype/30'}`}>
            <textarea
              className="w-full bg-transparent p-5 md:p-6 text-base md:text-lg text-vibe-ink resize-none outline-none placeholder:text-vibe-muted"
              rows={3}
              placeholder="Describe the part you need, like a 12-tooth gear or a wall bracket..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            />
            <div className="flex items-center justify-between px-5 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-vibe-slate hidden sm:inline">Try:</span>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setPrompt(`Make me ${ex}`)}
                      className="text-xs px-2.5 py-1 rounded-full border border-vibe-subtle text-vibe-slate hover:border-vibe-cobalt hover:text-vibe-cobalt transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-vibe-cobalt text-white font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-vibe-cobalt/90 transition-colors shadow-md hover:shadow-lg"
              >
                Start designing
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Model preview */}
        <div className={`mt-12 flex justify-center transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl border border-vibe-subtle bg-white shadow-xl overflow-hidden">
            <svg viewBox="0 0 400 300" className="w-full h-full">
              <defs>
                <linearGradient id="solidFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
                <linearGradient id="wireFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid */}
              <pattern id="previewGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(15,23,42,0.06)" strokeWidth="1" />
              </pattern>
              <rect width="400" height="300" fill="url(#previewGrid)" />

              {/* Wireframe cube */}
              <g className={`transition-opacity duration-700 ${showWireframe ? 'opacity-100' : 'opacity-0'}`}>
                <path d="M150 120 L250 80 L330 120 L230 160 Z" fill="none" stroke="#0C4A6E" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M150 120 L150 200 L230 240 L230 160" fill="none" stroke="#0C4A6E" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M250 80 L250 160 L230 240 M250 160 L330 200 M330 120 L330 200" fill="none" stroke="#0C4A6E" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M150 200 L250 160 L330 200" fill="none" stroke="#0C4A6E" strokeWidth="1.5" strokeDasharray="4 3" />
              </g>

              {/* Solid cube */}
              <g className={`transition-opacity duration-700 ${showWireframe ? 'opacity-0' : 'opacity-100'}`}>
                <path d="M150 120 L250 80 L330 120 L230 160 Z" fill="url(#solidFill)" opacity="0.95" />
                <path d="M150 120 L150 200 L230 240 L230 160 Z" fill="#1D4ED8" opacity="0.85" />
                <path d="M250 80 L250 160 L330 200 L330 120 Z" fill="#06B6D4" opacity="0.7" />
                <path d="M150 200 L250 160 L330 200 L230 240 Z" fill="#2563EB" opacity="0.9" />
                <path d="M230 160 L250 160 L250 80 M230 160 L230 240" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none" />
              </g>

              {/* Dimension line */}
              <g className={`transition-opacity duration-700 ${showWireframe ? 'opacity-0' : 'opacity-100'}`}>
                <line x1="40" y1="200" x2="150" y2="200" stroke="#D97706" strokeWidth="1.5" />
                <path d="M40 196 V204 M150 196 V204" stroke="#D97706" strokeWidth="1.5" />
                <text x="95" y="220" textAnchor="middle" className="font-mono text-[12px] fill-vibe-cyanotype">60.0 mm</text>
              </g>
            </svg>

            {/* Status pill */}
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-vibe-subtle text-xs font-medium text-vibe-slate">
              <div className="w-2 h-2 rounded-full bg-vibe-patina animate-pulse" />
              {showWireframe ? 'Wireframe' : 'Solid B-rep'}
            </div>
          </div>
        </div>

        {/* Trust / tech badges */}
        <div className={`flex flex-wrap items-center justify-center gap-4 mt-12 transition-all duration-700 delay-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <NutToggle checked={!showWireframe} onChange={setShowWireframe} label="Show solid" size="sm" />
          <span className="text-xs text-vibe-muted">CadQuery · OpenCASCADE · STEP · STL · GLB</span>
        </div>
      </div>
    </section>
  );
}
