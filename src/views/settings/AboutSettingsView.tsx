import React from 'react';
import { openExternalUrl } from '../../api/ipc';
import { Activity, AlertTriangle, History, Music, HeartHandshake, ExternalLink } from '../../components/ui/icons';
import { Badge, Button, Callout, Kbd, SettingRow, SettingsGroup, type ToneOrNeutral } from '../../components/ui';
import { textTones } from '../../components/ui/tones';
import { type Language, type Translations } from '../../i18n';
import type { BuildInfo } from '../../types/updates';
import { cn } from '../../utils/cn';
import rawReleases from '../../data/changelog.json';
import { SettingsPage } from './SettingsPage';

const DEFAULT_AUTHOR = 'Das Letzte Kemonomimi';

/** Byline for the running version, read from the changelog (the single source of truth for credits). */
const resolveAuthor = (version: string): string => {
  const releases: { version: string; author?: string }[] = rawReleases;
  const release = releases.find((r) => r.version === version) ?? releases[0];
  return release?.author || DEFAULT_AUTHOR;
};

export interface AboutSettingsViewProps {
  appIconStyle: 'lineout' | 'classic';
  appVersion: string;
  buildInfo: BuildInfo | null;
  language: Language;
  loc: Translations;
  onOpenHealthCheck: () => void;
  onOpenChangelog: () => void;
}

export const AboutSettingsView: React.FC<AboutSettingsViewProps> = ({
  appIconStyle,
  appVersion,
  buildInfo,
  language: _language,
  loc,
  onOpenHealthCheck,
  onOpenChangelog,
}) => {
  const handleOpenExternalUrl = async (url: string) => {
    try {
      await openExternalUrl(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  const techCards: { label: string; value: string; desc: string; tone: ToneOrNeutral }[] = [
    { label: loc.settings.aboutAudioEngine, value: 'GStreamer + PipeWire Pro Audio', desc: loc.settings.aboutAudioEngineDesc, tone: 'neutral' },
    { label: loc.settings.aboutDsp, value: 'SoundTouch & Rubber Band', desc: loc.settings.aboutDspDesc, tone: 'cyan' },
    { label: loc.settings.aboutLibrary, value: 'SQLite (sqlx) + Cover Art Archive', desc: loc.settings.aboutLibraryDesc, tone: 'purple' },
    { label: loc.settings.aboutLicense, value: 'GPL-3.0-or-later', desc: loc.settings.aboutLicenseDesc, tone: 'green' },
  ];

  const shortcuts = [
    { key: 'Space', desc: loc.shortcuts.playPause },
    { key: '← / →', desc: loc.shortcuts.seekFwdBack },
    { key: 'Ctrl + ← / →', desc: `${loc.shortcuts.prevTrack} / ${loc.shortcuts.nextTrack}` },
    { key: '↑ / ↓', desc: loc.shortcuts.volUpDown },
    { key: 'M', desc: loc.shortcuts.muteUnmute },
    { key: 'N / P', desc: `${loc.shortcuts.nextTrack} / ${loc.shortcuts.prevTrack}` },
    { key: 'Q', desc: loc.nav.queue },
    { key: 'F / Ctrl+F', desc: loc.library.searchPlaceholder },
    { key: '1, 2, 3, 4', desc: `${loc.nav.nowPlaying}, ${loc.nav.library}, ${loc.nav.playlists}, ${loc.nav.dsp}` },
    { key: 'Esc', desc: loc.common.close },
  ];

  return (
    <SettingsPage>
      {/* Compact hero */}
      <div className="flex flex-wrap items-center gap-4">
        <img
          src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
          alt="Auralune Logo"
          className="size-16 rounded-2xl border border-line bg-black/30 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold">
            <span>Auralune</span>
            <Badge mono>v{appVersion}</Badge>
          </h3>
          <p className="mt-0.5 text-ui text-fg-secondary">
            {loc.settings.version} {appVersion}
            {buildInfo ? ` (${buildInfo.channel} • ${buildInfo.commit_short})` : ''} • {loc.settings.author}:{' '}
            {resolveAuthor(appVersion)}
          </p>
          <p className="mt-1 text-xs leading-normal text-fg-muted">
            Linux High-Fidelity DSP & PipeWire Audio Engine • Extensible foobar2000-like flexibility, anime aesthetics &
            real-time pitch/tempo modulation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onOpenHealthCheck}>
            <Activity size={14} />
            {loc.healthCheck.title}
          </Button>
          <Button size="sm" onClick={onOpenChangelog}>
            <History size={14} />
            {loc.settings.changelog}
          </Button>
        </div>
      </div>

      {/* Creator links: Bandcamp & the Sorta app for AuDHD / ADHD */}
      <SettingsGroup label={loc.settings.group.links}>
        <SettingRow
          compact
          icon={<Music size={18} />}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {loc.settings.aboutBandcampTitle}
              <Badge tone="purple">Bandcamp</Badge>
            </span>
          }
          description={loc.settings.aboutBandcampDesc}
          control={
            <Button
              size="sm"
              onClick={() => handleOpenExternalUrl('https://dasletztekemonomimi.bandcamp.com/track/skrzyd-a-bia-e')}
            >
              <ExternalLink size={14} />
              {loc.settings.aboutBandcampBtn}
            </Button>
          }
        />
        <SettingRow
          compact
          icon={<HeartHandshake size={18} />}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {loc.settings.aboutSortaTitle}
              <Badge tone="cyan">AuDHD</Badge>
            </span>
          }
          description={loc.settings.aboutSortaDesc}
          control={
            <Button size="sm" onClick={() => handleOpenExternalUrl('https://sortaofficial.lovable.app/')}>
              <ExternalLink size={14} />
              {loc.settings.aboutSortaBtn}
            </Button>
          }
        />
      </SettingsGroup>

      <SettingsGroup label={loc.settings.group.builtWith}>
        {techCards.map((card) => (
          <SettingRow
            key={card.label}
            compact
            title={card.label}
            description={card.desc}
            control={
              <span className={cn('font-mono text-xs font-semibold', card.tone === 'neutral' ? 'text-fg' : textTones[card.tone])}>
                {card.value}
              </span>
            }
          />
        ))}
      </SettingsGroup>

      {/* Keyboard shortcuts */}
      <SettingsGroup label={loc.shortcuts.title}>
        <div className="@container">
          <ul className="grid grid-cols-1 @xl:grid-cols-2">
            {shortcuts.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-ui first:border-t-0 @xl:nth-[2]:border-t-0"
              >
                <span className="text-fg-secondary">{item.desc}</span>
                <Kbd>{item.key}</Kbd>
              </li>
            ))}
          </ul>
        </div>
      </SettingsGroup>

      {/* Disclaimer / no warranty */}
      <Callout tone="amber" icon={<AlertTriangle size={18} />}>
        <h4 className="mb-1.5 text-md font-extrabold text-accent-amber">{loc.settings.disclaimerTitle}</h4>
        <p className="text-ui leading-relaxed text-fg-secondary">{loc.settings.disclaimerBody}</p>
      </Callout>
    </SettingsPage>
  );
};
