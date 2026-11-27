// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkSkills, discoverAuthored, expectedSkills, linkAuthored } from './skills.mjs';

let root;

const write = (rel, content) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const skillMd = (name) => `---\nname: ${name}\ndescription: test skill\n---\n# ${name}\n`;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('expectedSkills', () => {
  it('returns the sorted union of locked and authored skills', () => {
    const authored = [{ name: 'release', area: 'system', dir: 'skills/system/release' }];
    expect(expectedSkills({ vite: {}, vitest: {} }, authored)).toEqual(['release', 'vite', 'vitest']);
  });

  it('rejects a name that is both authored and locked', () => {
    const authored = [{ name: 'vite', area: 'frontend', dir: 'skills/frontend/vite' }];
    expect(() => expectedSkills({ vite: {} }, authored)).toThrow(/both authored/);
  });
});

describe('discoverAuthored', () => {
  it('finds skills one area level deep and ignores folders without SKILL.md', () => {
    write('skills/audio/dsp/SKILL.md', skillMd('dsp'));
    write('skills/audio/notes/README.md', 'not a skill');
    expect(discoverAuthored(root)).toEqual([{ name: 'dsp', area: 'audio', dir: 'skills/audio/dsp' }]);
  });
});

describe('linkAuthored + checkSkills', () => {
  const setup = () => {
    write('skills/audio/dsp/SKILL.md', skillMd('dsp'));
    write('skills-lock.json', JSON.stringify({ version: 2, skills: { vite: {} } }));
    write('.agents/skills/vite/SKILL.md', skillMd('vite'));
    fs.mkdirSync(path.join(root, '.claude/skills'), { recursive: true });
    fs.symlinkSync('../../.agents/skills/vite', path.join(root, '.claude/skills/vite'), 'dir');
  };

  it('links authored skills for both agents and passes the check', () => {
    setup();
    linkAuthored(root, discoverAuthored(root));
    expect(fs.readlinkSync(path.join(root, '.agents/skills/dsp'))).toBe('../../skills/audio/dsp');
    expect(fs.readFileSync(path.join(root, '.claude/skills/dsp/SKILL.md'), 'utf8')).toContain('name: dsp');
    const result = checkSkills(root);
    expect(result.missing).toEqual([]);
    expect(result.problems).toEqual([]);
  });

  it('is idempotent', () => {
    setup();
    linkAuthored(root, discoverAuthored(root));
    expect(() => linkAuthored(root, discoverAuthored(root))).not.toThrow();
  });

  it('reports every missing entry for both agents', () => {
    setup();
    const { missing } = checkSkills(root);
    expect(missing).toEqual(['.agents/skills/dsp', '.claude/skills/dsp']);
  });

  it('refuses to replace a real directory with a symlink', () => {
    setup();
    write('.agents/skills/dsp/SKILL.md', skillMd('dsp'));
    expect(() => linkAuthored(root, discoverAuthored(root))).toThrow(/not a symlink/);
  });

  it('removes dangling links left by a deleted skill', () => {
    setup();
    linkAuthored(root, discoverAuthored(root));
    fs.rmSync(path.join(root, 'skills/audio/dsp'), { recursive: true });
    linkAuthored(root, discoverAuthored(root));
    expect(fs.existsSync(path.join(root, '.agents/skills/dsp'))).toBe(false);
    expect(fs.lstatSync(path.join(root, '.claude/skills/dsp'), { throwIfNoEntry: false })).toBeUndefined();
  });

  it('flags a frontmatter name that differs from the folder name', () => {
    setup();
    write('skills/audio/dsp/SKILL.md', skillMd('other-name'));
    linkAuthored(root, discoverAuthored(root));
    expect(checkSkills(root).problems[0]).toMatch(/declares name "other-name"/);
  });

  it('lists unmanaged skills as extra without failing', () => {
    setup();
    linkAuthored(root, discoverAuthored(root));
    write('.agents/skills/stray/SKILL.md', skillMd('stray'));
    const result = checkSkills(root);
    expect(result.extra).toEqual(['stray']);
    expect(result.missing).toEqual([]);
  });
});
