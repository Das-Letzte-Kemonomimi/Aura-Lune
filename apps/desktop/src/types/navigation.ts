/** Główne widoki aplikacji renderowane przez `MainContentRouter`. */
export type MainTabType =
  | 'player'
  | 'library'
  | 'playlists'
  | 'stem-projects'
  | 'radio'
  | 'dsp'
  | 'stats';

/** Dawne zakładki, które `App` przekierowuje do okna Ustawień (np. z palety poleceń). */
export type SettingsRedirectTab = 'devices' | 'transcode' | 'themes';

/** Wszystkie wartości stanu `activeTab` w `App`. */
export type AppTab = MainTabType | SettingsRedirectTab;

/** Zakładki okna Ustawień. */
export type SettingsTab = 'themes' | 'devices' | 'transcode' | 'about' | 'changelog' | 'backup';

const MAIN_TABS: ReadonlySet<string> = new Set<MainTabType>([
  'player',
  'library',
  'playlists',
  'stem-projects',
  'radio',
  'dsp',
  'stats',
]);

/** Czy zakładka jest głównym widokiem (a nie przekierowaniem do Ustawień). */
export function isMainTab(tab: string): tab is MainTabType {
  return MAIN_TABS.has(tab);
}
