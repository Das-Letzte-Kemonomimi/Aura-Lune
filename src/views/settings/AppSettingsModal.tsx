import React, { Suspense } from 'react';
import { SettingsModal, type SettingsTab } from './SettingsModal';
import type { GeneralSettingsViewProps } from './GeneralSettingsView';
import type { AppearanceSettingsViewProps } from './AppearanceSettingsView';
import type { PlaybackSettingsViewProps } from './PlaybackSettingsView';
import type { AudioEngineSettingsViewProps } from './AudioEngineSettingsView';
import type { LibrarySettingsViewProps } from './LibrarySettingsView';
import type { IntegrationsSettingsViewProps } from './IntegrationsSettingsView';
import type { TranscodeSettingsViewProps } from './TranscodeSettingsView';
import type { DataSettingsViewProps } from './DataSettingsView';
import type { UpdatesSettingsViewProps } from './UpdatesSettingsView';
import type { AboutSettingsViewProps } from './AboutSettingsView';
import { SettingsTabSkeleton } from './SettingsTabSkeleton';
import { type Translations } from '../../i18n';

const GeneralSettingsView = React.lazy(() => import('./GeneralSettingsView').then((m) => ({ default: m.GeneralSettingsView })));
const AppearanceSettingsView = React.lazy(() => import('./AppearanceSettingsView').then((m) => ({ default: m.AppearanceSettingsView })));
const PlaybackSettingsView = React.lazy(() => import('./PlaybackSettingsView').then((m) => ({ default: m.PlaybackSettingsView })));
const AudioEngineSettingsView = React.lazy(() => import('./AudioEngineSettingsView').then((m) => ({ default: m.AudioEngineSettingsView })));
const LibrarySettingsView = React.lazy(() => import('./LibrarySettingsView').then((m) => ({ default: m.LibrarySettingsView })));
const IntegrationsSettingsView = React.lazy(() => import('./IntegrationsSettingsView').then((m) => ({ default: m.IntegrationsSettingsView })));
const TranscodeSettingsView = React.lazy(() => import('./TranscodeSettingsView').then((m) => ({ default: m.TranscodeSettingsView })));
const DataSettingsView = React.lazy(() => import('./DataSettingsView').then((m) => ({ default: m.DataSettingsView })));
const UpdatesSettingsView = React.lazy(() => import('./UpdatesSettingsView').then((m) => ({ default: m.UpdatesSettingsView })));
const AboutSettingsView = React.lazy(() => import('./AboutSettingsView').then((m) => ({ default: m.AboutSettingsView })));

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
      <Suspense key={activeTab} fallback={<SettingsTabSkeleton tab={activeTab} loc={loc} />}>
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
      </Suspense>
    </SettingsModal>
  );
};
