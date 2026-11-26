import React, { useEffect, useRef } from 'react';
import { Check, Edit3 } from '../ui/icons';
import { TONE_COLORS, chordTone, type ChordBar, type ChordCell } from '../../utils/chordChart';
import { formatTime } from '../../utils/timeFormat';
import { cn } from '../../utils/cn';
import { IconButton } from '../ui';

const LOW_CONFIDENCE = 0.55;

/** Font size (rem) that keeps a chord symbol inside its chip: longer names and shared bars get smaller text. */
function chordFontSize(label: string, cellsInBar: number): number {
  const base = label.length <= 2 ? 1.35 : label.length <= 4 ? 1.15 : label.length <= 6 ? 0.95 : 0.8;
  return cellsInBar > 1 ? Math.max(0.75, base - 0.1) : base;
}

/** Minimum chip width (px) so the label always fits, even for a short chord duration. */
function chordMinWidth(label: string, fontRem: number): number {
  return Math.max(48, Math.ceil(label.length * fontRem * 9.5 + 22));
}
const MANUAL_SCROLL_PAUSE_MS = 4000;

export interface ChordChartProps {
  bars: ChordBar[];
  currentTimeMs: number;
  displayChord: (chord: string) => string;
  onSeek: (positionMs: number) => void;
  canEdit: boolean;
  editingCell: ChordCell | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEdit: (cell: ChordCell) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  barLabel: (bar: number) => string;
  lowConfidenceLabel: (percent: number) => string;
  editLabel: string;
  /** Name of the button that confirms an edited chord. */
  saveLabel: string;
}

export const ChordChart: React.FC<ChordChartProps> = ({
  bars,
  currentTimeMs,
  displayChord,
  onSeek,
  canEdit,
  editingCell,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  barLabel,
  lowConfidenceLabel,
  editLabel,
  saveLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastManualScrollRef = useRef(0);

  const activeBarIdx = bars.findIndex((b) => currentTimeMs >= b.start_ms && currentTimeMs < b.end_ms);

  // Keep the playing bar centred, unless the user scrolled the chart themselves a moment ago.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeBarIdx < 0) return;
    if (Date.now() - lastManualScrollRef.current < MANUAL_SCROLL_PAUSE_MS) return;
    const el = container.querySelector<HTMLElement>('[data-active-bar="true"]');
    if (!el) return;
    const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [activeBarIdx]);

  const markManualScroll = () => {
    lastManualScrollRef.current = Date.now();
  };

  return (
    <div
      ref={containerRef}
      onWheel={markManualScroll}
      onTouchMove={markManualScroll}
      className="relative grid max-h-115 grid-cols-[repeat(auto-fill,minmax(--spacing(50),1fr))] content-start gap-2.5 overflow-y-auto pr-1"
    >
      {bars.map((bar, barIdx) => {
        const isActiveBar = barIdx === activeBarIdx;
        const isPast = bar.end_ms <= currentTimeMs;
        // Bar confidence = the lowest confidence of its chords (the weakest link).
        const barConfidence = Math.min(...bar.cells.map((c) => c.confidence));
        const barConfidencePct = Math.round(barConfidence * 100);
        const barLowConfidence = barConfidence < LOW_CONFIDENCE;
        return (
          <div
            key={`${bar.bar}-${bar.start_ms}`}
            data-active-bar={isActiveBar ? 'true' : undefined}
            className={cn(
              'rounded-2xl border p-2 transition-[opacity,background,border-color] duration-200',
              isActiveBar ? 'border-accent-pink/60 bg-accent-pink/10 shadow-halo-lg shadow-accent-pink/25' : 'border-line bg-white/2 shadow-none',
              isPast ? 'opacity-50' : 'opacity-100',
            )}
          >
            <div
              className={cn(
                'mb-1.5 flex justify-between text-xxs font-bold tracking-wide',
                isActiveBar ? 'text-accent-pink' : 'text-fg-secondary',
              )}
            >
              <span>{barLabel(bar.bar)}</span>
              <span className="font-mono font-medium">
                {formatTime(bar.start_ms)}
                <span className={cn('ml-1.5', barLowConfidence ? 'text-accent-amber' : 'text-fg-secondary')}>{barConfidencePct}%</span>
              </span>
            </div>

            <div className="flex gap-1.5">
              {bar.cells.map((cell) => {
                const tone = chordTone(cell.quality);
                const color = TONE_COLORS[tone];
                const isActive = currentTimeMs >= cell.start_ms && currentTimeMs < cell.end_ms;
                const isEditing = editingCell === cell;
                const lowConfidence = cell.confidence < LOW_CONFIDENCE;
                const label = displayChord(cell.chord);
                const fontRem = chordFontSize(label, bar.cells.length);
                const progress = isActive
                  ? Math.min(1, (currentTimeMs - cell.start_ms) / Math.max(1, cell.end_ms - cell.start_ms))
                  : 0;
                return (
                  <div
                    key={cell.start_ms}
                    className="group relative flex h-17 cursor-pointer items-center justify-center overflow-hidden rounded-xl hover:brightness-120"
                    role="button"
                    tabIndex={0}
                    onClick={() => !isEditing && onSeek(cell.start_ms)}
                    onKeyDown={(e) => {
                      if (!isEditing && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSeek(cell.start_ms);
                      }
                    }}
                    title={lowConfidence ? lowConfidenceLabel(Math.round(cell.confidence * 100)) : undefined}
                    style={{
                      flex: `${Math.max(1, cell.end_ms - cell.start_ms)} 1 0`,
                      minWidth: `${chordMinWidth(label, fontRem)}px`,
                      background: `${color}${isActive ? '33' : '1a'}`,
                      borderLeft: `4px ${lowConfidence ? 'dotted' : 'solid'} ${color}`,
                      outline: isActive ? `2px solid ${color}` : 'none',
                      outlineOffset: '-2px',
                    }}
                  >
                    {isActive && (
                      <>
                        {/* Background fill: how much of the chord has already sounded */}
                        <div
                          className="pointer-events-none absolute top-0 bottom-0 left-0"
                          style={{ width: `${progress * 100}%`, background: `${color}55` }}
                        />
                        {/* Thick progress bar with a glow and a position marker */}
                        <div
                          className="pointer-events-none absolute left-0 bottom-0 h-1.5"
                          style={{
                            width: `${progress * 100}%`,
                            background: color,
                            boxShadow: `0 0 10px ${color}`,
                          }}
                        />
                        <div
                          className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white opacity-90"
                          style={{ left: `calc(${progress * 100}% - 1px)` }}
                        />
                      </>
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editValue}
                          autoFocus
                          onChange={(e) => onEditValueChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitEdit();
                            if (e.key === 'Escape') onCancelEdit();
                          }}
                          className="w-13 rounded-md bg-deep px-1 py-0.5 text-center font-mono text-sm text-fg"
                          style={{ border: `1px solid ${color}` }}
                        />
                        <IconButton size="sm" label={saveLabel} onClick={onCommitEdit} className="size-6 text-accent-green hover:text-accent-green">
                          <Check size={15} />
                        </IconButton>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          'relative font-mono font-extrabold whitespace-nowrap text-fg',
                          lowConfidence ? 'opacity-75' : 'opacity-100',
                        )}
                        style={{ fontSize: `${fontRem}rem` }}
                      >
                        {label}
                      </span>
                    )}

                    {canEdit && !isEditing && (
                      <IconButton
                        size="sm"
                        label={editLabel}
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEdit(cell);
                        }}
                        className="absolute top-1 right-1 size-6 bg-black/45 text-fg-secondary opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Edit3 size={11} />
                      </IconButton>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export interface ChordOverviewProps {
  cells: ChordCell[];
  currentTimeMs: number;
  onSeek: (positionMs: number) => void;
  /** Track length; when known the strip spans the whole song (gaps before/after the chords stay empty). */
  durationMs?: number;
}

/** Thin whole-song strip: colour per chord family, playhead, click to seek. */
export const ChordOverview: React.FC<ChordOverviewProps> = ({
  cells,
  currentTimeMs,
  onSeek,
  durationMs,
}) => {
  if (cells.length === 0) return null;
  const lastEnd = cells[cells.length - 1].end_ms;
  const spansTrack = !!durationMs && durationMs > 0;
  const start = spansTrack ? 0 : cells[0].start_ms;
  const total = Math.max(1, (spansTrack ? Math.max(durationMs, lastEnd) : lastEnd) - start);
  const leadMs = cells[0].start_ms - start;
  const tailMs = start + total - lastEnd;
  const playhead = Math.min(100, Math.max(0, ((currentTimeMs - start) / total) * 100));
  return (
    <div
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        onSeek(start + ((e.clientX - rect.left) / rect.width) * total);
      }}
      className="relative flex h-4.5 cursor-pointer overflow-hidden rounded-md bg-white/5"
    >
      {leadMs > 0 && <div style={{ flex: `${leadMs} 0 0` }} />}
      {cells.map((cell) => (
        <div
          key={cell.start_ms}
          className={cn(
            'border-r border-deep/70',
            cell.end_ms <= currentTimeMs ? 'opacity-35' : 'opacity-80',
          )}
          style={{
            flex: `${Math.max(1, cell.end_ms - cell.start_ms)} 0 0`,
            background: TONE_COLORS[chordTone(cell.quality)],
          }}
        />
      ))}
      {tailMs > 0 && <div style={{ flex: `${tailMs} 0 0` }} />}
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-halo-sm shadow-white/80"
        style={{ left: `${playhead}%` }}
      />
    </div>
  );
};
