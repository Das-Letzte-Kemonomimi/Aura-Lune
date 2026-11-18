import React from 'react';
import { SettingsModal, type SettingsTab } from './SettingsModal';
import { AudioDevicesSettingsView, type AudioDevicesSettingsViewProps } from './AudioDevicesSettingsView';
import { TranscodeSettingsView, type TranscodeSettingsViewProps } from './TranscodeSettingsView';
import { ThemesSettingsView, type ThemesSettingsViewProps } from './ThemesSettingsView';
import { AboutSettingsView, type AboutSettingsViewProps } from './AboutSettingsView';
import { BackupSettingsView, type BackupSettingsViewProps } from './BackupSettingsView';
import { ChangelogView } from '../changelog/ChangelogView';
import { type Language, type Translations } from '../../i18n';

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  loc: Translations;
  language: Language;
  devicesProps: AudioDevicesSettingsViewProps;
  transcodeProps: TranscodeSettingsViewProps;
  themesProps: ThemesSettingsViewProps;
  aboutProps: AboutSettingsViewProps;
  backupProps: BackupSettingsViewProps;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  loc,
  language,
  devicesProps,
  transcodeProps,
  themesProps,
  aboutProps,
  backupProps,
}) => {
  return (
    <SettingsModal
      isOpen={isOpen}
      onClose={onClose}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      loc={loc}
    >
      {activeTab === 'themes' && <ThemesSettingsView {...themesProps} />}
      {activeTab === 'devices' && <AudioDevicesSettingsView {...devicesProps} />}
      {activeTab === 'transcode' && <TranscodeSettingsView {...transcodeProps} />}
      {activeTab === 'about' && <AboutSettingsView {...aboutProps} />}
      {activeTab === 'changelog' && <ChangelogView currentLang={language} />}
      {activeTab === 'backup' && <BackupSettingsView {...backupProps} />}
    </SettingsModal>
  );
};
