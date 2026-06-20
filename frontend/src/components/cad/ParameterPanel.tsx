import type { Parameter } from '@/types';

interface ParameterPanelProps {
  parameters: Parameter[];
  values: Record<string, number>;
  onChange: (name: string, value: number) => void;
}

export function ParameterPanel({ parameters, values, onChange }: ParameterPanelProps) {
  if (parameters.length === 0) return null;

  return (
    <div className="space-y-2">
      {parameters.map(p => {
        const val = values[p.name] ?? p.default;
        const pct = ((val - p.min) / (p.max - p.min)) * 100;

        return (
          <div key={p.name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors">
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-adam-text-secondary font-medium tracking-wide">
                  {p.name.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] text-adam-blue font-mono font-semibold tabular-nums">
                  {val.toFixed(1)}
                </span>
              </div>
              <div className="relative h-5 flex items-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-1 rounded-full bg-adam-neutral-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-adam-blue/80 to-adam-blue transition-all duration-75"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={e => onChange(p.name, parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-adam-blue pointer-events-none transition-transform group-hover:scale-110"
                  style={{ left: `calc(${pct}% - 7px)` }}
                />
              </div>
            </div>
            <div className="flex justify-between px-3 pb-2 pt-0.5">
              <span className="text-[9px] text-adam-text-tertiary font-mono">{p.min}</span>
              <span className="text-[9px] text-adam-text-tertiary font-mono">{p.max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
