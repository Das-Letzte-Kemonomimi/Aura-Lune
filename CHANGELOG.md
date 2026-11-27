# Changelog Rules & Writing Guide

> **Looking for release history?**
> All release notes and unreleased development highlights live in [`src/data/changelog.json`](src/data/changelog.json) (Single Source of Truth) and are shown directly inside the app under **Settings → Updates & Changelog**, on **GitHub Releases**, and on rolling **`dev-build`** pre-releases.

This file defines the rules AI coding agents and contributors **must follow** whenever making user-facing changes in Aura-Lune.

---

## 1. Where & When to Record Changes

- **File to update**: `src/data/changelog.json` (prefer using `npm run changelog:add` rather than editing JSON by hand).
- **Target entry**: During normal work on `dev`, append entries to the single active **`"isDev": true`** object at index `0` (matching the current `-dev` app version, e.g. `1.1.6-dev`).
  - Builds on the **`dev`** channel (`auralune-dev`, `npm run tauri dev`) automatically display this entry at the top of **Settings → Updates & Changelog**.
  - Builds on the **`stable`** channel automatically hide `"isDev": true` entries until release day.
- **Never duplicate**: Do not add historical markdown blocks back into this file, do not re-create `CHANGELOG_PENDING.md`, and never hardcode entries inside `ChangelogView.tsx`.

### What needs an entry vs. what does NOT

| Needs a changelog entry | Skip changelog entry |
|---|---|
| New user-facing features, settings, views, hotkeys, audio formats | Internal code refactors with no visible behavior or speed change |
| Audible/visual bug fixes or crash/hang fixes | Test additions, lint cleanups, CI caching, agent skills |
| Measurable performance, memory, or startup improvements listeners feel | Documentation-only edits (`AGENTS.md`, `DEVELOPMENT.md`, `docs/`) |
| Security hardening affecting file/URL handling or config locations | Dependency version bumps unless they fix/change user behavior |

---

## 2. Humanization Rules (Write for Everyday Listeners)

Aura-Lune's changelog is read by music listeners inside the desktop app — **not everyone reading it is a programmer**. Before adding an item to `src/data/changelog.json`:

1. **Describe the user benefit, not the code**: Say *what sounds better, looks cleaner, or works more reliably*, not *how* the code was wired.
2. **Avoid internal implementation jargon**:
   - No internal file names (`lib.rs`, `usePersistedState.ts`, `install.sh`, `pipeline/`).
   - No internal symbol/hook/IPC names (`seek_with_fade`, `invoke()`, `lock_safe`, `PlaybackQueue::set_active_item`, `React.lazy`, `oxlint`, `vitest`, `clippy`).
   - Keep external audio/music terms users know (`FLAC`, `MIDI`, `EQ`, `ReplayGain`, `Crossfeed`, `DSP`, `MPRIS`, `PipeWire`), but drop internal plumbing acronyms (`IPC`, `CSP`, `HMM`, `STFT`, `SQLx`).
3. **One crisp, plain sentence (or two max)** per item. Consolidate related micro-fixes into a single clear bullet instead of listing 5 internal steps.
4. **Humanize before importing**: If drafting notes from commits or technical summaries, rewrite and simplify them *before* running `npm run changelog:add`.

### Examples

| Don't write (too technical) | Do write (listener-friendly) |
|---|---|
| `Fixed seek_with_fade two-stage IPC throttling in WaveformCanvas.tsx.` | `Two-stage seeking on progress sliders and waveforms with smooth time preview while dragging and a pop-free jump on release.` |
| `Split lib.rs from 4914 to 300 lines and removed 11 unused crates.` | *(Omit if purely structural, or if startup improved:)* `Faster app startup and lower memory usage.` |
| `Enforced path check and moved FIFO/socket from /tmp to XDG_RUNTIME_DIR.` | `Moved local playback control files into a private per-user runtime folder and hardened file/cover path checks.` |

---

## 3. Sections & Required Languages

Every changelog entry uses three optional/standard sections inside `ChangelogRelease`:
- **`added`** — New features, views, controls, modes, or capabilities.
- **`changed`** — Improvements, redesigns, performance gains, or localization updates.
- **`fixed`** — Bug fixes, crash/hang prevention, audio/timing accuracy fixes, and security hardening.

Every item must provide non-empty strings in all **five** UI locales (`supportedLanguages` in `src/i18n.ts`):
- `en` (English — also used for GitHub Release notes)
- `pl` (Polski)
- `de` (Deutsch)
- `fi` (Suomi)
- `la` (Latina)

---

## 4. Pipeline Commands (for Agents & Maintainers)

Full workflow reference: [`docs/developer/agent-pipelines.md`](docs/developer/agent-pipelines.md).

```bash
# Append a humanized entry to the active dev build block (reads package.json *-dev version)
npm run changelog:add -- \
  --type fixed \
  --en "Fixed gapless transitions stopping when the window is minimized." \
  --pl "Naprawiono przechodzenie między utworami przy zminimalizowanym oknie." \
  --de "Nahtlose Titelübergänge im minimierten Fenster behoben." \
  --fi "Korjattu kappaleiden saumaton vaihto ikkunan ollessa pienennettynä." \
  --la "Transitus continuus cantuum fenestra minima correctus."

# Or pipe JSON via stdin to avoid shell-quoting issues
npm run changelog:add -- --stdin <<'EOF'
{
  "type": "changed",
  "item": {
    "en": "...",
    "pl": "...",
    "de": "...",
    "fi": "...",
    "la": "..."
  }
}
EOF

# Validate schema, isDev / isLatest invariants, 5-language parity, and jargon checks
npm run changelog:validate

# At release time (/release): promote the active isDev block to X.Y.Z
npm run changelog:promote -- 1.2.0 "Release Codename"
```
