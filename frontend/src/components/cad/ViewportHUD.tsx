import { Maximize2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewPresetId } from '@/lib/constants';

interface ViewportHUDProps {
  activeView: ViewPresetId;
  onSelectView: (id: ViewPresetId) => void;
  onFit: () => void;
  onReset: () => void;
  axesVisible: boolean;
  onToggleAxes: () => void;
  hasModel: boolean;
}

export function ViewportHUD({
  activeView,
  onSelectView,
  onFit,
  onReset,
  axesVisible,
  onToggleAxes,
  hasModel,
}: ViewportHUDProps) {
  return (
    <>
      {/* ─── Top-right: ViewCube + XYZ legend ─── */}
      <div className="absolute top-14 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
        <div className="glass-hud pointer-events-auto select-none p-1.5 flex flex-col items-center gap-1.5 w-[108px]">
          {/* SVG 3D Isometric View Cube */}
          <svg viewBox="0 0 96 88" width="96" height="88" className="block select-none">
            {/* TOP face */}
            <g onClick={() => onSelectView('top')} className="cursor-pointer group/face">
              <path
                d="M 48,14 L 78,29 L 48,44 L 18,29 Z"
                fill={activeView === 'top' ? '#00A6FF' : 'rgba(255,255,255,0.03)'}
                stroke={activeView === 'top' ? '#00A6FF' : 'rgba(255,255,255,0.15)'}
                strokeWidth="1.2"
                className="transition-colors duration-150 group-hover/face:fill-[#00A6FF]/20 group-hover/face:stroke-[#00A6FF]/40"
              />
              <text
                x="48"
                y="31"
                textAnchor="middle"
                className={cn(
                  "text-[8px] font-bold tracking-wider pointer-events-none select-none transition-colors duration-150",
                  activeView === 'top' ? 'fill-white' : 'fill-adam-text-secondary group-hover/face:fill-white'
                )}
              >
                TOP
              </text>
            </g>

            {/* FRONT face */}
            <g onClick={() => onSelectView('front')} className="cursor-pointer group/face">
              <path
                d="M 18,29 L 48,44 L 48,74 L 18,59 Z"
                fill={activeView === 'front' ? '#00A6FF' : 'rgba(255,255,255,0.03)'}
                stroke={activeView === 'front' ? '#00A6FF' : 'rgba(255,255,255,0.15)'}
                strokeWidth="1.2"
                className="transition-colors duration-150 group-hover/face:fill-[#00A6FF]/20 group-hover/face:stroke-[#00A6FF]/40"
              />
              <text
                x="33"
                y="54"
                textAnchor="middle"
                className={cn(
                  "text-[8px] font-bold tracking-wider pointer-events-none select-none transition-colors duration-150",
                  activeView === 'front' ? 'fill-white' : 'fill-adam-text-secondary group-hover/face:fill-white'
                )}
              >
                FRONT
              </text>
            </g>

            {/* RIGHT face */}
            <g onClick={() => onSelectView('right')} className="cursor-pointer group/face">
              <path
                d="M 48,44 L 78,29 L 78,59 L 48,74 Z"
                fill={activeView === 'right' ? '#00A6FF' : 'rgba(255,255,255,0.03)'}
                stroke={activeView === 'right' ? '#00A6FF' : 'rgba(255,255,255,0.15)'}
                strokeWidth="1.2"
                className="transition-colors duration-150 group-hover/face:fill-[#00A6FF]/20 group-hover/face:stroke-[#00A6FF]/40"
              />
              <text
                x="63"
                y="54"
                textAnchor="middle"
                className={cn(
                  "text-[8px] font-bold tracking-wider pointer-events-none select-none transition-colors duration-150",
                  activeView === 'right' ? 'fill-white' : 'fill-adam-text-secondary group-hover/face:fill-white'
                )}
              >
                RIGHT
              </text>
            </g>
          </svg>

          {/* Grid buttons for other views */}
          <div className="w-full border-t border-white/[0.04] pt-2 px-0.5 pb-0.5 flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onSelectView('left')}
                className={cn(
                  "py-0.5 px-1 rounded text-[8px] font-semibold border text-center transition-all duration-150",
                  activeView === 'left'
                    ? "bg-adam-blue/15 text-adam-blue border-adam-blue/30"
                    : "bg-white/[0.01] text-adam-text-secondary border-white/[0.04] hover:bg-white/[0.04] hover:text-adam-text-primary hover:border-white/[0.1]"
                )}
              >
                LEFT
              </button>
              <button
                onClick={() => onSelectView('back')}
                className={cn(
                  "py-0.5 px-1 rounded text-[8px] font-semibold border text-center transition-all duration-150",
                  activeView === 'back'
                    ? "bg-adam-blue/15 text-adam-blue border-adam-blue/30"
                    : "bg-white/[0.01] text-adam-text-secondary border-white/[0.04] hover:bg-white/[0.04] hover:text-adam-text-primary hover:border-white/[0.1]"
                )}
              >
                BACK
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onSelectView('bottom')}
                className={cn(
                  "py-0.5 px-1 rounded text-[8px] font-semibold border text-center transition-all duration-150",
                  activeView === 'bottom'
                    ? "bg-adam-blue/15 text-adam-blue border-adam-blue/30"
                    : "bg-white/[0.01] text-adam-text-secondary border-white/[0.04] hover:bg-white/[0.04] hover:text-adam-text-primary hover:border-white/[0.1]"
                )}
              >
                BOTTOM
              </button>
              <button
                onClick={() => onSelectView('iso')}
                className={cn(
                  "py-0.5 px-1 rounded text-[8px] font-semibold border text-center transition-all duration-150",
                  activeView === 'iso'
                    ? "bg-adam-blue/15 text-adam-blue border-adam-blue/30"
                    : "bg-white/[0.01] text-adam-text-secondary border-white/[0.04] hover:bg-white/[0.04] hover:text-adam-text-primary hover:border-white/[0.1]"
                )}
              >
                ISO
              </button>
            </div>
          </div>
        </div>

        {/* XYZ legend */}
        <div className="glass-hud pointer-events-auto px-3 py-2 flex flex-col gap-1 select-none w-[108px] items-center">
          <div className="flex items-center justify-between w-full text-[10px] font-semibold">
            <span style={{ color: '#E34D4D' }} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-0.5 rounded-full bg-[#E34D4D]" />
              X
            </span>
            <span style={{ color: '#7AB838' }} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-0.5 rounded-full bg-[#7AB838]" />
              Y
            </span>
            <span style={{ color: '#4D8FE3' }} className="flex items-center gap-1.5 font-bold">
              <span className="inline-block w-2.5 h-0.5 rounded-full bg-[#4D8FE3]" />
              Z
            </span>
          </div>
        </div>
      </div>

      {/* ─── Bottom-right: toolbar ─── */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2 pointer-events-none">
        <ToolbarButton onClick={onFit} disabled={!hasModel} title="Fit to view">
          <Maximize2 className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton onClick={onReset} title="Reset camera">
          <RotateCcw className="h-5 w-5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={onToggleAxes}
          active={axesVisible}
          title={axesVisible ? 'Hide grid + axes' : 'Show grid + axes'}
        >
          {axesVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </ToolbarButton>
      </div>
    </>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'glass-hud pointer-events-auto h-8 w-8 flex items-center justify-center',
        'text-adam-text-secondary hover:text-adam-text-primary transition-colors',
        active && 'text-adam-blue',
        disabled && 'opacity-40 cursor-not-allowed hover:text-adam-text-secondary',
      )}
    >
      {children}
    </button>
  );
}
