import React from 'react';
import { SettingsModal, type SettingsTab } from './SettingsModal';
import { AudioDevicesSettingsView, type AudioDevicesSettingsViewProps } from './AudioDevicesSettingsView';
import { TranscodeSettingsView, type TranscodeSettingsViewProps } from './TranscodeSettingsView';
import { ThemesSettingsView, type ThemesSettingsViewProps } from './ThemesSettingsView';
import { UpdatesSettingsView, type UpdatesSettingsViewProps } from './UpdatesSettingsView';
import { AboutSettingsView, type AboutSettingsViewProps } from './AboutSettingsView';
import { BackupSettingsView, type BackupSettingsViewProps } from './BackupSettingsView';
import { type Translations } from '../../i18n';

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  loc: Translations;
  devicesProps: AudioDevicesSettingsViewProps;
  transcodeProps: TranscodeSettingsViewProps;
  themesProps: ThemesSettingsViewProps;
  updatesProps: UpdatesSettingsViewProps;
  aboutProps: AboutSettingsViewProps;
  backupProps: BackupSettingsViewProps;
  updateAvailable?: boolean;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  loc,
  devicesProps,
  transcodeProps,
  themesProps,
  updatesProps,
  aboutProps,
  backupProps,
  updateAvailable,
}) => {
  return (
    <SettingsModal
      isOpen={isOpen}
      onClose={onClose}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      loc={loc}
      updateAvailable={updateAvailable}
    >
      {activeTab === 'themes' && <ThemesSettingsView {...themesProps} />}
      {activeTab === 'devices' && <AudioDevicesSettingsView {...devicesProps} />}
      {activeTab === 'transcode' && <TranscodeSettingsView {...transcodeProps} />}
      {activeTab === 'updates' && <UpdatesSettingsView {...updatesProps} />}
      {activeTab === 'about' && <AboutSettingsView {...aboutProps} />}
      {activeTab === 'backup' && <BackupSettingsView {...backupProps} />}
    </SettingsModal>
  );
};
