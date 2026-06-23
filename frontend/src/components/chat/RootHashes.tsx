import { useState } from 'react';
import { Copy, Check, Loader2, Hash, ExternalLink, Download } from 'lucide-react';
import { API_URL } from '@/lib/constants';

export interface RootHashData {
  code?: string;
  stl?: string;
  step?: string;
  glb?: string;
  dimViews?: string;
}

export interface TxSeqData {
  code?: number;
  stl?: number;
  step?: number;
  glb?: number;
  dimViews?: number;
}

export interface UploadProgress {
  [key: string]: { status: string; rootHash?: string; txSeq?: number };
}

interface RootHashesProps {
  hashes: RootHashData | null;
  txSeqs?: TxSeqData | null;
  loading: boolean;
  progress?: UploadProgress | null;
}

const EXPLORER_BASE = 'https://storagescan-galileo.0g.ai/submission/';

const FILE_META: { key: keyof RootHashData; label: string; ext: string; isBase64: boolean }[] = [
  { key: 'code', label: 'Code', ext: 'py', isBase64: false },
  { key: 'stl', label: 'STL', ext: 'stl', isBase64: true },
  { key: 'step', label: 'STEP', ext: 'step', isBase64: true },
  { key: 'glb', label: 'GLB', ext: 'glb', isBase64: true },
  { key: 'dimViews', label: 'Dim Views', ext: 'json', isBase64: false },
];

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'uploading') return <Loader2 className="h-3 w-3 text-adam-blue animate-spin" />;
  if (status === 'done') return <Check className="h-3 w-3 text-emerald-400" />;
  return <div className="w-2 h-2 rounded-full bg-adam-neutral-700" />;
}

function HashRow({ label, hash, txSeq, ext, isBase64 }: {
  label: string;
  hash: string;
  txSeq?: number;
  ext: string;
  isBase64: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = txSeq ? `${EXPLORER_BASE}${txSeq}` : `${EXPLORER_BASE}${hash}`;

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`${API_URL}/api/models/fetch-from-0g/${hash}?isBase64=${isBase64}`);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const data = await res.json();
      let blob: Blob;
      if (isBase64) {
        const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
        blob = new Blob([bytes], { type: 'application/octet-stream' });
      } else {
        blob = new Blob([data.data], { type: 'text/plain' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `model.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[0G] Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 group/row">
      <span className="text-[10px] text-adam-text-tertiary uppercase tracking-wider w-12 shrink-0">{label}</span>
      <span className="text-[10px] font-mono text-adam-text-secondary truncate flex-1" title={hash}>
        {truncateHash(hash)}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded hover:bg-white/5 text-adam-text-tertiary hover:text-adam-blue transition-colors"
          title="View on 0G Explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          onClick={download}
          disabled={downloading}
          className="p-1 rounded hover:bg-white/5 text-adam-text-tertiary hover:text-adam-blue transition-colors disabled:opacity-40"
          title="Download from 0G"
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
        </button>
        <button
          onClick={copy}
          className="p-1 rounded hover:bg-white/5 text-adam-text-tertiary hover:text-adam-blue transition-colors"
          title="Copy full hash"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

function ProgressRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <StatusIcon status={status} />
      <span className="text-[10px] text-adam-text-tertiary uppercase tracking-wider w-12 shrink-0">{label}</span>
      <span className={`text-[10px] flex-1 ${status === 'uploading' ? 'text-adam-blue' : status === 'done' ? 'text-adam-text-tertiary' : 'text-adam-text-tertiary/40'}`}>
        {status === 'uploading' && 'Uploading to 0G...'}
        {status === 'done' && 'Stored'}
        {status === 'skipped' && 'No data'}
        {status === 'pending' && 'Waiting...'}
      </span>
    </div>
  );
}

export function RootHashes({ hashes, txSeqs, loading, progress }: RootHashesProps) {
  // Progressive upload mode — show per-file status
  const isUploading = loading && progress && Object.keys(progress).length > 0;

  if (isUploading) {
    const doneCount = Object.values(progress).filter(p => p.status === 'done' || p.status === 'skipped').length;
    return (
      <div className="mt-2 rounded-xl border border-adam-neutral-700/40 bg-[#1a1a1a]/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-adam-neutral-700/30 bg-[#1e1e1e]/50">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 text-adam-blue animate-spin" />
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">
              Uploading to 0G Storage
            </span>
            <span className="text-[9px] text-adam-text-tertiary ml-auto tabular-nums">{doneCount}/5</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 rounded-full bg-adam-neutral-700/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-adam-blue/80 to-adam-blue transition-all duration-500"
              style={{ width: `${(doneCount / 5) * 100}%` }}
            />
          </div>
        </div>
        <div className="divide-y divide-adam-neutral-700/20">
          {FILE_META.map(({ key, label }) => {
            const p = progress[key];
            return <ProgressRow key={key} label={label} status={p?.status || 'pending'} />;
          })}
        </div>
      </div>
    );
  }

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

  const entries = FILE_META.filter(({ key }) => hashes[key]);
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
        {entries.map(({ key, label, ext, isBase64 }) => (
          <HashRow
            key={key}
            label={label}
            hash={hashes[key]!}
            txSeq={txSeqs?.[key]}
            ext={ext}
            isBase64={isBase64}
          />
        ))}
      </div>
    </div>
  );
}
