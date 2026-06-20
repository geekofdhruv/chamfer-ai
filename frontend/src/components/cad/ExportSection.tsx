import { Download } from 'lucide-react';
import { GlowCard } from '@/components/ui/spotlight-card';

interface ExportSectionProps {
  stlBase64?: string;
  stepBase64?: string;
  exportFilename: string;
  setExportFilename: (v: string) => void;
}

export function ExportSection({ stlBase64, stepBase64, exportFilename, setExportFilename }: ExportSectionProps) {
  if (!stlBase64 && !stepBase64) return null;

  const download = (base64: string, ext: string) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename || 'model'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 border-b border-adam-neutral-700">
      <GlowCard glowColor="purple" customSize className="w-full">
        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider mb-3">Export</h3>
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
              onClick={() => download(stlBase64, 'stl')}
              className="flex items-center gap-1.5 rounded-lg border border-adam-neutral-700 bg-adam-bg-dark px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 hover:text-adam-text-primary transition-colors flex-1 justify-center"
            >
              <Download className="h-3.5 w-3.5" /> STL
            </button>
          )}
          {stepBase64 && (
            <button
              onClick={() => download(stepBase64, 'step')}
              className="flex items-center gap-1.5 rounded-lg border border-adam-neutral-700 bg-adam-bg-dark px-3 py-2 text-xs text-adam-text-secondary hover:bg-adam-neutral-800 hover:text-adam-text-primary transition-colors flex-1 justify-center"
            >
              <Download className="h-3.5 w-3.5" /> STEP
            </button>
          )}
        </div>
      </GlowCard>
    </div>
  );
}
