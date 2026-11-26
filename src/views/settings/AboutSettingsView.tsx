import React from 'react';
import { invoke } from '../../api/ipc';
import { Activity, AlertTriangle, History, Music, HeartHandshake, ExternalLink, Keyboard } from '../../components/ui/icons';
import { Badge, Button, Callout, Card, Kbd, SectionHeader, SettingRow, type ToneOrNeutral } from '../../components/ui';
import { textTones } from '../../components/ui/tones';
import { type Language, type Translations } from '../../i18n';
import type { BuildInfo } from '../../types/updates';
import { cn } from '../../utils/cn';
import { SettingsPage } from './SettingsPage';

export interface AboutSettingsViewProps {
  appIconStyle: 'lineout' | 'classic';
  appVersion: string;
  buildInfo: BuildInfo | null;
  language: Language;
  loc: Translations;
  onOpenHealthCheck: () => void;
  onOpenChangelog: () => void;
  onOpenOnboarding: () => void;
}

export const AboutSettingsView: React.FC<AboutSettingsViewProps> = ({
  appIconStyle,
  appVersion,
  buildInfo,
  language: _language,
  loc,
  onOpenHealthCheck,
  onOpenChangelog,
  onOpenOnboarding,
}) => {
  const handleOpenExternalUrl = async (url: string) => {
    try {
      await invoke('open_external_url', { url });
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
      <Card padding="lg" className="flex items-center gap-5">
        <img
          src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
          alt="Auralune Logo"
          className={cn(
            'size-16 rounded-2xl border border-white/20 bg-black/30 object-contain shadow-halo-xl',
            appIconStyle === 'classic' ? 'p-0 shadow-accent-purple/55' : 'p-1 shadow-accent-pink/55',
          )}
        />
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-extrabold">
            <span>Auralune</span>
            <span className="text-lg text-accent-pink">狐 Kitsune</span>
            <Badge className="bg-accent-gradient text-on-accent">v{appVersion}</Badge>
          </h3>
          <p className="mt-1 text-sm font-bold text-accent-pink">
            {loc.settings.version} {appVersion}
            {buildInfo ? ` (${buildInfo.channel} • ${buildInfo.commit_short})` : ''} • {loc.settings.author}: Das Letzte
            Kemonomimi
          </p>
          <p className="mt-1.5 text-ui leading-normal text-fg-secondary">
            Linux High-Fidelity DSP & PipeWire Audio Engine • Extensible foobar2000-like flexibility, anime aesthetics &
            real-time pitch/tempo modulation.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button variant="tinted" tone="green" size="sm" onClick={onOpenHealthCheck}>
              <Activity size={13} />
              {loc.healthCheck.title}
            </Button>
            <Button variant="primary" size="sm" onClick={onOpenChangelog}>
              <History size={13} />
              {loc.settings.changelog}
            </Button>
          </div>
        </div>
      </Card>

      {/* Creator section: Bandcamp & the Sorta app for AuDHD / ADHD */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-3.5">
        <Card highlight="purple" className="flex flex-col justify-between gap-3.5">
          <SectionHeader
            icon={<Music size={18} />}
            tone="purple"
            title={
              <span className="flex flex-wrap items-center gap-2">
                {loc.settings.aboutBandcampTitle}
                <Badge tone="purple">Bandcamp</Badge>
              </span>
            }
            description={loc.settings.aboutBandcampDesc}
          />
          <Button
            variant="primary"
            onClick={() => handleOpenExternalUrl('https://dasletztekemonomimi.bandcamp.com/track/skrzyd-a-bia-e')}
          >
            <ExternalLink size={14} />
            {loc.settings.aboutBandcampBtn}
          </Button>
        </Card>

        <Card highlight="cyan" className="flex flex-col justify-between gap-3.5">
          <SectionHeader
            icon={<HeartHandshake size={18} />}
            tone="cyan"
            title={
              <span className="flex flex-wrap items-center gap-2">
                Sorta • AuDHD & ADHD Focus
                <Badge tone="cyan">AuDHD</Badge>
              </span>
            }
            description={loc.settings.aboutSortaDesc}
          />
          <Button variant="primary" onClick={() => handleOpenExternalUrl('https://sortaofficial.lovable.app/')}>
            <ExternalLink size={14} />
            {loc.settings.aboutSortaBtn}
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {techCards.map((card) => (
          <Card key={card.label} padding="sm">
            <span className="label-caps">{card.label}</span>
            <p className={cn('mt-1.5 text-sm font-semibold', card.tone === 'neutral' ? 'text-fg' : textTones[card.tone])}>
              {card.value}
            </p>
            <p className="mt-1 text-xs text-fg-secondary">{card.desc}</p>
          </Card>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <Card>
        <SectionHeader icon={<Keyboard size={18} />} tone="pink" title={loc.shortcuts.title} />
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-2.5 text-ui">
          {shortcuts.map((item) => (
            <Card
              key={item.key}
              variant="inset"
              padding="none"
              className="flex items-center justify-between px-2.5 py-1.5"
            >
              <span className="text-fg-secondary">{item.desc}</span>
              <Kbd>{item.key}</Kbd>
            </Card>
          ))}
        </div>
      </Card>

      {/* Disclaimer / no warranty */}
      <Callout tone="amber" icon={<AlertTriangle size={16} />}>
        <h4 className="mb-1.5 text-md font-extrabold text-accent-amber">{loc.settings.disclaimerTitle}</h4>
        <p className="text-ui leading-relaxed text-fg-secondary">{loc.settings.disclaimerBody}</p>
      </Callout>

      {/* Re-run the welcome wizard */}
      <Card padding="none" className="px-5 py-2">
        <SettingRow
          title={loc.settings.aboutOnboardingTitle}
          description={loc.settings.aboutOnboardingDesc}
          control={<Button onClick={onOpenOnboarding}>{loc.settings.aboutOnboardingBtn}</Button>}
        />
      </Card>
    </SettingsPage>
  );
};
