---
name: react-monolith-refactor
description: 'Safely refactoring, extracting hooks, and decomposing large monolithic React components like App.tsx in Aura-Lune.'
metadata:
  namespace: frontend
---
# React Monolith Refactoring & State Best Practices

This skill guides agents when reading, modifying, or keeping `src/App.tsx` (~1,280 lines), `src/components/modals/AppModalsContainer.tsx` (~1,034 lines), and large React 19 components slim.

## Guidelines for Handling `App.tsx`

1. **Targeted Reading**:
   - Read targeted line slices or search for specific state variables, hooks, or modal names before editing large files.

2. **Domain-Driven Hook Extraction**:
   - Keep `App.tsx` as a declarative shell. Extract state, IPC calls, and handlers into dedicated custom hooks in `src/hooks/`:
     - `usePlaybackController.ts`: Playback status, seek preview/commit, volume, transport.
     - `useLibraryManager.ts`: Tracks, albums, artists, scan progress, search query.
     - `useThemeManager.ts`: Theme tokens, background wallpaper, overlay opacity, blur.
     - `usePlaybackQueue.ts`: Playback queue items, loop mode, shuffle.
     - `useAppHeaderProps.ts`, `useBottomPlaybackDockProps.ts`, `useMainRouterProps.ts`, `useAppModalsProps.ts`: Prop builders covered by completeness unit tests.
   - Persist UI preferences with `usePersistedState` rather than raw `localStorage` pairs.

3. **Performance & Render Isolation**:
   - High-frequency UI updates (waveform scrubbing, volume OSD, FFT spectrum bars) read from `src/state/livePlayback.ts` (`useLiveStatus`, `useLivePositionMs`, `useLiveSpectrum`) so `App` does not re-render every tick.
   - Wrap layout and non-ticking section components in `React.memo`, and isolate animated canvas widgets (`SpectrumVisualizer`, `VuMeterWidget`, `WaveformCanvas`, `PianoRollCanvas`) so only the canvas redraws via `useCanvasLoop`.

4. **Localization Requirement**:
   - Every user-visible string must live in all five `src/locales/*.json` dictionaries (`en`, `pl`, `de`, `fi`, `la`) and use `fmt()` (`src/utils/fmt.ts`) for `{n}` placeholders. Never hardcode UI strings in JSX.

5. **Mandatory Pre-Commit Frontend Verification**:
   - Before committing any frontend modifications, always execute:
     ```bash
     npm run lint
     npm run typecheck
     npm test
     npm run build
     ```
