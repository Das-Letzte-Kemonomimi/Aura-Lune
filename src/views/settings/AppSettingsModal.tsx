import React from 'react';
import { SettingsModal, type SettingsTab } from './SettingsModal';
import { GeneralSettingsView, type GeneralSettingsViewProps } from './GeneralSettingsView';
import { AppearanceSettingsView, type AppearanceSettingsViewProps } from './AppearanceSettingsView';
import { PlaybackSettingsView, type PlaybackSettingsViewProps } from './PlaybackSettingsView';
import { AudioEngineSettingsView, type AudioEngineSettingsViewProps } from './AudioEngineSettingsView';
import { LibrarySettingsView, type LibrarySettingsViewProps } from './LibrarySettingsView';
import { IntegrationsSettingsView, type IntegrationsSettingsViewProps } from './IntegrationsSettingsView';
import { TranscodeSettingsView, type TranscodeSettingsViewProps } from './TranscodeSettingsView';
import { DataSettingsView, type DataSettingsViewProps } from './DataSettingsView';
import { UpdatesSettingsView, type UpdatesSettingsViewProps } from './UpdatesSettingsView';
import { AboutSettingsView, type AboutSettingsViewProps } from './AboutSettingsView';
import { type Translations } from '../../i18n';

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SettingsTab;
  onSelectTab: (tab: SettingsTab) => void;
  loc: Translations;
  generalProps: GeneralSettingsViewProps;
  appearanceProps: AppearanceSettingsViewProps;
  playbackProps: PlaybackSettingsViewProps;
  audioProps: AudioEngineSettingsViewProps;
  libraryProps: LibrarySettingsViewProps;
  integrationsProps: IntegrationsSettingsViewProps;
  transcodeProps: TranscodeSettingsViewProps;
  dataProps: DataSettingsViewProps;
  updatesProps: UpdatesSettingsViewProps;
  aboutProps: AboutSettingsViewProps;
  updateAvailable?: boolean;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  loc,
  generalProps,
  appearanceProps,
  playbackProps,
  audioProps,
  libraryProps,
  integrationsProps,
  transcodeProps,
  dataProps,
  updatesProps,
  aboutProps,
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
      {activeTab === 'general' && <GeneralSettingsView {...generalProps} />}
      {activeTab === 'appearance' && <AppearanceSettingsView {...appearanceProps} />}
      {activeTab === 'playback' && <PlaybackSettingsView {...playbackProps} />}
      {activeTab === 'audio' && <AudioEngineSettingsView {...audioProps} />}
      {activeTab === 'library' && <LibrarySettingsView {...libraryProps} />}
      {activeTab === 'integrations' && <IntegrationsSettingsView {...integrationsProps} />}
      {activeTab === 'export' && <TranscodeSettingsView {...transcodeProps} />}
      {activeTab === 'data' && <DataSettingsView {...dataProps} />}
      {activeTab === 'updates' && <UpdatesSettingsView {...updatesProps} />}
      {activeTab === 'about' && <AboutSettingsView {...aboutProps} />}
    </SettingsModal>
  );
};
