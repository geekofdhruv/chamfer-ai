import { Plus, LogOut, Settings, Wallet, Copy, Check, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { NutIcon } from '@/components/hardware/NutIcon';
import { SessionHistory } from '@/components/chat/SessionHistory';
import type { SessionListItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface SidebarProps {
  isOpen: boolean;
  onNewTask: () => void;
  onToggleSidebar?: () => void;
  walletAddress?: string;
  isConnected?: boolean;
  isAuthLoading?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  sessions?: SessionListItem[];
  activeSessionId?: string | null;
  onSelectSession?: (id: string) => void;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function WalletAvatar({ address, size = 36 }: { address: string; size?: number }) {
  const hash = address.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  
  // Dynamic color selection based on address hash
  const hairColors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#FF2E93'];
  const hairColor = hairColors[hash % hairColors.length];
  
  const jacketColors = ['#1E293B', '#0F172A', '#111827', '#1F2937'];
  const jacketColor = jacketColors[(hash >> 1) % jacketColors.length];
  
  const visorColors = ['#00A6FF', '#00E5FF', '#F59E0B', '#EC4899', '#10B981'];
  const visorColor = visorColors[(hash >> 2) % visorColors.length];
  
  // Decide decorations
  const hasVisor = (hash % 3) !== 0;
  const hasHeadphones = (hash % 2) === 0;
  
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-xl overflow-hidden shrink-0 shadow-inner">
      <defs>
        <linearGradient id={`bgGrad-${hash}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E1B4B" />
          <stop offset="100%" stopColor="#090514" />
        </linearGradient>
        <linearGradient id={`hairGrad-${hash}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hairColor} />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
      </defs>
      
      {/* Dark background */}
      <rect width="64" height="64" fill={`url(#bgGrad-${hash})`} />
      
      {/* Neck */}
      <path d="M28 42h8v8h-8z" fill="#FDBA74" opacity="0.85" />
      <path d="M28 44h8v3h-8z" fill="#E28743" opacity="0.4" />

      {/* Face (Boy character silhouette shape) */}
      <rect x="20" y="21" width="24" height="24" rx="7" fill="#FDBA74" />
      
      {/* Ears */}
      <circle cx="19" cy="31" r="3" fill="#FDBA74" />
      <circle cx="45" cy="31" r="3" fill="#FDBA74" />

      {/* Hair */}
      {hash % 3 === 0 ? (
        /* Undercut sweep */
        <path
          d="M17 21c-1-5 4-10 13-10s16 3 16 9c0 4-5 1-7-1s-5-3-9-3c-5 0-8 2-10 5s-3 0-3 0z"
          fill={`url(#hairGrad-${hash})`}
        />
      ) : hash % 3 === 1 ? (
        /* Cyber spiky */
        <path
          d="M16 23c-2-3 0-9 5-10s8-1 12-3c4-2 9 0 11 3s3 6 4 9c0 0-4-2-6-1s-4 2-7 1c-4-1-6-3-9-2s-6 2-7 2s-3 1-3 1z"
          fill={`url(#hairGrad-${hash})`}
        />
      ) : (
        /* Futuristic fringe */
        <path
          d="M18 21c0-5 5-9 14-9s14 3 14 9c0 0-3-2-5-2s-6 0-9 1-6-1-9-1c-2 0-5 2-5 2z"
          fill={`url(#hairGrad-${hash})`}
        />
      )}

      {/* Eyes */}
      <circle cx="27" cy="30" r="2" fill="#1E293B" />
      <circle cx="37" cy="30" r="2" fill="#1E293B" />
      
      {/* Smile */}
      <path d="M30 36.5 Q32 38.5 34 36.5" stroke="#1E293B" strokeWidth="1.5" strokeLinecap="round" />

      {/* Cyber Visor */}
      {hasVisor && (
        <g>
          <path d="M16 27.5h32v4.5H16z" fill="#0F172A" opacity="0.6" />
          <rect x="18" y="26" width="28" height="7.5" rx="2.5" fill={visorColor} opacity="0.9" />
          <path d="M22 27.5h14v1.2H22z" fill="#FFF" opacity="0.5" />
        </g>
      )}

      {/* Headphones */}
      {hasHeadphones && (
        <g>
          <path d="M19 19.5 Q32 10.5 45 19.5" stroke="#E2E8F0" strokeWidth="2.5" fill="none" opacity="0.9" />
          <rect x="15" y="25" width="5.5" height="12" rx="2.5" fill="#334155" />
          <rect x="43.5" y="25" width="5.5" height="12" rx="2.5" fill="#334155" />
          <circle cx="17.75" cy="31" r="1.5" fill="#00A6FF" />
          <circle cx="46.25" cy="31" r="1.5" fill="#00A6FF" />
        </g>
      )}

      {/* Jacket */}
      <path d="M14 49c3-5 9-7 18-7s15 2 18 7v15H14V49z" fill={jacketColor} />
      <path d="M26 42.5 L32 52 L38 42.5" stroke="#475569" strokeWidth="2" fill="none" />
      <circle cx="21" cy="54" r="1.2" fill="#00E5FF" />
      <circle cx="43" cy="54" r="1.2" fill="#00E5FF" />
    </svg>
  );
}

interface ConditionalWrapperProps {
  condition: boolean;
  wrapper: (children: React.ReactNode) => React.ReactNode;
  children: React.ReactNode;
}

function ConditionalWrapper({ condition, wrapper, children }: ConditionalWrapperProps) {
  return condition ? <>{wrapper(children)}</> : <>{children}</>;
}

export function Sidebar({
  isOpen, onNewTask, onToggleSidebar, walletAddress, isConnected,
  isAuthLoading, onConnect, onDisconnect,
  sessions, activeSessionId, onSelectSession,
}: SidebarProps) {
  const [isRotating, setIsRotating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleToggle = () => {
    if (!onToggleSidebar) return;
    setIsRotating(true);
    onToggleSidebar();
    window.setTimeout(() => setIsRotating(false), 300);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={`${
          isOpen ? 'w-64' : 'w-16'
        } flex h-full flex-shrink-0 flex-col bg-adam-bg-dark pb-2 transition-all duration-300 ease-in-out border-r border-white/[0.04]`}
      >
        {/* Header Section */}
        {isOpen ? (
          <div className="px-4 h-14 flex items-center justify-between shrink-0">
            <button
              type="button"
              className="flex cursor-pointer items-center space-x-2"
              onClick={onNewTask}
            >
              <div className="flex items-center gap-2 group">
                <div className="relative flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 64 64" fill="none" className="shrink-0 transition-transform duration-500 group-hover:rotate-12">
                    <defs>
                      <linearGradient id="sidebarLogoGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#00A6FF" />
                        <stop offset="100%" stopColor="#00E5FF" />
                      </linearGradient>
                    </defs>
                    <path d="M32 8L52 20V44L32 56L12 44V20L32 8Z" stroke="url(#sidebarLogoGrad)" strokeWidth="4.5" />
                    <path d="M32 32L52 20M32 32L12 20M32 32V56" stroke="url(#sidebarLogoGrad)" strokeWidth="3" opacity="0.8" />
                  </svg>
                  <div className="absolute inset-0 bg-adam-blue/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
                <span className="font-title font-bold text-adam-text-primary tracking-wider group-hover:text-adam-blue transition-colors duration-200">
                  Chamfer <span className="text-adam-blue">AI</span>
                </span>
              </div>
            </button>
            <button
              onClick={handleToggle}
              title="Collapse sidebar"
              className="h-7 w-7 flex items-center justify-center rounded-lg text-adam-text-tertiary hover:text-adam-text-primary hover:bg-white/[0.04] transition-all"
            >
              <NutIcon className="h-3.5 w-3.5" spinning={isRotating} />
            </button>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-center shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggle}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-adam-text-tertiary hover:text-adam-text-primary hover:bg-white/[0.04] transition-all"
                >
                  <NutIcon className="h-3.5 w-3.5" spinning={isRotating} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col">
                <span className="font-semibold">Expand</span>
                <span className="text-xs text-muted-foreground">Expand sidebar</span>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Action button container */}
        <div className={`${isOpen ? 'px-4' : 'px-2'} py-2 transition-all duration-300 ease-in-out`}>
          <ConditionalWrapper
            condition={!isOpen}
            wrapper={(children) => (
              <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col">
                  <span className="font-semibold">New Creation</span>
                  <span className="text-xs text-muted-foreground">Start a new creation</span>
                </TooltipContent>
              </Tooltip>
            )}
          >
            <div className={isOpen ? 'ml-[9px]' : 'flex justify-center'}>
              <Button
                variant="secondary"
                className={`${
                  isOpen
                    ? 'flex w-[216px] items-center justify-start gap-2 rounded-[100px] border border-adam-blue bg-adam-background-1 px-4 py-3 text-[#D7D7D7] hover:bg-adam-blue/40 hover:text-adam-text-primary'
                    : 'flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border-2 border-adam-blue bg-[#191A1A] p-[2px] text-[#D7D7D7] shadow-[0px_4px_10px_0px_rgba(0,166,255,0.24)] hover:bg-adam-blue/40 hover:text-adam-text-primary'
                } mb-4 transition-all duration-200`}
                onClick={onNewTask}
              >
                <Plus className="h-4.5 w-4.5 shrink-0" />
                {isOpen && (
                  <div className="text-sm font-semibold leading-[14px] tracking-[-0.14px] text-adam-neutral-200">
                    New Creation
                  </div>
                )}
              </Button>
            </div>
          </ConditionalWrapper>
        </div>

        {/* Content list container */}
        <div className="flex-1 overflow-y-auto min-h-0 chat-scroll px-1">
          {isOpen && isConnected && sessions && onSelectSession && sessions.length > 0 ? (
            <SessionHistory
              sessions={sessions}
              activeSessionId={activeSessionId ?? null}
              onSelect={onSelectSession}
            />
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* Bottom Wallet Section */}
        <div className={`${isOpen ? 'px-4' : 'px-2'} py-4 transition-all duration-300 ease-in-out`}>
          {isConnected && walletAddress ? (
            isOpen ? (
              <div className="flex items-center justify-between rounded-xl p-2 transition-colors duration-200 hover:bg-adam-neutral-950 group">
                <div className="flex items-center space-x-3 min-w-0">
                  <WalletAvatar address={walletAddress} size={30} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-adam-text-primary truncate">
                      {truncateAddress(walletAddress)}
                    </span>
                    <span className="text-xs text-adam-text-tertiary">
                      Connected
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={handleCopy}
                    title={copied ? "Copied address" : "Copy address"}
                    className="p-1 rounded hover:bg-white/[0.06] text-adam-text-tertiary hover:text-adam-text-secondary active:scale-95 transition-all"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                  {onDisconnect && (
                    <button
                      onClick={onDisconnect}
                      title="Disconnect wallet"
                      className="p-1 rounded hover:bg-red-500/[0.08] text-adam-text-tertiary hover:text-red-400 active:scale-95 transition-all"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer transition-all duration-200 group/avatar flex items-center justify-center rounded-md hover:bg-adam-neutral-950 p-1.5"
                      onClick={onConnect}
                    >
                      <WalletAvatar address={walletAddress} size={30} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="flex flex-col">
                    <span className="font-semibold">Connected Wallet</span>
                    <span className="text-xs text-muted-foreground">{truncateAddress(walletAddress)}</span>
                  </TooltipContent>
                </Tooltip>
                {onDisconnect && (
                  <button
                    onClick={onDisconnect}
                    title="Disconnect wallet"
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-adam-text-tertiary hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          ) : isOpen ? (
            <div className="p-3.5 rounded-xl bg-[#212121] border border-white/[0.05] shadow-lg flex flex-col items-center text-center">
              <div className="h-8 w-8 rounded-lg bg-adam-blue/10 flex items-center justify-center text-adam-blue mb-2 shadow-[0_0_12px_rgba(0,166,255,0.05)]">
                <Wallet className="h-4.5 w-4.5" />
              </div>
              <span className="text-[12px] font-semibold text-adam-text-primary mb-0.5">Wallet Not Connected</span>
              <p className="text-[10px] text-adam-text-secondary/70 mb-3 leading-relaxed max-w-[170px]">
                Connect your wallet to start creating and saving projects.
              </p>
              <button
                onClick={onConnect}
                disabled={isAuthLoading}
                className="w-full flex items-center justify-center gap-2 rounded-[100px] border border-adam-blue bg-adam-bg-dark hover:bg-adam-blue/30 py-2 px-3 text-[12px] font-semibold text-adam-text-primary shadow-[0_0_15px_rgba(0,166,255,0.1)] hover:shadow-[0_0_20px_rgba(0,166,255,0.25)] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all duration-200"
              >
                <Wallet className="h-3.5 w-3.5" />
                {isAuthLoading ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onConnect}
                  disabled={isAuthLoading}
                  className="h-[36px] w-[36px] mx-auto rounded-lg flex items-center justify-center bg-adam-blue/10 hover:bg-adam-blue/20 text-adam-blue border border-adam-blue/20 hover:border-adam-blue/40 shadow-[0_0_10px_rgba(0,166,255,0.05)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all duration-200"
                >
                  <Wallet className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col">
                <span className="font-semibold">Connect Wallet</span>
                <span className="text-xs text-muted-foreground">Sign in to save projects</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

