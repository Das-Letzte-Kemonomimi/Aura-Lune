import React from 'react';
import { Bookmark, Keyboard, Mic2, Moon, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Sliders, Square, Volume2, VolumeX, X } from 'lucide-react';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { currentPositionMs } from '../../../state/livePlayback';

export type PlayerTransportControlsProps = Pick<PlayerViewProps, 'currentBookmark' | 'handleSaveBookmark' | 'loc' | 'activeTrackId' | 'handleJumpToBookmark' | 'formatTime' | 'handleDeleteBookmark' | 'showMessage' | 'setIsBookmarksModalOpen' | 'currentTrackBookmarks' | 'setLoopPointA' | 'formatTimeMs' | 'loopPointA' | 'setLoopPointB' | 'loopPointB' | 'setIsLoopEditorOpen' | 'setIsSleepTimerOpen' | 'sleepTimerRemainingSec' | 'sleepTimerTargetMode' | 'setIsShortcutsModalOpen' | 'setShowLyrics' | 'showLyrics' | 'handleToggleShuffle' | 'queue' | 'handlePrevious' | 'handleStop' | 'handlePlayPause' | 'handleNext' | 'handleCycleLoopMode' | 'handleToggleMute' | 'handleVolumeChange' | 'volumeProgressPercent' | 'formatVolumeValue' | 'handleToggleVolumeUnit' | 'volumeUnit'> & {
  status: PlaybackStatus;
};

// Memo: sekcja nie zależy od pozycji odtwarzania — nie renderuje się w każdej klatce statusu.
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {/* Narzędzia lewe: Zakładka, Pętla A-B, Sleep Timer, Skróty */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* 1. Przycisk Zakładki (Bookmark) */}
        {currentBookmark === null ? (
          <button
            onClick={handleSaveBookmark}
            title={loc.player.bookmarkDesc}
            className="glass-card"
            style={{
              height: '32px',
              padding: '0 11px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: activeTrackId ? '#fbbf24' : 'var(--text-muted)',
              background: activeTrackId ? 'rgba(251, 191, 36, 0.08)' : 'rgba(255, 255, 255, 0.04)',
              border: activeTrackId ? '1px solid rgba(251, 191, 36, 0.35)' : '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <Bookmark size={13} fill={activeTrackId ? '#fbbf24' : 'none'} color="#fbbf24" />
            <span>{loc.player.bookmark}</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
            <button
              onClick={handleSaveBookmark}
              className="glass-card"
              style={{
                padding: '6px 9px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '8px 0 0 8px',
                cursor: 'pointer',
                height: '32px',
              }}
            >
              <Bookmark size={13} fill="#fbbf24" color="#fbbf24" /> {loc.player.bookmark}
            </button>
            <button
              onClick={() => handleJumpToBookmark(currentBookmark)}
              className="glass-card"
              title={loc.player.bookmarkJump.replace('{0}', formatTime(currentBookmark))}
              style={{
                padding: '6px 6px',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#fbbf24',
                background: 'rgba(251, 191, 36, 0.12)',
                borderTop: '1px solid rgba(251, 191, 36, 0.45)',
                borderBottom: '1px solid rgba(251, 191, 36, 0.45)',
                borderLeft: 'none',
                borderRight: '1px solid rgba(251, 191, 36, 0.3)',
                cursor: 'pointer',
                height: '32px',
              }}
            >
              {formatTime(currentBookmark)}
            </button>
            <button
              onClick={handleDeleteBookmark}
              className="glass-card"
              title={loc.player.bookmarkDelete}
              style={{
                padding: '6px 6px',
                color: '#ff6b81',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                borderLeft: 'none',
                borderRadius: '0 8px 8px 0',
                cursor: 'pointer',
                height: '32px',
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* 2. Przycisk Wielopunktowych Zakładek (Points / Cue Points) */}
        <button
          onClick={() => {
            if (!activeTrackId && !status.current_track?.track_id) {
              showMessage(loc.player.loadTrackToManageBookmarks, true);
              return;
            }
            setIsBookmarksModalOpen(true);
          }}
          className="glass-card"
          style={{
            height: '32px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--accent-cyan)',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            fontSize: '0.75rem',
            fontWeight: 700,
            borderRadius: '8px',
            cursor: 'pointer',
          }}
          title={loc.player.bookmarksModalTitle.replace('{0}', String(currentTrackBookmarks.length))}
        >
          <Bookmark size={13} color="var(--accent-cyan)" />
          <span>{currentTrackBookmarks.length > 0 ? `${currentTrackBookmarks.length}` : loc.player.pointsLabel}</span>
        </button>

        {/* 3. Przycisk Punktu A */}
        <button
          onClick={() => {
            const pos = currentPositionMs(status.position_ms);
            setLoopPointA(pos);
            showMessage(loc.player.pointAUpdatedMsg.replace('{0}', formatTimeMs(pos)));
          }}
          className="glass-card"
          style={{
            minWidth: '32px',
            height: '32px',
            padding: '0 8px',
            fontSize: '0.78rem',
            fontWeight: 800,
            borderRadius: '8px',
            color: loopPointA !== null ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            background: loopPointA !== null ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 255, 255, 0.05)',
            border: loopPointA !== null ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title={loopPointA !== null
            ? loc.player.pointATooltip.replace('{0}', formatTimeMs(loopPointA)).replace('{1}', String(loopPointA))
            : loc.player.setPointAAtCurrent}
        >
          A
        </button>

        {/* 4. Przycisk Punktu B */}
        <button
          onClick={() => {
            const pos = currentPositionMs(status.position_ms);
            setLoopPointB(pos);
            showMessage(loc.player.pointBUpdatedMsg.replace('{0}', formatTimeMs(pos)));
          }}
          className="glass-card"
          style={{
            minWidth: '32px',
            height: '32px',
            padding: '0 8px',
            fontSize: '0.78rem',
            fontWeight: 800,
            borderRadius: '8px',
            color: loopPointB !== null ? 'var(--accent-pink)' : 'var(--text-secondary)',
            background: loopPointB !== null ? 'rgba(244, 63, 94, 0.22)' : 'rgba(255, 255, 255, 0.05)',
            border: loopPointB !== null ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title={loopPointB !== null
            ? loc.player.pointBTooltip.replace('{0}', formatTimeMs(loopPointB)).replace('{1}', String(loopPointB))
            : loc.player.setPointBAtCurrent}
        >
          B
        </button>

        {/* 5. Przycisk Edytora Pętli A-B (Sliders) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            onClick={() => setIsLoopEditorOpen(true)}
            className="glass-card"
            style={{
              minWidth: '32px',
              height: '32px',
              padding: '0 8px',
              borderRadius: (loopPointA !== null || loopPointB !== null) ? '8px 0 0 8px' : '8px',
              color: (loopPointA !== null && loopPointB !== null) ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              background: (loopPointA !== null && loopPointB !== null) ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.05)',
              border: (loopPointA !== null && loopPointB !== null) ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
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
              className="glass-card"
              style={{
                minWidth: '22px',
                height: '32px',
                padding: '0 4px',
                borderRadius: '0 8px 8px 0',
                color: '#ff6b81',
                background: 'rgba(255, 107, 129, 0.15)',
                border: '1px solid rgba(255, 107, 129, 0.35)',
                borderLeft: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={loc.shortcuts.loopClear}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 6. Przycisk Wyłącznika czasowego (Sleep Timer) */}
        <button
          onClick={() => setIsSleepTimerOpen(true)}
          className="glass-card"
          style={{
            minWidth: '32px',
            height: '32px',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            borderRadius: '8px',
            color:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? 'var(--accent-purple)'
                : 'var(--text-secondary)',
            border:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? '1px solid var(--accent-purple)'
                : '1px solid var(--border-subtle)',
            background:
              sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track'
                ? 'rgba(168, 85, 247, 0.18)'
                : 'rgba(255, 255, 255, 0.05)',
            cursor: 'pointer',
          }}
          title={loc.player.sleepTimer}
        >
          <Moon size={13} />
          {(sleepTimerRemainingSec !== null || sleepTimerTargetMode === 'end_of_track') && (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.68rem', marginLeft: '2px' }}>
              {sleepTimerRemainingSec !== null
                ? `${Math.floor(sleepTimerRemainingSec / 60)}:${(sleepTimerRemainingSec % 60) < 10 ? '0' : ''}${sleepTimerRemainingSec % 60}`
                : loc.player.timerEnd}
            </span>
          )}
        </button>

        {/* 7. Przycisk Skrótów klawiszowych */}
        <button
          onClick={() => setIsShortcutsModalOpen(true)}
          className="glass-card"
          style={{
            minWidth: '32px',
            height: '32px',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            cursor: 'pointer',
          }}
          title={loc.shortcuts.title}
        >
          <Keyboard size={13} />
        </button>

        {/* 8. Przycisk Tekstów piosenki (Lyrics) */}
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className="glass-card"
          style={{
            height: '32px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '8px',
            color: showLyrics ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            border: showLyrics ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
            background: showLyrics ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.05)',
            cursor: 'pointer',
          }}
          title={loc.shortcuts.lyrics}
        >
          <Mic2 size={13} />
          <span>{loc.player.lyrics}</span>
        </button>

        {/* Shuffle Button */}
        <button
          onClick={handleToggleShuffle}
          title={loc.shortcuts.shuffle}
          className="glass-card"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: queue.shuffle ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.06)',
            border: queue.shuffle ? '1px solid var(--accent-cyan)' : 'none',
            color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Shuffle size={16} />
        </button>

        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          title={loc.player.previous}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <SkipBack size={18} />
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          title={loc.player.stop}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Square size={16} />
        </button>

        {/* Play / Pause Button */}
        <button
          onClick={handlePlayPause}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
            cursor: 'pointer',
          }}
        >
          {status.state === 'Playing' ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          title={loc.player.next}
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <SkipForward size={18} />
        </button>

        {/* Repeat Button */}
        <button
          onClick={handleCycleLoopMode}
          title={queue.loop_mode === 'Track' ? loc.player.loopTrack : queue.loop_mode === 'Queue' ? loc.player.loopQueue : loc.player.loopOff}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: queue.loop_mode !== 'None' ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255,255,255,0.06)',
            border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : 'none',
            color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          {queue.loop_mode === 'Queue' && (
            <span style={{ position: 'absolute', bottom: '3px', right: '3px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-pink)' }} />
          )}
        </button>
      </div>

      {/* Volume Slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleToggleMute}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          title={status.volume === 0 ? loc.player.unmute : loc.player.mute}
        >
          {status.volume === 0 ? <VolumeX size={16} color="var(--text-muted)" /> : <Volume2 size={16} color="var(--text-secondary)" />}
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
          style={{
            width: '120px',
            cursor: 'pointer',
            background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
          }}
          title={`${loc.player.volume}: ${formatVolumeValue(status.volume)} (${Math.round(status.volume * 100)}%)`}
        />
        <button
          type="button"
          onClick={handleToggleVolumeUnit}
          title={loc.player.volumeToggleUnitTooltip}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '2px 6px',
            fontSize: '0.74rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: volumeUnit === 'db' ? 'var(--accent-cyan)' : 'var(--accent-pink)',
            cursor: 'pointer',
            minWidth: '52px',
            textAlign: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          {formatVolumeValue(status.volume)}
        </button>
      </div>
    </div>
));
