import type { AppModalsContainerProps } from './AppModalsContainer';
import type { useModalManager } from '../../hooks/useModalManager';

export type UseAppModalsPropsOptions = Partial<AppModalsContainerProps> & {
  modals?: ReturnType<typeof useModalManager>;
  library?: any;
  libraryActions?: any;
  playback?: any;
  dsp?: any;
  queueManager?: any;
  playlistsManager?: any;
  [key: string]: any;
};

export function useAppModalsProps(options: UseAppModalsPropsOptions): AppModalsContainerProps {
  const { modals, library, libraryActions, playback, dsp, queueManager, playlistsManager, ...rest } = options;
  return {
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
  } as AppModalsContainerProps;
}
