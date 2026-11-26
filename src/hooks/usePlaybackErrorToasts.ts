import { useTauriEvent } from './useTauriEvent';

/** Zdarzenie backendu z błędem odtwarzania (GStreamer), emitowane przez ticker odtwarzania. */
export const PLAYBACK_ERROR_EVENT = 'auralune://playback-error';

interface PlaybackErrorPayload {
  message: string;
}

/** Pokazuje błędy odtwarzania z backendu jako komunikaty błędu (toast). */
export function usePlaybackErrorToasts(showMessage: (text: string, isError?: boolean) => void): void {
  useTauriEvent<PlaybackErrorPayload>(PLAYBACK_ERROR_EVENT, (payload) => {
    if (payload?.message) showMessage(payload.message, true);
  });
}
