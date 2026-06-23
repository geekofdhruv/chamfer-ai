import { Plus, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { NutIcon } from '@/components/hardware/NutIcon';
import { SessionHistory } from '@/components/chat/SessionHistory';
import type { SessionListItem } from '@/types';

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

function getAvatarGradient(addr: string): string {
  const gradients = [
    'from-violet-500/80 to-indigo-600/80',
    'from-cyan-500/80 to-blue-600/80',
    'from-emerald-500/80 to-teal-600/80',
    'from-amber-500/80 to-orange-600/80',
    'from-rose-500/80 to-pink-600/80',
    'from-fuchsia-500/80 to-purple-600/80',
    'from-sky-500/80 to-cyan-600/80',
    'from-lime-500/80 to-green-600/80',
  ];
  const hash = addr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function getInitials(addr: string): string {
  return (addr.slice(2, 4) + addr.slice(-2)).toUpperCase();
}

export function Sidebar({
  isOpen, onNewTask, onToggleSidebar, walletAddress, isConnected,
  isAuthLoading, onConnect, onDisconnect,
  sessions, activeSessionId, onSelectSession,
}: SidebarProps) {
  const [isRotating, setIsRotating] = useState(false);

  const handleToggle = () => {
    if (!onToggleSidebar) return;
    setIsRotating(true);
    onToggleSidebar();
    window.setTimeout(() => setIsRotating(false), 300);
  };

  return (
    <div className={`${isOpen ? 'w-64' : 'w-16'} flex h-full flex-shrink-0 flex-col bg-adam-bg-dark border-r border-white/[0.04] transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className="px-4 h-14 flex items-center justify-between shrink-0">
        {isOpen ? (
          <>
            <button className="flex items-center gap-2.5 group" onClick={onNewTask}>
              <span className="text-sm font-semibold text-adam-text-primary tracking-tight group-hover:text-adam-blue transition-colors">Chamfer AI</span>
            </button>
            <button
              onClick={handleToggle}
              title="Collapse sidebar"
              className="h-7 w-7 flex items-center justify-center rounded-lg text-adam-text-tertiary hover:text-adam-text-primary hover:bg-white/[0.04] transition-all"
            >
              <NutIcon className="h-3.5 w-3.5" spinning={isRotating} />
            </button>
          </>
        ) : (
          <button
            onClick={handleToggle}
            title="Expand sidebar"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-adam-text-tertiary hover:text-adam-text-primary hover:bg-white/[0.04] transition-all mx-auto"
          >
            <NutIcon className="h-3.5 w-3.5" spinning={isRotating} />
          </button>
        )}
      </div>

      {/* New Creation */}
      <div className={`${isOpen ? 'px-3' : 'px-2'} pb-2 shrink-0`}>
        <div className={isOpen ? '' : 'flex justify-center'}>
          <button
            onClick={onNewTask}
            className={`
              group flex items-center justify-center gap-2 transition-all duration-200
              ${isOpen
                ? 'w-full rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-2.5 text-adam-text-secondary hover:text-adam-text-primary hover:bg-white/[0.07] hover:border-white/[0.1]'
                : 'h-9 w-9 rounded-xl bg-white/[0.04] text-adam-text-secondary hover:text-adam-text-primary hover:bg-white/[0.07] border border-white/[0.06]'
              }
            `}
          >
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" />
            {isOpen && <span className="text-[13px] font-medium">New Creation</span>}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className={`${isOpen ? 'mx-3' : 'mx-2'} h-px bg-white/[0.04] shrink-0`} />

      {/* Session history */}
      {isConnected && sessions && onSelectSession && sessions.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {isOpen && (
            <SessionHistory
              sessions={sessions}
              activeSessionId={activeSessionId ?? null}
              onSelect={onSelectSession}
            />
          )}
        </div>
      )}
      {(!isConnected || !sessions || sessions.length === 0) && <div className="flex-1" />}

      {/* Bottom — Wallet avatar */}
      {isConnected && walletAddress && (
        <div className="shrink-0 p-3 border-t border-white/[0.04]">
          {isOpen ? (
            <div className="flex items-center gap-3 px-1">
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(walletAddress)} flex items-center justify-center shadow-lg shrink-0`}>
                <span className="text-[10px] font-bold text-white tracking-wider">{getInitials(walletAddress)}</span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-adam-text-primary font-medium truncate">{truncateAddress(walletAddress)}</div>
                <div className="text-[10px] text-emerald-400/70 flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400/70 inline-block" />
                  Connected
                </div>
              </div>
              {/* Disconnect */}
              {onDisconnect && (
                <button
                  onClick={onDisconnect}
                  title="Disconnect"
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-adam-text-tertiary hover:text-red-400 hover:bg-red-500/[0.06] transition-all shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(walletAddress)} flex items-center justify-center shadow-lg cursor-pointer`}
                title={walletAddress}
                onClick={onConnect}
              >
                <span className="text-[10px] font-bold text-white tracking-wider">{getInitials(walletAddress)}</span>
              </div>
              {onDisconnect && (
                <button
                  onClick={onDisconnect}
                  title="Disconnect"
                  className="h-6 w-6 flex items-center justify-center rounded-md text-adam-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
