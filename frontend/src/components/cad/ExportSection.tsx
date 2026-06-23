import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { GlowCard } from '@/components/ui/spotlight-card';
import { API_URL } from '@/lib/constants';

interface ExportSectionProps {
  stlBase64?: string;
  stepBase64?: string;
  exportFilename: string;
  setExportFilename: (v: string) => void;
  rootHashStl?: string;
  rootHashStep?: string;
}

export function ExportSection({ stlBase64, stepBase64, exportFilename, setExportFilename, rootHashStl, rootHashStep }: ExportSectionProps) {
  if (!stlBase64 && !stepBase64) return null;

  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadFrom0G = async (rootHash: string, ext: string) => {
    setDownloading(ext);
    try {
      const res = await fetch(`${API_URL}/api/models/fetch-from-0g/${rootHash}?isBase64=true`);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const data = await res.json();
      const bytes = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportFilename || 'model'}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[0G] Download failed:', err);
    } finally {
      setDownloading(null);
    }
  };

  const downloadLocal = (base64: string, ext: string) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename || 'model'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = (ext: 'stl' | 'step') => {
    const rootHash = ext === 'stl' ? rootHashStl : rootHashStep;
    const base64 = ext === 'stl' ? stlBase64 : stepBase64;
    if (rootHash) {
      downloadFrom0G(rootHash, ext);
    } else if (base64) {
      downloadLocal(base64, ext);
    }
  };

  return (
    <div className="p-4 border-b border-adam-neutral-700">
      <GlowCard glowColor="blue" customSize className="w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider">Export <span className="text-[10px] font-normal text-pink-400/70 normal-case tracking-normal">by</span> <span className="text-pink-400 font-bold">0G</span></h3>
        </div>
        <div className="mb-3">
          <label className="text-[10px] text-adam-text-tertiary mb-1 block">Filename</label>
          <input
            type="text"
            value={exportFilename}
            onChange={e => setExportFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            className="w-full bg-adam-bg-dark border border-adam-neutral-700 rounded-lg px-3 py-1.5 text-xs text-adam-text-primary outline-none focus:border-adam-blue transition-colors"
            placeholder="model"
          />
        </div>
        <div className="flex gap-2">
          {stlBase64 && (
            <button
              onClick={() => handleDownload('stl')}
              disabled={downloading === 'stl'}
              className="flex items-center gap-1.5 rounded-lg border border-adam-neutral-700 bg-adam-bg-dark px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 hover:text-adam-text-primary transition-colors flex-1 justify-center disabled:opacity-50"
            >
              {downloading === 'stl' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} STL
            </button>
          )}
          {stepBase64 && (
            <button
              onClick={() => handleDownload('step')}
              disabled={downloading === 'step'}
              className="flex items-center gap-1.5 rounded-lg border border-adam-neutral-700 bg-adam-bg-dark px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 hover:text-adam-text-primary transition-colors flex-1 justify-center disabled:opacity-50"
            >
              {downloading === 'step' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} STEP
            </button>
          )}
        </div>
      </GlowCard>
    </div>
  );
}
