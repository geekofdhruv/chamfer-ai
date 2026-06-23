import { useState, useRef } from 'react';
import { Copy, Check, Download } from 'lucide-react';

interface CodeSectionProps {
  code: string;
}

export function CodeSection({ code }: CodeSectionProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 flex-1 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider">Generated Code <span className="text-[10px] font-normal text-pink-400/70 normal-case tracking-normal">by</span> <span className="text-pink-400 font-bold">0G</span></h3>
          </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-adam-text-tertiary hover:text-adam-text-secondary hover:bg-adam-neutral-800 transition-colors"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-adam-text-tertiary hover:text-adam-text-secondary hover:bg-adam-neutral-800 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="text-[11px] text-adam-text-secondary bg-adam-bg-dark rounded-lg p-3 overflow-auto max-h-[calc(100vh-400px)] font-mono leading-relaxed border border-adam-neutral-700">
        {code}
      </pre>
    </div>
  );
}
