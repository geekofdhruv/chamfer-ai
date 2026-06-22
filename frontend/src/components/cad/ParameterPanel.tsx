import type { ParameterSchema } from '@/types';

interface ParameterPanelProps {
  parameters: Record<string, ParameterSchema>;
  values: Record<string, number | string | boolean>;
  onChange: (name: string, value: number | string | boolean) => void;
}

export function ParameterPanel({ parameters, values, onChange }: ParameterPanelProps) {
  const paramEntries = Object.entries(parameters);
  if (paramEntries.length === 0) return null;

  return (
    <div className="space-y-2">
      {paramEntries.map(([name, schema]) => {
        const val = values[name] ?? schema.default;
        const displayName = name.replace(/_/g, ' ');

        if (schema.type === 'bool') {
          return (
            <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
                <button
                  onClick={() => onChange(name, !val)}
                  className={`w-8 h-4 rounded-full transition-colors ${val ? 'bg-adam-blue' : 'bg-adam-neutral-700'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${val ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {schema.description && (
                <p className="text-[9px] text-adam-text-tertiary mt-1">{schema.description}</p>
              )}
            </div>
          );
        }

        if (schema.type === 'enum' && schema.options && schema.options.length > 0) {
          return (
            <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
              </div>
              <select
                value={String(val)}
                onChange={(e) => onChange(name, e.target.value)}
                className="w-full text-[11px] bg-adam-neutral-800 border border-adam-neutral-700 rounded px-2 py-1 text-adam-text-secondary"
              >
                {schema.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {schema.description && (
                <p className="text-[9px] text-adam-text-tertiary mt-1">{schema.description}</p>
              )}
            </div>
          );
        }

        if (schema.type === 'string' || schema.type === 'color') {
          return (
            <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
              </div>
              <input
                type={schema.type === 'color' ? 'color' : 'text'}
                value={String(val)}
                onChange={(e) => onChange(name, e.target.value)}
                className="w-full text-[11px] bg-adam-neutral-800 border border-adam-neutral-700 rounded px-2 py-1 text-adam-text-secondary"
              />
              {schema.description && (
                <p className="text-[9px] text-adam-text-tertiary mt-1">{schema.description}</p>
              )}
            </div>
          );
        }

        // int / float - slider
        const min = schema.min ?? 0;
        const max = schema.max ?? 100;
        const step = schema.step ?? 1;
        const numericVal = typeof val === 'number' ? val : Number(val) || min;
        const pct = ((numericVal - min) / (max - min)) * 100;

        return (
          <div key={name} className="group rounded-lg bg-adam-bg-dark border border-adam-neutral-700 hover:border-adam-neutral-500 transition-colors">
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-adam-text-secondary font-medium tracking-wide capitalize">
                  {displayName}
                </span>
                <span className="text-[11px] text-adam-blue font-mono font-semibold tabular-nums">
                  {schema.type === 'float' ? numericVal.toFixed(1) : numericVal}
                </span>
              </div>
              {schema.description && (
                <p className="text-[9px] text-adam-text-tertiary mb-1">{schema.description}</p>
              )}
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
                  min={min}
                  max={max}
                  step={step}
                  value={numericVal}
                  onChange={(e) => onChange(name, parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md border-2 border-adam-blue pointer-events-none transition-transform group-hover:scale-110"
                  style={{ left: `calc(${pct}% - 7px)` }}
                />
              </div>
            </div>
            <div className="flex justify-between px-3 pb-2 pt-0.5">
              <span className="text-[9px] text-adam-text-tertiary font-mono">{min}</span>
              <span className="text-[9px] text-adam-text-tertiary font-mono">{max}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
