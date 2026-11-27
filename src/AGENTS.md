# AGENTS.md: Frontend (`src/`)

This file gives agents the essentials for the React frontend. The repository-wide rules (quality gates, commits, releases) are in the root [`AGENTS.md`](../AGENTS.md). The detailed map (every view, hook and prop builder) is in [`docs/developer/frontend-architecture.md`](../docs/developer/frontend-architecture.md). Read it when you need that depth.

## What this is

The Aura-Lune UI is a React 19 + TypeScript (strict) + Vite single-page app rendered in the Tauri 2 WebView. It never touches files, audio or the network itself. Everything goes through typed IPC to the Rust host in `src-tauri/`, and the Rust host pushes live state back as events:

- **Commands** (React → Rust): `invoke()` from `src/api/ipc.ts`.
- **Events** (Rust → React): `auralune://playback-status` (every 100 ms while playing, 250 ms otherwise), `auralune://playback-error`, `auralune://update-available`, `auralune://update-progress`, …

## Commands

```bash
# Dev
npm run tauri dev              # Full app: Tauri shell + Vite on 127.0.0.1:5173
npm run dev                    # Vite only, in a browser (no Tauri APIs; IPC calls fail)

# Quality gates (run before committing)
npm run lint                   # oxlint (.oxlintrc.json)
npm run typecheck              # tsc -b (strict)
npm test                       # vitest run (jsdom), src/**/*.test.ts(x)
npm run test:watch             # vitest in watch mode

# Run a single test file
npx vitest run src/state/livePlayback.test.ts

# After adding/removing/renaming a Tauri command
npm run gen:commands           # Regenerates src/api/commands.generated.ts from src-tauri/src/lib.rs

# Production bundle
npm run build                  # tsc -b && vite build → dist/
```

`npm test` runs only the Vitest suites. Rust tests, the smoke test and the other CI stages run through `./tests/run_all_tests.sh` (see the root `AGENTS.md`). Put pure logic in helpers under `utils/`, `state/` or a `*Model.ts` file next to the component, and test it without rendering (e.g. `components/player/piano-roll/pianoRollModel.ts`).

## Architecture in 60 seconds

```
src/
  main.tsx  App.tsx        React root; App is a slim declarative shell
  api/                     ipc.ts (the only invoke), settings.ts (SettingKey union),
                           commands.generated.ts (generated, never edit)
  state/                   livePlayback.ts (per-frame position/spectrum store),
                           statusCommit.ts (when App state may re-render)
  hooks/                   Domain hooks (use*Manager, usePlaybackController, useToasts,
                           useTauriEvent, usePersistedState…) + prop-builder hooks
  views/                   Feature screens: player, library, dsp, playlists, stems,
                           stats, settings, changelog; big views split into sections/
  components/
    layout/                AppHeader, BottomPlaybackDock, MainContentRouter, prop builders
    modals/                Lazy-loaded dialogs + AppModalsContainer
    player/                Turntable, TapeDeck, VU meter, spectrum, waveform, lyrics, piano-roll/
    library/  common/      Library panes; shared widgets (ToggleSwitch, MarkdownText…)
  types/                   Backend contracts, each defined once in its domain module
  utils/                   DSP math, AutoEQ data, formatters (timeFormat, fmt, fileSizeFormat)
  locales/  i18n.ts        en, pl, de, fi, la dictionaries + loader
  data/changelog.json      In-app changelog
  test/                    setup.ts, ipcMock.ts, canvasMock.ts
  components/ui/           Shared primitives (Button, Chip, Card, fields, ModalShell…), tones.ts, icons.ts (icon barrel)
  index.css  styles/       Tailwind entry; theme tokens, base layer, project utilities
```

### How frontend talks to backend

Always go through `src/api/ipc.ts`. Its `invoke` accepts only `CommandName` (the generated union), so `tsc` rejects unknown commands. It rethrows every failure as `IpcError { code, command, message }`; use `errorMessage(e)` / `isIpcError(e, code?)`. oxlint's `no-restricted-imports` forbids importing `invoke` from `@tauri-apps/api/core` anywhere outside `src/api/`, `src/test/` and test files. Settings go through `getSetting` / `setSetting` in `api/settings.ts`; add new keys to `SETTING_KEYS`. Subscribe to backend events with `useTauriEvent(name, handler, enabled?)`, never raw `listen()`.

### Adding a Tauri command

1. Implement and register it on the Rust side (see [`src-tauri/AGENTS.md`](../src-tauri/AGENTS.md)).
2. Run `npm run gen:commands`. `src-tauri/tests/ipc_contract_test.rs` fails if the generated file is stale or if any `invoke('…')` targets an unregistered command.
3. Call it with `invoke('command_name', { camelCaseArgs })` from `src/api/ipc` inside the relevant domain hook, not directly from presentational components.
4. Cover the hook with a Vitest test using the shared `invokeMock`.

### Live playback state

The backend playback ticker is the clock. The frontend never polls; a watchdog falls back to `get_status` once per second only if events stop.

- Each status event publishes `position_ms`, `spectrum`, and settled `volume` to `state/livePlayback.ts`. React state in `App` updates only when `shouldCommitStatus` (`state/statusCommit.ts`) reports a structural change (state, track, DSP, EQ, committed volume), so `App` stays idle while playing uninterrupted.
- Anything that draws progress, visualizers, or volume controls reads `useLiveStatus(status)`, `useLivePositionMs(fallback)`, `useLiveSpectrum(fallback)`, `useLiveVolume(fallback)`, or `useLiveSelector(...)`. Event handlers that need the exact position or volume call `currentPositionMs(fallback)` / `currentVolume(fallback)`. **Never read `status.position_ms` for display**: `App` does not tick on time alone.
- Seeking is two-phase: `handleSeekPreview` writes only to `livePlayback` while dragging (no IPC, no re-render), and `handleSeekCommit` sends one `seek` on release. `isSeekingRef` / `isVolumeInteractingRef` guard against rubber-banding.
- Per-frame logic (A-B loop) runs inside the status handler in `usePlaybackController`, not in effects on `status`. Canvas loops (`useCanvasLoop`, `useFrameLoop`) sleep when paused or when `document.hidden`.

### Views, sections & modals

- Large views and modals are thin shells that compose **section components** from a sibling folder (`views/player/sections/`, `views/library/sections/`, `views/dsp/sections/`, …). A section's props are `Pick<ParentProps, …>` plus the parent locals it reads. Sections that don't draw live progress get the coarse `status` and are `React.memo`. Keep parent views under ~500 lines.
- **Modals** are `React.lazy` + `<React.Suspense fallback={null}>` in `components/modals/AppModalsContainer.tsx`. To add one: add an `isXOpen` / `setIsXOpen` state pair (plus any payload state) to `hooks/useModalManager.ts`, create the component, export it from `components/modals/index.ts`, register the lazy import and conditional render in `AppModalsContainer`, and pass the open state and setters through `useAppModalsProps`.
- **Prop builders** (`useAppHeaderProps`, `useMainRouterProps`, `useAppModalsProps`, …) merge manager hooks (`ReturnType<typeof useXManager>`) with values from `App`. Types are checked, but **completeness is not**: after changing a view's props, confirm that every value is still provided, or it is silently `undefined` at runtime.

## Conventions

- **TypeScript only**, `strict: true`. No `any` outside tests (oxlint warns). Use `catch (e: unknown)` + `errorMessage(e)`. Backend contracts live once in `types/<domain>.ts`, and `types/player.ts` re-exports them.
- **Styling**: Tailwind CSS v4, configured in CSS (no `tailwind.config.*`). `index.css` imports `styles/theme.css` (runtime theme defaults + `@theme` tokens), `styles/base.css` (element defaults) and `styles/utilities.css` (`glass-panel`, `glass-card`, `label-caps`, …). Use theme tokens (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent-pink/15`), never hex: the theme engine (`useThemeManager`) rewrites the underlying variables at runtime. Sizes are rem/em on fixed scales (`text-ui` = 0.8125rem is the body size). Merge conditional classes with `cn()` from `utils/cn.ts`. Build UI from the `components/ui/` primitives (`ModalShell` + `ModalHeader`/`Body`/`Footer`, `Button`, `IconButton`, `Chip`, `SegmentedControl`, `Card`, `SettingRow`, `TextField`, `Badge`, `SliderRow`, `Popover`, `Callout`, …); never hand-write button, chip, tab, field or badge class strings, and leave hover, focus, disabled and transition styles to the base layer. Inline `style` only for values computed at runtime (progress, transforms, per-item colours). Hover and selected states are `hover:` / `aria-pressed:` variants, never `e.currentTarget.style`. Full rules: the `tailwind-v4` skill (`skills/frontend/tailwind-v4/SKILL.md`). No CSS modules.
- **Icons**: Tabler, imported only from `components/ui/icons.ts`, which re-exports each icon under its app name (oxlint forbids importing `@tabler/icons-react` elsewhere). To add one, add a line to the barrel. Pass `fill="currentColor"` for a solid glyph and `stroke` for the stroke width; use the `icon-inline` utility for an icon inside running text. Never use emoji or text glyphs (✓ ● ⚠) as icons; emoji that are content (preset or soundscape names, toast text) stay.
- **Hooks**: `react-hooks/exhaustive-deps` is an **error**. An intentional mount-only effect needs an `oxlint-disable-next-line` with a reason. Long-lived timers read the latest values through refs (`useSleepTimer`, `useHotkeysManager`).
- **State**: component state via hooks, domain state in `use*Manager` hooks, per-frame data in `livePlayback`. UI preferences use `usePersistedState` (one key for read and write, `parse` validator), not hand-written `localStorage` pairs.
- **Formatting values**: use `utils/timeFormat.ts`, `utils/fileSizeFormat.ts`, and `fmt(template, …args)` for `{0}` placeholders. Never chain `.replace('{0}', …)` or write a local formatter copy.
- **i18n**: every user-visible string goes in all five `locales/*.json`. `i18n.test.ts` (all English keys exist everywhere) and `i18n.parity.test.ts` (no stale keys, same `{n}` placeholders) must pass. The `i18n-sync` skill helps.
- **Performance**: wrap layout and player components that receive ticking props in `React.memo`. Virtualize long lists (`useVirtualScroll`, `useQueueVirtualScroll`). Update hover tooltips on canvases imperatively, not through React state.
- **Conventional Commits** (`feat(player): …`, `fix(library): …`); see the root `AGENTS.md`.

## Testing

- Vitest with jsdom. `src/test/setup.ts` globally mocks `@tauri-apps/api/core`. Import the shared mock with `import { invokeMock } from '../test/ipcMock'`; it resets to resolve `undefined` before each test. **Do not add per-file `vi.mock('@tauri-apps/api/core')` blocks.**
- Canvas components use `src/test/canvasMock.ts`. Test files sit next to their source as `*.test.ts(x)`.
- Test active behaviour only. Never assert that a removed feature or element is absent; delete obsolete tests instead.

## Changelog data

[`data/changelog.json`](data/changelog.json) is the Single Source of Truth for the in-app changelog (`Settings → Updates & Changelog`). Read [`../CHANGELOG.md`](../CHANGELOG.md) for humanization rules and [`../docs/developer/agent-pipelines.md`](../docs/developer/agent-pipelines.md) for the CLI pipeline (`npm run changelog:add`, `changelog:validate`, `changelog:promote`). **Never hardcode entries in `ChangelogView.tsx`.** On `dev`, append listener-friendly 5-language entries directly into the active `"isDev": true` block (`dev` builds display it automatically, `stable` builds hide it).
