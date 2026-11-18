---
name: react-monolith-refactor
description: 'Safely refactoring, extracting hooks, and decomposing large monolithic React components like App.tsx in Aura-Lune.'
metadata:
  namespace: frontend
---
# React Monolith Refactoring & State Best Practices

This skill guides agents when reading, modifying, or refactoring `apps/desktop/src/App.tsx` (~20,700 lines) and complex React 19 components.

## Guidelines for Handling `App.tsx`

1. **Targeted Reading**:
   - Avoid reading all 20,000 lines of `App.tsx` into context at once.
   - Use `view_file` with precise line slices or grep for specific state variables / modal names before inspecting surrounding code.

2. **Domain-Driven Hook Extraction**:
   - When modifying or adding state, extract state and handlers into dedicated custom hooks in `apps/desktop/src/hooks/`:
     - `useAudioPlayer.ts`: Playback status, progress slider, volume, seeking.
     - `useLibrary.ts`: Tracks, albums, artists, scan progress, search query.
     - `useThemeEngine.ts`: Glassmorphism blur, background wallpaper, anime FX particles.
     - `usePlaybackQueue.ts`: Playback queue items, loop mode, shuffle.
   - Re-export clean hook interfaces to keep component files modular.

3. **Performance & Render Isolation**:
   - High-frequency UI updates (e.g. waveform scrubbing, volume OSD, FFT spectrum bars) must not trigger re-renders of the entire library list or modal tree.
   - Use React 19 hooks (`useCallback`, `useMemo`, `useTransition`) and isolate animated widgets (`SpectrumVisualizer`, `VuMeterWidget`) so only the canvas element re-draws.

4. **Localization Requirement**:
   - Every user-visible string must use the `t(...)` translation function from `apps/desktop/src/i18n.ts`. Never hardcode UI strings in JSX.

5. **Mandatory Pre-Commit Frontend Verification**:
   - Before committing any frontend modifications, always execute:
     ```bash
     npm --prefix apps/desktop run lint
     npm --prefix apps/desktop test
     npm --prefix apps/desktop run build
     ```
