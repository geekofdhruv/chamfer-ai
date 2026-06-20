import { PROVIDERS } from '@/lib/constants';

interface ProviderSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function ProviderSelector({ selected, onSelect }: ProviderSelectorProps) {
  return (
    <div className="flex gap-1.5">
      {PROVIDERS.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`flex-1 rounded-lg px-2 py-1 text-[11px] text-center transition-all ${
            selected === p.id
              ? 'bg-adam-blue/20 text-adam-blue font-medium'
              : 'bg-adam-neutral-800 text-adam-text-tertiary hover:bg-adam-neutral-700 hover:text-adam-text-secondary'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
