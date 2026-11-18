import React from 'react';
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
  activeTab: string;
  isPlayerScrolledDown: boolean;
  layoutMaxWidth: string;
  playerProps: PlayerViewProps;
  libraryProps: LibraryViewProps;
  dspProps: DspStudioViewProps;
  playlistsProps: PlaylistsViewProps;
  stemProjectsProps: StemProjectsRouterProps;
  radioProps: RadioRouterProps;
}

export const MainContentRouter: React.FC<MainContentRouterProps> = ({
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
}) => {
  return (
    <main
      ref={mainContentRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingBottom: activeTab !== 'player' || isPlayerScrolledDown ? '88px' : '0',
      }}
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
        <div style={{ padding: '24px 16px', maxWidth: layoutMaxWidth, margin: '0 auto' }}>
          <StemProjectsLibraryView
            onOpenProject={stemProjectsProps.onOpenProject}
            onOpenCreateProject={stemProjectsProps.onOpenCreateProject}
          />
        </div>
      )}

      {/* Tab 6: Anime Web Radio */}
      {activeTab === 'radio' && <RadioView {...radioProps} />}
    </main>
  );
};
