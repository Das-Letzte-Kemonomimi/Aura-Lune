# Frontend Architecture

Reference for the React 19 + TypeScript frontend in `src/`. Rules agents must follow live in [`src/AGENTS.md`](../../src/AGENTS.md).

## Views & Screens (`src/views`)
**Section components.** Large views and modals are thin shells that compose section components from a sibling folder (`views/player/sections/`, `views/library/sections/`, `views/dsp/sections/`, `views/player/bigscreen/`, `views/settings/audio/`, `views/settings/transcode/`, `components/modals/parametric-eq/`, `url-import/`, `stem-studio/`). A section's props are typed `Pick<ParentProps, …>` plus the few parent locals it reads, and the parent renders it as `<Section {...props} status={…} />`. Sections that do not draw live progress receive the coarse `status` and are `React.memo`. Keep new UI in a section file; parent views should stay under ~500 lines.

- **`views/player/`**:
  - `PlayerView.tsx`: Main playback screen shell → `sections/` (`PlayerToolbar`, `PlayerVisualColumn`, `PlayerQuickDspVibes`, `PlayerProgressSection`, `PlayerTransportControls`, `PlayerDspMiniBar`, `PlayerQueuePanel`); `queueTrackMeta.ts` resolves queue items to library metadata.
  - `BigScreenView.tsx`: Cinematic full-screen player → `bigscreen/` (HUD, vinyl, tape deck, controls).
- **`views/library/`**:
  - `LibraryView.tsx`: Virtualized library view shell → `sections/` (header, scan panel, toolbar, tracks, album grid, album detail, artists, MusicBrainz match panel). Setter/state prop types come from `ReturnType<typeof useLibraryManager>`.
- **`views/dsp/`**:
  - `DspStudioView.tsx`: Audiophile DSP rack shell → `sections/` (engine selector, pitch/tempo/rate sliders, reverb, presets, mastering rack, graphic EQ).
- **`views/playlists/`**:
  - `PlaylistsView.tsx`: Custom user playlists with M3U8 export/import and smart playlists.
  - `RadioView.tsx`: Live anime, J-Pop, and Lo-Fi internet radio streaming stations.
- **`views/stems/`**:
  - `StemProjectsLibraryView.tsx`: Stem project manager and multi-track separation hub.
- **`components/player/piano-roll/`** (Music Analysis Studio → Piano-Roll & MIDI): `PianoRollView` (memoized shell: data loading, toolbar, MIDI export, loading/empty/error states) → `PianoRollCanvas` (`useCanvasLoop`, device-DPR buffer, position extrapolated from `livePlayback` via `extrapolatePositionMs`/`easeDisplayPosition`, draws only the notes inside the window, loop sleeps when paused; Follow mode keeps the playhead at 30%, wheel scrolls rows when they overflow (else pans time; Shift/horizontal wheel always pans time), Ctrl+wheel time zoom, Alt+wheel and the ± buttons set the row height (`null` = auto), vertical drag and a draggable scrollbar scroll rows without leaving Follow (Follow re-centres rows only until the first manual scroll), edge markers show notes hidden above/below; time zoom and row height are persisted (`auralune_piano_roll_px_per_sec`, `auralune_piano_roll_row_height`, `auto` or px); click seeks in CSS pixels from the geometry of the last drawn frame; hover tooltip is updated imperatively, never through React state) · `pianoRollModel.ts` (pure: pitch range, `visibleNoteRange` binary search with `maxDuration` look-back, coordinate mapping, grid/ruler ticks, density, hit-test) · `pianoRollLayers.ts` (offscreen keyboard/row-stripe and minimap layers, rebuilt only when their key changes). `MusicAnalysisModal` does not read the live position — tabs that need it read it themselves (`ChordTimelineView` uses `useLivePositionMs`; the piano roll reads `livePlayback` in its draw loop).
- **`views/stats/`**:
  - `StatsDashboardView.tsx`: Listening recap, top artists, play counts, analytics, and direct Recap modal launcher. Routed via `MainContentRouter` when `activeTab === 'stats'`.
- **`views/changelog/`**:
  - `ChangelogView.tsx`: Paginated version history driven by [`src/data/changelog.json`](../../src/data/changelog.json) with configurable page sizes (3, 5, 10), first/last, prev/next, and smart ellipsis page navigation.
- **`views/settings/`**:
  - `AppSettingsModal.tsx`: Tabbed settings container (themes, devices, transcode, **updates** — also hosts the changelog, about, backup). `AboutSettingsView` shows the real version/channel/commit from `useUpdateManager`.

## Domain Hooks (`src/hooks`)
- **`usePlaybackController`**: Coordinates higher-level play, pause, next, previous, stop, seek, and loop operations.
- **`usePlaybackQueue`**: Queue management, reordering, shuffling, removing, and virtualized queue tracking.
- **`useLibraryManager`**: Library scanning, indexing progress, track loading, and album/artist queries using `useDeferredValue`.
- **`useLibraryPlaybackActions`**: Favorites, track ratings, play count resetting, adding tracks to playlists.
- **`useDspManager`**: DSP engine selection, 10-band graphic EQ, parametric EQ, compressor, saturator, limiter.
- **`useThemeManager`**: Theme tokens, custom wallpaper uploads, overlay opacity, and blur radius.
- **`useModalManager`**: Central modal state: one `isXOpen` / `setIsXOpen` pair (plus payload state) per modal.
- **`useUpdateManager`**: update state (`buildInfo`, `info`, `checking`, `installing`, `installed`, `progress`, `error`, `hasUpdate`) and actions `checkNow`/`install`/`restart`/`skip`/`setAutoCheck`. Listens to `auralune://update-available` and `auralune://update-progress`; reads settings `update_check_enabled` and `update_skipped_version`. `hasUpdate` drives the pulsing "Update" badge next to the version in `AppHeader`, which opens Settings → Updates (`views/settings/UpdatesSettingsView.tsx`, auto-check uses the shared `components/common/ToggleSwitch`, the update card is collapsed by default (pill, version, buttons; notes expand on demand), release notes render through `components/common/MarkdownText` + `utils/markdown.ts` (safe parser, no `innerHTML`), the Updates tab shows a pill while `hasUpdate`; managed installs get **Download & install** → **Restart now**, other install kinds a notice). Strings live in the `updates` locale namespace.
- **`useAudioSettings`**: Audio device selection, buffer sizes, bit-perfect toggle, volume OSD configurations.
- **`usePlaylistManager`**: Playlist CRUD, M3U8 import/export, and radio stations.
- **`useTranscodeManager`**: Audio conversion jobs, background progress tracking, and range exports.
- **`useMusicBrainzManager`**: MusicBrainz release queries, cover art fetching, and manual cover uploads.
- **`useScrobblerManager`**: Last.fm and ListenBrainz session authentication and scrobble dispatch.
- **`useSessionManager`**: App session bootstrap, audio health check, and system diagnostic reporting.
- **`useAmbienceMode`**: Ambient anime particle visualizers (Sakura, Neon Rain, Fireflies, Snow, Matrix Rain, Momiji, Embers).
- **`useVolumeUnit`**: Toggle volume display between percent (`%`) and decibels (`dBFS`).
- **`useInfinityQueue`**: Auto-recommendation queue continuation based on genre and artist similarity.
- **`useHotkeysManager`**: Global keyboard shortcuts coordinator with text-input guard. Registers one `keydown` listener and reads the latest props through a ref.
- **`useTauriEvent`**: Subscribe to a backend event (`useTauriEvent(name, handler, enabled?)`). Always use it instead of raw `listen()` in components/hooks — it keeps the latest handler and unsubscribes even when unmounted before `listen()` resolves.
- **`usePlaybackErrorToasts`**: Shows `auralune://playback-error` events from the playback ticker as error toasts (mounted once in `App`).
- **`useToasts`**: In-app notification queue (`showMessage(text, isError)` is stable; per-toast timers, max 3 visible, duplicates collapsed; info messages hidden unless `showInfo`).
- **`usePersistedState`**: `localStorage`-backed state where read and write share one key (`parse` validator, `legacyKeys` migration). Every mounted instance on a key stays in sync (a module-level subscriber registry plus the `storage` event), so a setting shown in several places, such as the lyrics romaji mode or the visualizer mode, changes everywhere at once. `parseBoolean` and `parseOneOf` cover the common parsers. Use it for new UI preferences instead of hand-written `getItem`/`setItem` pairs.
- **`useSleepTimer`**: Sleep timer countdown/fade-out; interval reads latest values via refs so frequent host re-renders do not reset it.
- **`useVirtualScroll` & `useQueueVirtualScroll`**: Windowed rendering for ultra-large track libraries.

## Prop Builder Hooks
Builders merge domain-hook results ("managers") with values from `App`. Managers are typed as `ReturnType<typeof useXManager>`; merged values are asserted to the intersection of their sources, so every value's **type** is checked, but **completeness** is not. After changing a view's props, check that every value is still provided by a manager or by `App`; missing values are silently `undefined` at runtime (that bug class broke crossfeed, add-to-queue and restore-session before Phase 5).
- **`useAppHeaderProps`**: Assembles props for `AppHeader`.
- **`useBottomPlaybackDockProps`**: Assembles props for `BottomPlaybackDock`.
- **`useMainContentRouterProps`**: Assembles view routing parameters for `MainContentRouter` (including `statsProps`).
- **`useMainRouterProps`**: Bundles child view props (`playerProps`, `libraryProps`, `dspProps`, `playlistsProps`, `statsProps`).
- **`useAppModalsProps`**: Bundles props required by all modals in `AppModalsContainer`.
- **`useAppSettingsModalProps`**: Bundles settings tabs into `AppSettingsModal`.

## Performance & Responsiveness Principles
0. **Live Playback Store (`src/state/livePlayback.ts`)**:
   - Status arrives via the `auralune://playback-status` event (watchdog falls back to `get_status` once per second if events stop).
   - Every frame publishes `position_ms` + `spectrum` to `livePlayback`; React state in `App` is only updated when `shouldCommitStatus` (`src/state/statusCommit.ts`) reports a structural change or a ≥1 s position step.
   - Components that draw progress/visualizers read live values with `useLiveStatus(status)`, `useLivePositionMs(fallback)` or `useLiveSpectrum(fallback)` (PlayerView, BottomPlaybackDock, BigScreenView, DspStudioView, MiniPlayerWidget, DesktopLyricsOverlay, LoopEditorModal, TrackBookmarksModal, MusicAnalysisModal, StemProjectStudioModal). Event handlers needing the exact position call `currentPositionMs(fallback)`. Never read `status.position_ms` for display — it is up to 1 s stale.
   - Per-frame logic (A-B loop) runs inside the status handler in `usePlaybackController`, not in effects on `status`.
1. **Two-Phase Seeking**:
   - `handleSeekPreview(pos)`: Instant 60/120 FPS UI feedback without IPC traffic while dragging (writes only to `livePlayback`, no `App` re-render). Supported across all progress sliders (`<input type="range">`) and animated `WaveformCanvas` visual styles (`smooth`, `bars`, `scrolling`, `mirror`) with pointer capture (`setPointerCapture`) and real-time hover/drag timestamp badges.
   - `handleSeekCommit(pos)`: Dispatched once on pointer/mouse/key up with `seek_with_fade` (20-48ms anti-pop micro-fade).
2. **Dual-Mode Zero-Latency & Smooth Fade Volume Control**:
   - **Post-Queue Pipeline Placement**: In GStreamer, the `volume` element is linked downstream of `queue_sink` (`... -> queue_sink -> volume -> sink`), eliminating 600ms buffer latency so volume adjustments take effect at the hardware sink within < 15ms.
   - **Instant Response Mode (`instantVolume: true`)**:
     - Slider dragging dispatches immediate 0ms initial IPC followed by display-synchronized `requestAnimationFrame` coalesced updates with trailing-edge delivery.
     - Backend `set_volume` operates directly on an atomic value (`< 1 µs`) and sets GStreamer property immediately.
   - **Smooth Fade Mode (`instantVolume: false`)**:
     - Backend `set_volume_smooth` runs an 8ms micro-step S-curve cosine interpolation ramp (default 120ms for jumps/mute, 60ms for slider drag) on a dedicated lightweight thread with instant generation-based cancellation.
     - Frontend animates the visual slider thumb synchronously via `requestAnimationFrame` for silky smooth, click-free audio and UI transitions.
   - **Toggle Mute (`handleToggleMute`)**:
     - In instant mode: snaps immediately to 0 or restores previous level.
     - In smooth mode: smoothly eases out to 0 or eases in from 0 over 120ms.
3. **Interaction Guards Against Rubberbanding**:
   - `isSeekingRef` and `isVolumeInteractingRef` protect the UI state from being overwritten by delayed backend polling responses.
4. **Backend-Driven Status Cadence**:
   - The backend ticker emits status every 100 ms while playing and every 250 ms while paused or stopped; the frontend does not poll.
5. **Background Visualizer Optimization**:
   - `SpectrumVisualizer` and `AnimeAmbienceFX` listen for `document.hidden` and pause animation loops when minimized or hidden.

## UI Components & Lazy Loaded Modals (`src/components`)
- **Modals**: All modal dialogs in `AppModalsContainer.tsx` use `React.lazy()` and `<React.Suspense fallback={null}>` to keep the initial JavaScript bundle small and fast to load.
- **Layout & Player Components**: Extensively wrapped with `React.memo` to prevent unnecessary rerenders during playback time ticks.

## Styling (Tailwind CSS v4)

- **Entry**: `src/index.css` imports Tailwind and three partials: `styles/theme.css` (runtime theme defaults on `:root`, bridged to utilities with `@theme inline`; type, tracking, breakpoint and motion scales), `styles/base.css` (element defaults in `@layer base`) and `styles/utilities.css` (`glass-panel`, `glass-card`, `label-caps` components; `bg-accent-gradient`, `range-fill`, `bg-modal` utilities).
- **Theme**: `useThemeManager` rewrites `--bg-*`, `--accent-*`, `--text-*` on `<html>`; utilities such as `text-fg-muted` or `bg-accent-pink/15` read them live, so a theme switch needs no re-render.
- **Primitives**: `components/ui/` — `ModalShell` (every dialog: semantics, Escape, backdrop, z-index layer) and `Callout`. Merge conditional classes with `cn()` (`utils/cn.ts`); pass runtime CSS variables with `cssVars()`.
- **Inline styles** are for runtime values only (live progress, playback-driven transforms, per-item colours, canvas sizes) and for a few hand-drawn artwork gradients (turntable, tape deck, big screen).
- Full conventions: the `tailwind-v4` skill (`skills/frontend/tailwind-v4/SKILL.md`).

## IPC Layer (`src/api`)
- [`api/ipc.ts`](../../src/api/ipc.ts): the only `invoke` the app may use. Accepts only `CommandName` (generated union of registered commands), rethrows every failure as `IpcError { code, command, message }` (`String(err)` returns the plain message). Helpers: `errorMessage(e)`, `isIpcError(e, code?)`.
- [`api/commands.generated.ts`](../../src/api/commands.generated.ts): generated by `npm run gen:commands` from `generate_handler!` in `lib.rs`. Never edit by hand; `ipc_contract_test.rs` fails when it is stale.
- [`api/settings.ts`](../../src/api/settings.ts): `getSetting(key)` / `setSetting(key, value)` over a closed `SettingKey` union. Add new keys to `SETTING_KEYS`.
- oxlint `no-restricted-imports` forbids importing `invoke` from `@tauri-apps/api/core` outside `src/api/`, `src/test/` and test files.
- Tests: `src/test/setup.ts` globally mocks `@tauri-apps/api/core`; import the shared mock with `import { invokeMock } from '../test/ipcMock'` (reset to resolve `undefined` before each test). Do not add per-file `vi.mock('@tauri-apps/api/core')` blocks.

## Type Contracts (`src/types`)
- `queue.ts`: `QueueItem`, `PlaybackQueue`, `QueueColumnConfig`.
- `playlist.ts`: `Playlist`.
- `theme.ts`: `ThemeTokens`, `Theme`.
- `equalizer.ts`: `EqualizerPreset`, `EQUALIZER_BANDS`.
- `player.ts`: `DspEngineType`, `DEFAULT_PLAYBACK_STATUS`; re-exports `TrackRecord`/`AlbumRecord` (from `library.ts`), `PlaybackStatus`/`DspCapabilities` (from `playback.ts`) and `AudioCard` (from `audioDevices.ts`). Define each backend contract **once**, in its domain module.
- `navigation.ts`: `MainTabType` (routed views), `SettingsRedirectTab`, `AppTab`, `SettingsTab`, `isMainTab()`.
- `analysis.ts`: `TrackKeyBpm`, `ChordSegment`, `AiModelInfo`.
- `utils/chordChart.ts`: `groupByBar(cells, bpm)` also splits any cell longer than one bar (legacy data) using `60000/bpm*4`; `ChordOverview` takes `durationMs` to span the whole track.

## DSP & Audio Math Utilities (`src/utils`)
- `parametricEqMath.ts`: Biquad filter transfer functions, frequency response curves, safe preamp calculations.
- `autoEqDatabase.ts`: Curated database of AutoEQ headphone profiles.
- `harmonicMixing.ts`: Camelot wheel harmonic key matching and musical transposition algorithms.
- `vinylSimulator.ts`: Real-time vinyl record simulation (surface noise, crackles, wow & flutter).
- `soundscapeAudio.ts`: Procedural ambient soundscapes (rain, thunder, cafe, waves, night ambient).
- `romaji.ts`: Transliterates Japanese Kanji, Hiragana, and Katakana titles into Latin Romaji.
- `timeFormat.ts`: Time formatters (`formatTime`, `formatTimeMs`, `parseTimeToMs`).
- `fileSizeFormat.ts`: Human-readable byte formatting (`formatBytes`).
- `fmt.ts`: `fmt(template, ...args)` fills `{0}`, `{1}` … in translation strings. Never chain `.replace('{0}', …)` (it only replaces the first occurrence and treats `$&` specially).
- Components must use these formatters rather than local copies.

## Internationalization (`src/locales` & `src/i18n.ts`)
Standalone JSON translation dictionaries in `src/locales/`:
- 🇬🇧 English (`en.json`)
- 🇵🇱 Polish (`pl.json`)
- 🇩🇪 German (`de.json`)
- 🇫🇮 Finnish (`fi.json`)
- 🏛️ Latin (`la.json`)

`i18n.test.ts` checks that every English key exists in every language; `i18n.parity.test.ts` checks the reverse (no stale keys) and that each message has the same `{n}` placeholders as English (required by `fmt`).

## Adding a new modal dialog

1. Add an `isMyModalOpen` / `setIsMyModalOpen` state pair (and any payload state) to [`src/hooks/useModalManager.ts`](../../src/hooks/useModalManager.ts) and return it.
2. Create your modal component under `src/components/modals/MyNewModal.tsx` and wrap its content in `<ModalShell onClose={…}>` from `components/ui` (pick a `layer` if it opens above another modal).
3. Export it in `src/components/modals/index.ts`.
4. Register its lazy-loaded import (`React.lazy`) and conditional render in [`AppModalsContainer.tsx`](../../src/components/modals/AppModalsContainer.tsx).
5. Pass the open state and setters to the modal through `useAppModalsProps`, and open it with `modalManager.setIsMyModalOpen(true)`.

## Changelog entries

Rules for tone and humanization live in [`CHANGELOG.md`](../../CHANGELOG.md); full workflow commands live in [`agent-pipelines.md`](agent-pipelines.md).

1. **During Active Development (on `dev`)**:
   - Rewrite user-facing changes in plain, non-technical language for listeners and append them to the active `"isDev": true` block in [`src/data/changelog.json`](../../src/data/changelog.json) using `npm run changelog:add`.
   - `ChangelogView.tsx` reads `buildInfo?.channel` (or `-dev` version fallback) so `dev` builds show the active `"isDev": true` entry with a `DEV BUILD` badge, while `stable` builds filter it out.
2. **On Release (`npm run changelog:promote`)** (see [`docs/RELEASING.md`](../RELEASING.md)):
   - Promote the active `isDev` block via `npm run changelog:promote -- X.Y.Z "Codename"` (clears `isDev`, sets `isLatest: true`, clears `isLatest` from older versions).
   - Ensure every item matches `ChangelogRelease` / `ChangelogItem`:
     ```json
     {
       "version": "1.1.6",
       "codename": "Release Codename",
       "date": "YYYY-MM-DD",
       "author": "Author Name",
       "isLatest": true,
       "added": [
         {
           "en": "Feature description",
           "pl": "Opis funkcji",
           "de": "Funktionsbeschreibung",
           "fi": "Ominaisuuden kuvaus",
           "la": "Descriptio facultatis"
         }
       ],
       "changed": [],
       "fixed": []
     }
     ```
   - **Never hardcode entries into `ChangelogView.tsx`**: `ChangelogView.tsx` consumes `changelog.json`, filters by channel, paginates, and localizes automatically.
   - Run `npm run changelog:validate`, `vitest run src/views/changelog/ChangelogView.test.tsx`, `vitest run scripts/changelog.test.mjs`, and `vitest run src/i18n.test.ts`.

