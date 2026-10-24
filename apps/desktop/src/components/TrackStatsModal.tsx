import React from 'react';
import { Flame, Clock, BarChart3, RefreshCw, X, RotateCcw } from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

export interface TrackStatsData {
  id: number;
  title: string;
  artist: string;
  album?: string | null;
  path: string;
  duration_ms: number;
  format: string;
  sample_rate: number;
  channels: number;
  bit_depth?: number | null;
  play_count?: number | null;
  last_played_at?: number | null;
}

interface TrackStatsModalProps {
  track: TrackStatsData | null;
  currentLang?: Language;
  onClose: () => void;
  onResetPlays?: (trackId: number) => void;
}

export const TrackStatsModal: React.FC<TrackStatsModalProps> = ({
  track,
  currentLang = 'pl',
  onClose,
  onResetPlays,
}) => {
  if (!track) return null;

  const loc = getTranslations(currentLang);

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatTotalTime = (totalMs: number) => {
    const totalSecs = Math.floor(totalMs / 1000);
    if (totalSecs < 60) return `${totalSecs} ${loc.stats.secsUnit}`;
    const mins = Math.floor(totalSecs / 60);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `${hours} ${loc.stats.hoursUnit} ${remainingMins} ${loc.stats.minsUnit}`;
    }
    return `${mins} ${loc.stats.minsUnit}`;
  };

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return loc.player.neverPlayed;
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const formatRelativeTime = (timestamp?: number | null) => {
    if (!timestamp) return loc.player.neverPlayed;
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 60) return loc.stats.relativeJustNow;
    if (diff < 3600) return loc.stats.relativeMinutesAgo.replace('{m}', String(Math.floor(diff / 60)));
    if (diff < 86400) return loc.stats.relativeHoursAgo.replace('{h}', String(Math.floor(diff / 3600)));
    const days = Math.floor(diff / 86400);
    if (days === 1) return loc.stats.relativeOneDayAgo;
    return loc.stats.relativeDaysAgo.replace('{d}', String(days));
  };

  const totalListenedMs = (track.play_count || 0) * track.duration_ms;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(18, 14, 34, 0.96)',
          borderRadius: '16px',
          border: '1px solid var(--border-accent)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek modala */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 10px rgba(244, 63, 94, 0.4)',
              }}
            >
              <BarChart3 size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                {loc.player.statsTitle}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {loc.player.trackStats} • ID #{track.id}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Zawartość statystyk */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Tytuł i wykonawca */}
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              {track.title}
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--accent-pink)', fontWeight: 600 }}>
              {track.artist} {track.album ? `• ${track.album}` : ''}
            </p>
          </div>

          {/* Kafelki metryk odsłuchu */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {/* Licznik odtworzeń */}
            <div
              className="glass-card"
              style={{
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderLeft: '3px solid var(--accent-amber)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-amber)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                <Flame size={14} />
                <span>{loc.player.playCount}</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: '2px 0' }}>
                {track.play_count || 0}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {track.play_count === 1 ? loc.trackStatsModal.singlePlay : `${track.play_count || 0} ${loc.player.plays}`}
              </span>
            </div>

            {/* Łączny czas odsłuchu */}
            <div
              className="glass-card"
              style={{
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderLeft: '3px solid var(--accent-purple)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-purple)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                <Clock size={14} />
                <span>{loc.trackStatsModal.totalTime}</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '4px 0' }}>
                {formatTotalTime(totalListenedMs)}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {loc.trackStatsModal.trackDuration.replace('{t}', formatTime(track.duration_ms))}
              </span>
            </div>

            {/* Ostatnio odtwarzano */}
            <div
              className="glass-card"
              style={{
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                borderLeft: '3px solid var(--accent-cyan)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                <RefreshCw size={14} />
                <span>{loc.player.lastPlayed}</span>
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#fff', margin: '5px 0' }}>
                {formatRelativeTime(track.last_played_at)}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatDate(track.last_played_at)}
              </span>
            </div>
          </div>

          {/* Szczegóły techniczne i ścieżka pliku */}
          <div
            className="glass-card"
            style={{
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{loc.trackStatsModal.formatCodec}</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {track.format} {track.bit_depth ? `• ${track.bit_depth}-bit` : ''} • {Math.round(track.sample_rate / 1000)} kHz
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{loc.trackStatsModal.audioChannels}</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>
                {track.channels === 2 ? loc.trackStatsModal.stereoChannels : `${track.channels} ch`}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{loc.trackStatsModal.filePath}</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', wordBreak: 'break-all' }}>
                {track.path}
              </span>
            </div>
          </div>
        </div>

        {/* Dolny pasek akcji */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          {onResetPlays && (track.play_count || 0) > 0 ? (
            <button
              onClick={() => onResetPlays(track.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
              title={loc.trackStatsModal.resetPlaysTooltip}
            >
              <RotateCcw size={13} />
              {loc.player.resetStats}
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
              color: '#fff',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {loc.settings.close}
          </button>
        </div>
      </div>
    </div>
  );
};
