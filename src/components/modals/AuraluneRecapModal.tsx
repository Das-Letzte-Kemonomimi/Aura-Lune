import React, { useEffect, useId, useState } from 'react';
import {
  Flame,
  Clock,
  Music,
  User,
  Sparkles,
  Trophy,
  Play,
} from '../ui/icons';
import { invoke } from '../../api/ipc';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { cn } from '../../utils/cn';
import { Badge, Button, ModalBody, ModalFooter, ModalHeader, ModalShell, SegmentedControl } from '../ui';

interface TopTrackDto {
  id: number;
  title: string;
  artist: string;
  album?: string;
  play_count: number;
  total_time_ms: number;
  total_play_time_ms?: number;
}

interface TopArtistDto {
  artist: string;
  play_count: number;
  total_time_ms: number;
}

interface RecapSummaryDto {
  period: string;
  total_listening_seconds?: number;
  total_listened_ms?: number;
  total_tracks_played?: number;
  tracks_played_count?: number;
  top_tracks: TopTrackDto[];
  /** Older builds sent `[artist, total_ms]` pairs; both shapes are accepted. */
  top_artists: Array<TopArtistDto | [string, number]>;
}

interface AuraluneRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayTrackId?: (id: number) => void;
  currentLang: Language;
}

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: readonly Period[] = ['week', 'month', 'year', 'all'];

export const AuraluneRecapModal: React.FC<AuraluneRecapModalProps> = ({
  isOpen,
  onClose,
  onPlayTrackId,
  currentLang,
}) => {
  const titleId = useId();
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState<boolean>(true);
  const [recapData, setRecapData] = useState<RecapSummaryDto | null>(null);

  const loc = getTranslations(currentLang);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    invoke<RecapSummaryDto>('get_recap_summary', { period })
      .then((data) => {
        if (isMounted) {
          setRecapData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch Auralune Recap:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, period]);

  if (!isOpen) return null;

  const formatHoursMins = (totalSec: number) => {
    if (isNaN(totalSec) || totalSec == null || totalSec <= 0) {
      return '0 min';
    }
    const sec = Math.floor(totalSec);
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const formatTrackMs = (ms: number) => {
    if (isNaN(ms) || ms == null || ms <= 0) return '';
    const sec = Math.floor(ms / 1000);
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${mins}:${remSec < 10 ? '0' : ''}${remSec}`;
  };

  const periodLabels: Record<Period, string> = {
    week: loc.recapModal.period7d,
    month: loc.recapModal.period30d,
    year: loc.recapModal.period365d,
    all: loc.recapModal.periodAll,
  };

  return (
    <ModalShell onClose={onClose} layer="top" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={
          <span className="flex items-center gap-2">
            Auralune Recap
            <Badge tone="pink">WRAPPED</Badge>
          </span>
        }
        subtitle={loc.recapModal.subtitle}
        icon={<Flame size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
        actions={
          <SegmentedControl
            label="Period"
            size="sm"
            items={PERIODS.map((p) => ({ value: p, label: periodLabels[p] }))}
            value={period}
            onChange={setPeriod}
          />
        }
      />

      <ModalBody className="flex flex-col gap-5">
      {/* Computed and normalised statistics */}
      {(() => {
        const totalSeconds =
          recapData?.total_listening_seconds ??
          (recapData?.total_listened_ms != null ? Math.round(recapData.total_listened_ms / 1000) : 0);

        const totalTracks =
          recapData?.total_tracks_played ??
          recapData?.tracks_played_count ??
          0;

        const normalizedTracks: TopTrackDto[] = (recapData?.top_tracks || []).map((t) => ({
          id: t.id,
          title: t.title || 'Unknown Title',
          artist: t.artist || 'Unknown Artist',
          album: t.album,
          play_count: t.play_count ?? 0,
          total_time_ms: t.total_time_ms ?? t.total_play_time_ms ?? 0,
        }));

        const normalizedArtists: TopArtistDto[] = (recapData?.top_artists || [])
          .map((item) => {
            if (Array.isArray(item)) {
              return {
                artist: String(item[0] || ''),
                play_count: typeof item[1] === 'number' ? Math.max(1, Math.round(item[1] / 180000)) : 1,
                total_time_ms: typeof item[1] === 'number' ? item[1] : 0,
              };
            }
            return {
              artist: item.artist || '',
              play_count:
                item.play_count ??
                (item.total_time_ms ? Math.max(1, Math.round(item.total_time_ms / 180000)) : 0),
              total_time_ms: item.total_time_ms ?? 0,
            };
          })
          .filter((a) => Boolean(a.artist));

        const hasData =
          Boolean(recapData) &&
          (totalSeconds > 0 || totalTracks > 0 || normalizedTracks.length > 0 || normalizedArtists.length > 0);

        if (loading) {
          return (
            <div className="px-0 py-15 text-center text-fg-muted">
              <Sparkles size={28} className="mx-auto mt-0 mb-3 animate-spin" />
              <div>{loc.recapModal.generating}</div>
            </div>
          );
        }

        if (!hasData) {
          return (
            <div className="rounded-2xl border border-dashed border-line bg-white/2 px-5 py-12 text-center">
              <Music size={36} className="mx-auto mt-0 mb-3 text-fg-muted" />
              <h3 className="mx-0 mt-0 mb-1.5 text-base font-bold">
                {loc.recapModal.noHistory}
              </h3>
              <p className="m-0 mx-auto max-w-105 text-ui text-fg-muted">
                {loc.recapModal.noHistoryDesc}
              </p>
            </div>
          );
        }

        return (
          <>
            {/* Main counter tiles */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Total time */}
              <div
                className="flex items-center gap-4 rounded-2xl border border-accent-pink/35 bg-linear-135 from-accent-pink/15 to-accent-purple/10 p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-pink/25">
                  <Clock size={24} className="text-accent-pink" />
                </div>
                <div>
                  <div className="text-ui font-semibold text-fg-muted">
                    {loc.recapModal.totalTimeSpent}
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-fg">
                    {formatHoursMins(totalSeconds)}
                  </div>
                </div>
              </div>

              {/* Tracks listened to */}
              <div
                className="flex items-center gap-4 rounded-2xl border border-accent-cyan/35 bg-linear-135 from-accent-cyan/15 to-blue-500/10 p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-cyan/25">
                  <Music size={24} className="text-accent-cyan" />
                </div>
                <div>
                  <div className="text-ui font-semibold text-fg-muted">
                    {loc.recapModal.tracksPlayed}
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-fg">
                    {totalTracks}
                  </div>
                </div>
              </div>
            </div>

            {/* Top tracks ranking */}
            {normalizedTracks.length > 0 && (
              <div className="rounded-2xl border border-line bg-white/3 p-4.5">
                <div className="mb-3.5 flex items-center gap-2">
                  <Trophy size={18} className="text-accent-amber" />
                  <span className="text-sm font-bold">
                    {loc.recapModal.topTracks}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {normalizedTracks.map((track, index) => {
                    const isTop1 = index === 0;
                    return (
                      <div
                        key={track.id}
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-3.5 py-2.5',
                          isTop1 ? 'bg-linear-to-r from-accent-pink/20 to-white/3' : 'bg-white/2',
                          isTop1 ? 'border-accent-pink/35' : 'border-transparent',
                        )}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span
                            className={cn(
                              'w-5 text-center text-sm font-extrabold',
                              isTop1 ? 'text-accent-amber' : 'text-fg-muted',
                            )}
                          >
                            #{index + 1}
                          </span>

                          <div className="overflow-hidden">
                            <div className="truncate text-sm font-bold text-fg">
                              {track.title}
                            </div>
                            <div className="truncate text-xs text-fg-secondary">
                              {track.artist}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3.5">
                          <div className="text-right">
                            <div className="text-ui font-bold text-accent-cyan">
                              {track.play_count} {loc.recapModal.plays}
                            </div>
                            {track.total_time_ms > 0 && (
                              <div className="text-xxs text-fg-muted">
                                {formatTrackMs(track.total_time_ms)}
                              </div>
                            )}
                          </div>

                          {onPlayTrackId && (
                            <button
                              onClick={() => onPlayTrackId(track.id)}
                              className="flex h-7.5 w-7.5 items-center justify-center rounded-full border border-accent-pink/40 bg-accent-pink/25 text-fg"
                            >
                              <Play size={12} className="ml-0.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top artists ranking */}
            {normalizedArtists.length > 0 && (
              <div className="rounded-2xl border border-line bg-white/3 p-4.5">
                <div className="mb-3 flex items-center gap-2">
                  <User size={18} className="text-accent-purple" />
                  <span className="text-sm font-bold">
                    {loc.recapModal.topArtists}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {normalizedArtists.map((artist, idx) => (
                    <div
                      key={`${artist.artist}-${idx}`}
                      className="flex items-center gap-2 rounded-xl border border-accent-purple/30 bg-accent-purple/10 px-3.5 py-2"
                    >
                      <span className="text-xs font-extrabold text-accent-purple">
                        #{idx + 1}
                      </span>
                      <span className="text-ui font-bold text-fg">
                        {artist.artist}
                      </span>
                      {artist.play_count > 0 && (
                        <span className="text-xs text-fg-muted">
                          ({artist.play_count} {loc.recapModal.plays})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose}>{loc.common.close}</Button>
      </ModalFooter>
    </ModalShell>
  );
};
