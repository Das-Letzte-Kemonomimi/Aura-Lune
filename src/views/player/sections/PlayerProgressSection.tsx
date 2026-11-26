import React from 'react';
import { Bookmark } from 'lucide-react';
import { WaveformCanvas } from '../../../components/player/WaveformCanvas';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { cssVars } from '../../../utils/cssVars';

export type PlayerProgressSectionProps = Pick<PlayerViewProps, 'formatTime' | 'dspCombination' | 'loopPointA' | 'loopPointB' | 'setIsLoopEditorOpen' | 'loc' | 'formatTimeMs' | 'setLoopPointA' | 'setLoopPointB' | 'showMessage' | 'handleToggleSeekFade' | 'seekFadeEnabled' | 'trackWaveformPeaks' | 'language' | 'handleSeek' | 'handleSeekPreview' | 'handleSeekCommit' | 'currentBookmark' | 'currentTrackBookmarks'> & {
  status: PlaybackStatus;
  seekProgressPercent: number;
};

export const PlayerProgressSection: React.FC<PlayerProgressSectionProps> = ({
  currentBookmark,
  currentTrackBookmarks,
  dspCombination,
  formatTime,
  formatTimeMs,
  handleSeek,
  handleSeekCommit,
  handleSeekPreview,
  handleToggleSeekFade,
  language,
  loc,
  loopPointA,
  loopPointB,
  seekFadeEnabled,
  seekProgressPercent,
  setIsLoopEditorOpen,
  setLoopPointA,
  setLoopPointB,
  showMessage,
  status,
  trackWaveformPeaks,
}) => (
    <div>
      <div className="mb-1.5 flex items-center justify-between font-mono text-ui text-fg-secondary">
        <div className="flex items-center gap-2">
          <span className="font-bold text-fg">
            {formatTime(status.position_ms)}
          </span>
          {/* DSP speed and transposition indicator when tempo, rate or pitch is changed */}
          {(dspCombination.hasTempo || dspCombination.hasRate || dspCombination.hasPitch) && (
            <span
              className="rounded-sm border border-accent-purple/45 bg-accent-purple/25 px-1.5 py-px text-xxs font-bold text-accent-purple"
              title={`DSP (${dspCombination.engine}): Σ Speed ${dspCombination.totalSpeedRatio.toFixed(2)}x, Σ Pitch ${dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)}st (Tempo: ${dspCombination.tempoRatio.toFixed(2)}x, Pitch: ${dspCombination.pitchSt.toFixed(2)}st, Rate: ${dspCombination.rateRatio.toFixed(2)}x)`}
            >
              DSP {dspCombination.totalSpeedRatio !== 1.0 ? `${dspCombination.totalSpeedRatio.toFixed(2)}x` : ''}
              {dspCombination.totalSpeedRatio !== 1.0 && Math.abs(dspCombination.totalPitchSemitones) > 0.005 ? ', ' : ''}
              {Math.abs(dspCombination.totalPitchSemitones) > 0.005 ? `${dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)}st` : ''}
            </span>
          )}
          {(loopPointA !== null || loopPointB !== null) && (
            <div className="flex items-center gap-1">
              <span
                onClick={() => setIsLoopEditorOpen(true)}
                className={cn(
                  'flex cursor-pointer items-center gap-1 rounded-sm border px-1.5 py-px text-xxs font-bold',
                  loopPointA !== null && loopPointB !== null ? 'border-accent-cyan/45 bg-accent-cyan/20 text-accent-cyan' : 'border-amber-400/40 bg-white/8 text-amber-400',
                )}
                title={loc.player.editLoopTooltip}
              >
                <span>🔁 {loc.player.loopAB}:</span>
                <span className="text-accent-cyan">{loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000'}</span>
                <span>→</span>
                <span className="text-accent-pink">{loopPointB !== null ? formatTimeMs(loopPointB) : '—'}</span>
                {loopPointA !== null && loopPointB !== null && loopPointB > loopPointA && (
                  <span className="text-2xs opacity-85">
                    ({((loopPointB - loopPointA) / 1000).toFixed(1)}s)
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  setLoopPointA(null);
                  setLoopPointB(null);
                  showMessage(loc.player.clearedLoopMsg);
                }}
                className="rounded-sm border border-accent-pink/45 bg-accent-pink/20 px-1.5 py-px text-xxs text-rose-400"
                title={loc.player.clearLoop}
              >
                ✕
              </button>
            </div>
          )}

          {/* Fade Seek toggle for the progress bar */}
          <button
            onClick={handleToggleSeekFade}
            className={cn(
              'rounded-sm border px-2 py-px text-xxs font-bold transition-all duration-150',
              seekFadeEnabled ? 'border-pink-500/45 bg-pink-500/20 text-accent-pink' : 'border-line bg-white/6 text-fg-muted',
            )}
            title={loc.player.seekFadeDesc}
          >
            {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
          </button>
        </div>
        <span>{status.duration_ms ? formatTime(status.duration_ms) : '--:--'}</span>
      </div>

      {/* Track waveform: an interactive wave synced with DSP */}
      <WaveformCanvas
        peaks={trackWaveformPeaks || []}
        progress={status.duration_ms && status.duration_ms > 0 ? (status.position_ms / status.duration_ms) * 100 : 0}
        durationMs={status.duration_ms || 0}
        positionMs={status.position_ms || 0}
        loopPointA={loopPointA}
        loopPointB={loopPointB}
        isPlaying={status.state === 'Playing'}
        height={66}
        colorPlayedStart="#f43f5e"
        colorPlayedEnd="#a855f7"
        currentLang={language}
        onSeek={(pct) => {
          if (status.duration_ms && status.duration_ms > 0) {
            handleSeek(Math.floor(pct * status.duration_ms));
          }
        }}
        onSeekPreview={(pct) => {
          if (status.duration_ms && status.duration_ms > 0) {
            handleSeekPreview?.(Math.floor(pct * status.duration_ms));
          }
        }}
        onSeekCommit={(pct) => {
          if (status.duration_ms && status.duration_ms > 0) {
            if (handleSeekCommit) {
              handleSeekCommit(Math.floor(pct * status.duration_ms));
            } else {
              handleSeek(Math.floor(pct * status.duration_ms));
            }
          }
        }}
        title={`${loc.waveform.title} (${loc.waveform.hint})`}
        className="mb-2.5"
      />

      {/* Slider container with the A-B loop highlight and the bookmark marker */}
      <div className="relative flex w-full items-center">
        {loopPointA !== null && loopPointB !== null && status.duration_ms && (
          <div
            className="pointer-events-none absolute top-1/2 z-1 h-2 -translate-y-1/2 rounded-sm bg-linear-to-r from-accent-cyan/65 to-accent-pink/65 shadow-halo-sm shadow-accent-cyan/60"
            style={{
              left: `${(loopPointA / status.duration_ms) * 100}%`,
              width: `${Math.max(2, ((loopPointB - loopPointA) / status.duration_ms) * 100)}%`,
            }}
          />
        )}
        {loopPointA !== null && status.duration_ms && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(loopPointA);
              showMessage(fmt(loc.player.jumpToPointAMsg, formatTimeMs(loopPointA)));
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsLoopEditorOpen(true);
            }}
            className="absolute -top-4 z-2 -translate-x-1/2 cursor-pointer rounded-sm border border-accent-cyan bg-deep px-1 py-0 text-2xs font-extrabold text-accent-cyan"
            style={{ left: `${(loopPointA / status.duration_ms) * 100}%` }}
            title={fmt(loc.player.pointATooltip, formatTimeMs(loopPointA), String(loopPointA))}
          >
            A
          </div>
        )}
        {loopPointB !== null && status.duration_ms && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(loopPointB);
              showMessage(fmt(loc.player.jumpToPointBMsg, formatTimeMs(loopPointB)));
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsLoopEditorOpen(true);
            }}
            className="absolute -top-4 z-2 -translate-x-1/2 cursor-pointer rounded-sm border border-accent-pink bg-deep px-1 py-0 text-2xs font-extrabold text-accent-pink"
            style={{ left: `${(loopPointB / status.duration_ms) * 100}%` }}
            title={fmt(loc.player.pointBTooltip, formatTimeMs(loopPointB), String(loopPointB))}
          >
            B
          </div>
        )}
        {/* Saved bookmark marker on the timeline */}
        {currentBookmark !== null && status.duration_ms && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(currentBookmark);
            }}
            className="absolute -top-4.5 z-3 flex -translate-x-1/2 cursor-pointer items-center gap-0.5 rounded-sm border border-amber-400 bg-deep px-1 py-0 text-2xs font-extrabold text-amber-400 shadow-halo-sm shadow-amber-400/40"
            style={{ left: `${(currentBookmark / status.duration_ms) * 100}%` }}
            title={`${fmt(loc.player.bookmarkJump, formatTime(currentBookmark))} (${loc.player.clickToJump})`}
          >
            <Bookmark size={9} fill="#fbbf24" /> {formatTime(currentBookmark)}
          </div>
        )}
        {/* Multi-point bookmark markers (track bookmarks / cue points) on the timeline */}
        {status.duration_ms && status.duration_ms > 0 && currentTrackBookmarks.map((bm) => {
          const leftPct = Math.min(100, Math.max(0, (bm.position_ms / status.duration_ms!) * 100));
          return (
            <div
              key={`bm-${bm.id}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSeek(bm.position_ms);
                showMessage(`📌 ${bm.name} (${formatTimeMs(bm.position_ms)})`);
              }}
              className="absolute top-1/2 z-4 h-2 w-2 cursor-pointer rounded-xs border border-white bg-accent-cyan shadow-halo-sm shadow-accent-cyan/90"
              style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%) rotate(45deg)' }}
              title={`📌 ${bm.name} - ${formatTimeMs(bm.position_ms)} (${loc.player.clickToJump})`}
            />
          );
        })}
        <input
          type="range"
          min={0}
          max={status.duration_ms || 100}
          value={status.position_ms}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (handleSeekPreview) handleSeekPreview(val);
            else handleSeek(val);
          }}
          onPointerUp={(e) => {
            handleSeekCommit?.(Number(e.currentTarget.value));
            e.currentTarget.blur();
          }}
          onMouseUp={(e) => {
            handleSeekCommit?.(Number(e.currentTarget.value));
            e.currentTarget.blur();
          }}
          onTouchEnd={(e) => {
            handleSeekCommit?.(Number(e.currentTarget.value));
            e.currentTarget.blur();
          }}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
              handleSeekCommit?.(Number(e.currentTarget.value));
            }
          }}
          onKeyDown={(e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
              e.currentTarget.blur();
            }
          }}
          className="relative z-3 w-full range-fill"
          style={cssVars({ '--fill': `${seekProgressPercent}%` })}
        />
      </div>
    </div>
);
