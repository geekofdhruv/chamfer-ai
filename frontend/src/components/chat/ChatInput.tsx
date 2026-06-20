import { ArrowUp, Brain } from 'lucide-react';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { ProviderSelector } from '@/components/layout/ProviderSelector';

interface ChatInputProps {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
  provider: string;
  setProvider: (v: string) => void;
  placeholder: string;
  reasoningEnabled: boolean;
  setReasoningEnabled: (v: boolean) => void;
  showAnimatedPlaceholder?: boolean;
}

export function ChatInput({
  prompt, setPrompt, onSubmit, isGenerating, isFocused, setIsFocused,
  provider, setProvider, placeholder, reasoningEnabled, setReasoningEnabled,
  showAnimatedPlaceholder,
}: ChatInputProps) {
  return (
    <div className={`relative rounded-2xl border-2 transition-all duration-300 ${
      isFocused
        ? 'border-adam-blue shadow-[inset_0px_0px_8px_0px_rgba(0,0,0,0.08)]'
        : 'border-adam-neutral-700 shadow-[inset_0px_0px_8px_0px_rgba(0,0,0,0.08)] hover:border-adam-neutral-400'
    } bg-adam-background-2`}>
      {showAnimatedPlaceholder && !prompt && !isFocused && (
        <AnimatedPlaceholder visible />
      )}
      <textarea
        className="w-full bg-transparent p-4 text-sm text-adam-text-primary resize-none outline-none placeholder:text-adam-text-tertiary"
        rows={3}
        placeholder={showAnimatedPlaceholder ? '' : placeholder}
        value={prompt}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
      />
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2 flex-1 max-w-[300px]">
          <ProviderSelector selected={provider} onSelect={setProvider} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReasoningEnabled(!reasoningEnabled)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-all ${
              reasoningEnabled
                ? 'bg-adam-blue/20 text-adam-blue'
                : 'bg-adam-neutral-800 text-adam-text-tertiary hover:bg-adam-neutral-700'
            }`}
          >
            <Brain className="h-3 w-3" />
            {reasoningEnabled ? 'Think' : 'Fast'}
          </button>
          <button
            onClick={() => onSubmit()}
            disabled={isGenerating || !prompt.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-adam-blue text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-adam-blue/80 transition-colors"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
