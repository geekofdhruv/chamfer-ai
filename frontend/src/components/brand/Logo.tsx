interface LogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export function Logo({ className, size = 32, showWordmark = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className || ''}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className="shrink-0">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <path d="M32 8L52 20V44L32 56L12 44V20L32 8Z" stroke="url(#logoGrad)" strokeWidth="2.5" />
        <path d="M32 8V32M32 32L52 44M32 32L12 44" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.6" />
        <line x1="8" y1="56" x2="32" y2="56" stroke="#F59E0B" strokeWidth="2" />
        <path d="M8 54V58M32 54V58" stroke="#F59E0B" strokeWidth="2" />
        <line x1="20" y1="56" x2="20" y2="61" stroke="#F59E0B" strokeWidth="2" strokeDasharray="2 2" />
      </svg>
      {showWordmark && (
        <span className="font-display font-bold text-vibe-ink text-lg tracking-tight">
          Vibe<span className="text-vibe-cobalt">CAD</span>
        </span>
      )}
    </div>
  );
}
