import React, { useEffect, useRef } from 'react';
import { Check, Edit3 } from 'lucide-react';
import { TONE_COLORS, chordTone, type ChordBar, type ChordCell } from '../../utils/chordChart';
import { formatTime } from '../../utils/timeFormat';

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

const CHART_CSS = `
.ct-chip .ct-edit { opacity: 0; transition: opacity 0.12s ease; }
.ct-chip:hover .ct-edit, .ct-chip:focus-within .ct-edit { opacity: 1; }
.ct-chip:hover { filter: brightness(1.18); }
`;

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
      style={{
        position: 'relative',
        maxHeight: '460px',
        overflowY: 'auto',
        paddingRight: '4px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '10px',
        alignContent: 'start',
      }}
    >
      <style>{CHART_CSS}</style>
      {bars.map((bar, barIdx) => {
        const isActiveBar = barIdx === activeBarIdx;
        const isPast = bar.end_ms <= currentTimeMs;
        // Pewność taktu = najniższa pewność jego akordów (najsłabsze ogniwo).
        const barConfidence = Math.min(...bar.cells.map((c) => c.confidence));
        const barConfidencePct = Math.round(barConfidence * 100);
        const barLowConfidence = barConfidence < LOW_CONFIDENCE;
        return (
          <div
            key={`${bar.bar}-${bar.start_ms}`}
            data-active-bar={isActiveBar ? 'true' : undefined}
            style={{
              padding: '8px',
              borderRadius: '14px',
              background: isActiveBar ? 'rgba(244, 63, 94, 0.10)' : 'rgba(255, 255, 255, 0.03)',
              border: isActiveBar ? '1px solid rgba(244, 63, 94, 0.6)' : '1px solid rgba(255, 255, 255, 0.07)',
              boxShadow: isActiveBar ? '0 0 18px rgba(244, 63, 94, 0.25)' : 'none',
              opacity: isPast ? 0.5 : 1,
              transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: isActiveBar ? '#fda4af' : '#94a3b8',
              }}
            >
              <span>{barLabel(bar.bar)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {formatTime(bar.start_ms)}
                <span style={{ marginLeft: '6px', color: barLowConfidence ? '#fbbf24' : '#94a3b8' }}>{barConfidencePct}%</span>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
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
                    className="ct-chip"
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
                      position: 'relative',
                      overflow: 'hidden',
                      flex: `${Math.max(1, cell.end_ms - cell.start_ms)} 1 0`,
                      minWidth: `${chordMinWidth(label, fontRem)}px`,
                      height: '68px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: `${color}${isActive ? '33' : '1a'}`,
                      borderLeft: `4px ${lowConfidence ? 'dotted' : 'solid'} ${color}`,
                      outline: isActive ? `2px solid ${color}` : 'none',
                      outlineOffset: '-2px',
                    }}
                  >
                    {isActive && (
                      <>
                        {/* Wypełnienie tła: ile z akordu już wybrzmiało */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: `${progress * 100}%`,
                            background: `${color}55`,
                            pointerEvents: 'none',
                          }}
                        />
                        {/* Gruby pasek postępu z poświatą i znacznikiem pozycji */}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            bottom: 0,
                            height: '6px',
                            width: `${progress * 100}%`,
                            background: color,
                            boxShadow: `0 0 10px ${color}`,
                            pointerEvents: 'none',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `calc(${progress * 100}% - 1px)`,
                            width: '2px',
                            background: '#ffffff',
                            opacity: 0.9,
                            pointerEvents: 'none',
                          }}
                        />
                      </>
                    )}

                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editValue}
                          autoFocus
                          onChange={(e) => onEditValueChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onCommitEdit();
                            if (e.key === 'Escape') onCancelEdit();
                          }}
                          style={{
                            width: '52px',
                            padding: '2px 4px',
                            background: '#090a12',
                            border: `1px solid ${color}`,
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            color: '#ffffff',
                            fontFamily: 'var(--font-mono)',
                          }}
                        />
                        <button
                          onClick={onCommitEdit}
                          style={{ padding: '2px', background: 'none', border: 'none', color: '#34d399', cursor: 'pointer' }}
                        >
                          <Check size={15} />
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: `${fontRem}rem`,
                          position: 'relative',
                          whiteSpace: 'nowrap',
                          color: '#f8fafc',
                          opacity: lowConfidence ? 0.75 : 1,
                        }}
                      >
                        {label}
                      </span>
                    )}

                    {canEdit && !isEditing && (
                      <button
                        className="ct-edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEdit(cell);
                        }}
                        title={editLabel}
                        aria-label={editLabel}
                        style={{
                          position: 'absolute',
                          top: '3px',
                          right: '3px',
                          padding: '3px',
                          display: 'flex',
                          background: 'rgba(0, 0, 0, 0.45)',
                          border: 'none',
                          borderRadius: '5px',
                          color: '#e2e8f0',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={11} />
                      </button>
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
      style={{
        position: 'relative',
        display: 'flex',
        height: '18px',
        borderRadius: '6px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'rgba(255, 255, 255, 0.04)',
      }}
    >
      {leadMs > 0 && <div style={{ flex: `${leadMs} 0 0` }} />}
      {cells.map((cell) => (
        <div
          key={cell.start_ms}
          style={{
            flex: `${Math.max(1, cell.end_ms - cell.start_ms)} 0 0`,
            background: TONE_COLORS[chordTone(cell.quality)],
            opacity: cell.end_ms <= currentTimeMs ? 0.35 : 0.8,
            borderRight: '1px solid rgba(9, 10, 18, 0.7)',
          }}
        />
      ))}
      {tailMs > 0 && <div style={{ flex: `${tailMs} 0 0` }} />}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${playhead}%`,
          width: '2px',
          background: '#ffffff',
          boxShadow: '0 0 6px rgba(255, 255, 255, 0.8)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
