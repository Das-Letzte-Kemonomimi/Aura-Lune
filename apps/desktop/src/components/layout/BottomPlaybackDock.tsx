import type { AppTab } from '../../types/navigation';
import React, { useState } from 'react';
import type { VolumeUnit } from '../../hooks/useVolumeUnit';
import { formatDb, sliderToVolume, volumeToSlider } from '../../utils/volumeScale';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Square,
  Volume2,
  VolumeX,
  Disc,
  FolderOpen,
  Zap,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import { type PlaybackStatus, type TrackRecord, type DspEngineType } from '../../types/player';
import { type PlaybackQueue } from '../../types/queue';
import { useLiveStatus } from '../../state/livePlayback';

export interface BottomPlaybackDockProps {
  isVisible: boolean;
  activeTab: AppTab;
  language: Language;
  loc: Translations;
  status: PlaybackStatus;
  currentPlayingTrack: TrackRecord | null;
  effectiveDisplayTitle: string;
  effectiveDisplayArtist: string;
  currentCover: string | null;
  filePath: string;
  queue: PlaybackQueue;
  volumeProgressPercent: number;
  volumeUnit: VolumeUnit;
  formatTime: (ms: number) => string;
  onScrollToTopOrSwitchTab: () => void;
  onOpenContainingFolder: (path: string, e: React.MouseEvent) => void;
  onToggleShuffle: () => void;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onCycleLoopMode: () => void;
  onToggleStopAfterCurrent: () => void;
  onSeek: (ms: number) => void;
  onSeekPreview?: (ms: number) => void;
  onSeekCommit?: (ms: number) => void;
  onCycleDspEngine: () => void;
  onSelectDspEngine: (engine: DspEngineType) => void;
  onToggleMute: () => void;
  onVolumeChange: (val: number) => void;
  onToggleMiniPlayer: () => void;
}

export const BottomPlaybackDock: React.FC<BottomPlaybackDockProps> = React.memo(({
  isVisible,
  activeTab,
  language: _language,
  loc,
  status: statusProp,
  currentPlayingTrack,
  effectiveDisplayTitle,
  effectiveDisplayArtist,
  currentCover,
  filePath,
  queue,
  volumeProgressPercent,
  volumeUnit,
  formatTime,
  onScrollToTopOrSwitchTab,
  onOpenContainingFolder,
  onToggleShuffle,
  onPrevious,
  onPlayPause,
  onNext,
  onCycleLoopMode,
  onToggleStopAfterCurrent,
  onSeek,
  onSeekPreview,
  onSeekCommit,
  onCycleDspEngine,
  onSelectDspEngine,
  onToggleMute,
  onVolumeChange,
  onToggleMiniPlayer,
}) => {
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const status = useLiveStatus(statusProp);
  const seekProgressPercent =
    status.duration_ms && status.duration_ms > 0
      ? Math.min(100, Math.max(0, (status.position_ms / status.duration_ms) * 100))
      : 0;
  const [isDspQuickMenuOpen, setIsDspQuickMenuOpen] = useState(false);

  if (!isVisible) return null;

  const t = loc;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '76px',
        background: 'rgba(15, 12, 28, 0.96)',
        borderTop: '1px solid var(--border-accent)',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.65)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        gap: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Lewa strona: Mini okładka, Tytuł, Wykonawca */}
      <div
        onClick={onScrollToTopOrSwitchTab}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          minWidth: '220px',
          maxWidth: '30%',
          cursor: 'pointer',
        }}
        title={activeTab === 'player' ? loc.bottomDock.scrollToTop : loc.bottomDock.openFullPlayer}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
            background: currentCover
              ? `url("${currentCover}") center/cover no-repeat`
              : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {!currentCover && (
            <Disc
              size={24}
              color="#fff"
              style={{
                animation: status.state === 'Playing' ? 'spin 4s linear infinite' : 'none',
              }}
            />
          )}
        </div>
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {effectiveDisplayTitle}
          </p>
          <p
            style={{
              margin: '2px 0 0 0',
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {effectiveDisplayArtist}
            {currentPlayingTrack?.format && (
              <span
                style={{
                  marginLeft: '6px',
                  fontSize: '0.68rem',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  color: 'var(--accent-cyan)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {currentPlayingTrack.format}
              </span>
            )}
            {(currentPlayingTrack?.path || filePath || status.current_track?.uri) && (
              <button
                onClick={(e) =>
                  onOpenContainingFolder(
                    currentPlayingTrack?.path || filePath || status.current_track?.uri || '',
                    e
                  )
                }
                title={loc.queue.openContainingFolder}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  marginLeft: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  verticalAlign: 'middle',
                }}
              >
                <FolderOpen size={13} />
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Środek: Sterowanie odtwarzaniem i pasek pozycji */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
          maxWidth: '560px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            style={{
              background: queue.shuffle ? 'rgba(6, 182, 212, 0.22)' : 'transparent',
              border: queue.shuffle ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              color: queue.shuffle ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s ease',
              boxShadow: queue.shuffle ? '0 0 10px rgba(6, 182, 212, 0.4)' : 'none',
            }}
            title={
              queue.shuffle
                ? loc.player.shuffleOn
                : loc.player.shuffleOff
            }
          >
            <Shuffle size={16} />
          </button>

          {/* Previous */}
          <button
            onClick={onPrevious}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title={t.bottomDock.prevTooltip}
          >
            <SkipBack size={18} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={onPlayPause}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              border: 'none',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 16px rgba(255, 77, 148, 0.45)',
            }}
            title={status.state === 'Playing' ? t.bottomDock.pauseTooltip : t.bottomDock.playTooltip}
          >
            {status.state === 'Playing' ? (
              <Pause size={18} fill="#fff" />
            ) : (
              <Play size={18} fill="#fff" style={{ marginLeft: '2px' }} />
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title={t.bottomDock.nextTooltip}
          >
            <SkipForward size={18} />
          </button>

          {/* Loop Mode */}
          <button
            onClick={onCycleLoopMode}
            style={{
              background: queue.loop_mode !== 'None' ? 'rgba(255, 77, 148, 0.22)' : 'transparent',
              border: queue.loop_mode !== 'None' ? '1px solid var(--accent-pink)' : '1px solid transparent',
              color: queue.loop_mode !== 'None' ? 'var(--accent-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.18s ease',
              boxShadow: queue.loop_mode !== 'None' ? '0 0 10px rgba(255, 77, 148, 0.4)' : 'none',
            }}
            title={
              queue.loop_mode === 'Track'
                ? loc.player.loopTrack
                : queue.loop_mode === 'Queue'
                  ? loc.player.loopQueue
                  : loc.player.loopOff
            }
          >
            {queue.loop_mode === 'Track' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>

          {/* Stop After Current */}
          <button
            onClick={onToggleStopAfterCurrent}
            style={{
              background: status.stop_after_current ? 'rgba(234, 179, 8, 0.22)' : 'transparent',
              border: status.stop_after_current ? '1px solid #eab308' : '1px solid transparent',
              color: status.stop_after_current ? '#eab308' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'all 0.18s ease',
              boxShadow: status.stop_after_current ? '0 0 10px rgba(234, 179, 8, 0.4)' : 'none',
            }}
            title={
              status.stop_after_current
                ? loc.bottomDock.stopAfterCurrentOn
                : loc.bottomDock.stopAfterCurrentOff
            }
          >
            <Square size={13} style={{ fill: status.stop_after_current ? '#eab308' : 'none' }} />
          </button>
        </div>

        {/* Position Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              minWidth: '36px',
              textAlign: 'right',
            }}
          >
            {formatTime(status.position_ms)}
          </span>
          <input
            type="range"
            min={0}
            max={status.duration_ms || 100}
            value={status.position_ms}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (onSeekPreview) onSeekPreview(val);
              else onSeek(val);
            }}
            onPointerUp={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onMouseUp={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onTouchEnd={(e) => onSeekCommit?.(Number(e.currentTarget.value))}
            onKeyUp={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
                onSeekCommit?.(Number(e.currentTarget.value));
              }
            }}
            style={{
              flex: 1,
              height: '4px',
              accentColor: 'var(--accent-pink)',
              cursor: 'pointer',
              background: `linear-gradient(to right, var(--accent-pink) 0%, var(--accent-purple) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
            }}
          />
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              minWidth: '36px',
            }}
          >
            {formatTime(status.duration_ms || 0)}
          </span>
        </div>
      </div>

      {/* Prawa strona: DSP, Głośność, Maksymalizacja */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '240px',
          justifyContent: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '16px',
              background:
                status.engine === 'Bypass'
                  ? 'rgba(16, 185, 129, 0.14)'
                  : status.engine === 'RubberBand'
                    ? 'rgba(236, 72, 153, 0.16)'
                    : 'rgba(6, 182, 212, 0.16)',
              border:
                status.engine === 'Bypass'
                  ? '1px solid rgba(16, 185, 129, 0.45)'
                  : status.engine === 'RubberBand'
                    ? '1px solid rgba(236, 72, 153, 0.45)'
                    : '1px solid rgba(6, 182, 212, 0.45)',
              boxShadow:
                status.engine === 'Bypass'
                  ? '0 0 10px rgba(16, 185, 129, 0.22)'
                  : status.engine === 'RubberBand'
                    ? '0 0 10px rgba(236, 72, 153, 0.28)'
                    : '0 0 10px rgba(6, 182, 212, 0.28)',
              transition: 'all 0.18s ease',
            }}
          >
            <button
              onClick={onCycleDspEngine}
              style={{
                padding: '4px 7px 4px 10px',
                background: 'transparent',
                border: 'none',
                color:
                  status.engine === 'Bypass'
                    ? 'var(--accent-green)'
                    : status.engine === 'RubberBand'
                      ? 'var(--accent-pink)'
                      : 'var(--accent-cyan)',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title={loc.bottomDock.dspEngineCycleTooltip.replace(
                '{0}',
                status.engine === 'Bypass'
                  ? `Direct Bypass (${loc.bottomDock.cleanAudio})`
                  : status.engine === 'RubberBand'
                    ? 'Rubber Band (Hi-Fi R3)'
                    : status.engine
              )}
            >
              <Zap size={13} fill={status.engine !== 'Bypass' ? 'currentColor' : 'none'} />
              <span>{status.engine === 'RubberBand' ? 'Rubber Band' : status.engine}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDspQuickMenuOpen(!isDspQuickMenuOpen);
              }}
              style={{
                padding: '4px 6px 4px 2px',
                background: 'transparent',
                border: 'none',
                borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                color:
                  status.engine === 'Bypass'
                    ? 'var(--accent-green)'
                    : status.engine === 'RubberBand'
                      ? 'var(--accent-pink)'
                      : 'var(--accent-cyan)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title={loc.bottomDock.selectDspEngineList}
            >
              <ChevronUp
                size={12}
                style={{
                  transform: isDspQuickMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.18s ease',
                }}
              />
            </button>

            {isDspQuickMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  right: 0,
                  background: 'rgba(20, 20, 32, 0.96)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 0, 0, 0.4)',
                  zIndex: 1000,
                  minWidth: '205px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 8px', fontWeight: 600 }}>
                  {loc.bottomDock.selectDspEngine}
                </div>
                {[
                  {
                    id: 'Bypass' as DspEngineType,
                    name: 'Direct Bypass',
                    desc: loc.bottomDock.cleanAudio,
                    color: 'var(--accent-green)',
                  },
                  {
                    id: 'RubberBand' as DspEngineType,
                    name: 'Rubber Band',
                    desc: 'Hi-Fi R3',
                    color: 'var(--accent-pink)',
                  },
                  {
                    id: 'SoundTouch' as DspEngineType,
                    name: 'SoundTouch',
                    desc: loc.bottomDock.fastEngine,
                    color: 'var(--accent-cyan)',
                  },
                ].map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => {
                      onSelectDspEngine(eng.id);
                      setIsDspQuickMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: status.engine === eng.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      border: status.engine === eng.id ? `1px solid ${eng.color}` : '1px solid transparent',
                      color: status.engine === eng.id ? eng.color : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: status.engine === eng.id ? 700 : 500,
                      textAlign: 'left',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={12} color={eng.color} fill={eng.id !== 'Bypass' ? eng.color : 'none'} />
                      {eng.name}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{eng.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {status.pitch_semitones !== 0 && (
            <span
              style={{
                fontSize: '0.70rem',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(255, 77, 148, 0.18)',
                color: 'var(--accent-pink)',
                fontWeight: 600,
              }}
              title={t.bottomDock.pitchTooltip}
            >
              {status.pitch_semitones > 0 ? `+${status.pitch_semitones}` : status.pitch_semitones} st
            </span>
          )}
          {status.tempo_ratio !== 1.0 && (
            <span
              style={{
                fontSize: '0.70rem',
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(6, 182, 212, 0.18)',
                color: 'var(--accent-cyan)',
                fontWeight: 600,
              }}
              title={t.bottomDock.tempoTooltip}
            >
              {status.tempo_ratio.toFixed(2)}x
            </span>
          )}
        </div>

        {/* Volume Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onToggleMute}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            title={status.volume === 0 ? t.bottomDock.mutedTooltip : t.bottomDock.volumeTooltip}
          >
            {status.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volumeToSlider(status.volume, volumeUnit)}
            onChange={(e) => onVolumeChange(sliderToVolume(Number(e.target.value), volumeUnit))}
            title={`${loc.player.volume}: ${volumeUnit === 'db' ? formatDb(status.volume) : `${Math.round(status.volume * 100)}%`}`}
            style={{
              width: '95px',
              height: '4px',
              cursor: 'pointer',
              background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) ${volumeProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
            }}
          />
        </div>

        {/* Scroll to Top / Expand to Player View */}
        <button
          onClick={onScrollToTopOrSwitchTab}
          className="glass-card"
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
          }}
          title={activeTab === 'player' ? t.bottomDock.scrollToTop : t.bottomDock.openFullPlayer}
        >
          {activeTab === 'player' ? <ChevronUp size={15} /> : <Maximize2 size={14} />}
        </button>

        {/* Mini Player Toggle */}
        <button
          onClick={onToggleMiniPlayer}
          className="glass-card"
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
          }}
          title={t.bottomDock.maximizeTooltip}
        >
          <Minimize2 size={14} />
        </button>
      </div>
    </div>
  );
});
