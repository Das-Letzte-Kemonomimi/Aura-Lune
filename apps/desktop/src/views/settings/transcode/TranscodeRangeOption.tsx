import React from 'react';
import { Scissors, Repeat, Bookmark } from 'lucide-react';
import { formatTimeMs } from '../../../utils/timeFormat';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';

export type TranscodeRangeOptionProps = Pick<TranscodeSettingsViewProps, 'transcodeApplyRange' | 'onTranscodeApplyRangeChange' | 'loc' | 'loopPointA' | 'loopPointB' | 'currentTrackBookmarks' | 'onTranscodeRangeAChange' | 'onTranscodeRangeBChange' | 'transcodeRangeA' | 'status' | 'transcodeRangeB'> & {
  handleApplyLoopFromPlayer: () => void;
  handleApplyBookmarksRange: () => void;
  parsedA: number;
  parsedB: number | null;
  isOrderInvalid: boolean;
};

export const TranscodeRangeOption: React.FC<TranscodeRangeOptionProps> = ({
  currentTrackBookmarks,
  handleApplyBookmarksRange,
  handleApplyLoopFromPlayer,
  isOrderInvalid,
  loc,
  loopPointA,
  loopPointB,
  onTranscodeApplyRangeChange,
  onTranscodeRangeAChange,
  onTranscodeRangeBChange,
  parsedA,
  parsedB,
  status,
  transcodeApplyRange,
  transcodeRangeA,
  transcodeRangeB,
}) => (
    <div
      style={{
        marginTop: '10px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: transcodeApplyRange
          ? 'rgba(6, 182, 212, 0.12)'
          : 'rgba(255, 255, 255, 0.03)',
        border: transcodeApplyRange
          ? '1px solid var(--accent-cyan)'
          : '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'all 0.2s ease',
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          userSelect: 'none',
          fontWeight: 600,
          fontSize: '0.88rem',
          color: transcodeApplyRange ? 'var(--accent-cyan)' : 'var(--text-primary)',
        }}
      >
        <input
          type="checkbox"
          checked={transcodeApplyRange}
          onChange={(e) => onTranscodeApplyRangeChange(e.target.checked)}
          style={{ accentColor: 'var(--accent-cyan)', width: '16px', height: '16px' }}
        />
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Scissors size={15} color={transcodeApplyRange ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
          {loc.settings.transcodeApplyRange}
          {(loopPointA !== null || loopPointB !== null) && (
            <span
              style={{
                fontSize: '0.72rem',
                padding: '1px 8px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.22)',
                color: 'var(--accent-cyan)',
                fontWeight: 700,
                border: '1px solid rgba(6, 182, 212, 0.35)',
              }}
            >
              {loc.settings.transcodeLoopAB} {formatTimeMs(loopPointA ?? 0)} → {formatTimeMs(loopPointB)}
            </span>
          )}
        </span>
      </label>
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '26px' }}>
        {loc.settings.transcodeApplyRangeDesc}
      </p>

      {transcodeApplyRange && (
        <div
          style={{
            paddingLeft: '26px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: '4px',
          }}
        >
          {/* Przyciski synchronizacji z pętlą A-B z odtwarzacza oraz zapisanymi znacznikami */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {(loopPointA !== null || loopPointB !== null) && (
              <button
                type="button"
                onClick={handleApplyLoopFromPlayer}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <Repeat size={12} />
                {loc.settings.transcodeFromPlayer} ({loopPointA !== null ? `A: ${formatTimeMs(loopPointA)}` : 'A: 0ms'} → {loopPointB !== null ? `B: ${formatTimeMs(loopPointB)}` : 'B: —'})
              </button>
            )}

            {currentTrackBookmarks.length >= 2 && (
              <button
                type="button"
                onClick={handleApplyBookmarksRange}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid rgba(236, 72, 153, 0.35)',
                  color: 'var(--accent-pink)',
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <Bookmark size={12} />
                {loc.settings.transcodeApplySavedBookmarks.replace('{0}', String(currentTrackBookmarks.length))}
              </button>
            )}
          </div>

          {currentTrackBookmarks.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Zapisane znaczniki utworu:</span>
              {currentTrackBookmarks.map((bm) => (
                <div key={bm.id} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{bm.name}</span>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>({formatTimeMs(bm.position_ms)})</span>
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeAChange(formatTimeMs(bm.position_ms))}
                    title={`Ustaw "${bm.name}" jako Punkt A`}
                    style={{ background: 'rgba(6,182,212,0.2)', border: 'none', color: 'var(--accent-cyan)', borderRadius: '3px', padding: '1px 4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeBChange(formatTimeMs(bm.position_ms))}
                    title={`Ustaw "${bm.name}" jako Punkt B`}
                    style={{ background: 'rgba(236,72,153,0.2)', border: 'none', color: 'var(--accent-pink)', borderRadius: '3px', padding: '1px 4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                  >
                    B
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {/* Punkt A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {loc.settings.transcodePointA}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {formatTimeMs(parsedA)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="np. 0:00.000, 0:22.449, 860ms"
                  value={transcodeRangeA}
                  onChange={(e) => onTranscodeRangeAChange(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => onTranscodeRangeAChange(formatTimeMs(status.position_ms))}
                  title={loc.settings.transcodeSetCurrentPos}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loc.settings.transcodeSetCurrentTime}
                </button>
                {loopPointA !== null && (
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeAChange(formatTimeMs(loopPointA))}
                    title={loc.settings.transcodeGetLoopA}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(6, 182, 212, 0.2)',
                      border: '1px solid var(--accent-cyan)',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    A
                  </button>
                )}
              </div>
            </div>

            {/* Punkt B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-pink)', fontWeight: 600 }}>
                  {loc.settings.transcodePointB}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {parsedB !== null
                    ? formatTimeMs(parsedB)
                    : loc.settings.transcodeEndOfTrack}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder={loc.settings.transcodeTimePlaceholder}
                  value={transcodeRangeB}
                  onChange={(e) => onTranscodeRangeBChange(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(0,0,0,0.3)',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => onTranscodeRangeBChange(formatTimeMs(status.position_ms))}
                  title={loc.settings.transcodeSetCurrentPos}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loc.settings.transcodeSetCurrentTime}
                </button>
                {loopPointB !== null && (
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeBChange(formatTimeMs(loopPointB))}
                    title={loc.settings.transcodeGetLoopB}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'rgba(244, 63, 94, 0.2)',
                      border: '1px solid var(--accent-pink)',
                      color: 'var(--accent-pink)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    B
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Podsumowanie zakresu i walidacja */}
          {isOrderInvalid ? (
            <div
              style={{
                color: 'var(--accent-pink)',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <span>⚠️ {loc.settings.transcodeEndMustBeGreater}</span>
            </div>
          ) : parsedB !== null ? (
            <div
              style={{
                color: 'var(--accent-cyan)',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>✂️ {loc.settings.transcodeRangeDuration.replace('{0}', `${((parsedB - parsedA) / 1000).toFixed(3)}s (${formatTimeMs(parsedB - parsedA)})`)}</span>
            </div>
          ) : (
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>✂️ {loc.settings.transcodeExportRangeText.replace('{0}', formatTimeMs(parsedA))}</span>
            </div>
          )}
        </div>
      )}
    </div>
);
