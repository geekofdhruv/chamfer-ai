import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { PROVIDERS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ProviderSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function ProviderSelector({ selected, onSelect }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProvider = PROVIDERS.find(p => p.id === selected);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition-all',
          open
            ? 'bg-adam-blue/20 text-adam-blue'
            : 'bg-adam-neutral-800 text-adam-text-tertiary hover:bg-adam-neutral-700 hover:text-adam-text-secondary'
        )}
      >
        <span className="font-medium">{selectedProvider?.name || 'Model'}</span>
        <ChevronDown className={cn('h-3 w-3 opacity-70 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 max-h-52 overflow-y-auto rounded-2xl border border-adam-neutral-700 bg-adam-background-2 p-1.5 shadow-lg z-50">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-adam-neutral-800',
                selected === p.id && 'bg-adam-neutral-800'
              )}
            >
              <div className="flex flex-col">
                <span className="text-sm text-adam-text-primary font-medium">{p.name}</span>
                <span className="text-[10px] text-adam-text-tertiary">{p.desc}</span>
              </div>
              {selected === p.id && <Check className="h-3.5 w-3.5 text-adam-blue" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
