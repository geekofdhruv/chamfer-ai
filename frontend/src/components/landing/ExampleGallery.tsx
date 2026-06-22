import { useState } from 'react';
import { cn } from '@/lib/utils';

const EXAMPLES = [
  {
    prompt: 'a 12-tooth spur gear',
    params: ['teeth = 12', 'module = 2.0', 'thickness = 8.0'],
    tags: ['STL', 'STEP'],
  },
  {
    prompt: 'a wall bracket for a shelf',
    params: ['length = 120.0', 'hole_dia = 8.0', 'thickness = 5.0'],
    tags: ['STL', 'STEP'],
  },
  {
    prompt: 'a 60 mm electronics enclosure',
    params: ['width = 60.0', 'height = 40.0', 'wall = 2.0'],
    tags: ['STL', 'STEP', 'GLB'],
  },
  {
    prompt: 'a pipe connector',
    params: ['outer_dia = 25.0', 'inner_dia = 20.0', 'length = 30.0'],
    tags: ['STL', 'STEP'],
  },
];

interface ExampleGalleryProps {
  onSelect: (prompt: string) => void;
}

export function ExampleGallery({ onSelect }: ExampleGalleryProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <section className="relative py-24 px-4 bg-vibe-paper">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono font-semibold text-vibe-cobalt uppercase tracking-widest">Examples</span>
          <h2 className="font-display font-bold text-vibe-ink text-3xl md:text-4xl mt-3 mb-4">
            Parts you can build right now
          </h2>
          <p className="text-vibe-slate max-w-xl mx-auto">
            These are real prompts. The parameters are extracted from the generated CadQuery code.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {EXAMPLES.map((ex, i) => (
            <button
              key={ex.prompt}
              onClick={() => onSelect(`Make me ${ex.prompt}`)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                'group text-left rounded-2xl border bg-white p-5 transition-all duration-300 hover:shadow-lg',
                hovered === i ? 'border-vibe-cobalt shadow-vibe-cobalt/10' : 'border-vibe-subtle'
              )}
            >
              <div className="w-full h-32 rounded-xl bg-vibe-paper border border-vibe-subtle mb-4 flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 120 90" className="w-20 h-20 text-vibe-cobalt/80">
                  <path
                    d="M30 70 L30 30 L60 15 L90 30 L90 70 L60 85 Z"
                    fill="currentColor"
                    opacity={0.15}
                  />
                  <path
                    d="M30 30 L60 15 L90 30 M30 30 L30 70 M90 30 L90 70 M30 70 L60 85 L90 70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-vibe-ink text-base mb-2 capitalize">
                {ex.prompt}
              </h3>
              <div className="space-y-1 mb-4">
                {ex.params.map((p) => (
                  <div key={p} className="font-mono text-[10px] text-vibe-slate bg-vibe-paper px-2 py-1 rounded">
                    {p}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ex.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-medium text-vibe-cobalt bg-vibe-cobalt/10 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
