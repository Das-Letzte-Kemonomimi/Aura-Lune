# Developer Documentation

Reference documentation for Aura-Lune contributors and AI agents. The rules agents must follow are in the `AGENTS.md` files (root, `src/`, `src-tauri/`, `crates/`); these documents hold the detailed maps behind those rules.

## Documents

| Document | Contents |
|---|---|
| [`agent-pipelines.md`](agent-pipelines.md) | Automated agent & contributor pipelines (skills, IPC codegen, changelog, quality gates, releases) |
| [`architecture-guide.md`](architecture-guide.md) | System diagram, technology stack, repository layout |
| [`rust-architecture.md`](rust-architecture.md) | Core crates: domain, DSP, audio engine pipeline, storage, library, metadata, downloads, desktop integration; adding DB columns |
| [`tauri-commands.md`](tauri-commands.md) | Tauri host: setup/lifecycle modules, command modules and contracts, updater design; adding a command |
| [`frontend-architecture.md`](frontend-architecture.md) | Views, hooks, prop builders, performance principles, IPC layer, types, utils, i18n; adding a modal; changelog entries |
| [`testing.md`](testing.md) | Test locations per crate and the 7-stage CI-parity runner |

## Elsewhere in the repository

- [`../RELEASING.md`](../RELEASING.md) ([Polish](../RELEASING.pl.md)): release process with the manual GitHub Actions workflows
- [`../adr/`](../adr/): architecture decision records
- [`../architecture.md`](../architecture.md): original architecture vision (Polish), including the read-only policy for user files
- [`../FEATURE_MATRIX.md`](../FEATURE_MATRIX.md): feature matrix
- [`../../DEVELOPMENT.md`](../../DEVELOPMENT.md): system prerequisites, toolchain setup, the development pipeline, [agent skills for Claude Code and Antigravity](../../DEVELOPMENT.md#6-agent-skills-claude-code-and-antigravity), troubleshooting
