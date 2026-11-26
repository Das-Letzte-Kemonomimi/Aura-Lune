/**
 * Typed access to the app settings stored in SQLite (`app_settings`).
 *
 * The keys are a closed union: a typo in a setting name is a compile error, not a
 * silent read or write of another key. New setting: add the key to `SETTING_KEYS`.
 * Values are text (the backend stores `TEXT`); parsing stays with the caller.
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
  'playback_volume',
  'preamp_auto',
  'preamp_db',
  'restore_session_on_startup',
  'seek_fade_enabled',
  'stereo_widener_active',
  'stereo_widener_amount',
  'update_check_enabled',
  'update_last_checked',
  'update_skipped_version',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** Reads a setting; `null` when it has not been saved yet. */
export function getSetting(key: SettingKey): Promise<string | null> {
  return invoke<string | null>('get_app_setting', { key });
}

/** Writes a setting (overwrites the previous value). */
export function setSetting(key: SettingKey, value: string): Promise<void> {
  return invoke<void>('set_app_setting', { key, value });
}
