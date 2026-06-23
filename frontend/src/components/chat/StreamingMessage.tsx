import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search } from 'lucide-react';
import { WorkflowTimeline } from './WorkflowTimeline';
import { NutIcon } from '@/components/hardware/NutIcon';
import type { WorkflowStep } from '@/types';
import { cn } from '@/lib/utils';

interface StreamingMessageProps {
  steps?: WorkflowStep[];
  reasoning?: string;
}

export function StreamingMessage({ steps, reasoning }: StreamingMessageProps) {
  const hasSteps = steps && steps.length > 0;
  const [reasoningOpen, setReasoningOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="group relative rounded-xl border border-adam-blue/15 bg-gradient-to-br from-adam-blue/[0.05] via-adam-background-1/30 to-transparent overflow-hidden"
    >
      {/* Animated shimmer top border */}
      <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-adam-blue/60 to-transparent animate-shimmer" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
        {/* Pulsing avatar */}
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-adam-blue/25 to-adam-blue/[0.08] text-adam-blue ring-1 ring-adam-blue/20">
          <NutIcon className="h-3.5 w-3.5" />
          <div className="absolute inset-0 rounded-lg bg-adam-blue/15 animate-pulse-glow pointer-events-none" />
        </div>

        {/* Name + status */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-adam-text-primary">Chamfer AI</span>
          <span className="text-[10px] text-adam-blue font-medium uppercase tracking-wider">thinking</span>
        </div>

        {/* Typing dots */}
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-adam-blue rounded-full"
              style={{
                animation: 'typing-dot 1.2s infinite ease-in-out',
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-3.5 pb-3.5">
        {hasSteps ? (
          <WorkflowTimeline steps={steps!} reasoning={reasoning || undefined} />
        ) : (
          <div className="text-[12px] text-adam-text-tertiary leading-relaxed">
            {reasoning ? (
              <>
                <button
                  onClick={() => setReasoningOpen(prev => !prev)}
                  className="w-full flex items-center gap-1.5 text-[10px] text-adam-text-tertiary hover:text-adam-text-secondary transition-colors mb-1.5"
                >
                  <span className="inline-block w-1 h-1 rounded-full bg-adam-blue animate-pulse" />
                  <span className="flex-1 text-left">Thinking... ({reasoning.length} chars)</span>
                  <ChevronDown className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    reasoningOpen ? 'rotate-180' : ''
                  )} />
                </button>
                <AnimatePresence initial={false}>
                  {reasoningOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="text-[11px] text-adam-text-tertiary/80 bg-adam-bg-dark/50 rounded-lg p-2.5 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-mono ring-1 ring-adam-neutral-700/20">
                        {reasoning}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-adam-blue/15">
                  <Search className="h-3 w-3 text-adam-blue animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] text-adam-blue font-medium">Consulting clarifier agent...</div>
                  <div className="text-[10px] text-adam-text-tertiary mt-0.5">Checking if your prompt has enough detail</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
