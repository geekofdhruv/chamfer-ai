import { cn } from '@/lib/utils';

interface NutIconProps {
  className?: string;
  spinning?: boolean;
  size?: number;
}

export function NutIcon({ className, spinning, size = 16 }: NutIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(spinning && 'animate-spin', className)}
    >
      <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 7v2.5M12 14.5V17M7 12h2.5M14.5 12H17" opacity="0.5" />
    </svg>
  );
}
