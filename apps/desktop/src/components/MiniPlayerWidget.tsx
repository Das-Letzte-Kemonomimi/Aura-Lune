import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Volume2,
  VolumeX,
  Disc,
  Zap,
} from 'lucide-react';
import { type Language, getTranslations } from '../i18n';

interface MiniPlayerWidgetProps {
  title: string;
  artist: string;
  coverUrl?: string | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number | null;
  volume: number;
  pitchSemitones: number;
  tempoRatio: number;
  currentLang?: Language;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (positionMs: number) => void;
  onVolumeChange: (volume: number) => void;
  onRestore: () => void;
}

export const MiniPlayerWidget: React.FC<MiniPlayerWidgetProps> = ({
  title,
  artist,
  coverUrl,
  isPlaying,
  positionMs,
  durationMs,
  volume,
  pitchSemitones,
  tempoRatio,
  currentLang = 'en',
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onRestore,
}) => {
  const t = getTranslations(currentLang);
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const progress = durationMs && durationMs > 0 ? (positionMs / durationMs) * 100 : 0;
  const isDspActive = Math.abs(pitchSemitones) > 0.05 || Math.abs(tempoRatio - 1.0) > 0.02;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 14px',
        background: 'var(--bg-deep)',
        color: 'var(--text-primary)',
        userSelect: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        border: '1px solid var(--border-accent)',
        borderRadius: '12px',
      }}
    >
      {/* Górna belka: Okładka, Tytuł, DSP i Przycisk Przywrócenia */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Okładka */}
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '8px',
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isPlaying ? '0 0 12px var(--shadow-glow)' : 'none',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Cover"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Disc
              size={22}
              style={{
                color: 'var(--accent-purple)',
                animation: isPlaying ? 'spin 4s linear infinite' : 'none',
              }}
            />
          )}
        </div>

        {/* Tytuł i wykonawca */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-primary)',
            }}
          >
            {title || 'Auralune'}
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {artist || t.player.noTrack}
          </div>
        </div>

        {/* Ewentualny badge aktywnego DSP */}
        {isDspActive && (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(244, 63, 94, 0.2)',
              color: 'var(--accent-pink)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              flexShrink: 0,
            }}
          >
            <Zap size={10} />
            {tempoRatio.toFixed(2)}x
          </span>
        )}

        {/* Przycisk powrotu do pełnego okna */}
        <button
          onClick={onRestore}
          title={`${t.nav.miniPlayer} (${t.common.close})`}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            padding: '5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Pasek postępu */}
      <div style={{ margin: '4px 0' }}>
        <div
          onClick={(e) => {
            if (!durationMs || durationMs <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            onSeek(Math.floor(pct * durationMs));
          }}
          style={{
            height: '4px',
            borderRadius: '2px',
            background: 'rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-pink))',
              borderRadius: '2px',
              boxShadow: '0 0 8px var(--accent-pink)',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            marginTop: '3px',
          }}
        >
          <span>{formatTime(positionMs)}</span>
          <span>{durationMs ? formatTime(durationMs) : '--:--'}</span>
        </div>
      </div>

      {/* Przyciski sterowania */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
            title={volume === 0 ? t.player.unmute : t.player.mute}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{
              width: '50px',
              height: '3px',
              cursor: 'pointer',
              background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${Math.min(100, Math.max(0, volume * 100))}%, rgba(255, 255, 255, 0.12) ${Math.min(100, Math.max(0, volume * 100))}%, rgba(255, 255, 255, 0.12) 100%)`,
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={onPrev}
            title={t.player.previous}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <SkipBack size={15} />
          </button>

          <button
            onClick={onPlayPause}
            title={isPlaying ? t.player.pause : t.player.play}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(168, 85, 247, 0.4)',
            }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '1px' }} />}
          </button>

          <button
            onClick={onNext}
            title={t.player.next}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
