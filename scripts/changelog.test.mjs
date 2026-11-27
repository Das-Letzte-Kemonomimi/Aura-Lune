// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addChangelogEntry,
  extractReleaseField,
  formatDevReleaseNotes,
  formatReleaseNotes,
  humanizeWarnings,
  promoteDevRelease,
  validateChangelog,
} from './changelog.mjs';

const ITEM_A = {
  en: 'Smooth volume transitions without clicks.',
  pl: 'Płynna zmiana głośności bez trzasków.',
  de: 'Weiche Lautstärkeübergänge ohne Knacken.',
  fi: 'Sulavat äänenvoimakkuuden siirtymät ilman naksahduksia.',
  la: 'Transitus soni lenes sine strepitu.',
};

const BASE_STABLE = [
  {
    version: '1.1.5',
    codename: 'Stable Baseline',
    date: '2026-11-15',
    author: 'Das Letzte Kemonomimi',
    isLatest: true,
    added: [ITEM_A],
    fixed: [],
  },
];

describe('scripts/changelog pipeline', () => {
  it('validates clean releases and real repo invariants', () => {
    const result = validateChangelog(BASE_STABLE);
    expect(result.errors).toEqual([]);
  });

  it('rejects duplicate isDev entries, non-index-0 isDev, or missing locales', () => {
    const bad = [
      { ...BASE_STABLE[0], isLatest: false },
      { ...BASE_STABLE[0], version: '1.1.6-dev', isDev: true, isLatest: true },
    ];
    const { errors } = validateChangelog(bad);
    expect(errors.some((e) => e.includes('index 0'))).toBe(true);
    expect(errors.some((e) => e.includes('isLatest=true'))).toBe(true);
  });

  it('creates an isDev entry on add and deduplicates identical items', () => {
    const withOne = addChangelogEntry(BASE_STABLE, {
      section: 'changed',
      item: ITEM_A,
      version: '1.1.6-dev',
      date: '2026-11-26',
    });
    expect(withOne[0].version).toBe('1.1.6-dev');
    expect(withOne[0].isDev).toBe(true);
    expect(withOne[0].changed).toHaveLength(1);
    expect(withOne[1].isLatest).toBe(true);

    const deduped = addChangelogEntry(withOne, {
      section: 'changed',
      item: ITEM_A,
      version: '1.1.6-dev',
      date: '2026-11-26',
    });
    expect(deduped[0].changed).toHaveLength(1);
    expect(validateChangelog(deduped).errors).toEqual([]);
  });

  it('promotes the active isDev entry to a stable release with isLatest=true', () => {
    const dev = addChangelogEntry(BASE_STABLE, {
      section: 'added',
      item: ITEM_A,
      version: '1.1.6-dev',
      date: '2026-11-26',
    });
    const promoted = promoteDevRelease(dev, {
      version: '1.2.0',
      codename: 'Clearer Notes',
      date: '2026-12-01',
    });
    expect(promoted[0].version).toBe('1.2.0');
    expect(promoted[0].codename).toBe('Clearer Notes');
    expect(promoted[0].isDev).toBeUndefined();
    expect(promoted[0].isLatest).toBe(true);
    expect(promoted[1].isLatest).toBe(false);
    expect(validateChangelog(promoted).errors).toEqual([]);
    expect(extractReleaseField(promoted, '1.2.0', 'codename')).toBe('Clearer Notes');
    expect(formatReleaseNotes(promoted[0], 'en')).toContain('### ✨ Added');
  });

  it('formats dev release notes and warns on un-humanized internal jargon', () => {
    const dev = addChangelogEntry(BASE_STABLE, {
      section: 'fixed',
      item: {
        ...ITEM_A,
        en: 'Fixed seek_with_fade IPC race in crates/audio-engine/src/lib.rs.',
      },
      version: '1.1.6-dev',
      date: '2026-11-26',
    });
    expect(formatDevReleaseNotes(dev, 'en')).toContain('v1.1.6-dev');
    expect(humanizeWarnings(dev[0].fixed[0]).length).toBeGreaterThan(0);
    expect(validateChangelog(dev).warnings.length).toBeGreaterThan(0);
  });

  it('validates the repository src/data/changelog.json file', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const raw = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'changelog.json'), 'utf8'));
    const { errors, warnings } = validateChangelog(raw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
