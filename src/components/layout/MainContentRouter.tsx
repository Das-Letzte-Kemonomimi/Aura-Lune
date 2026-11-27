import type { AppTab } from '../../types/navigation';
import React from 'react';
import { cn } from '../../utils/cn';
import type { Language } from '../../i18n';
import {
  PlayerView,
  type PlayerViewProps,
  LibraryView,
  type LibraryViewProps,
  DspStudioView,
  type DspStudioViewProps,
  PlaylistsView,
  type PlaylistsViewProps,
  StemProjectsLibraryView,
  RadioView,
  type RadioStation,
  StatsDashboardView,
  type StatsDashboardViewProps,
} from '../../views';

export interface StemProjectsRouterProps {
  currentLang: Language;
  onOpenProject: (pid: number) => void;
  onOpenCreateProject: () => void;
}

export interface RadioRouterProps {
  currentLang: Language;
  currentStation: RadioStation | null;
  isPlaying: boolean;
  liveStreamTitle?: string | null;
  customStations: RadioStation[];
  onPlayStation: (station: RadioStation) => void;
  onStop: () => void;
  onOpenAddModal: () => void;
  onDeleteCustomStation: (id: string) => void;
}

export interface MainContentRouterProps {
  mainContentRef: React.RefObject<HTMLElement | null>;
  activeTab: AppTab;
  isPlayerScrolledDown: boolean;
  layoutMaxWidth: string;
  playerProps: PlayerViewProps;
  libraryProps: LibraryViewProps;
  dspProps: DspStudioViewProps;
  playlistsProps: PlaylistsViewProps;
  stemProjectsProps: StemProjectsRouterProps;
  radioProps: RadioRouterProps;
  statsProps?: StatsDashboardViewProps;
}

export const MainContentRouter: React.FC<MainContentRouterProps> = React.memo(({
  mainContentRef,
  activeTab,
  isPlayerScrolledDown,
  layoutMaxWidth,
  playerProps,
  libraryProps,
  dspProps,
  playlistsProps,
  stemProjectsProps,
  radioProps,
  statsProps,
}) => {
  return (
    <main
      ref={mainContentRef}
      // `pb-24.5` reserves clearance for the `h-21.5` BottomPlaybackDock when visible.
      className={cn('min-h-0 flex-1 overflow-y-auto', (activeTab !== 'player' || isPlayerScrolledDown) && 'pb-24.5')}
    >
      {/* Tab 1: Player View */}
      {activeTab === 'player' && <PlayerView {...playerProps} />}

      {/* Tabs 2–7 share a unified container aligned to layoutMaxWidth */}
      {activeTab !== 'player' && (
        <div className="mx-auto w-full px-1 py-2 sm:px-2" style={{ maxWidth: layoutMaxWidth }}>
          {activeTab === 'library' && <LibraryView {...libraryProps} />}
          {activeTab === 'dsp' && <DspStudioView {...dspProps} />}
          {activeTab === 'playlists' && <PlaylistsView {...playlistsProps} />}
          {activeTab === 'stem-projects' && (
            <StemProjectsLibraryView
              currentLang={stemProjectsProps.currentLang}
              onOpenProject={stemProjectsProps.onOpenProject}
              onOpenCreateProject={stemProjectsProps.onOpenCreateProject}
            />
          )}
          {activeTab === 'radio' && <RadioView {...radioProps} />}
          {activeTab === 'stats' && statsProps && <StatsDashboardView {...statsProps} />}
        </div>
      )}
    </main>
  );
});
