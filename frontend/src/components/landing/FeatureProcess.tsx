import { MessageSquare, Code, Boxes, FileOutput } from 'lucide-react';

const STEPS = [
  {
    id: 'text',
    icon: MessageSquare,
    label: 'Describe',
    detail: 'Type the part in plain language. Add dimensions, material, and purpose.',
  },
  {
    id: 'code',
    icon: Code,
    label: 'Generate',
    detail: 'An open-source code model writes CadQuery Python with named parameters.',
  },
  {
    id: 'solid',
    icon: Boxes,
    label: 'Build',
    detail: 'A sandboxed OpenCASCADE kernel builds the real B-rep geometry.',
  },
  {
    id: 'export',
    icon: FileOutput,
    label: 'Export',
    detail: 'Download STEP for engineering, STL for printing, or GLB for the web.',
  },
];

export function FeatureProcess() {
  return (
    <section className="relative py-24 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono font-semibold text-vibe-cobalt uppercase tracking-widest">Process</span>
          <h2 className="font-display font-bold text-vibe-ink text-3xl md:text-4xl mt-3 mb-4">
            From text to manufacturable geometry
          </h2>
          <p className="text-vibe-slate max-w-xl mx-auto">
            No templates. The model is rebuilt from a real parametric script every time you change a value.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute top-[42px] left-[12.5%] right-[12.5%] h-px bg-vibe-subtle hidden md:block" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 w-20 h-20 rounded-2xl bg-vibe-paper border border-vibe-subtle flex items-center justify-center mb-5 shadow-sm">
                    <Icon className="w-7 h-7 text-vibe-cobalt" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-vibe-cobalt text-white text-[10px] font-bold flex items-center justify-center font-mono">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-vibe-ink text-lg mb-2">{step.label}</h3>
                  <p className="text-sm text-vibe-slate leading-relaxed">{step.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
