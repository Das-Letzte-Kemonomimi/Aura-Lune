/** Main app views rendered by `MainContentRouter`. */
export type MainTabType =
  | 'player'
  | 'library'
  | 'playlists'
  | 'stem-projects'
  | 'radio'
  | 'dsp'
  | 'stats';

/** Old tabs that `App` redirects to the Settings window (e.g. from the command palette). */
export type SettingsRedirectTab = 'devices' | 'transcode' | 'themes';

/** All values of the `activeTab` state in `App`. */
export type AppTab = MainTabType | SettingsRedirectTab;

/** Settings window tabs. */
export type SettingsTab = 'themes' | 'devices' | 'transcode' | 'updates' | 'about' | 'backup';

const MAIN_TABS: ReadonlySet<string> = new Set<MainTabType>([
  'player',
  'library',
  'playlists',
  'stem-projects',
  'radio',
  'dsp',
  'stats',
]);

/** Whether the tab is a main view (not a redirect to Settings). */
export function isMainTab(tab: string): tab is MainTabType {
  return MAIN_TABS.has(tab);
}

/** What the player view shows next to the controls. */
export type NowPlayingVisualMode = 'cover' | 'turntable' | 'tape' | 'vumeter';

const NOW_PLAYING_VISUAL_MODES: ReadonlySet<unknown> = new Set<NowPlayingVisualMode>(['cover', 'turntable', 'tape', 'vumeter']);

/** Whether a stored value (saved session, `localStorage`) is a known visual mode. */
export function isNowPlayingVisualMode(value: unknown): value is NowPlayingVisualMode {
  return NOW_PLAYING_VISUAL_MODES.has(value);
}
