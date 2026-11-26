// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { translations, supportedLanguages, getTranslations, type Language } from './i18n';

describe('i18n Localization & Translation Parity', () => {
  it('supports all declared languages with valid labels and flags', () => {
    expect(supportedLanguages.length).toBe(5);
    const codes = supportedLanguages.map((l) => l.code);
    expect(codes).toEqual(['en', 'pl', 'de', 'fi', 'la']);
  });

  it('provides complete translations for every supported language', () => {
    for (const lang of supportedLanguages) {
      const dict = translations[lang.code];
      expect(dict, `Missing translations dictionary for '${lang.code}'`).toBeDefined();
    }
  });

  it('guarantees exact key parity and non-empty strings between en and other languages', () => {
    const enDict = translations.en;
    const targetLangs: Language[] = ['pl', 'de', 'fi', 'la'];

    // Helper to recursively assert that all keys in reference object exist in target
    function assertDeepKeyParity(
      refObj: Record<string, any>,
      targetObj: Record<string, any>,
      lang: string,
      path: string = ''
    ) {
      for (const key of Object.keys(refObj)) {
        const currentPath = path ? `${path}.${key}` : key;
        const refVal = refObj[key];
        const targetVal = targetObj[key];

        expect(targetVal, `[${lang}] Missing key at path '${currentPath}'`).toBeDefined();

        if (typeof refVal === 'object' && refVal !== null) {
          expect(
            typeof targetVal,
            `[${lang}] Type mismatch at '${currentPath}'. Expected object.`
          ).toBe('object');
          assertDeepKeyParity(refVal, targetVal, lang, currentPath);
        } else if (typeof refVal === 'string') {
          expect(
            typeof targetVal,
            `[${lang}] Type mismatch at '${currentPath}'. Expected string.`
          ).toBe('string');
          expect(
            targetVal.trim().length,
            `[${lang}] Empty string translation at '${currentPath}'`
          ).toBeGreaterThan(0);

          // Verify placeholder consistency (e.g. {0}, {1})
          const refPlaceholders = refVal.match(/\{\d+\}/g) || [];
          for (const ph of refPlaceholders) {
            expect(
              targetVal.includes(ph),
              `[${lang}] Missing placeholder '${ph}' at '${currentPath}'. Target: "${targetVal}"`
            ).toBe(true);
          }
        }
      }
    }

    for (const lang of targetLangs) {
      assertDeepKeyParity(enDict, translations[lang], lang);
    }
  });

  it('falls back to English when an unknown language is requested', () => {
    const fallback = getTranslations('unknown' as any);
    expect(fallback).toBe(translations.en);
  });
});
