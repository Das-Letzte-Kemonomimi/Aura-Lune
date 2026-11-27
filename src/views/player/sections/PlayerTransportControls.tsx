import React from 'react';
import { Bookmark, Keyboard, Mic2, Moon, Pause, Play, Repeat, Repeat1, Shuffle, Sliders, SkipBack, SkipForward, Square, X } from '../../../components/ui/icons';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { currentPositionMs, useLiveVolume } from '../../../state/livePlayback';
import { fmt } from '../../../utils/fmt';
import { cn } from '../../../utils/cn';
import { Button, Chip, IconButton } from '../../../components/ui';
import { VolumeIcon, VolumeSlider } from '../../../components/player/VolumeSlider';

export type PlayerTransportControlsProps = Pick<PlayerViewProps, 'currentBookmark' | 'handleSaveBookmark' | 'loc' | 'activeTrackId' | 'handleJumpToBookmark' | 'formatTime' | 'handleDeleteBookmark' | 'showMessage' | 'setIsBookmarksModalOpen' | 'currentTrackBookmarks' | 'setLoopPointA' | 'formatTimeMs' | 'loopPointA' | 'setLoopPointB' | 'loopPointB' | 'setIsLoopEditorOpen' | 'setIsSleepTimerOpen' | 'sleepTimerRemainingSec' | 'sleepTimerTargetMode' | 'setIsShortcutsModalOpen' | 'setShowLyrics' | 'showLyrics' | 'handleToggleShuffle' | 'queue' | 'handlePrevious' | 'handleToggleStopAfterCurrent' | 'handlePlayPause' | 'handleNext' | 'handleCycleLoopMode' | 'handleToggleMute' | 'handleVolumeChange' | 'formatVolumeValue' | 'handleToggleVolumeUnit' | 'volumeUnit'> & {
  status: PlaybackStatus;
};


/** Leaf volume cluster reading live volume from `livePlayback` so drag/smooth fades avoid `PlayerTransportControls` re-renders. */
const PlayerVolumeCluster: React.FC<{
  stopAfterCurrent: boolean | undefined;
  volumeFallback: number;
  volumeUnit: PlayerViewProps['volumeUnit'];
  loc: PlayerViewProps['loc'];
  handleToggleStopAfterCurrent: PlayerViewProps['handleToggleStopAfterCurrent'];
  handleToggleMute: PlayerViewProps['handleToggleMute'];
  handleVolumeChange: PlayerViewProps['handleVolumeChange'];
  handleToggleVolumeUnit: PlayerViewProps['handleToggleVolumeUnit'];
  formatVolumeValue: PlayerViewProps['formatVolumeValue'];
}> = React.memo(({
  stopAfterCurrent,
  volumeFallback,
  volumeUnit,
  loc,
  handleToggleStopAfterCurrent,
  handleToggleMute,
  handleVolumeChange,
  handleToggleVolumeUnit,
  formatVolumeValue,
}) => {
  const volume = useLiveVolume(volumeFallback);
  return (
    <div className="order-3 flex items-center gap-2 rounded-2xl border border-line bg-black/25 py-1 pr-1.5 pl-1.5 lg:justify-self-end">
      <Chip
        tone="amber"
        pressed={Boolean(stopAfterCurrent)}
        onClick={handleToggleStopAfterCurrent}
        aria-label={stopAfterCurrent ? loc.bottomDock.stopAfterCurrentOn : loc.bottomDock.stopAfterCurrentOff}
        title={stopAfterCurrent ? loc.bottomDock.stopAfterCurrentOn : loc.bottomDock.stopAfterCurrentOff}
        className="size-8 rounded-xl p-0"
      >
        <Square size={14} fill={stopAfterCurrent ? 'currentColor' : 'none'} />
      </Chip>
      <IconButton
        size="sm"
        label={volume === 0 ? loc.player.unmute : loc.player.mute}
        onClick={handleToggleMute}
      >
        <VolumeIcon gain={volume} size={16} className={volume === 0 ? undefined : 'text-fg-secondary'} />
      </IconButton>
      <VolumeSlider
        ariaLabel={loc.player.volume}
        gain={volume}
        onGainChange={handleVolumeChange}
        className="w-30"
        title={`${loc.player.volume}: ${formatVolumeValue(volume, 'db')} (${formatVolumeValue(volume, 'percent')})`}
      />
      <Button
        size="sm"
        onClick={handleToggleVolumeUnit}
        title={loc.player.volumeToggleUnitTooltip}
        className={cn('min-w-13 rounded-md px-1.5 py-0.5 font-mono', volumeUnit === 'db' ? 'text-accent-cyan' : 'text-accent-pink')}
      >
        {formatVolumeValue(volume)}
      </Button>
    </div>
  );
});

/** Rounded cluster that groups related tool buttons (bookmarks, loop, extras). */
function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1 rounded-xl border border-line bg-black/25 p-1">{children}</div>;
}

/** Round transport button (previous, next). */
const transportClass = 'size-9.5 rounded-full border-transparent bg-white/8 text-fg';
/** Round toggle (shuffle, repeat). */
const roundToggleClass = 'size-9 rounded-full p-0';

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
  handleToggleMute,
  handleToggleShuffle,
  handleToggleStopAfterCurrent,
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
  volumeUnit,
}) => {
  const hasLoopPoint = loopPointA !== null || loopPointB !== null;
  const sleepActive = sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track';
  const playing = status.state === 'Playing';
  return (
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      {/* Media transport: the centre of the row */}
      <div className="order-1 flex items-center justify-center gap-2 lg:order-2 lg:justify-self-center">
        <Chip
          tone="cyan"
          pressed={queue.shuffle}
          onClick={handleToggleShuffle}
          aria-label={loc.shortcuts.shuffle}
          title={loc.shortcuts.shuffle}
          className={roundToggleClass}
        >
          <Shuffle size={16} />
        </Chip>

        <IconButton label={loc.player.previous} onClick={handlePrevious} className={transportClass}>
          <SkipBack size={18} />
        </IconButton>
        <Button
          variant="primary"
          onClick={handlePlayPause}
          aria-label={playing ? loc.player.pause : loc.player.play}
          className="size-14 rounded-full p-0 shadow-accent-glow"
        >
          {playing ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </Button>
        <IconButton label={loc.player.next} onClick={handleNext} className={transportClass}>
          <SkipForward size={18} />
        </IconButton>

        <Chip
          tone="pink"
          pressed={queue.loop_mode !== 'None'}
          onClick={handleCycleLoopMode}
          aria-label={queue.loop_mode === 'Track' ? loc.player.loopTrack : queue.loop_mode === 'Queue' ? loc.player.loopQueue : loc.player.loopOff}
          title={queue.loop_mode === 'Track' ? loc.player.loopTrack : queue.loop_mode === 'Queue' ? loc.player.loopQueue : loc.player.loopOff}
          className={cn(roundToggleClass, 'relative')}
        >
          {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          {queue.loop_mode === 'Queue' && (
            <span aria-hidden="true" className="absolute right-1 bottom-1 size-1 rounded-full bg-accent-pink" />
          )}
        </Chip>
      </div>

      {/* Tools: grouped by purpose, wrapping as clusters instead of single buttons */}
      <div className="order-2 flex flex-wrap items-center gap-2 lg:order-1 lg:justify-self-start">
        <ToolGroup>
        {currentBookmark === null ? (
          <Button
            variant={activeTrackId ? 'tinted' : 'secondary'}
            tone="amber"
            size="sm"
            onClick={handleSaveBookmark}
            title={loc.player.bookmarkDesc}
            className="h-7"
          >
            <Bookmark size={13} fill={activeTrackId ? 'currentColor' : 'none'} className="text-accent-amber" />
            {loc.player.bookmark}
          </Button>
        ) : (
          <div className="flex items-center">
            <Button variant="tinted" tone="amber" size="sm" onClick={handleSaveBookmark} className="h-7 rounded-r-none">
              <Bookmark size={13} fill="currentColor" /> {loc.player.bookmark}
            </Button>
            <Button
              variant="tinted"
              tone="amber"
              size="sm"
              onClick={() => handleJumpToBookmark(currentBookmark)}
              title={fmt(loc.player.bookmarkJump, formatTime(currentBookmark))}
              className="h-7 rounded-none border-l-0 font-mono"
            >
              {formatTime(currentBookmark)}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteBookmark}
              aria-label={loc.player.bookmarkDelete}
              title={loc.player.bookmarkDelete}
              className="h-7 rounded-l-none border-l-0 px-1.5"
            >
              <X size={12} />
            </Button>
          </div>
        )}

        {/* Cue points (multi-point bookmarks) */}
        <Button
          variant="tinted"
          tone="cyan"
          size="sm"
          onClick={() => {
            if (!activeTrackId && !status.current_track?.track_id) {
              showMessage(loc.player.loadTrackToManageBookmarks, true);
              return;
            }
            setIsBookmarksModalOpen(true);
          }}
          title={fmt(loc.player.bookmarksModalTitle, String(currentTrackBookmarks.length))}
          className="h-7"
        >
          <Bookmark size={13} />
          {currentTrackBookmarks.length > 0 ? `${currentTrackBookmarks.length}` : loc.player.pointsLabel}
        </Button>

        </ToolGroup>

        <ToolGroup>
        <Chip
          tone="cyan"
          pressed={loopPointA !== null}
          onClick={() => {
            const pos = currentPositionMs(status.position_ms);
            setLoopPointA(pos);
            showMessage(fmt(loc.player.pointAUpdatedMsg, formatTimeMs(pos)));
          }}
          title={loopPointA !== null
            ? fmt(loc.player.pointATooltip, formatTimeMs(loopPointA), String(loopPointA))
            : loc.player.setPointAAtCurrent}
          className="h-7 min-w-8 font-bold"
        >
          A
        </Chip>
        <Chip
          tone="pink"
          pressed={loopPointB !== null}
          onClick={() => {
            const pos = currentPositionMs(status.position_ms);
            setLoopPointB(pos);
            showMessage(fmt(loc.player.pointBUpdatedMsg, formatTimeMs(pos)));
          }}
          title={loopPointB !== null
            ? fmt(loc.player.pointBTooltip, formatTimeMs(loopPointB), String(loopPointB))
            : loc.player.setPointBAtCurrent}
          className="h-7 min-w-8 font-bold"
        >
          B
        </Chip>

        {/* A-B loop editor, with a clear button once a point is set */}
        <div className="flex items-center">
          <Chip
            tone="cyan"
            pressed={loopPointA !== null && loopPointB !== null}
            onClick={() => setIsLoopEditorOpen(true)}
            aria-label={loc.player.editLoopTooltip}
            title={loc.player.editLoopTooltip}
            className={cn('h-7 min-w-8 px-2', hasLoopPoint && 'rounded-r-none')}
          >
            <Sliders size={13} />
          </Chip>
          {hasLoopPoint && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setLoopPointA(null);
                setLoopPointB(null);
                showMessage(loc.player.clearedLoopMsg);
              }}
              aria-label={loc.shortcuts.loopClear}
              title={loc.shortcuts.loopClear}
              className="h-7 rounded-l-none border-l-0 px-1.5"
            >
              <X size={12} />
            </Button>
          )}
        </div>

        </ToolGroup>

        <ToolGroup>
        <Chip
          tone="purple"
          pressed={sleepActive}
          onClick={() => setIsSleepTimerOpen(true)}
          aria-label={loc.player.sleepTimer}
          title={loc.player.sleepTimer}
          className="h-7 min-w-8 px-2"
        >
          <Moon size={13} />
          {sleepActive && (
            <span className="font-mono text-xxs font-bold">
              {sleepTimerRemainingSec !== null
                ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
                : loc.player.timerEnd}
            </span>
          )}
        </Chip>

        <IconButton variant="secondary" label={loc.shortcuts.title} onClick={() => setIsShortcutsModalOpen(true)} className="size-7">
          <Keyboard size={13} />
        </IconButton>

        <Chip tone="cyan" pressed={showLyrics} onClick={() => setShowLyrics(!showLyrics)} title={loc.shortcuts.lyrics} className="h-7">
          <Mic2 size={13} />
          {loc.player.lyrics}
        </Chip>

        </ToolGroup>
      </div>

      {/* Volume */}
      <PlayerVolumeCluster
        stopAfterCurrent={status.stop_after_current}
        volumeFallback={status.volume}
        volumeUnit={volumeUnit}
        loc={loc}
        handleToggleStopAfterCurrent={handleToggleStopAfterCurrent}
        handleToggleMute={handleToggleMute}
        handleVolumeChange={handleVolumeChange}
        handleToggleVolumeUnit={handleToggleVolumeUnit}
        formatVolumeValue={formatVolumeValue}
      />
    </div>
  );
});
