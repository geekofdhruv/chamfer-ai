import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { API_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Eye, ChevronDown } from 'lucide-react';

interface ProviderInfo {
  id: string;
  name: string;
  model: string;
  hasKey: boolean;
  supportsVision: boolean;
  maxContextTokens?: number;
}

interface ProviderSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
  requireVision?: boolean;
}

function getProviderDescription(providerId: string, providerName: string): string {
  const id = providerId.toLowerCase();
  const name = providerName.toLowerCase();
  if (id.includes('gemini') || name.includes('gemini') || id.includes('google')) {
    return 'Latest Google model with excellent multi-modal capabilities';
  }
  if (id.includes('claude') || name.includes('claude') || id.includes('anthropic')) {
    return 'Most powerful Anthropic model for complex reasoning';
  }
  if (id.includes('gpt') || name.includes('gpt') || id.includes('openai')) {
    return 'Latest OpenAI model for reliable CAD generation';
  }
  if (id.includes('glm') || name.includes('glm')) {
    return 'Z.AI model with strong agentic coding and reasoning';
  }
  if (id.includes('0g')) {
    return '0G custom model optimized for speed and structure';
  }
  if (id.includes('mimo')) {
    return 'MiMo core model with high-context reasoning';
  }
  if (id.includes('deepseek')) {
    return 'Most powerful reasoning model for complex CAD operations';
  }
  if (id.includes('qwen')) {
    return 'Qwen model with excellent multi-lingual and vision capabilities';
  }
  if (id.includes('groq') || id.includes('llama')) {
    return 'Groq Llama model optimized for ultra-fast generation';
  }
  return 'Advanced AI model optimized for CAD generation';
}

export function ProviderSelector({ selected, onSelect, requireVision = false }: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

  useEffect(() => {
    fetch(`${API_URL}/api/providers`)
      .then(r => r.json())
      .then(data => {
        let list = (data.providers || []).filter((p: ProviderInfo) => p.hasKey);
        if (requireVision) {
          list = list.filter((p: ProviderInfo) => p.supportsVision);
        }
        setProviders(list);
        
        // Auto-switch to first vision provider if current doesn't support vision
        if (requireVision && list.length > 0) {
          const currentProvider = list.find((p: ProviderInfo) => p.id === selected);
          if (!currentProvider?.supportsVision) {
            onSelect(list[0].id);
          }
        }
      })
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, [requireVision, selected, onSelect]);

  const selectedProvider = providers.find(p => p.id === selected);

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

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 290;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      const pos: { top: number; left?: number; right?: number } = { top: rect.top - 8 };
      if (spaceRight >= dropdownWidth + 16) {
        pos.left = rect.left;
      } else if (spaceLeft >= dropdownWidth + 16) {
        pos.right = window.innerWidth - rect.right;
      } else {
        pos.left = Math.max(8, rect.right - dropdownWidth);
      }
      setDropdownPos(pos);
    }
  }, [open]);

  if (loading) {
    return (
      <span className="text-[11px] text-adam-text-tertiary">Loading…</span>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={cn(
          'h-8 flex items-center gap-1.5 bg-transparent text-xs transition-all font-normal shrink-0 outline-none',
          open
            ? 'text-white'
            : 'text-neutral-400 hover:text-white'
        )}
      >
        <span>{selectedProvider?.name?.split(' (')[0] || 'Model'}</span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 transition-transform duration-200 opacity-70",
          open && "rotate-180"
        )} />
      </button>

      {open && createPortal(
        <div
          className="fixed w-[290px] max-h-[340px] overflow-y-auto rounded-2xl border border-[#2d2e2f]/90 bg-[#1e1e1f] p-1.5 shadow-2xl z-[9999] chat-scroll"
          style={{
            top: dropdownPos.top + 'px',
            transform: 'translateY(-100%)',
            ...(dropdownPos.left !== undefined ? { left: dropdownPos.left + 'px' } : {}),
            ...(dropdownPos.right !== undefined ? { right: dropdownPos.right + 'px' } : {}),
          }}
        >
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p.id); setOpen(false); }}
              className={cn(
                'flex flex-col w-full items-start rounded-xl px-4 py-3 text-left transition-colors duration-150 outline-none',
                selected === p.id
                  ? 'bg-[#292a2b]'
                  : 'hover:bg-[#2c2d2e]/80'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[13px] text-white font-semibold">{p.name}</span>
                <div className="flex items-center gap-1">
                  {p.supportsVision && (
                    <span className="flex items-center gap-0.5 text-[10px] text-blue-400/80 font-medium">
                      <Eye className="w-3 h-3" /> Vision
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[11.5px] text-[#9ca3af] mt-0.5 leading-relaxed font-normal">
                {getProviderDescription(p.id, p.name)}
              </p>
              {p.maxContextTokens && (
                <div className="text-[9px] text-[#9ca3af]/40 mt-1 font-mono">
                  {p.maxContextTokens >= 1000 ? `${(p.maxContextTokens/1000).toFixed(0)}K` : p.maxContextTokens} ctx
                </div>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

