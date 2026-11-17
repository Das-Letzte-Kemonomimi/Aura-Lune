---
name: i18n-sync
description: 'Enforcing key parity and translation completeness across languages in Aura-Lune i18n dictionaries.'
metadata:
  namespace: quality
---
# i18n Synchronization & Localization Best Practices

This skill guides agents when modifying UI text, adding new features, or touching `apps/desktop/src/i18n.ts`.

## Rules for Localization

1. **Synchronized Additions**:
   - Every new string added to the `Translations` interface in `apps/desktop/src/i18n.ts` must be added to all defined language dictionaries (at minimum `en` and `pl`).
   - Never leave a key missing in one language dictionary, as this causes runtime fallback errors or TypeScript compilation failures.

2. **Technical Audio Nomenclature**:
   - Standard audio terminology (e.g., *Gain*, *Q-factor*, *HPSS*, *Stem Separation*, *BPM*, *Camelot Wheel*, *PipeWire*, *Buffer Size*) should remain consistent across languages or be accompanied by recognizable standard terms.

3. **Validation**:
   - Run `npm --prefix apps/desktop run build` to ensure TypeScript verifies that all language dictionaries strictly satisfy the `Translations` type interface.
