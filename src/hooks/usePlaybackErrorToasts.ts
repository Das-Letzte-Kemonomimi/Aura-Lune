import { useTauriEvent } from './useTauriEvent';

/** Backend playback error event (GStreamer), emitted by the playback ticker. */
export const PLAYBACK_ERROR_EVENT = 'auralune://playback-error';

interface PlaybackErrorPayload {
  message: string;
}

/** Shows backend playback errors as error messages (toast). */
export function usePlaybackErrorToasts(showMessage: (text: string, isError?: boolean) => void): void {
  useTauriEvent<PlaybackErrorPayload>(PLAYBACK_ERROR_EVENT, (payload) => {
    if (payload?.message) showMessage(payload.message, true);
  });
}
