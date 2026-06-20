export function StreamingMessage({ reasoning }: { reasoning: string }) {
  return (
    <div className="bg-adam-background-1 rounded-xl p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[10px] text-adam-text-tertiary font-medium">Generating...</div>
        <div className="flex gap-1">
          <span className="w-1 h-1 bg-adam-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 bg-adam-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 bg-adam-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
      {reasoning && (
        <details open className="mt-1">
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
