#!/usr/bin/env node
// Keeps the agent skills identical for Claude Code and Antigravity.
//
// Layout (skills/ and skills-lock.json are committed; .agents/ and .claude/ are generated):
//   skills/<area>/<name>/         authored project skills, the source of truth
//   skills-lock.json              pins every third-party skill (source, commit, content hash)
//   .agents/skills/<name>         real directory for third-party skills (Antigravity reads it),
//                                 symlink to skills/<area>/<name> for authored skills
//   .claude/skills/<name>         symlink to ../../.agents/skills/<name> (Claude Code reads it)
//
// Commands (see DEVELOPMENT.md, "Agent skills"):
//   npm run skills:check     offline: fail when an expected skill is missing for either agent
//   npm run skills:install   repair: restore third-party skills from the lock, relink, check
//   npm run skills:update    pull the newest upstream versions, rewrite the lock, relink, check
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Pinned so every contributor restores skills with the same CLI behaviour. */
export const SKILLS_CLI = 'skills@1.9.0';
/** Minimum Node version required by the skills CLI. */
export const MIN_NODE = [22, 20, 0];
const AGENTS = ['claude-code', 'antigravity'];
const AGENTS_DIR = path.join('.agents', 'skills');
const CLAUDE_DIR = path.join('.claude', 'skills');

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const frontmatterName = (skillFile) => {
  const head = fs.readFileSync(skillFile, 'utf8').split(/^---\s*$/m)[1] ?? '';
  return /^name:\s*['"]?([^'"\r\n]+?)['"]?\s*$/m.exec(head)?.[1] ?? null;
};

/** Authored skills: every `skills/<area>/<name>/SKILL.md`. */
export function discoverAuthored(root) {
  const base = path.join(root, 'skills');
  if (!isDir(base)) return [];
  const found = [];
  for (const area of fs.readdirSync(base).sort()) {
    const areaDir = path.join(base, area);
    if (!isDir(areaDir)) continue;
    for (const name of fs.readdirSync(areaDir).sort()) {
      const dir = path.join(areaDir, name);
      if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue;
      found.push({ name, area, dir: path.posix.join('skills', area, name) });
    }
  }
  return found;
}

/** Sorted union of locked third-party skills and authored skills; a name clash is an error. */
export function expectedSkills(lockSkills, authored) {
  const names = new Set(Object.keys(lockSkills));
  for (const { name } of authored) {
    if (names.has(name)) throw new Error(`Skill "${name}" is both authored in skills/ and locked in skills-lock.json`);
    names.add(name);
  }
  return [...names].sort();
}

const readLock = (root) => {
  const file = path.join(root, 'skills-lock.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')).skills ?? {};
};

/** Creates the two symlinks per authored skill and drops dangling links left by removed skills. */
export function linkAuthored(root, authored) {
  fs.mkdirSync(path.join(root, AGENTS_DIR), { recursive: true });
  fs.mkdirSync(path.join(root, CLAUDE_DIR), { recursive: true });

  const place = (linkPath, target) => {
    const existing = fs.lstatSync(linkPath, { throwIfNoEntry: false });
    if (existing && !existing.isSymbolicLink()) {
      throw new Error(`${linkPath} exists and is not a symlink; remove it (or rename the skill) and retry`);
    }
    if (existing && fs.readlinkSync(linkPath) === target) return;
    if (existing) fs.rmSync(linkPath);
    fs.symlinkSync(target, linkPath, 'dir');
  };

  for (const { name, dir } of authored) {
    place(path.join(root, AGENTS_DIR, name), path.posix.join('..', '..', dir));
    place(path.join(root, CLAUDE_DIR, name), path.posix.join('..', '..', '.agents', 'skills', name));
  }

  for (const dir of [AGENTS_DIR, CLAUDE_DIR]) {
    for (const entry of fs.readdirSync(path.join(root, dir))) {
      const full = path.join(root, dir, entry);
      if (fs.lstatSync(full).isSymbolicLink() && !fs.existsSync(full)) fs.rmSync(full);
    }
  }
}

/**
 * Compares what should exist with what both agents can actually load.
 * `missing` and `problems` fail the check; `extra` only informs.
 */
export function checkSkills(root) {
  const authored = discoverAuthored(root);
  const expected = expectedSkills(readLock(root), authored);
  const missing = [];
  const problems = [];

  for (const name of expected) {
    for (const dir of [AGENTS_DIR, CLAUDE_DIR]) {
      if (!fs.existsSync(path.join(root, dir, name, 'SKILL.md'))) missing.push(`${dir}/${name}`);
    }
  }
  for (const { name, dir } of authored) {
    const declared = frontmatterName(path.join(root, dir, 'SKILL.md'));
    if (declared !== name) problems.push(`${dir}/SKILL.md declares name "${declared}", expected "${name}"`);
  }

  const known = new Set(expected);
  const extra = isDir(path.join(root, AGENTS_DIR))
    ? fs.readdirSync(path.join(root, AGENTS_DIR)).filter((n) => !known.has(n))
    : [];
  return { expected, missing, problems, extra };
}

const nodeIsNewEnough = (version = process.versions.node) => {
  const have = version.split('.').map(Number);
  for (let i = 0; i < MIN_NODE.length; i += 1) {
    if ((have[i] ?? 0) !== MIN_NODE[i]) return (have[i] ?? 0) > MIN_NODE[i];
  }
  return true;
};

const runCli = (root, args) => {
  if (!nodeIsNewEnough()) {
    console.error(`The skills CLI needs Node >= ${MIN_NODE.join('.')} (found ${process.versions.node}). Run: nvm install 22`);
    process.exit(1);
  }
  const result = spawnSync('npx', ['--yes', SKILLS_CLI, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DISABLE_TELEMETRY: '1' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const report = (root) => {
  const { expected, missing, problems, extra } = checkSkills(root);
  for (const name of extra) console.warn(`note: unmanaged skill .agents/skills/${name} (not in skills-lock.json or skills/)`);
  for (const issue of problems) console.error(`problem: ${issue}`);
  if (missing.length > 0) {
    console.error(`Missing skill entries:\n${missing.map((m) => `  ${m}`).join('\n')}\nRun: npm run skills:install (requires network + Node >= ${MIN_NODE.join('.')}), then reload skills (/skills reload or start a new session).`);
  }
  if (missing.length > 0 || problems.length > 0) return false;
  console.log(`OK: ${expected.length} skills available to Claude Code and Antigravity.`);
  return true;
};

const main = () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const command = process.argv[2] ?? 'check';
  const agentFlags = AGENTS.flatMap((a) => ['-a', a]);

  if (command === 'check') {
    process.exit(report(root) ? 0 : 1);
  } else if (command === 'install') {
    runCli(root, ['experimental_install', ...agentFlags]);
    linkAuthored(root, discoverAuthored(root));
    process.exit(report(root) ? 0 : 1);
  } else if (command === 'update') {
    runCli(root, ['update', '-p', '-y']);
    runCli(root, ['experimental_install', ...agentFlags]);
    linkAuthored(root, discoverAuthored(root));
    process.exit(report(root) ? 0 : 1);
  } else {
    console.error('Usage: node scripts/skills.mjs [check|install|update]');
    process.exit(2);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
