import React from 'react';
import { invoke } from '../../api/ipc';
import {
  Activity,
  History,
  Music,
  HeartHandshake,
  ExternalLink,
  Keyboard,
} from '../../components/ui/icons';
import { type Language, type Translations } from '../../i18n';
import type { BuildInfo } from '../../types/updates';
import { cn } from '../../utils/cn';

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

  return (
    <div className="mx-auto my-0 flex max-w-187.5 flex-col gap-5">
      <div className="glass-card flex items-center gap-5 p-6">
        <img
          src={appIconStyle === 'classic' ? '/icon_classic.png' : '/icon_lineout.png'}
          alt="Auralune Logo"
          className={cn(
            'h-16 w-16 rounded-2xl border border-white/20 bg-black/30 object-contain shadow-halo-xl',
            appIconStyle === 'classic' ? 'shadow-accent-purple/55' : 'shadow-pink-500/55',
            appIconStyle === 'classic' ? 'p-0' : 'p-1',
          )}
        />
        <div>
          <h3 className="m-0 flex items-center gap-2 text-2xl font-extrabold">
            <span>Auralune</span>
            <span className="text-lg text-accent-pink">狐 Kitsune</span>
            <span className="rounded-xl bg-accent-gradient px-2 py-0.5 text-xs font-extrabold text-on-accent">v{appVersion}</span>
          </h3>
          <p className="mx-0 mt-1 mb-0 text-sm font-bold text-accent-pink">
            {loc.settings.version} {appVersion}{buildInfo ? ` (${buildInfo.channel} • ${buildInfo.commit_short})` : ''} • {loc.settings.author}: Das Letzte Kemonomimi
          </p>
          <p className="mx-0 mt-1.5 mb-0 text-ui leading-normal text-fg-secondary">
            Linux High-Fidelity DSP & PipeWire Audio Engine • Extensible foobar2000-like flexibility, anime aesthetics & real-time pitch/tempo modulation.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenHealthCheck}
              className="flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400"
            >
              <Activity size={13} />
              {loc.healthCheck.title}
            </button>
            <button
              onClick={onOpenChangelog}
              className="flex items-center gap-1.5 rounded-md border-0 bg-accent-gradient px-3 py-1 text-xs font-bold text-on-accent"
            >
              <History size={13} />
              {loc.settings.changelog}
            </button>
          </div>
        </div>
      </div>

      {/* Creator section: Bandcamp & the Sorta app for AuDHD / ADHD */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(80),1fr))] gap-3.5">
        {/* Bandcamp card: the author's music */}
        <div
          className="glass-card flex flex-col justify-between rounded-2xl border border-accent-purple/35 bg-linear-135 from-accent-purple/10 to-accent-pink/8 px-5 py-4.5 shadow-xl shadow-accent-purple/10"
        >
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music size={18} className="text-accent-purple" />
                <h4 className="m-0 text-base font-extrabold text-fg">
                  {loc.settings.aboutBandcampTitle}
                </h4>
              </div>
              <span className="rounded-sm bg-accent-purple/25 px-2 py-0.5 text-xxs font-bold text-accent-purple">
                Bandcamp
              </span>
            </div>
            <p className="mx-0 mt-0 mb-3.5 text-ui leading-relaxed text-white/85">
              {loc.settings.aboutBandcampDesc}
            </p>
          </div>
          <button
            onClick={() => handleOpenExternalUrl('https://dasletztekemonomimi.bandcamp.com/track/skrzyd-a-bia-e')}
            className="flex items-center justify-center gap-1.5 rounded-lg border-0 bg-linear-135 from-accent-purple to-accent-pink px-3.5 py-2 text-ui font-bold text-on-accent shadow-lift shadow-accent-purple/30"
          >
            <ExternalLink size={14} />
            {loc.settings.aboutBandcampBtn}
          </button>
        </div>

        {/* Sorta card: an app for AuDHD / ADHD */}
        <div
          className="glass-card flex flex-col justify-between rounded-2xl border border-accent-cyan/35 bg-linear-135 from-accent-cyan/10 to-pink-500/8 px-5 py-4.5 shadow-xl shadow-accent-cyan/10"
        >
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake size={18} className="text-accent-cyan" />
                <h4 className="m-0 text-base font-extrabold text-fg">
                  Sorta • AuDHD & ADHD Focus
                </h4>
              </div>
              <span className="rounded-sm bg-accent-cyan/25 px-2 py-0.5 text-xxs font-bold text-accent-cyan">
                AuDHD
              </span>
            </div>
            <p className="mx-0 mt-0 mb-3.5 text-ui leading-relaxed text-white/85">
              {loc.settings.aboutSortaDesc}
            </p>
          </div>
          <button
            onClick={() => handleOpenExternalUrl('https://sortaofficial.lovable.app/')}
            className="flex items-center justify-center gap-1.5 rounded-lg border-0 bg-linear-135 from-accent-cyan to-accent-pink px-3.5 py-2 text-ui font-bold text-on-accent shadow-lift shadow-accent-cyan/30"
          >
            <ExternalLink size={14} />
            {loc.settings.aboutSortaBtn}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="glass-card p-4">
          <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
            {loc.settings.aboutAudioEngine}
          </span>
          <p className="mx-0 mt-1.5 mb-0 text-sm font-semibold text-fg">
            GStreamer + PipeWire Pro Audio
          </p>
          <p className="mx-0 mt-1 mb-0 text-xs text-fg-secondary">
            {loc.settings.aboutAudioEngineDesc}
          </p>
        </div>

        <div className="glass-card p-4">
          <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
            {loc.settings.aboutDsp}
          </span>
          <p className="mx-0 mt-1.5 mb-0 text-sm font-semibold text-accent-cyan">
            SoundTouch & Rubber Band
          </p>
          <p className="mx-0 mt-1 mb-0 text-xs text-fg-secondary">
            {loc.settings.aboutDspDesc}
          </p>
        </div>

        <div className="glass-card p-4">
          <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
            {loc.settings.aboutLibrary}
          </span>
          <p className="mx-0 mt-1.5 mb-0 text-sm font-semibold text-accent-purple">
            SQLite (sqlx) + Cover Art Archive
          </p>
          <p className="mx-0 mt-1 mb-0 text-xs text-fg-secondary">
            {loc.settings.aboutLibraryDesc}
          </p>
        </div>

        <div className="glass-card p-4">
          <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
            {loc.settings.aboutLicense}
          </span>
          <p className="mx-0 mt-1.5 mb-0 text-sm font-semibold text-accent-green">
            GPL-3.0-or-later
          </p>
          <p className="mx-0 mt-1 mb-0 text-xs text-fg-secondary">
            {loc.settings.aboutLicenseDesc}
          </p>
        </div>
      </div>

      {/* Keyboard shortcuts card */}
      <div className="glass-card p-5">
        <h4 className="mx-0 mt-0 mb-3.5 flex items-center gap-2 text-base font-bold text-fg">
          <Keyboard size={18} className="text-accent-pink" /> {loc.shortcuts.title}
        </h4>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(70),1fr))] gap-2.5 text-ui">
          {[
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
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/3 px-2.5 py-1.5"
            >
              <span className="text-fg-secondary">{item.desc}</span>
              <kbd
                className="rounded-md border border-accent-purple/35 bg-accent-purple/15 px-2 py-0.5 font-mono text-xs font-bold text-accent-pink shadow-sm shadow-black/30"
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer / no warranty card */}
      <div
        className="rounded-2xl border border-accent-amber/30 bg-linear-135 from-accent-amber/8 to-orange-600/6 px-5.5 py-4.5 shadow-xl shadow-accent-amber/8"
      >
        <h4 className="mx-0 mt-0 mb-2.5 text-md font-extrabold tracking-normal text-amber-400">
          {loc.settings.disclaimerTitle}
        </h4>
        <p className="m-0 text-ui leading-relaxed text-amber-400/85">
          {loc.settings.disclaimerBody}
        </p>
      </div>

      {/* Card for re-running the welcome wizard */}
      <div className="glass-card flex items-center justify-between p-5">
        <div>
          <div className="text-sm font-semibold text-fg">
            {loc.settings.aboutOnboardingTitle}
          </div>
          <div className="mt-0.5 text-xs text-fg-muted">
            {loc.settings.aboutOnboardingDesc}
          </div>
        </div>
        <button
          onClick={onOpenOnboarding}
          className="rounded-lg border border-line bg-white/6 px-4 py-2 text-ui font-semibold text-accent-cyan"
        >
          {loc.settings.aboutOnboardingBtn}
        </button>
      </div>
    </div>
  );
};
