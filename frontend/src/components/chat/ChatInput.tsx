import { ArrowUp, Brain, ImagePlus, X } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { ProviderSelector } from '@/components/layout/ProviderSelector';
import { fileToBase64, validateImage, compressImage } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  prompt: string;
  setPrompt: (v: string) => void;
  onSubmit: () => void;
  isGenerating: boolean;
  isFocused: boolean;
  setIsFocused: (v: boolean) => void;
  provider: string;
  setProvider: (v: string) => void;
  placeholder: string;
  reasoningEnabled: boolean;
  setReasoningEnabled: (v: boolean) => void;
  showAnimatedPlaceholder?: boolean;
  images: string[];
  onImagesChange: (images: string[]) => void;
  providerSupportsVision: boolean;
  isConnected?: boolean;
}

export function ChatInput({
  prompt, setPrompt, onSubmit, isGenerating, isFocused, setIsFocused,
  provider, setProvider, placeholder, reasoningEnabled, setReasoningEnabled,
  showAnimatedPlaceholder, images, onImagesChange,
  providerSupportsVision, isConnected = true,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [...images];
    setImageError(null);

    for (const file of Array.from(files)) {
      const validation = validateImage(file);
      if (!validation.valid) {
        setImageError(validation.error);
        continue;
      }

      try {
        let dataUrl = await fileToBase64(file);
        // Compress if large (base64 ~4/3 of binary, so 8MB base64 ≈ 6MB binary)
        if (dataUrl.length > 8 * 1024 * 1024) {
          dataUrl = await compressImage(dataUrl, 1024);
        }
        newImages.push(dataUrl);
      } catch (err) {
        setImageError('Failed to process image');
      }
    }

    onImagesChange(newImages);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [images, onImagesChange]);

  const removeImage = useCallback((index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  }, [images, onImagesChange]);

  return (
    <div className={cn(
      'relative rounded-2xl border transition-all duration-300 bg-adam-background-2/80 backdrop-blur-sm',
      isFocused
        ? 'border-adam-blue/60 shadow-[0_0_0_3px_rgba(0,166,255,0.08),inset_0_1px_0_rgba(255,255,255,0.03)]'
        : 'border-adam-neutral-700/50 hover:border-adam-neutral-600/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'
    )}>
      {showAnimatedPlaceholder && !prompt && !isFocused && (
        <AnimatedPlaceholder visible />
      )}
      <textarea
        className="w-full bg-transparent px-4 pt-3.5 pb-2 text-sm text-adam-text-primary resize-none outline-none placeholder:text-adam-text-tertiary/60"
        rows={3}
        placeholder={showAnimatedPlaceholder ? '' : placeholder}
        value={prompt}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
      />

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {images.map((img, i) => (
            <div key={i} className="relative flex-shrink-0 group">
              <img
                src={img}
                alt={`Reference ${i + 1}`}
                className="w-16 h-16 rounded-lg object-cover border border-adam-neutral-700/50"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-adam-neutral-800 text-adam-text-tertiary hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {imageError && (
        <div className="px-4 pb-2 text-[11px] text-red-400/90">{imageError}</div>
      )}

      <div className="flex items-center justify-between px-3 pb-2.5">
        <div className="flex items-center gap-2">
          {providerSupportsVision && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'h-8 w-8 flex items-center justify-center rounded-xl transition-all border shrink-0',
                images.length > 0
                  ? 'bg-adam-blue/15 text-adam-blue border-adam-blue/30 shadow-[0_0_10px_rgba(0,166,255,0.1)]'
                  : 'bg-adam-neutral-800/60 text-adam-text-tertiary border-white/[0.06] hover:bg-adam-neutral-700/60 hover:text-adam-text-secondary'
              )}
              title="Upload reference images"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <ProviderSelector selected={provider} onSelect={setProvider} requireVision={images.length > 0} />
          <button
            onClick={() => setReasoningEnabled(!reasoningEnabled)}
            className={cn(
              'h-8 flex items-center gap-1.5 rounded-xl px-3 text-[11px] font-medium transition-all border shrink-0',
              reasoningEnabled
                ? 'bg-adam-blue/15 text-adam-blue border-adam-blue/30 shadow-[0_0_10px_rgba(0,166,255,0.1)]'
                : 'bg-adam-neutral-800/60 text-adam-text-tertiary border-white/[0.06] hover:bg-adam-neutral-700/60 hover:text-adam-text-secondary'
            )}
            title={reasoningEnabled ? 'Reasoning mode — slower, more thorough' : 'Fast mode — quicker responses'}
          >
            <Brain className="h-3.5 w-3.5" />
            {reasoningEnabled ? 'Think' : 'Fast'}
          </button>
          <button
            onClick={() => onSubmit()}
            disabled={!isConnected || isGenerating || (!prompt.trim() && images.length === 0)}
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded-xl transition-all border shrink-0',
              (prompt.trim() || images.length > 0) && !isGenerating && isConnected
                ? 'bg-adam-blue text-white border-adam-blue/20 hover:bg-adam-blue/90 shadow-[0_2px_8px_rgba(0,166,255,0.25)]'
                : 'bg-adam-neutral-800/60 text-adam-text-tertiary border-white/[0.06] cursor-not-allowed'
            )}
            title={!isConnected ? "Please connect your wallet first" : ""}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
