import { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';
import type { ClarificationOption } from '@/types';

interface ClarificationMessageProps {
  questions: ClarificationOption[];
  onSubmit: (answers: string, answerList: { question: string; answer: string }[]) => void;
}

export function ClarificationMessage({ questions, onSubmit }: ClarificationMessageProps) {
  const [selections, setSelections] = useState<Record<string, string>>(
    Object.fromEntries(questions.map(q => [q.key, q.default || '']))
  );
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const selectOption = (key: string, value: string) => {
    setSelections(prev => ({ ...prev, [key]: value }));
    setCustomInputs(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  const setCustom = (key: string, value: string) => {
    setCustomInputs(prev => ({ ...prev, [key]: value }));
    setSelections(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const answerList = questions.map(q => ({
      question: q.question,
      answer: selections[q.key] || '(let model decide)',
    }));
    const formatted = answerList.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n');
    onSubmit(formatted, answerList);
  };

  const handleAllDecide = () => {
    setSelections(Object.fromEntries(questions.map(q => [q.key, '(let model decide)'])));
    setCustomInputs({});
  };

  return (
    <div className="rounded-xl p-4 text-sm bg-adam-background-1 border border-adam-blue/30">
      <div className="text-[10px] text-adam-blue mb-3 font-medium flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5" /> VibeCAD needs more details
      </div>
      <div className="space-y-4 mb-4">
        {questions.map((q, i) => (
          <div key={i}>
            <label className="text-xs text-adam-text-secondary mb-2 block font-medium">
              {q.question}
            </label>
            {q.options && q.options.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt, j) => {
                  const isSelected = selections[q.key] === opt && !customInputs[q.key];
                  return (
                    <button
                      key={j}
                      onClick={() => selectOption(q.key, opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-adam-blue text-white border border-adam-blue'
                          : 'bg-adam-neutral-800 text-adam-text-secondary border border-adam-neutral-700 hover:bg-adam-neutral-700 hover:text-adam-text-primary'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {opt}
                    </button>
                  );
                })}
                <input
                  type="text"
                  value={customInputs[q.key] || ''}
                  onChange={e => setCustom(q.key, e.target.value)}
                  placeholder="Custom..."
                  className="w-24 border border-adam-neutral-700 rounded-lg px-2.5 py-1.5 text-xs bg-adam-bg-dark text-adam-text-primary outline-none focus:border-adam-blue placeholder:text-adam-text-tertiary"
                />
              </div>
            ) : (
              <input
                type="text"
                value={selections[q.key] || ''}
                onChange={e => setSelections(prev => ({ ...prev, [q.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && i === questions.length - 1) handleSubmit(); }}
                placeholder="Type your answer..."
                autoFocus={i === 0}
                className="w-full border border-adam-neutral-700 rounded-lg px-3 py-1.5 text-sm bg-adam-bg-dark text-adam-text-primary outline-none focus:border-adam-blue placeholder:text-adam-text-tertiary"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAllDecide}
          className="flex-1 rounded-lg border border-adam-neutral-700 px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 transition-colors"
        >
          Let model decide all
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 rounded-lg bg-adam-blue px-3 py-2 text-xs text-white hover:bg-adam-blue/80 transition-colors font-medium"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
