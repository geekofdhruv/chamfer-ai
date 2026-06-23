import { useState } from 'react';
import { Copy, Check, Loader2, Hash } from 'lucide-react';

export interface RootHashData {
  code?: string;
  stl?: string;
  step?: string;
  glb?: string;
  dimViews?: string;
}

interface RootHashesProps {
  hashes: RootHashData | null;
  loading: boolean;
}

const LABELS: { key: keyof RootHashData; label: string }[] = [
  { key: 'code', label: 'Code' },
  { key: 'stl', label: 'STL' },
  { key: 'step', label: 'STEP' },
  { key: 'glb', label: 'GLB' },
  { key: 'dimViews', label: 'Dim Views' },
];

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function HashRow({ label, hash }: { label: string; hash: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="text-[10px] text-adam-text-tertiary uppercase tracking-wider w-12 shrink-0">{label}</span>
      <span className="text-[10px] font-mono text-adam-text-secondary truncate flex-1" title={hash}>
        {truncateHash(hash)}
      </span>
      <button
        onClick={copy}
        className="p-1 rounded hover:bg-white/5 text-adam-text-tertiary hover:text-adam-blue transition-colors shrink-0"
        title="Copy full hash"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

export function RootHashes({ hashes, loading }: RootHashesProps) {
  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-adam-neutral-700/40 bg-[#1a1a1a]/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-adam-neutral-700/30 bg-[#1e1e1e]/50">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 text-adam-blue animate-spin" />
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">
              Root hashes loading...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!hashes) return null;

  const entries = LABELS.filter(({ key }) => hashes[key]);
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-adam-neutral-700/40 bg-[#1a1a1a]/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-adam-neutral-700/30 bg-[#1e1e1e]/50">
        <div className="flex items-center gap-2">
          <Hash className="h-3 w-3 text-adam-blue" />
          <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">
            0G Storage Root Hashes
          </span>
          <span className="text-[9px] text-adam-text-tertiary ml-auto">{entries.length} files</span>
        </div>
      </div>
      <div className="divide-y divide-adam-neutral-700/20">
        {entries.map(({ key, label }) => (
          <HashRow key={key} label={label} hash={hashes[key]!} />
        ))}
      </div>
    </div>
  );
}
