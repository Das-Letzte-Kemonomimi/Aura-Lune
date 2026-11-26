---
name: i18n-sync
description: 'Enforcing key parity and translation completeness across languages in Aura-Lune i18n dictionaries.'
metadata:
  namespace: quality
---
# i18n Synchronization & Localization Best Practices

This skill guides agents when modifying UI text, adding new features, or touching `src/i18n.ts` and `src/locales/*.json`.

## Rules for Localization

1. **Synchronized Additions Across All 5 Locales**:
   - Every new string added to the `Translations` type (derived from `src/locales/en.json`) must be added to **all five** dictionaries: `en.json`, `pl.json`, `de.json`, `fi.json`, and `la.json` in `src/locales/`.
   - Use `fmt(template, ...args)` from `src/utils/fmt.ts` for `{0}`, `{1}` placeholders and preserve identical placeholder indices across all five languages. Never chain `.replace('{0}', ...)`.
   - During releases, `src/data/changelog.json` entries must also include all five languages (`pl`, `en`, `de`, `fi`, `la`).

2. **Technical Audio Nomenclature**:
   - Standard audio terminology (e.g., *Gain*, *Q-factor*, *HPSS*, *Stem Separation*, *BPM*, *Camelot Wheel*, *PipeWire*, *Buffer Size*) should remain consistent across languages or be accompanied by recognizable standard terms.

3. **Mandatory Pre-Commit Validation**:
   - Run `npm test` to verify 100% key parity, no stale keys, and matching `{n}` placeholders (`src/i18n.test.ts` and `src/i18n.parity.test.ts`).
   - Run `npm run lint`, `npm run typecheck`, and `npm run build` before declaring the task complete or committing.
