import React from 'react';
import { Scissors, Repeat, Bookmark, AlertTriangle } from '../../../components/ui/icons';
import { formatTimeMs } from '../../../utils/timeFormat';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';

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
      className={cn(
        'mt-2.5 flex flex-col gap-2 rounded-xl border px-3.5 py-3 transition-all duration-200',
        transcodeApplyRange ? 'bg-accent-cyan/10' : 'bg-white/3',
        transcodeApplyRange ? 'border-accent-cyan' : 'border-line',
      )}
    >
      <label
        className={cn(
          'flex cursor-pointer select-none items-center gap-2.5 text-sm font-semibold',
          transcodeApplyRange ? 'text-accent-cyan' : 'text-fg',
        )}
      >
        <input
          type="checkbox"
          checked={transcodeApplyRange}
          onChange={(e) => onTranscodeApplyRangeChange(e.target.checked)}
          className="h-4 w-4 accent-accent-cyan"
        />
        <span className="flex flex-wrap items-center gap-1.5">
          <Scissors className={cn(transcodeApplyRange ? 'text-accent-cyan' : 'text-fg-muted')} size={15} />
          {loc.settings.transcodeApplyRange}
          {(loopPointA !== null || loopPointB !== null) && (
            <span
              className="rounded-xl border border-accent-cyan/35 bg-accent-cyan/20 px-2 py-px text-xs font-bold text-accent-cyan"
            >
              {loc.settings.transcodeLoopAB} {formatTimeMs(loopPointA ?? 0)} → {formatTimeMs(loopPointB)}
            </span>
          )}
        </span>
      </label>
      <p className="m-0 pl-6.5 text-ui text-fg-muted">
        {loc.settings.transcodeApplyRangeDesc}
      </p>

      {transcodeApplyRange && (
        <div className="mt-1 flex flex-col gap-2.5 pl-6.5">
          {/* Buttons that sync with the player's A-B loop and the saved markers */}
          <div className="flex flex-wrap items-center gap-2">
            {(loopPointA !== null || loopPointB !== null) && (
              <button
                type="button"
                onClick={handleApplyLoopFromPlayer}
                className="flex items-center gap-1.5 rounded-md border border-accent-cyan/30 bg-accent-cyan/15 px-2.5 py-1 text-xs font-semibold text-accent-cyan"
              >
                <Repeat size={12} />
                {loc.settings.transcodeFromPlayer} ({loopPointA !== null ? `A: ${formatTimeMs(loopPointA)}` : 'A: 0ms'} → {loopPointB !== null ? `B: ${formatTimeMs(loopPointB)}` : 'B: —'})
              </button>
            )}

            {currentTrackBookmarks.length >= 2 && (
              <button
                type="button"
                onClick={handleApplyBookmarksRange}
                className="flex items-center gap-1.5 rounded-md border border-pink-500/35 bg-pink-500/15 px-2.5 py-1 text-xs font-semibold text-accent-pink"
              >
                <Bookmark size={12} />
                {fmt(loc.settings.transcodeApplySavedBookmarks, String(currentTrackBookmarks.length))}
              </button>
            )}
          </div>

          {currentTrackBookmarks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-white/2 px-2.5 py-1.5">
              <span className="text-xs text-fg-muted">Zapisane znaczniki utworu:</span>
              {currentTrackBookmarks.map((bm) => (
                <div key={bm.id} className="flex items-center gap-1 rounded-sm bg-white/6 px-1.5 py-0.5 text-xxs">
                  <span className="font-semibold text-fg">{bm.name}</span>
                  <span className="font-mono text-accent-cyan">({formatTimeMs(bm.position_ms)})</span>
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeAChange(formatTimeMs(bm.position_ms))}
                    title={`Set "${bm.name}" as point A`}
                    className="rounded-sm border-0 bg-accent-cyan/20 px-1 py-px text-xxs font-bold text-accent-cyan"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeBChange(formatTimeMs(bm.position_ms))}
                    title={`Set "${bm.name}" as point B`}
                    className="rounded-sm border-0 bg-pink-500/20 px-1 py-px text-xxs font-bold text-accent-pink"
                  >
                    B
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(55),1fr))] gap-2.5">
            {/* Punkt A */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-ui font-semibold text-accent-cyan">
                  {loc.settings.transcodePointA}
                </span>
                <span className="font-mono text-xs text-fg-muted">
                  {formatTimeMs(parsedA)}
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. 0:00.000, 0:22.449, 860ms"
                  value={transcodeRangeA}
                  onChange={(e) => onTranscodeRangeAChange(e.target.value)}
                  className="flex-1 rounded-md border border-line bg-black/30 px-2.5 py-1.5 font-mono text-ui text-fg"
                />
                <button
                  type="button"
                  onClick={() => onTranscodeRangeAChange(formatTimeMs(status.position_ms))}
                  title={loc.settings.transcodeSetCurrentPos}
                  className="rounded-md border border-line bg-white/6 px-2 py-1.5 text-xs whitespace-nowrap text-fg-secondary"
                >
                  {loc.settings.transcodeSetCurrentTime}
                </button>
                {loopPointA !== null && (
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeAChange(formatTimeMs(loopPointA))}
                    title={loc.settings.transcodeGetLoopA}
                    className="rounded-md border border-accent-cyan bg-accent-cyan/20 px-2 py-1.5 text-xs font-semibold text-accent-cyan"
                  >
                    A
                  </button>
                )}
              </div>
            </div>

            {/* Punkt B */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-ui font-semibold text-accent-pink">
                  {loc.settings.transcodePointB}
                </span>
                <span className="font-mono text-xs text-fg-muted">
                  {parsedB !== null
                    ? formatTimeMs(parsedB)
                    : loc.settings.transcodeEndOfTrack}
                </span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder={loc.settings.transcodeTimePlaceholder}
                  value={transcodeRangeB}
                  onChange={(e) => onTranscodeRangeBChange(e.target.value)}
                  className="flex-1 rounded-md border border-line bg-black/30 px-2.5 py-1.5 font-mono text-ui text-fg"
                />
                <button
                  type="button"
                  onClick={() => onTranscodeRangeBChange(formatTimeMs(status.position_ms))}
                  title={loc.settings.transcodeSetCurrentPos}
                  className="rounded-md border border-line bg-white/6 px-2 py-1.5 text-xs whitespace-nowrap text-fg-secondary"
                >
                  {loc.settings.transcodeSetCurrentTime}
                </button>
                {loopPointB !== null && (
                  <button
                    type="button"
                    onClick={() => onTranscodeRangeBChange(formatTimeMs(loopPointB))}
                    title={loc.settings.transcodeGetLoopB}
                    className="rounded-md border border-accent-pink bg-accent-pink/20 px-2 py-1.5 text-xs font-semibold text-accent-pink"
                  >
                    B
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Range summary and validation */}
          {isOrderInvalid ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-pink">
              <AlertTriangle size={13} />
              <span>{loc.settings.transcodeEndMustBeGreater}</span>
            </div>
          ) : parsedB !== null ? (
            <div className="flex items-center gap-1.5 font-mono text-xs text-accent-cyan">
              <Scissors size={13} />
              <span>{fmt(loc.settings.transcodeRangeDuration, `${((parsedB - parsedA) / 1000).toFixed(3)}s (${formatTimeMs(parsedB - parsedA)})`)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-xs text-fg-muted">
              <Scissors size={13} />
              <span>{fmt(loc.settings.transcodeExportRangeText, formatTimeMs(parsedA))}</span>
            </div>
          )}
        </div>
      )}
    </div>
);
