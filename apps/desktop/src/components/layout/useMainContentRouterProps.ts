import type {
  PlayerViewProps,
  LibraryViewProps,
  DspStudioViewProps,
  PlaylistsViewProps,
  StatsDashboardViewProps,
} from '../../views';
import type { StemProjectsRouterProps, RadioRouterProps } from './MainContentRouter';

export interface UseMainContentRouterPropsOptions {
  playerProps: PlayerViewProps;
  libraryProps: LibraryViewProps;
  dspProps: DspStudioViewProps;
  playlistsProps: PlaylistsViewProps;
  stemProjectsProps: StemProjectsRouterProps;
  radioProps: RadioRouterProps;
  statsProps?: StatsDashboardViewProps;
}

export function useMainContentRouterProps(options: UseMainContentRouterPropsOptions) {
  return {
    playerProps: options.playerProps,
    libraryProps: options.libraryProps,
    dspProps: options.dspProps,
    playlistsProps: options.playlistsProps,
    stemProjectsProps: options.stemProjectsProps,
    radioProps: options.radioProps,
    statsProps: options.statsProps,
  };
}
