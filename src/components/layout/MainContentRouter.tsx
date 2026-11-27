import type { AppTab } from '../../types/navigation';
import React, { Suspense } from 'react';
import { cn } from '../../utils/cn';
import type { Language } from '../../i18n';
import type { PlayerViewProps } from '../../views/player/PlayerView';
import type { LibraryViewProps } from '../../views/library/LibraryView';
import type { DspStudioViewProps } from '../../views/dsp/DspStudioView';
import type { PlaylistsViewProps } from '../../views/playlists/PlaylistsView';
import type { RadioStation } from '../../views/playlists/RadioView';
import type { StatsDashboardViewProps } from '../../views/stats/StatsDashboardView';
import { ViewLoadingSkeleton } from './ViewLoadingSkeleton';

const PlayerView = React.lazy(() => import('../../views/player/PlayerView').then((m) => ({ default: m.PlayerView })));
const LibraryView = React.lazy(() => import('../../views/library/LibraryView').then((m) => ({ default: m.LibraryView })));
const DspStudioView = React.lazy(() => import('../../views/dsp/DspStudioView').then((m) => ({ default: m.DspStudioView })));
const PlaylistsView = React.lazy(() => import('../../views/playlists/PlaylistsView').then((m) => ({ default: m.PlaylistsView })));
const StemProjectsLibraryView = React.lazy(() => import('../../views/stems/StemProjectsLibraryView').then((m) => ({ default: m.StemProjectsLibraryView })));
const RadioView = React.lazy(() => import('../../views/playlists/RadioView').then((m) => ({ default: m.RadioView })));
const StatsDashboardView = React.lazy(() => import('../../views/stats/StatsDashboardView').then((m) => ({ default: m.StatsDashboardView })));

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
  const loc = playerProps?.loc ?? libraryProps?.loc ?? dspProps?.loc ?? playlistsProps?.loc;
  const fallback = (
    <ViewLoadingSkeleton
      tab={activeTab}
      layoutMaxWidth={layoutMaxWidth}
      loc={loc}
      visualMode={playerProps?.nowPlayingVisualMode}
      showLyrics={playerProps?.showLyrics}
      librarySubView={libraryProps?.librarySubView}
      albumViewMode={libraryProps?.albumViewMode}
      albumGridSize={libraryProps?.albumGridSize}
      hasSelectedAlbumDetail={Boolean(libraryProps?.selectedAlbumDetail)}
      hasSelectedPlaylist={Boolean(playlistsProps?.selectedPlaylist)}
    />
  );

  return (
    <main
      ref={mainContentRef}
      // `pb-24.5` reserves clearance for the `h-21.5` BottomPlaybackDock when visible.
      className={cn('min-h-0 flex-1 overflow-y-auto', (activeTab !== 'player' || isPlayerScrolledDown) && 'pb-24.5')}
    >
      {/* Tab 1: Player View */}
      {activeTab === 'player' && (
        <Suspense key="player" fallback={fallback}>
          <PlayerView {...playerProps} />
        </Suspense>
      )}

      {/* Tabs 2–7 share a unified container aligned to layoutMaxWidth */}
      {activeTab !== 'player' && (
        <div className="mx-auto w-full px-1 py-2 sm:px-2" style={{ maxWidth: layoutMaxWidth }}>
          <Suspense key={activeTab} fallback={fallback}>
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
          </Suspense>
        </div>
      )}
    </main>
  );
});
