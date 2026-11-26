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
