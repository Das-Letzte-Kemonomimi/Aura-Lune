import type { PlayerViewProps } from '../../views/PlayerView';
import type { LibraryViewProps } from '../../views/LibraryView';
import type { DspStudioViewProps } from '../../views/DspStudioView';
import type { PlaylistsViewProps } from '../../views/PlaylistsView';
import type { StemProjectsRouterProps, RadioRouterProps } from './MainContentRouter';

export interface UseMainContentRouterPropsOptions {
  playerProps: PlayerViewProps;
  libraryProps: LibraryViewProps;
  dspProps: DspStudioViewProps;
  playlistsProps: PlaylistsViewProps;
  stemProjectsProps: StemProjectsRouterProps;
  radioProps: RadioRouterProps;
}

export function useMainContentRouterProps(options: UseMainContentRouterPropsOptions) {
  return {
    playerProps: options.playerProps,
    libraryProps: options.libraryProps,
    dspProps: options.dspProps,
    playlistsProps: options.playlistsProps,
    stemProjectsProps: options.stemProjectsProps,
    radioProps: options.radioProps,
  };
}
