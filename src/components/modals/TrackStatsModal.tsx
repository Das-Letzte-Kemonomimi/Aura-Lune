import React, { useId, useState } from 'react';
import { Flame, Clock, BarChart3, RefreshCw, RotateCcw } from '../ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { formatTime, formatRelativeTime as formatRelativeTimeBase } from '../../utils/timeFormat';
import { cn } from '../../utils/cn';
import { textTones } from '../ui/tones';
import { Button, Card, ModalBody, ModalFooter, ModalHeader, ModalShell } from '../ui';

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
  const titleId = useId();

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
    <ModalShell onClose={onClose} layer="studio" size="md" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.player.statsTitle}
        subtitle={`${loc.player.trackStats} • ID #${track.id}`}
        icon={<BarChart3 size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-4">
        {/* Title and artist */}
        <div>
          <h3 className="mb-1 text-xl font-bold text-fg">{track.title}</h3>
          <p className="text-sm font-semibold text-accent-pink">
            {track.artist} {track.album ? `• ${track.album}` : ''}
          </p>
        </div>

        {/* Listening metric tiles */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile
            tone="amber"
            icon={<Flame size={14} />}
            label={loc.player.playCount}
            value={<span className="text-2xl">{track.play_count || 0}</span>}
            hint={track.play_count === 1 ? loc.trackStatsModal.singlePlay : `${track.play_count || 0} ${loc.player.plays}`}
          />
          <StatTile
            tone="purple"
            icon={<Clock size={14} />}
            label={loc.trackStatsModal.totalTime}
            value={formatTotalTime(totalListenedMs)}
            hint={loc.trackStatsModal.trackDuration.replace('{t}', formatTime(track.duration_ms))}
          />
          <StatTile
            tone="cyan"
            icon={<RefreshCw size={14} />}
            label={loc.player.lastPlayed}
            value={formatRelativeTime(track.last_played_at)}
            hint={formatDate(track.last_played_at)}
          />
        </div>

        {/* Technical details and file path */}
        <Card padding="sm" className="flex flex-col gap-2 text-ui">
          <div className="flex justify-between border-b border-line pb-1.5">
            <span className="text-fg-muted">{loc.trackStatsModal.formatCodec}</span>
            <span className="font-mono font-bold text-accent-cyan">
              {track.format} {track.bit_depth ? `• ${track.bit_depth}-bit` : ''} • {Math.round(track.sample_rate / 1000)} kHz
            </span>
          </div>
          <div className="flex justify-between border-b border-line pb-1.5">
            <span className="text-fg-muted">{loc.trackStatsModal.audioChannels}</span>
            <span className="font-semibold text-fg">
              {track.channels === 2 ? loc.trackStatsModal.stereoChannels : `${track.channels} ch`}
            </span>
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-fg-muted">{loc.trackStatsModal.filePath}</span>
            <span className="font-mono text-xs break-all text-fg-secondary">{track.path}</span>
          </div>
        </Card>
      </ModalBody>

      <ModalFooter className="justify-between">
        {onResetPlays && (track.play_count || 0) > 0 ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onResetPlays(track.id)}
            title={loc.trackStatsModal.resetPlaysTooltip}
          >
            <RotateCcw size={13} />
            {loc.player.resetStats}
          </Button>
        ) : (
          <div />
        )}
        <Button variant="primary" onClick={onClose}>
          {loc.settings.close}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};

const tileBorder: Record<'amber' | 'purple' | 'cyan', string> = {
  amber: 'border-accent-amber',
  purple: 'border-accent-purple',
  cyan: 'border-accent-cyan',
};

/** One listening metric: a tinted label, a value and a hint line. */
function StatTile({
  tone,
  icon,
  label,
  value,
  hint,
}: {
  tone: 'amber' | 'purple' | 'cyan';
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <Card padding="none" className={cn('flex flex-col gap-1 border-l-3 p-3.5', tileBorder[tone])}>
      <div className={cn('flex items-center gap-1.5 text-xs font-bold uppercase', textTones[tone])}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="my-1 text-md font-extrabold text-fg">{value}</div>
      <span className="truncate text-xxs text-fg-muted">{hint}</span>
    </Card>
  );
}
