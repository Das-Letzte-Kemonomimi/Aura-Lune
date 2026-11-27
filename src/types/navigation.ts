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
export type SettingsRedirectTab = LegacySettingsTab | 'playback';

/** All values of the `activeTab` state in `App`. */
export type AppTab = MainTabType | SettingsRedirectTab;

/** Settings window tabs. */
export type SettingsTab =
  | 'general'
  | 'appearance'
  | 'playback'
  | 'audio'
  | 'library'
  | 'integrations'
  | 'export'
  | 'data'
  | 'updates'
  | 'about';

/** Tab ids from before the settings reorganisation; entry points may still pass them. */
export type LegacySettingsTab = 'themes' | 'devices' | 'transcode' | 'backup';

export type SettingsNavGroupId = 'personal' | 'audio' | 'libraryServices' | 'system';

/** The Settings navigation rail, in display order. Labels live under `settings.nav.<id>` in the locales. */
export const SETTINGS_TABS: readonly { id: SettingsTab; group: SettingsNavGroupId }[] = [
  { id: 'general', group: 'personal' },
  { id: 'appearance', group: 'personal' },
  { id: 'playback', group: 'audio' },
  { id: 'audio', group: 'audio' },
  { id: 'library', group: 'libraryServices' },
  { id: 'integrations', group: 'libraryServices' },
  { id: 'export', group: 'libraryServices' },
  { id: 'data', group: 'system' },
  { id: 'updates', group: 'system' },
  { id: 'about', group: 'system' },
];

const SETTINGS_TAB_IDS: ReadonlySet<string> = new Set(SETTINGS_TABS.map((t) => t.id));

/** Tab ids from before the settings reorganisation (stored or passed by old entry points). */
const LEGACY_SETTINGS_TABS: Readonly<Record<string, SettingsTab>> = {
  themes: 'appearance',
  devices: 'audio',
  transcode: 'export',
  backup: 'data',
};

/** Maps any stored or legacy tab id to a current one; unknown values fall back to `general`. */
export function normalizeSettingsTab(value: unknown): SettingsTab {
  if (typeof value !== 'string') return 'general';
  if (SETTINGS_TAB_IDS.has(value)) return value as SettingsTab;
  return LEGACY_SETTINGS_TABS[value] ?? 'general';
}

const MAIN_TABS: ReadonlySet<string> = new Set<MainTabType>([
  'player',
  'library',
  'playlists',
  'stem-projects',
  'radio',
  'dsp',
  'stats',
]);

const SETTINGS_REDIRECT_TABS: ReadonlySet<string> = new Set<SettingsRedirectTab>(['themes', 'devices', 'transcode', 'backup', 'playback']);

/** Whether the tab is not a main view but a request to open that Settings tab. */
export function isSettingsRedirectTab(tab: string): tab is SettingsRedirectTab {
  return SETTINGS_REDIRECT_TABS.has(tab);
}

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
