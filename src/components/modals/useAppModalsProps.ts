import { useShallowMemo } from '../../hooks/useShallowMemo';
import type { AppModalsContainerProps } from './AppModalsContainer';
import type { useModalManager } from '../../hooks/useModalManager';
import type { useLibraryManager } from '../../hooks/useLibraryManager';
import type { useLibraryPlaybackActions } from '../../hooks/useLibraryPlaybackActions';
import type { usePlaybackController } from '../../hooks/usePlaybackController';
import type { useDspManager } from '../../hooks/useDspManager';
import type { usePlaybackQueue } from '../../hooks/usePlaybackQueue';
import type { usePlaylistManager } from '../../hooks/usePlaylistManager';

export type UseAppModalsPropsOptions = Partial<AppModalsContainerProps> & {
  modals?: ReturnType<typeof useModalManager>;
  library?: ReturnType<typeof useLibraryManager>;
  libraryActions?: ReturnType<typeof useLibraryPlaybackActions>;
  playback?: ReturnType<typeof usePlaybackController>;
  dsp?: ReturnType<typeof useDspManager>;
  queueManager?: ReturnType<typeof usePlaybackQueue>;
  playlistsManager?: ReturnType<typeof usePlaylistManager>;
};

export function useAppModalsProps(options: UseAppModalsPropsOptions): AppModalsContainerProps {
  const { modals, library, libraryActions, playback, dsp, queueManager, playlistsManager, ...rest } = options;
  return useShallowMemo({
    ...(library || {}),
    ...(libraryActions || {}),
    ...(playback || {}),
    ...(dsp || {}),
    ...(queueManager || {}),
    ...(playlistsManager || {}),
    ...(modals || {}),
    ...(queueManager?.addTrackNextToQueue ? { handleAddTrackNextToQueue: queueManager.addTrackNextToQueue } : {}),
    ...(queueManager?.confirmSaveQueueAsPlaylist ? { handleConfirmSaveQueueAsPlaylist: queueManager.confirmSaveQueueAsPlaylist } : {}),
    ...(queueManager?.addTrackToQueue ? { handleAddTrackToQueue: queueManager.addTrackToQueue } : {}),
    ...rest,
  } as AppModalsContainerProps);
}
