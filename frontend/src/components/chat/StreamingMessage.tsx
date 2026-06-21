import { Search } from 'lucide-react';
import { WorkflowTimeline } from './WorkflowTimeline';
import type { WorkflowStep } from '@/types';

interface StreamingMessageProps {
  reasoning: string;
  steps?: WorkflowStep[];
}

export function StreamingMessage({ reasoning, steps }: StreamingMessageProps) {
  const hasSteps = steps && steps.length > 0;

  return (
    <div className="bg-adam-background-1 rounded-xl p-3 text-sm">
      {hasSteps ? (
        <WorkflowTimeline steps={steps!} reasoning={reasoning || undefined} />
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-adam-blue/15">
            <Search className="h-3 w-3 text-adam-blue animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-[12px] text-adam-blue font-medium">Consulting clarifier agent...</div>
            <div className="text-[10px] text-adam-text-tertiary mt-0.5">Checking if your prompt has enough detail</div>
          </div>
          <div className="flex gap-1">
            <span className="w-1 h-1 bg-adam-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-adam-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-adam-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
      {!hasSteps && reasoning && (
        <details open className="mt-2 ml-9">
          <summary className="text-[10px] text-adam-text-tertiary cursor-pointer hover:text-adam-text-secondary transition-colors mb-1">
            Thinking... ({reasoning.length} chars)
          </summary>
          <div className="text-[11px] text-adam-text-tertiary bg-adam-bg-dark rounded-lg p-2 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
            {reasoning}
          </div>
        </details>
      )}
    </div>
  );
}
