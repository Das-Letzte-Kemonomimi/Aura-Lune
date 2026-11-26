import { describe, expect, it } from 'vitest';
import { translations, type Language } from './i18n';

type Dict = { [key: string]: string | Dict };

/** Wszystkie ścieżki kluczy z wartościami tekstowymi, np. `notifications.playingMsg`. */
function leaves(obj: Dict, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(path, v);
    else for (const [p, s] of leaves(v, path)) out.set(p, s);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort().join(',');

const en = leaves(translations.en as unknown as Dict);
const others: Language[] = ['pl', 'de', 'fi', 'la'];

describe('i18n dictionaries', () => {
  it.each(others)('%s has no keys that English lacks (stale entries)', (lang) => {
    const extra = [...leaves(translations[lang] as unknown as Dict).keys()].filter((k) => !en.has(k));
    expect(extra).toEqual([]);
  });

  it.each(others)('%s uses the same {n} placeholders as English for every message', (lang) => {
    const dict = leaves(translations[lang] as unknown as Dict);
    const mismatched = [...en]
      .filter(([k, v]) => dict.has(k) && placeholders(v) !== placeholders(dict.get(k) ?? ''))
      .map(([k, v]) => `${k}: en {${placeholders(v)}} vs ${lang} {${placeholders(dict.get(k) ?? '')}}`);
    expect(mismatched).toEqual([]);
  });
});
