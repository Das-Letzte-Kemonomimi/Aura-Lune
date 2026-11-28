import type { AlbumRecord, TrackRecord } from '../../types/library';
import React, { useMemo } from 'react';
import { BarChart3, Flame, Clock, Music, Disc, Mic2, Sparkles, Play, Medal } from '../../components/ui/icons';
import type { Language } from '../../i18n';
import { getTranslations } from '../../i18n';
import { formatRelativeTime as formatRelativeTimeBase } from '../../utils/timeFormat';
import { cn } from '../../utils/cn';
import { Badge, Button, Card, IconButton, PageHeader, ProgressBar, SectionHeader, type Tone } from '../../components/ui';
import { iconTileTones } from '../../components/ui/tones';
import { computeLibraryStats, countForm } from './statsModel';

export interface StatsDashboardViewProps {
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  currentLang: Language;
  onPlayTrack: (track: TrackRecord) => void;
  onOpenStatsModal: (track: TrackRecord) => void;
  onOpenRecapModal?: () => void;
}

const MEDAL_TONES = ['text-accent-amber', 'text-fg-secondary', 'text-accent-amber/55'];

/** Bar colour of each format in the format breakdown. */
const formatTone = (format: string): Tone => (format === 'FLAC' ? 'cyan' : format === 'MP3' ? 'pink' : 'amber');

/** One of the four key figures under the banner. */
function KpiCard({ tone, icon, label, children }: { tone: Tone; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Card padding="none" className="flex items-center gap-3.5 rounded-2xl px-5 py-4.5">
      <div className={cn('flex size-11.5 shrink-0 items-center justify-center rounded-xl', iconTileTones[tone])}>{icon}</div>
      <div className="min-w-0">
        <span className="block truncate text-xs font-semibold text-fg-muted">{label}</span>
        <div className="mt-0.5 text-xl font-extrabold text-fg wrap-break-word">{children}</div>
      </div>
    </Card>
  );
}

/** A dashboard panel: heading with an optional right-hand note, then its content. */
function StatsPanel({ icon, tone, title, aside, children }: {
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="panel" padding="none" className="px-5.5 py-5">
      <SectionHeader as="h3" className="mb-3.5" icon={icon} tone={tone} title={title} actions={aside} />
      {children}
    </Card>
  );
}

const PanelEmpty = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6 text-center text-ui text-fg-muted">{children}</div>
);

export const StatsDashboardView: React.FC<StatsDashboardViewProps> = ({
  tracks,
  albums,
  currentLang,
  onPlayTrack,
  onOpenStatsModal,
  onOpenRecapModal,
}) => {
  const loc = getTranslations(currentLang);
  const stats = useMemo(
    () => computeLibraryStats(tracks, albums, loc.stats.unknownArtist),
    [tracks, albums, loc.stats.unknownArtist],
  );

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

  const tracksInLibraryText = (count: number) => {
    const form = countForm(count);
    const text =
      form === 'one'
        ? loc.stats.tracksInLibrarySingle
        : form === 'few'
          ? loc.stats.tracksInLibraryFew
          : loc.stats.tracksInLibraryMany;
    return `${count} ${text}`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Title banner */}
      <Card variant="panel" padding="md" className="border-line-accent bg-linear-135 from-accent-purple/20 to-accent-pink/15">
        <PageHeader
          icon={<BarChart3 size={20} />}
          title={loc.stats.title}
          description={loc.stats.subtitle}
          actions={
            <>
              {onOpenRecapModal && (
                <Button variant="tinted" tone="pink" onClick={onOpenRecapModal} title={loc.nav.recapTitle || loc.nav.recap}>
                  <Sparkles size={14} /> {loc.nav.recap}
                </Button>
              )}
              <Badge tone="cyan" size="sm">
                <Sparkles size={14} /> {loc.stats.liveBadge}
              </Badge>
            </>
          }
        />
      </Card>

      {/* 4 key metric cards (KPI) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(55),1fr))] gap-3.5">
        <KpiCard tone="purple" icon={<Clock size={22} />} label={loc.stats.totalListenTime}>
          {formatTotalTime(stats.totalListenedMs)}
        </KpiCard>
        <KpiCard tone="amber" icon={<Flame size={22} />} label={loc.stats.totalPlays}>
          <span className="text-accent-amber">
            {stats.totalPlays} {loc.stats.playsUnit}
          </span>
        </KpiCard>
        <KpiCard tone="cyan" icon={<Music size={22} />} label={loc.stats.librarySize}>
          {stats.totalTracks} <span className="text-sm text-fg-muted">{loc.stats.tracksUnit}</span>
        </KpiCard>
        <KpiCard tone="pink" icon={<Sparkles size={22} />} label={loc.stats.hiResShare}>
          <span className="text-accent-pink">{stats.hiResCount}</span>{' '}
          <span className="text-sm text-fg-muted">{loc.stats.hiResSubtitle}</span>
        </KpiCard>
      </div>

      {/* Middle section: top tracks & top artists */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(76),1fr))] gap-4.5">
        <StatsPanel icon={<Flame size={16} />} tone="amber" title={loc.stats.topTracks} aside={<Badge>TOP 5</Badge>}>
          {stats.topTracks.length === 0 ? (
            <PanelEmpty>{loc.stats.topTracksEmpty}</PanelEmpty>
          ) : (
            <ol className="flex list-none flex-col gap-2 p-0">
              {stats.topTracks.map((t, idx) => (
                <li key={t.id}>
                  <Card variant="inset" padding="none" className="flex items-center justify-between gap-2.5 px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex w-6 justify-center text-base text-fg-muted">
                        {idx < MEDAL_TONES.length ? (
                          <Medal size={18} className={MEDAL_TONES[idx]} aria-label={`#${idx + 1}`} />
                        ) : (
                          `${idx + 1}.`
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-fg">{t.title}</div>
                        <div className="truncate text-xs text-fg-secondary">{t.artist}</div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <Button
                        variant="tinted"
                        tone="amber"
                        size="sm"
                        onClick={() => onOpenStatsModal(t)}
                        title={loc.stats.viewTrackStatsTooltip}
                      >
                        <Flame size={12} /> {t.play_count}x
                      </Button>
                      <IconButton
                        size="sm"
                        label={loc.stats.playTrackTooltip}
                        onClick={() => onPlayTrack(t)}
                        className="rounded-full bg-accent-gradient text-on-accent hover:text-on-accent"
                      >
                        <Play size={12} fill="currentColor" />
                      </IconButton>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </StatsPanel>

        <StatsPanel icon={<Mic2 size={16} />} tone="purple" title={loc.stats.topArtists} aside={<Badge>TOP 5</Badge>}>
          {stats.topArtists.length === 0 ? (
            <PanelEmpty>{loc.stats.topArtistsEmpty}</PanelEmpty>
          ) : (
            <ol className="flex list-none flex-col gap-2 p-0">
              {stats.topArtists.map((a, idx) => (
                <li key={a.artist}>
                  <Card variant="inset" padding="none" className="flex items-center justify-between gap-2.5 px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-135 from-accent-purple to-accent-cyan text-ui font-bold text-on-accent">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-fg">{a.artist}</div>
                        <div className="truncate text-xs text-fg-secondary">{tracksInLibraryText(a.tracks)}</div>
                      </div>
                    </div>

                    <Badge tone="purple" size="sm" className="font-bold">
                      <Flame size={12} /> {a.plays} {loc.stats.playsUnit}
                    </Badge>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </StatsPanel>
      </div>

      {/* Bottom section: format distribution & recently played */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(90),1fr))] gap-4.5">
        <StatsPanel icon={<Disc size={16} />} tone="cyan" title={loc.stats.formatBreakdown}>
          <div className="flex flex-col gap-2.5">
            {stats.formatBreakdown.map((item) => (
              <div key={item.format}>
                <div className="mb-1 flex justify-between gap-2 text-ui">
                  <span className="font-mono font-bold text-fg">{item.format}</span>
                  <span className="shrink-0 text-fg-muted">
                    {item.count} {loc.stats.tracksUnit} ({item.percent}%)
                  </span>
                </div>
                <ProgressBar value={item.percent} tone={formatTone(item.format)} label={item.format} />
              </div>
            ))}
          </div>
        </StatsPanel>

        <StatsPanel icon={<Clock size={16} />} tone="pink" title={loc.stats.recentTracks}>
          {stats.recentTracks.length === 0 ? (
            <PanelEmpty>{loc.stats.recentTracksEmpty}</PanelEmpty>
          ) : (
            <div className="flex flex-col gap-2">
              {stats.recentTracks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/2 px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-ui font-semibold text-fg">{t.title}</div>
                    <div className="truncate text-xs text-fg-muted">{t.artist}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-accent-cyan">{formatRelativeTime(t.last_played_at)}</span>
                    <IconButton
                      size="sm"
                      label={loc.stats.playTrackTooltip}
                      onClick={() => onPlayTrack(t)}
                      className="text-accent-pink hover:text-accent-pink"
                    >
                      <Play size={13} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </StatsPanel>
      </div>
    </div>
  );
};
