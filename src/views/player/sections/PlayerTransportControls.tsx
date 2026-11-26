import React from 'react';
import { Bookmark, Keyboard, Mic2, Moon, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Sliders, Square, Volume2, VolumeX, X } from 'lucide-react';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { currentPositionMs } from '../../../state/livePlayback';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { cssVars } from '../../../utils/cssVars';

export type PlayerTransportControlsProps = Pick<PlayerViewProps, 'currentBookmark' | 'handleSaveBookmark' | 'loc' | 'activeTrackId' | 'handleJumpToBookmark' | 'formatTime' | 'handleDeleteBookmark' | 'showMessage' | 'setIsBookmarksModalOpen' | 'currentTrackBookmarks' | 'setLoopPointA' | 'formatTimeMs' | 'loopPointA' | 'setLoopPointB' | 'loopPointB' | 'setIsLoopEditorOpen' | 'setIsSleepTimerOpen' | 'sleepTimerRemainingSec' | 'sleepTimerTargetMode' | 'setIsShortcutsModalOpen' | 'setShowLyrics' | 'showLyrics' | 'handleToggleShuffle' | 'queue' | 'handlePrevious' | 'handleStop' | 'handlePlayPause' | 'handleNext' | 'handleCycleLoopMode' | 'handleToggleMute' | 'handleVolumeChange' | 'volumeProgressPercent' | 'formatVolumeValue' | 'handleToggleVolumeUnit' | 'volumeUnit'> & {
  status: PlaybackStatus;
};

// Memo: the section does not depend on the playback position, so it does not render on every status frame.
export const PlayerTransportControls: React.FC<PlayerTransportControlsProps> = React.memo(({
  activeTrackId,
  currentBookmark,
  currentTrackBookmarks,
  formatTime,
  formatTimeMs,
  formatVolumeValue,
  handleCycleLoopMode,
  handleDeleteBookmark,
  handleJumpToBookmark,
  handleNext,
  handlePlayPause,
  handlePrevious,
  handleSaveBookmark,
  handleStop,
  handleToggleMute,
  handleToggleShuffle,
  handleToggleVolumeUnit,
  handleVolumeChange,
  loc,
  loopPointA,
  loopPointB,
  queue,
  setIsBookmarksModalOpen,
  setIsLoopEditorOpen,
  setIsShortcutsModalOpen,
  setIsSleepTimerOpen,
  setLoopPointA,
  setLoopPointB,
  setShowLyrics,
  showLyrics,
  showMessage,
  sleepTimerRemainingSec,
  sleepTimerTargetMode,
  status,
  volumeProgressPercent,
  volumeUnit,
}) => (
    <div className="flex items-center justify-between">
      {/* Left tools: bookmark, A-B loop, sleep timer, shortcuts */}
      <div className="flex items-center gap-1.5">
        {/* 1. Bookmark button */}
        {currentBookmark === null ? (
          <button
            onClick={handleSaveBookmark}
            title={loc.player.bookmarkDesc}
            className={cn(
              'glass-card flex h-8 items-center gap-1.5 rounded-lg border px-3 py-0 text-xs font-bold',
              activeTrackId ? 'border-amber-400/35 bg-amber-400/8 text-amber-400' : 'border-line bg-white/4 text-fg-muted',
            )}
          >
            <Bookmark size={13} fill={activeTrackId ? '#fbbf24' : 'none'} className="text-amber-400" />
            <span>{loc.player.bookmark}</span>
          </button>
        ) : (
          <div className="flex items-center gap-px">
            <button
              onClick={handleSaveBookmark}
              className="glass-card flex h-8 items-center gap-1 rounded-none rounded-l-lg border border-amber-400/45 bg-amber-400/15 px-2.5 py-1.5 text-xs font-bold text-amber-400"
            >
              <Bookmark size={13} fill="#fbbf24" className="text-amber-400" /> {loc.player.bookmark}
            </button>
            <button
              onClick={() => handleJumpToBookmark(currentBookmark)}
              className="glass-card h-8 border-t border-b border-l-0 border-r border-amber-400/45 border-amber-400/30 bg-amber-400/10 p-1.5 font-mono text-xs font-bold text-amber-400"
              title={fmt(loc.player.bookmarkJump, formatTime(currentBookmark))}
            >
              {formatTime(currentBookmark)}
            </button>
            <button
              onClick={handleDeleteBookmark}
              className="glass-card h-8 rounded-none rounded-r-lg border border-l-0 border-amber-400/45 bg-amber-400/10 p-1.5 text-rose-400"
              title={loc.player.bookmarkDelete}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* 2. Multi-point bookmarks button (cue points) */}
        <button
          onClick={() => {
            if (!activeTrackId && !status.current_track?.track_id) {
              showMessage(loc.player.loadTrackToManageBookmarks, true);
              return;
            }
            setIsBookmarksModalOpen(true);
          }}
          className="glass-card flex h-8 items-center gap-1 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-2.5 py-0 text-xs font-bold text-accent-cyan"
          title={fmt(loc.player.bookmarksModalTitle, String(currentTrackBookmarks.length))}
        >
          <Bookmark size={13} className="text-accent-cyan" />
          <span>{currentTrackBookmarks.length > 0 ? `${currentTrackBookmarks.length}` : loc.player.pointsLabel}</span>
        </button>

        {/* 3. Point A button */}
        <button
          onClick={() => {
            const pos = currentPositionMs(status.position_ms);
            setLoopPointA(pos);
            showMessage(fmt(loc.player.pointAUpdatedMsg, formatTimeMs(pos)));
          }}
          className={cn(
            'glass-card flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 py-0 text-ui font-extrabold transition-all duration-150',
            loopPointA !== null ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan' : 'border-line bg-white/5 text-fg-secondary',
          )}
          title={loopPointA !== null
            ? fmt(loc.player.pointATooltip, formatTimeMs(loopPointA), String(loopPointA))
            : loc.player.setPointAAtCurrent}
        >
          A
        </button>

        {/* 4. Point B button */}
        <button
          onClick={() => {
            const pos = currentPositionMs(status.position_ms);
            setLoopPointB(pos);
            showMessage(fmt(loc.player.pointBUpdatedMsg, formatTimeMs(pos)));
          }}
          className={cn(
            'glass-card flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 py-0 text-ui font-extrabold transition-all duration-150',
            loopPointB !== null ? 'border-accent-pink bg-accent-pink/20 text-accent-pink' : 'border-line bg-white/5 text-fg-secondary',
          )}
          title={loopPointB !== null
            ? fmt(loc.player.pointBTooltip, formatTimeMs(loopPointB), String(loopPointB))
            : loc.player.setPointBAtCurrent}
        >
          B
        </button>

        {/* 5. A-B loop editor button (sliders) */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsLoopEditorOpen(true)}
            className={cn(
              'glass-card flex h-8 min-w-8 items-center justify-center border px-2 py-0',
              (loopPointA !== null && loopPointB !== null) ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan' : 'border-line bg-white/5 text-fg-secondary',
            )}
            style={{ borderRadius: (loopPointA !== null || loopPointB !== null) ? '8px 0' : '8px' }}
            title={loc.player.editLoopTooltip}
          >
            <Sliders size={13} />
          </button>
          {(loopPointA !== null || loopPointB !== null) && (
            <button
              onClick={() => {
                setLoopPointA(null);
                setLoopPointB(null);
                showMessage(loc.player.clearedLoopMsg);
              }}
              className="glass-card flex h-8 min-w-5.5 items-center justify-center rounded-none rounded-r-lg border border-l-0 border-rose-400/35 bg-rose-400/15 px-1 py-0 text-rose-400"
              title={loc.shortcuts.loopClear}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 6. Sleep timer button */}
        <button
          onClick={() => setIsSleepTimerOpen(true)}
          className={cn(
            'glass-card flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border px-2 py-0 text-xs',
            sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track' ? 'border-accent-purple bg-accent-purple/20 text-accent-purple' : 'border-line bg-white/5 text-fg-secondary',
          )}
          title={loc.player.sleepTimer}
        >
          <Moon size={13} />
          {(sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track') && (
            <span className="ml-0.5 font-mono text-xxs font-bold">
              {sleepTimerRemainingSec !== null
                ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
                : loc.player.timerEnd}
            </span>
          )}
        </button>

        {/* 7. Keyboard shortcuts button */}
        <button
          onClick={() => setIsShortcutsModalOpen(true)}
          className="glass-card flex h-8 min-w-8 items-center justify-center rounded-lg border border-line bg-white/5 px-2 py-0 text-xs text-fg-secondary"
          title={loc.shortcuts.title}
        >
          <Keyboard size={13} />
        </button>

        {/* 8. Lyrics button */}
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className={cn(
            'glass-card flex h-8 items-center gap-1.5 rounded-lg border px-2.5 py-0 text-xs font-semibold',
            showLyrics ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan' : 'border-line bg-white/5 text-fg-secondary',
          )}
          title={loc.shortcuts.lyrics}
        >
          <Mic2 size={13} />
          <span>{loc.player.lyrics}</span>
        </button>

        {/* Shuffle Button */}
        <button
          onClick={handleToggleShuffle}
          title={loc.shortcuts.shuffle}
          className={cn(
            'glass-card flex h-9 w-9 items-center justify-center rounded-full',
            queue.shuffle ? 'border border-accent-cyan bg-accent-cyan/25 text-accent-cyan' : 'border-0 bg-white/6 text-fg-muted',
          )}
        >
          <Shuffle size={16} />
        </button>

        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          title={loc.player.previous}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full border-0 bg-white/8 text-fg"
        >
          <SkipBack size={18} />
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          title={loc.player.stop}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full border-0 bg-white/8 text-fg"
        >
          <Square size={16} />
        </button>

        {/* Play / Pause Button */}
        <button
          onClick={handlePlayPause}
          className="flex h-14 w-14 items-center justify-center rounded-full border-0 bg-accent-gradient text-on-accent shadow-accent-glow"
        >
          {status.state === 'Playing' ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          title={loc.player.next}
          className="flex h-9.5 w-9.5 items-center justify-center rounded-full border-0 bg-white/8 text-fg"
        >
          <SkipForward size={18} />
        </button>

        {/* Repeat Button */}
        <button
          onClick={handleCycleLoopMode}
          title={queue.loop_mode === 'Track' ? loc.player.loopTrack : queue.loop_mode === 'Queue' ? loc.player.loopQueue : loc.player.loopOff}
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-full',
            queue.loop_mode !== 'None' ? 'border border-accent-pink bg-accent-pink/25 text-accent-pink' : 'border-0 bg-white/6 text-fg-muted',
          )}
        >
          {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          {queue.loop_mode === 'Queue' && (
            <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-accent-pink" />
          )}
        </button>
      </div>

      {/* Volume Slider */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleMute}
          className="flex items-center border-0 bg-transparent p-0 text-fg-muted"
          title={status.volume === 0 ? loc.player.unmute : loc.player.mute}
        >
          {status.volume === 0 ? <VolumeX size={16} className="text-fg-muted" /> : <Volume2 size={16} className="text-fg-secondary" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={status.volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          onPointerUp={(e) => e.currentTarget.blur()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
              e.currentTarget.blur();
            }
          }}
          className="w-30 range-fill"
          style={cssVars({ '--fill': `${volumeProgressPercent}%` })}
          title={`${loc.player.volume}: ${formatVolumeValue(status.volume)} (${Math.round(status.volume * 100)}%)`}
        />
        <button
          type="button"
          onClick={handleToggleVolumeUnit}
          title={loc.player.volumeToggleUnitTooltip}
          className={cn(
            'min-w-13 rounded-md border border-line bg-white/6 px-1.5 py-0.5 text-center font-mono text-xs font-bold transition-all duration-150',
            volumeUnit === 'db' ? 'text-accent-cyan' : 'text-accent-pink',
          )}
        >
          {formatVolumeValue(status.volume)}
        </button>
      </div>
    </div>
));
