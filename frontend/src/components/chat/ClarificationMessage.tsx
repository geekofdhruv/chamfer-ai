import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface ClarificationMessageProps {
  questions: string[];
  onSubmit: (answers: string) => void;
}

export function ClarificationMessage({ questions, onSubmit }: ClarificationMessageProps) {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ''));
  const [autoDecide, setAutoDecide] = useState<boolean[]>(questions.map(() => false));

  const toggleAutoDecide = (idx: number) => {
    setAutoDecide(prev => { const next = [...prev]; next[idx] = !next[idx]; return next; });
    if (!autoDecide[idx]) {
      setAnswers(prev => { const next = [...prev]; next[idx] = ''; return next; });
    }
  };

  const handleSubmit = () => {
    const formatted = questions.map((q, i) => {
      const a = autoDecide[i] ? '(let model decide)' : (answers[i] || '(not specified)');
      return `Q: ${q}\nA: ${a}`;
    }).join('\n');
    onSubmit(formatted);
  };

  const handleAllDecide = () => {
    setAutoDecide(questions.map(() => true));
    setAnswers(questions.map(() => ''));
  };

  return (
    <div className="rounded-xl p-3 text-sm bg-adam-background-1 border border-adam-blue/30">
      <div className="text-[10px] text-adam-blue mb-2 font-medium flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5" /> VibeCAD needs more details
      </div>
      <div className="space-y-3 mb-3">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="text-xs text-adam-text-secondary mb-1 block">{q}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={autoDecide[i] ? '' : answers[i]}
                onChange={e => { const next = [...answers]; next[i] = e.target.value; setAnswers(next); }}
                onKeyDown={e => { if (e.key === 'Enter' && i === questions.length - 1) handleSubmit(); }}
                placeholder={autoDecide[i] ? 'Model will decide...' : 'Type your answer...'}
                disabled={autoDecide[i]}
                className={`flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors ${
                  autoDecide[i]
                    ? 'bg-adam-bg-dark/50 border-adam-neutral-700 text-adam-text-tertiary cursor-not-allowed'
                    : 'bg-adam-bg-dark border-adam-neutral-700 text-adam-text-primary focus:border-adam-blue placeholder:text-adam-text-tertiary'
                }`}
                autoFocus={i === 0}
              />
              <button
                onClick={() => toggleAutoDecide(i)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                  autoDecide[i]
                    ? 'bg-adam-blue/20 text-adam-blue border border-adam-blue/40'
                    : 'bg-adam-neutral-800 text-adam-text-tertiary border border-adam-neutral-700 hover:bg-adam-neutral-700 hover:text-adam-text-secondary'
                }`}
              >
                Auto
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAllDecide}
          className="flex-1 rounded-lg border border-adam-neutral-700 px-3 py-1.5 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 transition-colors"
        >
          Let model decide all
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 rounded-lg bg-adam-blue px-3 py-1.5 text-xs text-white hover:bg-adam-blue/80 transition-colors font-medium"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
