/**
 * Typowany dostęp do ustawień aplikacji przechowywanych w SQLite (`app_settings`).
 *
 * Klucze są zamkniętą unią — literówka w nazwie ustawienia to błąd kompilacji, a nie
 * ciche czytanie/zapisywanie innego klucza. Nowe ustawienie: dopisz klucz do `SETTING_KEYS`.
 * Wartości są tekstowe (backend przechowuje `TEXT`); parsowanie zostaje po stronie wywołującego.
 */
import { invoke } from './ipc';

export const SETTING_KEYS = [
  'album_playback_mode',
  'app_language',
  'bass_boost',
  'close_to_tray',
  'crossfade_duration',
  'dsp_default_engine',
  'dsp_restore_on_startup',
  'dsp_saved_settings',
  'eq_enabled_on_startup',
  'lastfm_custom_key',
  'lastfm_custom_secret',
  'lastfm_enabled',
  'lastfm_session_key',
  'lastfm_username',
  'limiter_enabled',
  'listenbrainz_enabled',
  'listenbrainz_token',
  'playback_session_state',
  'restore_session_on_startup',
  'seek_fade_enabled',
  'stereo_widener_active',
  'stereo_widener_amount',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** Odczytuje ustawienie; `null`, gdy nie zostało jeszcze zapisane. */
export function getSetting(key: SettingKey): Promise<string | null> {
  return invoke<string | null>('get_app_setting', { key });
}

/** Zapisuje ustawienie (nadpisuje poprzednią wartość). */
export function setSetting(key: SettingKey, value: string): Promise<void> {
  return invoke<void>('set_app_setting', { key, value });
}
