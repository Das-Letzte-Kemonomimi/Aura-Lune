import React, { useMemo } from 'react';
import {
  BarChart3,
  Flame,
  Clock,
  Music,
  Disc,
  Mic2,
  Sparkles,
  Play,
} from 'lucide-react';
import type { Language } from '../i18n';
import { getTranslations } from '../i18n';

interface TrackRecord {
  id: number;
  path: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album_id: number | null;
  disc_no: number | null;
  track_no: number | null;
  duration_ms: number;
  format: string;
  sample_rate: number;
  channels: number;
  bit_depth: number | null;
  file_size: number;
  modified_time: number;
  is_favorite?: boolean | null;
  play_count?: number | null;
  last_played_at?: number | null;
  total_play_time_ms?: number | null;
}

interface AlbumRecord {
  id: number;
  title: string;
  album_artist: string;
  year: number | null;
  cover_path?: string | null;
}

interface StatsDashboardViewProps {
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  currentLang?: Language;
  onPlayTrack: (track: TrackRecord) => void;
  onOpenStatsModal: (track: TrackRecord) => void;
}

export const StatsDashboardView: React.FC<StatsDashboardViewProps> = ({
  tracks,
  albums,
  currentLang = 'pl',
  onPlayTrack,
  onOpenStatsModal,
}) => {
  const loc = getTranslations(currentLang);

  // Podsumowanie globalne
  const stats = useMemo(() => {
    const totalTracks = tracks.length;
    const totalAlbums = albums.length;
    const artists = new Set(tracks.map((t) => t.artist).filter(Boolean));
    const totalArtists = artists.size;

    const totalPlays = tracks.reduce((acc, t) => acc + (t.play_count || 0), 0);
    const totalListenedMs = tracks.reduce((acc, t) => acc + (t.play_count || 0) * (t.duration_ms || 0), 0);

    // Top Utwory wg odtworzeń
    const topTracks = [...tracks]
      .filter((t) => (t.play_count || 0) > 0)
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 5);

    // Top Wykonawcy wg odtworzeń
    const artistMap = new Map<string, { artist: string; plays: number; tracks: number }>();
    tracks.forEach((t) => {
      const art = t.artist || loc.stats.unknownArtist;
      const existing = artistMap.get(art) || { artist: art, plays: 0, tracks: 0 };
      existing.plays += t.play_count || 0;
      existing.tracks += 1;
      artistMap.set(art, existing);
    });

    const topArtists = Array.from(artistMap.values())
      .filter((a) => a.plays > 0)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);

    // Rozkład formatów
    const formatMap = new Map<string, number>();
    let hiResCount = 0;
    tracks.forEach((t) => {
      const fmt = (t.format || 'OTHER').toUpperCase();
      formatMap.set(fmt, (formatMap.get(fmt) || 0) + 1);
      if ((t.bit_depth && t.bit_depth >= 24) || t.sample_rate >= 88200) {
        hiResCount++;
      }
    });

    const formatBreakdown = Array.from(formatMap.entries())
      .map(([format, count]) => ({
        format,
        count,
        percent: totalTracks > 0 ? Math.round((count / totalTracks) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Ostatnio słuchane
    const recentTracks = [...tracks]
      .filter((t) => t.last_played_at)
      .sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0))
      .slice(0, 5);

    return {
      totalTracks,
      totalAlbums,
      totalArtists,
      totalPlays,
      totalListenedMs,
      topTracks,
      topArtists,
      formatBreakdown,
      hiResCount,
      recentTracks,
    };
  }, [tracks, albums]);

  const formatTotalTime = (totalMs: number) => {
    const totalSecs = Math.floor(totalMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `${hours} ${loc.stats.hoursUnit} ${remainingMins} ${loc.stats.minsUnit}`;
    }
    if (mins > 0) {
      return `${mins} ${loc.stats.minsUnit}`;
    }
    return `${totalSecs} ${loc.stats.secsUnit}`;
  };

  const formatRelativeTime = (timestamp?: number | null) => {
    if (!timestamp) return loc.stats.relativeNever;
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 60) return loc.stats.relativeJustNow;
    if (diff < 3600) return loc.stats.relativeMinutesAgo.replace('{m}', String(Math.floor(diff / 60)));
    if (diff < 86400) return loc.stats.relativeHoursAgo.replace('{h}', String(Math.floor(diff / 3600)));
    const days = Math.floor(diff / 86400);
    if (days === 1) return loc.stats.relativeOneDayAgo;
    return loc.stats.relativeDaysAgo.replace('{d}', String(days));
  };

  const getTracksInLibraryText = (count: number) => {
    if (count === 1) return loc.stats.tracksInLibrarySingle.replace('{n}', '1');
    if (count >= 2 && count <= 4) return loc.stats.tracksInLibraryFew.replace('{n}', String(count));
    return loc.stats.tracksInLibraryMany.replace('{n}', String(count));
  };

  const medalEmojis = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Baner Tytułowy */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(244, 63, 94, 0.14))',
          border: '1px solid var(--border-accent)',
          borderRadius: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <BarChart3 size={24} color="var(--accent-pink)" />
            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              {loc.stats.title}
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {loc.stats.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={14} /> {loc.stats.liveBadge}
          </span>
        </div>
      </div>

      {/* 4 Kluczowe Karty Metryk (KPI) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* Łączny czas */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            background: 'rgba(26, 20, 46, 0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-purple)',
            }}
          >
            <Clock size={22} color="var(--accent-purple)" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.stats.totalListenTime}</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
              {formatTotalTime(stats.totalListenedMs)}
            </div>
          </div>
        </div>

        {/* Całkowite odtworzenia */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            background: 'rgba(26, 20, 46, 0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-amber)',
            }}
          >
            <Flame size={22} color="var(--accent-amber)" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.stats.totalPlays}</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>
              {stats.totalPlays} {loc.stats.playsUnit}
            </div>
          </div>
        </div>

        {/* Rozmiar biblioteki */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            background: 'rgba(26, 20, 46, 0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-cyan)',
            }}
          >
            <Music size={22} color="var(--accent-cyan)" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.stats.librarySize}</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
              {stats.totalTracks} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{loc.stats.tracksUnit}</span>
            </div>
          </div>
        </div>

        {/* Udział Hi-Res */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            background: 'rgba(26, 20, 46, 0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(244, 63, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-pink)',
            }}
          >
            <Sparkles size={22} color="var(--accent-pink)" />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>{loc.stats.hiResShare}</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-pink)', marginTop: '2px' }}>
              {stats.hiResCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{loc.stats.hiResSubtitle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Środkowa Sekcja: Top Utwory & Top Wykonawcy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
        {/* Kolumna 1: Top 5 Utworów */}
        <div className="glass-panel" style={{ padding: '20px 22px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={17} color="var(--accent-amber)" /> {loc.stats.topTracks}
            </h4>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>TOP 5</span>
          </div>

          {stats.topTracks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {loc.stats.topTracksEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.topTracks.map((t, idx) => (
                <div
                  key={t.id}
                  className="glass-card"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ fontSize: '1.05rem', width: '24px', textAlign: 'center' }}>
                      {medalEmojis[idx]}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {t.artist}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span
                      onClick={() => onOpenStatsModal(t)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '10px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: 'var(--accent-amber)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      title={loc.stats.viewTrackStatsTooltip}
                    >
                      🔥 {t.play_count}x
                    </span>
                    <button
                      onClick={() => onPlayTrack(t)}
                      title={loc.stats.playTrackTooltip}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Play size={12} fill="#fff" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolumna 2: Top 5 Wykonawców */}
        <div className="glass-panel" style={{ padding: '20px 22px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mic2 size={17} color="var(--accent-purple)" /> {loc.stats.topArtists}
            </h4>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>TOP 5</span>
          </div>

          {stats.topArtists.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {loc.stats.topArtistsEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.topArtists.map((a, idx) => (
                <div
                  key={a.artist}
                  className="glass-card"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: 700,
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {a.artist}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {getTracksInLibraryText(a.tracks)}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '10px',
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: 'var(--accent-purple)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                    }}
                  >
                    🔥 {a.plays} {loc.stats.playsUnit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dolna Sekcja: Rozkład Formatów & Ostatnio Odtwarzane */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
        {/* Rozkład Kodeków / Formatów */}
        <div className="glass-panel" style={{ padding: '20px 22px', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.96rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Disc size={17} color="var(--accent-cyan)" /> {loc.stats.formatBreakdown}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.formatBreakdown.map((item) => (
              <div key={item.format}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    {item.format}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {item.count} {loc.stats.tracksUnit} ({item.percent}%)
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${item.percent}%`,
                      borderRadius: '3px',
                      background:
                        item.format === 'FLAC'
                          ? 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))'
                          : item.format === 'MP3'
                          ? 'var(--accent-pink)'
                          : 'var(--accent-amber)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ostatnio Odtwarzane Utwory */}
        <div className="glass-panel" style={{ padding: '20px 22px', borderRadius: '14px' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.96rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={17} color="var(--accent-pink)" /> {loc.stats.recentTracks}
          </h4>
          {stats.recentTracks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {loc.stats.recentTracksEmpty}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.recentTracks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {t.artist}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)' }}>
                      {formatRelativeTime(t.last_played_at)}
                    </span>
                    <button
                      onClick={() => onPlayTrack(t)}
                      title={loc.stats.playTrackTooltip}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-pink)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      <Play size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
