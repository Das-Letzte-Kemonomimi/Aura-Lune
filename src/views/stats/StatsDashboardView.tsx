import type { AlbumRecord, TrackRecord } from '../../types/library';
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
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { formatRelativeTime as formatRelativeTimeBase } from '../../utils/timeFormat';
import { cn } from '../../utils/cn';

export interface StatsDashboardViewProps {
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  currentLang?: Language;
  onPlayTrack: (track: TrackRecord) => void;
  onOpenStatsModal: (track: TrackRecord) => void;
  onOpenRecapModal?: () => void;
}

export const StatsDashboardView: React.FC<StatsDashboardViewProps> = ({
  tracks,
  albums,
  currentLang = 'pl',
  onPlayTrack,
  onOpenStatsModal,
  onOpenRecapModal,
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
  }, [tracks, albums, loc.stats.unknownArtist]);

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

  const formatRelativeTime = (timestamp?: number | null) =>
    formatRelativeTimeBase(timestamp, {
      never: loc.stats.relativeNever,
      justNow: loc.stats.relativeJustNow,
      minutesAgo: loc.stats.relativeMinutesAgo,
      hoursAgo: loc.stats.relativeHoursAgo,
      daysAgo: loc.stats.relativeDaysAgo,
      oneDayAgo: loc.stats.relativeOneDayAgo,
    });

  const getTracksInLibraryText = (count: number) => {
    if (count === 1) return loc.stats.tracksInLibrarySingle.replace('{n}', '1');
    if (count >= 2 && count <= 4) return loc.stats.tracksInLibraryFew.replace('{n}', String(count));
    return loc.stats.tracksInLibraryMany.replace('{n}', String(count));
  };

  const medalEmojis = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    <div className="mx-auto flex max-w-[min(100rem,98vw)] flex-col gap-5.5">
      {/* Baner Tytułowy */}
      <div
        className="glass-panel flex items-center justify-between rounded-2xl border border-line-accent bg-linear-135 from-accent-purple/20 to-accent-pink/15 px-7 py-6"
      >
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <BarChart3 size={24} className="text-accent-pink" />
            <h2 className="m-0 text-2xl font-extrabold tracking-tight text-fg">
              {loc.stats.title}
            </h2>
          </div>
          <p className="m-0 text-sm text-fg-secondary">
            {loc.stats.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenRecapModal && (
            <button
              onClick={onOpenRecapModal}
              className="flex items-center gap-1.5 rounded-3xl border border-accent-pink bg-linear-135 from-accent-pink/25 to-accent-purple/25 px-3.5 py-1.5 text-ui font-bold text-fg"
              title={loc.nav.recapTitle || loc.nav.recap}
            >
              <Sparkles size={14} className="text-accent-pink" /> {loc.nav.recap}
            </button>
          )}
          <span
            className="flex items-center gap-1.5 rounded-3xl border border-line bg-white/8 px-3.5 py-1.5 text-ui font-semibold text-accent-cyan"
          >
            <Sparkles size={14} /> {loc.stats.liveBadge}
          </span>
        </div>
      </div>

      {/* 4 Kluczowe Karty Metryk (KPI) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {/* Łączny czas */}
        <div
          className="glass-card flex items-center gap-3.5 rounded-2xl border border-accent-purple/30 bg-card px-5 py-4.5"
        >
          <div
            className="flex h-11.5 w-11.5 items-center justify-center rounded-xl border border-accent-purple bg-accent-purple/20"
          >
            <Clock size={22} className="text-accent-purple" />
          </div>
          <div>
            <span className="text-xs font-semibold text-fg-muted">{loc.stats.totalListenTime}</span>
            <div className="mt-0.5 text-xl font-extrabold text-fg">
              {formatTotalTime(stats.totalListenedMs)}
            </div>
          </div>
        </div>

        {/* Całkowite odtworzenia */}
        <div
          className="glass-card flex items-center gap-3.5 rounded-2xl border border-accent-amber/30 bg-card px-5 py-4.5"
        >
          <div
            className="flex h-11.5 w-11.5 items-center justify-center rounded-xl border border-accent-amber bg-accent-amber/20"
          >
            <Flame size={22} className="text-accent-amber" />
          </div>
          <div>
            <span className="text-xs font-semibold text-fg-muted">{loc.stats.totalPlays}</span>
            <div className="mt-0.5 text-xl font-extrabold text-accent-amber">
              {stats.totalPlays} {loc.stats.playsUnit}
            </div>
          </div>
        </div>

        {/* Rozmiar biblioteki */}
        <div
          className="glass-card flex items-center gap-3.5 rounded-2xl border border-accent-cyan/30 bg-card px-5 py-4.5"
        >
          <div
            className="flex h-11.5 w-11.5 items-center justify-center rounded-xl border border-accent-cyan bg-accent-cyan/20"
          >
            <Music size={22} className="text-accent-cyan" />
          </div>
          <div>
            <span className="text-xs font-semibold text-fg-muted">{loc.stats.librarySize}</span>
            <div className="mt-0.5 text-xl font-extrabold text-fg">
              {stats.totalTracks} <span className="text-sm text-fg-muted">{loc.stats.tracksUnit}</span>
            </div>
          </div>
        </div>

        {/* Udział Hi-Res */}
        <div
          className="glass-card flex items-center gap-3.5 rounded-2xl border border-accent-pink/30 bg-card px-5 py-4.5"
        >
          <div
            className="flex h-11.5 w-11.5 items-center justify-center rounded-xl border border-accent-pink bg-accent-pink/20"
          >
            <Sparkles size={22} className="text-accent-pink" />
          </div>
          <div>
            <span className="text-xs font-semibold text-fg-muted">{loc.stats.hiResShare}</span>
            <div className="mt-0.5 text-xl font-extrabold text-accent-pink">
              {stats.hiResCount} <span className="text-sm text-fg-muted">{loc.stats.hiResSubtitle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Środkowa Sekcja: Top Utwory & Top Wykonawcy */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-4.5">
        {/* Kolumna 1: Top 5 Utworów */}
        <div className="glass-panel rounded-2xl px-5.5 py-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h4 className="m-0 flex items-center gap-2 text-md font-bold text-fg">
              <Flame size={17} className="text-accent-amber" /> {loc.stats.topTracks}
            </h4>
            <span className="text-xs text-fg-muted">TOP 5</span>
          </div>

          {stats.topTracks.length === 0 ? (
            <div className="p-6 text-center text-ui text-fg-muted">
              {loc.stats.topTracksEmpty}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.topTracks.map((t, idx) => (
                <div
                  key={t.id}
                  className="glass-card flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-white/3 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-6 text-center text-base">
                      {medalEmojis[idx]}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-fg">
                        {t.title}
                      </div>
                      <div className="text-xs text-fg-secondary">
                        {t.artist}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      onClick={() => onOpenStatsModal(t)}
                      className="cursor-pointer rounded-xl bg-accent-amber/15 px-2 py-1 text-xs font-bold text-accent-amber"
                      title={loc.stats.viewTrackStatsTooltip}
                    >
                      🔥 {t.play_count}x
                    </span>
                    <button
                      onClick={() => onPlayTrack(t)}
                      title={loc.stats.playTrackTooltip}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-accent-gradient text-on-accent"
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
        <div className="glass-panel rounded-2xl px-5.5 py-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h4 className="m-0 flex items-center gap-2 text-md font-bold text-fg">
              <Mic2 size={17} className="text-accent-purple" /> {loc.stats.topArtists}
            </h4>
            <span className="text-xs text-fg-muted">TOP 5</span>
          </div>

          {stats.topArtists.length === 0 ? (
            <div className="p-6 text-center text-ui text-fg-muted">
              {loc.stats.topArtistsEmpty}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.topArtists.map((a, idx) => (
                <div
                  key={a.artist}
                  className="glass-card flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-white/3 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-135 from-accent-purple to-accent-cyan text-ui font-bold text-on-accent"
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-fg">
                        {a.artist}
                      </div>
                      <div className="text-xs text-fg-secondary">
                        {getTracksInLibraryText(a.tracks)}
                      </div>
                    </div>
                  </div>

                  <span className="rounded-xl bg-accent-purple/15 px-2 py-1 text-xs font-bold text-accent-purple">
                    🔥 {a.plays} {loc.stats.playsUnit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dolna Sekcja: Rozkład Formatów & Ostatnio Odtwarzane */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-4.5">
        {/* Rozkład Kodeków / Formatów */}
        <div className="glass-panel rounded-2xl px-5.5 py-5">
          <h4 className="mx-0 mt-0 mb-3.5 flex items-center gap-2 text-md font-bold text-fg">
            <Disc size={17} className="text-accent-cyan" /> {loc.stats.formatBreakdown}
          </h4>
          <div className="flex flex-col gap-2.5">
            {stats.formatBreakdown.map((item) => (
              <div key={item.format}>
                <div className="mb-1 flex justify-between text-ui">
                  <span className="font-mono font-bold text-fg">
                    {item.format}
                  </span>
                  <span className="text-fg-muted">
                    {item.count} {loc.stats.tracksUnit} ({item.percent}%)
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-white/8">
                  <div
                    className={cn(
                      'h-full rounded-sm',
                      item.format === 'FLAC' ? 'bg-linear-to-r from-accent-cyan to-accent-purple' : item.format === 'MP3' ? 'bg-accent-pink' : 'bg-accent-amber',
                    )}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ostatnio Odtwarzane Utwory */}
        <div className="glass-panel rounded-2xl px-5.5 py-5">
          <h4 className="mx-0 mt-0 mb-3.5 flex items-center gap-2 text-md font-bold text-fg">
            <Clock size={17} className="text-accent-pink" /> {loc.stats.recentTracks}
          </h4>
          {stats.recentTracks.length === 0 ? (
            <div className="p-6 text-center text-ui text-fg-muted">
              {loc.stats.recentTracksEmpty}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.recentTracks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg bg-white/2 px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-ui font-semibold text-fg">
                      {t.title}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {t.artist}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-accent-cyan">
                      {formatRelativeTime(t.last_played_at)}
                    </span>
                    <button
                      onClick={() => onPlayTrack(t)}
                      title={loc.stats.playTrackTooltip}
                      className="border-0 bg-transparent p-1 text-accent-pink"
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
