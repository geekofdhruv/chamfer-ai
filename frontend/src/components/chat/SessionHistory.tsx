import type { SessionListItem } from '@/types';

interface SessionHistoryProps {
  sessions: SessionListItem[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function SessionHistory({ sessions, activeSessionId, onSelect, compact }: SessionHistoryProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-1">
      {!compact && (
        <div className="px-3 py-2 text-[11px] font-bold text-adam-neutral-500 uppercase tracking-wider">
          Chat History
        </div>
      )}
      <ul className="flex list-none flex-col gap-1 px-1">
        {sessions.slice(0, compact ? 5 : 20).map(s => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors duration-200 ease-in-out truncate block ${
                activeSessionId === s.id
                  ? 'bg-adam-neutral-950 text-adam-neutral-10 font-semibold'
                  : 'text-adam-neutral-400 hover:bg-adam-neutral-950 hover:text-adam-neutral-10'
              }`}
            >
              <div className="truncate text-ellipsis">{s.title}</div>
              <div className={`text-[9px] mt-0.5 ${
                activeSessionId === s.id ? 'text-adam-neutral-400' : 'text-adam-neutral-500'
              }`}>{timeAgo(s.updated_at || s.created_at)}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
