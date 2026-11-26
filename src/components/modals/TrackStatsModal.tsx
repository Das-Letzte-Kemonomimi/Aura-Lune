import React, { useState } from 'react';
import { Flame, Clock, BarChart3, RefreshCw, X, RotateCcw } from 'lucide-react';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { formatTime, formatRelativeTime as formatRelativeTimeBase } from '../../utils/timeFormat';
import { ModalShell } from '../ui';

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
  const [currentTimestamp] = useState(() => Math.floor(Date.now() / 1000));

  if (!track) return null;

  const loc = getTranslations(currentLang);

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

  const formatRelativeTime = (timestamp?: number | null) =>
    formatRelativeTimeBase(
      timestamp,
      {
        never: loc.player.neverPlayed,
        justNow: loc.stats.relativeJustNow,
        minutesAgo: loc.stats.relativeMinutesAgo,
        hoursAgo: loc.stats.relativeHoursAgo,
        daysAgo: loc.stats.relativeDaysAgo,
        oneDayAgo: loc.stats.relativeOneDayAgo,
      },
      currentTimestamp,
    );

  const totalListenedMs = (track.play_count || 0) * track.duration_ms;

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-w-140 flex-col overflow-hidden rounded-2xl border border-line-accent shadow-2xl shadow-black/70"
    >
      {/* Nagłówek modala */}
      <div className="flex items-center justify-between border-b border-white/8 bg-white/2 px-6 py-4.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient shadow-lg shadow-accent-pink/40"
          >
            <BarChart3 size={18} className="text-fg" />
          </div>
          <div>
            <h3 className="m-0 text-lg font-extrabold text-fg">
              {loc.player.statsTitle}
            </h3>
            <span className="text-xs text-fg-muted">
              {loc.player.trackStats} • ID #{track.id}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border-0 bg-transparent p-1.5 text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* Zawartość statystyk */}
      <div className="flex flex-col gap-4.5 p-6">
        {/* Tytuł i wykonawca */}
        <div>
          <h4 className="mx-0 mt-0 mb-1 text-xl font-bold text-fg">
            {track.title}
          </h4>
          <p className="m-0 text-sm font-semibold text-accent-pink">
            {track.artist} {track.album ? `• ${track.album}` : ''}
          </p>
        </div>

        {/* Kafelki metryk odsłuchu */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Licznik odtworzeń */}
          <div className="glass-card flex flex-col gap-1 border-l-3 border-accent-amber p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-accent-amber uppercase">
              <Flame size={14} />
              <span>{loc.player.playCount}</span>
            </div>
            <div className="mx-0 my-0.5 text-2xl font-extrabold text-fg">
              {track.play_count || 0}
            </div>
            <span className="text-xxs text-fg-muted">
              {track.play_count === 1 ? loc.trackStatsModal.singlePlay : `${track.play_count || 0} ${loc.player.plays}`}
            </span>
          </div>

          {/* Łączny czas odsłuchu */}
          <div className="glass-card flex flex-col gap-1 border-l-3 border-accent-purple p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-accent-purple uppercase">
              <Clock size={14} />
              <span>{loc.trackStatsModal.totalTime}</span>
            </div>
            <div className="mx-0 my-1 text-lg font-extrabold text-fg">
              {formatTotalTime(totalListenedMs)}
            </div>
            <span className="text-xxs text-fg-muted">
              {loc.trackStatsModal.trackDuration.replace('{t}', formatTime(track.duration_ms))}
            </span>
          </div>

          {/* Ostatnio odtwarzano */}
          <div className="glass-card flex flex-col gap-1 border-l-3 border-accent-cyan p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-accent-cyan uppercase">
              <RefreshCw size={14} />
              <span>{loc.player.lastPlayed}</span>
            </div>
            <div className="mx-0 my-1.5 text-md font-bold text-fg">
              {formatRelativeTime(track.last_played_at)}
            </div>
            <span className="truncate text-xxs text-fg-muted">
              {formatDate(track.last_played_at)}
            </span>
          </div>
        </div>

        {/* Szczegóły techniczne i ścieżka pliku */}
        <div className="glass-card flex flex-col gap-2 px-4.5 py-3.5 text-ui">
          <div className="flex justify-between border-b border-white/5 pb-1.5">
            <span className="text-fg-muted">{loc.trackStatsModal.formatCodec}</span>
            <span className="font-mono font-bold text-accent-cyan">
              {track.format} {track.bit_depth ? `• ${track.bit_depth}-bit` : ''} • {Math.round(track.sample_rate / 1000)} kHz
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1.5">
            <span className="text-fg-muted">{loc.trackStatsModal.audioChannels}</span>
            <span className="font-semibold text-fg">
              {track.channels === 2 ? loc.trackStatsModal.stereoChannels : `${track.channels} ch`}
            </span>
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-fg-muted">{loc.trackStatsModal.filePath}</span>
            <span className="font-mono text-xs break-all text-fg-secondary">
              {track.path}
            </span>
          </div>
        </div>
      </div>

      {/* Dolny pasek akcji */}
      <div className="flex items-center justify-between border-t border-white/8 bg-black/30 px-6 py-3.5">
        {onResetPlays && (track.play_count || 0) > 0 ? (
          <button
            onClick={() => onResetPlays(track.id)}
            className="flex items-center gap-1.5 rounded-lg border border-accent-red/30 bg-accent-red/15 px-3 py-1.5 text-xs font-semibold text-accent-red"
            title={loc.trackStatsModal.resetPlaysTooltip}
          >
            <RotateCcw size={13} />
            {loc.player.resetStats}
          </button>
        ) : <div />}

        <button
          onClick={onClose}
          className="rounded-lg border-0 bg-linear-135 from-accent-purple to-accent-pink px-4.5 py-2 text-ui font-bold text-on-accent"
        >
          {loc.settings.close}
        </button>
      </div>
    </ModalShell>
  );
};
