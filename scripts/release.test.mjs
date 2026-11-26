// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bumpSemver,
  collectVersionState,
  compareSemver,
  encodeShieldsPart,
  nextDevVersion,
  resolveTargetVersion,
  rewriteReadmeBadge,
  verifyVersionParity,
} from './release.mjs';

describe('scripts/release SemVer helpers', () => {
  it('bumps patch, minor, major, and next dev versions accurately', () => {
    expect(bumpSemver('1.1.5', 'patch')).toBe('1.1.6');
    expect(bumpSemver('1.1.5', 'minor')).toBe('1.2.0');
    expect(bumpSemver('1.1.5', 'major')).toBe('2.0.0');
    expect(nextDevVersion('1.2.0')).toBe('1.2.1-dev');
    expect(compareSemver('1.2.0', '1.1.5')).toBeGreaterThan(0);
  });

  it('auto-recommends minor when dev changelog has added entries and patch otherwise', () => {
    expect(
      resolveTargetVersion({
        spec: 'auto',
        latestStableVersion: '1.1.5',
        devEntry: { added: [{}], changed: [], fixed: [] },
      }),
    ).toBe('1.2.0');

    expect(
      resolveTargetVersion({
        spec: 'auto',
        latestStableVersion: '1.1.5',
        devEntry: { added: [], changed: [{}], fixed: [{}] },
      }),
    ).toBe('1.1.6');

    expect(() =>
      resolveTargetVersion({
        spec: '1.1.5',
        latestStableVersion: '1.1.5',
        devEntry: { added: [], changed: [], fixed: [] },
      }),
    ).toThrow(/newer than/);
  });
});

describe('scripts/release README badge updater', () => {
  it('escapes shields characters and rewrites both English and Polish badges', () => {
    expect(encodeShieldsPart('“Dock & Wave-Mix_v2”')).toBe('“Dock_%26_Wave--Mix__v2”');

    const enReadme = `  <p>\n    <a href="https://github.com/Das-Letzte-Kemonomimi/Aura-Lune/releases/tag/v1.1.5"><img src="https://img.shields.io/badge/version-1.1.5_“Old_Name”-f43f5e.svg?style=for-the-badge" alt="Version" /></a>\n  </p>`;
    const updatedEn = rewriteReadmeBadge(enReadme, {
      version: '1.2.0',
      codename: 'Clear & Bright',
      label: 'version',
      quotes: 'english',
    });
    expect(updatedEn).toContain('releases/tag/v1.2.0');
    expect(updatedEn).toContain('version-1.2.0_“Clear_%26_Bright”-f43f5e.svg');

    const plReadme = `  <p>\n    <a href="https://github.com/Das-Letzte-Kemonomimi/Aura-Lune/releases/tag/v1.1.5"><img src="https://img.shields.io/badge/wersja-1.1.5_„Stary_Tytuł”-f43f5e.svg?style=for-the-badge" alt="Wersja" /></a>\n  </p>`;
    const updatedPl = rewriteReadmeBadge(plReadme, {
      version: '1.2.0',
      codename: 'Jasno i Czysto',
      label: 'wersja',
      quotes: 'polish',
    });
    expect(updatedPl).toContain('releases/tag/v1.2.0');
    expect(updatedPl).toContain('wersja-1.2.0_„Jasno_i_Czysto”-f43f5e.svg');
  });
});

describe('scripts/release parity checker', () => {
  it('detects version mismatches and passes when all files align', () => {
    const cleanState = {
      cargo: '1.2.0',
      packageJson: '1.2.0',
      packageLock: '1.2.0',
      tauriConf: '1.2.0',
      installSh: '1.2.0',
      pkgbuild: '1.2.0',
      pkgbuildBin: '1.2.0',
      srcinfoPkgver: '1.2.0',
      featureMatrix: '1.2.0',
      developmentAppImage: '1.2.0',
      developmentDeb: '1.2.0',
      readmeEnHasTag: (v) => v === '1.2.0',
      readmePlHasTag: (v) => v === '1.2.0',
      changelogTop: { version: '1.2.0', isLatest: true, isDev: false },
    };

    expect(verifyVersionParity(cleanState, '1.2.0')).toEqual([]);
    expect(
      verifyVersionParity({ ...cleanState, cargo: '1.2.0-dev', readmePlHasTag: () => false }, '1.2.0'),
    ).toEqual([
      'Cargo.toml: version is "1.2.0-dev", expected "1.2.0".',
      'README.pl.md: missing releases/tag/v1.2.0 badge link.',
    ]);
  });

  it('reads current repo manifests and matches live README badge patterns', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const state = collectVersionState(root);
    expect(state.cargo).toMatch(/^\d+\.\d+\.\d+(-dev)?$/);
    expect(state.packageJson).toBe(state.cargo);
    expect(state.tauriConf).toBe(state.cargo);

    const en = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
    const pl = fs.readFileSync(path.join(root, 'README.pl.md'), 'utf8');
    expect(
      rewriteReadmeBadge(en, { version: '1.2.0', codename: 'Test Echo', label: 'version', quotes: 'english' }),
    ).toContain('releases/tag/v1.2.0');
    expect(
      rewriteReadmeBadge(pl, { version: '1.2.0', codename: 'Testowe Echo', label: 'wersja', quotes: 'polish' }),
    ).toContain('releases/tag/v1.2.0');
  });
});
