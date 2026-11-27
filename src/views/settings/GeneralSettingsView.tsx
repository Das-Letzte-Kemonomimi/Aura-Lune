import React from 'react';
import { Check, Globe, History, ListMusic, Settings, Headphones, Tv, Sparkles } from '../../components/ui/icons';
import { Badge, Button, Card, Chip, SectionHeader, SettingRow, ToggleCard } from '../../components/ui';
import { ToggleSwitch } from '../../components/common/ToggleSwitch';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import type { Language } from '../../i18n';
import type { AlbumPlaybackBehavior } from '../../types/player';
import type { AudioSettingsProps } from './audio/audioSettingsProps';
import { SettingsPage } from './SettingsPage';

export type GeneralSettingsViewProps = Pick<
  AudioSettingsProps,
  | 'loc'
  | 'language'
  | 'restoreSessionOnStartup'
  | 'onToggleRestoreSessionOnStartup'
  | 'desktopNotificationsEnabled'
  | 'onToggleDesktopNotifications'
  | 'albumPlaybackMode'
  | 'onSetAlbumPlaybackMode'
  | 'recapOptIn'
  | 'onToggleRecapOptIn'
> & {
  onLanguageChange: (lang: Language) => void;
  closeToTray: boolean;
  onToggleCloseToTray: (enabled: boolean) => void;
  onOpenOnboarding: () => void;
};

/** General: language, start-up and window behaviour, notifications, album click mode, Recap and the welcome wizard. */
export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  loc,
  language,
  onLanguageChange,
  restoreSessionOnStartup,
  onToggleRestoreSessionOnStartup,
  closeToTray,
  onToggleCloseToTray,
  desktopNotificationsEnabled,
  onToggleDesktopNotifications,
  albumPlaybackMode,
  onSetAlbumPlaybackMode,
  recapOptIn,
  onToggleRecapOptIn,
  onOpenOnboarding,
}) => {
  const albumModes: { id: AlbumPlaybackBehavior; label: string; short: string }[] = [
    { id: 'replace', label: loc.settings.albumPlaybackReplace, short: loc.settings.albumModeReplace },
    { id: 'append', label: loc.settings.albumPlaybackAppend, short: loc.settings.albumModeAppend },
    { id: 'single', label: loc.settings.albumPlaybackSingle, short: loc.settings.albumModeSingle },
  ];

  return (
    <SettingsPage title={loc.settings.nav.general} icon={<Settings size={22} />} tone="purple">
      {/* UI language */}
      <Card>
        <SectionHeader
          icon={<Globe size={20} />}
          tone="cyan"
          title={loc.settings.language}
          description="English • Polski • Deutsch • Suomi • Latina"
          actions={<LanguageSelector currentLang={language} onLanguageChange={onLanguageChange} />}
        />
      </Card>

      {/* Remember the playback session on restart */}
      <ToggleCard
        icon={<History size={20} />}
        tone="purple"
        title={loc.settings.restoreSessionTitle}
        description={loc.settings.restoreSessionDesc}
        checked={restoreSessionOnStartup}
        onChange={onToggleRestoreSessionOnStartup}
      />

      {/* Linux system tray */}
      <ToggleCard
        icon={<Headphones size={20} />}
        tone="cyan"
        title={loc.settings.closeToTray}
        description={loc.settings.closeToTrayDesc}
        checked={closeToTray}
        onChange={onToggleCloseToTray}
      />

      {/* Desktop notifications (libnotify / D-Bus) */}
      <ToggleCard
        icon={<Tv size={20} />}
        tone="cyan"
        title={loc.settings.desktopNotificationsTitle}
        description={loc.settings.desktopNotificationsDesc}
        checked={desktopNotificationsEnabled}
        onChange={onToggleDesktopNotifications}
      />

      {/* Album and playlist playback behaviour (autoplay and queue) */}
      <Card>
        <SectionHeader
          icon={<ListMusic size={20} />}
          tone="pink"
          title={loc.settings.albumPlaybackTitle}
          description={loc.settings.albumPlaybackDesc}
          actions={<Badge tone="pink">{albumModes.find((m) => m.id === albumPlaybackMode)?.short}</Badge>}
        />
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(50),1fr))] gap-2">
          {albumModes.map((mode) => {
            const isActive = albumPlaybackMode === mode.id;
            return (
              <Chip
                key={mode.id}
                pressed={isActive}
                onClick={() => onSetAlbumPlaybackMode(mode.id)}
                className="justify-start px-3.5 py-2.5 text-left text-ui whitespace-normal"
              >
                {isActive && <Check size={14} className="shrink-0" />}
                {mode.label}
              </Chip>
            );
          })}
        </div>
      </Card>

      {/* Auralune Recap consent (opt-in) */}
      <Card padding="none" className="px-5 py-2">
        <SettingRow
          icon={<Sparkles size={18} />}
          title={loc.settings.recapTitle}
          description={loc.settings.recapDesc}
          control={<ToggleSwitch checked={recapOptIn} onChange={onToggleRecapOptIn} label={loc.settings.recapTitle} />}
        />
      </Card>

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
