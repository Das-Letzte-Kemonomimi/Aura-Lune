import React from 'react';
import { Settings } from '../../components/ui/icons';
import { Button, SegmentedControl, SettingRow, SettingsGroup } from '../../components/ui';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import type { Language } from '../../i18n';
import type { AlbumPlaybackBehavior } from '../../types/player';
import type { AudioSettingsProps } from './audio/audioSettingsProps';
import { SettingsPage } from './SettingsPage';
import { ToggleRow } from './ToggleRow';

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
      <SettingsGroup label={loc.settings.language}>
        <SettingRow
          compact
          title={loc.settings.language}
          description={loc.settings.languageDesc}
          control={<LanguageSelector currentLang={language} onLanguageChange={onLanguageChange} />}
        />
      </SettingsGroup>

      <SettingsGroup label={loc.settings.group.startup}>
        <ToggleRow
          title={loc.settings.restoreSessionTitle}
          description={loc.settings.restoreSessionDesc}
          checked={restoreSessionOnStartup}
          onChange={onToggleRestoreSessionOnStartup}
        />
        <ToggleRow
          title={loc.settings.closeToTray}
          description={loc.settings.closeToTrayDesc}
          checked={closeToTray}
          onChange={onToggleCloseToTray}
        />
      </SettingsGroup>

      <SettingsGroup label={loc.settings.group.behaviour}>
        <ToggleRow
          title={loc.settings.desktopNotificationsTitle}
          description={loc.settings.desktopNotificationsDesc}
          checked={desktopNotificationsEnabled}
          onChange={onToggleDesktopNotifications}
        />
        <SettingRow
          compact
          title={loc.settings.albumPlaybackTitle}
          description={loc.settings.albumPlaybackDesc}
          control={
            <SegmentedControl
              size="sm"
              tone="purple"
              label={loc.settings.albumPlaybackTitle}
              items={albumModes.map((m) => ({ value: m.id, label: m.short }))}
              value={albumPlaybackMode}
              onChange={onSetAlbumPlaybackMode}
            />
          }
        >
          <p className="text-xs text-fg-secondary">{albumModes.find((m) => m.id === albumPlaybackMode)?.label}</p>
        </SettingRow>
        <ToggleRow
          title={loc.settings.recapTitle}
          description={loc.settings.recapDesc}
          checked={recapOptIn}
          onChange={onToggleRecapOptIn}
        />
        <SettingRow
          compact
          title={loc.settings.aboutOnboardingTitle}
          description={loc.settings.aboutOnboardingDesc}
          control={<Button onClick={onOpenOnboarding}>{loc.settings.aboutOnboardingBtn}</Button>}
        />
      </SettingsGroup>
    </SettingsPage>
  );
};
