import type { AppTab } from '../../types/navigation';
import React from 'react';
import { cn } from '../../utils/cn';
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
  onOpenProject: (pid: number) => void;
  onOpenCreateProject: () => void;
}

export interface RadioRouterProps {
  currentLang: any;
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
      className={cn('min-h-0 flex-1 overflow-y-auto', (activeTab !== 'player' || isPlayerScrolledDown) && 'pb-22')}
    >
      {/* Tab 1: Player View */}
      {activeTab === 'player' && <PlayerView {...playerProps} />}

      {/* Tab 2: Library View */}
      {activeTab === 'library' && <LibraryView {...libraryProps} />}

      {/* Tab 3: DSP Studio View */}
      {activeTab === 'dsp' && <DspStudioView {...dspProps} />}

      {/* Tab 4: Playlists View */}
      {activeTab === 'playlists' && <PlaylistsView {...playlistsProps} />}

      {/* Tab 5: Stem Separation Projects View */}
      {activeTab === 'stem-projects' && (
        <div className="mx-auto px-4 py-6" style={{ maxWidth: layoutMaxWidth }}>
          <StemProjectsLibraryView
            onOpenProject={stemProjectsProps.onOpenProject}
            onOpenCreateProject={stemProjectsProps.onOpenCreateProject}
          />
        </div>
      )}

      {/* Tab 6: Anime Web Radio */}
      {activeTab === 'radio' && <RadioView {...radioProps} />}

      {/* Tab 7: Recap & Stats Dashboard */}
      {activeTab === 'stats' && statsProps && (
        <div className="mx-auto px-4 py-6" style={{ maxWidth: layoutMaxWidth }}>
          <StatsDashboardView {...statsProps} />
        </div>
      )}
    </main>
  );
});
