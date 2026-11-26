#!/usr/bin/env node
// Single-source-of-truth changelog pipeline for `src/data/changelog.json`.
//
// Commands:
//   npm run changelog:validate               Check schema, dev/latest flags, and 5-language parity
//   npm run changelog:add -- ...             Append a humanized entry to the active `isDev` release
//   npm run changelog:promote -- X.Y.Z "..." Promote the active `isDev` entry to a stable release
//   node scripts/changelog.mjs notes <ver> <codename|date|notes>
//   node scripts/changelog.mjs dev-notes [--lang en]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LANGUAGES = ['en', 'pl', 'de', 'fi', 'la'];
export const SECTIONS = ['added', 'changed', 'fixed'];
export const DEFAULT_AUTHOR = 'Das Letzte Kemonomimi';
export const DEV_CODENAME = 'Development Channel';
export const CHANGELOG_REL_PATH = path.join('src', 'data', 'changelog.json');

const TECHNICAL_PATTERNS = [
  { label: 'internal source filename', re: /\b[A-Za-z0-9_-]+\.(rs|tsx|ts|mjs|sh|ya?ml)\b/g },
  { label: 'Rust module path (::)', re: /\b[a-z_][a-z0-9_]*::[A-Za-z0-9_]+/g },
  { label: 'repo directory path', re: /\b(src-tauri|crates|tests)\/[A-Za-z0-9_./-]+/g },
  { label: 'internal hook/symbol identifier', re: /\buse[A-Z][A-Za-z0-9]{4,}\b/g },
  { label: 'IPC/internal tooling jargon', re: /\b(IPC|CSP|SQLx|clippy|oxlint|rustfmt|vitest)\b/g },
];

export function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** Flags overly technical phrasing that should be simplified for non-technical listeners. */
export function humanizeWarnings(item) {
  const warnings = [];
  for (const lang of ['en', 'pl']) {
    const text = item?.[lang];
    if (typeof text !== 'string') continue;
    for (const { label, re } of TECHNICAL_PATTERNS) {
      re.lastIndex = 0;
      const match = re.exec(text);
      if (match) {
        warnings.push(`[${lang}] Mentions ${label} ("${match[0]}") — simplify for everyday listeners if possible.`);
      }
    }
  }
  return warnings;
}

function itemCount(release) {
  return SECTIONS.reduce((sum, key) => sum + (Array.isArray(release?.[key]) ? release[key].length : 0), 0);
}

/** Validates the full `changelog.json` array against schema, channel invariants, and locale parity. */
export function validateChangelog(releases) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(releases)) {
    return { errors: ['changelog.json root must be a JSON array.'], warnings };
  }

  const seenVersions = new Set();
  const devIndices = [];
  const latestIndices = [];
  let firstStableIndex = -1;

  releases.forEach((rel, idx) => {
    const label = `entry[${idx}] (${rel?.version ?? 'unknown'})`;
    if (!rel || typeof rel !== 'object') {
      errors.push(`${label}: must be an object.`);
      return;
    }

    for (const field of ['version', 'codename', 'date', 'author']) {
      if (typeof rel[field] !== 'string' || rel[field].trim().length === 0) {
        errors.push(`${label}: missing non-empty '${field}'.`);
      }
    }

    if (typeof rel.date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(rel.date)) {
      errors.push(`${label}: date '${rel.date}' must use YYYY-MM-DD format.`);
    }

    if (typeof rel.version === 'string') {
      if (seenVersions.has(rel.version)) {
        errors.push(`${label}: duplicate version '${rel.version}'.`);
      }
      seenVersions.add(rel.version);
    }

    if (rel.isDev === true) {
      devIndices.push(idx);
      if (idx !== 0) {
        errors.push(`${label}: isDev=true entry must be at index 0.`);
      }
      if (rel.isLatest === true) {
        errors.push(`${label}: isDev=true entry cannot also have isLatest=true.`);
      }
    } else if (firstStableIndex === -1) {
      firstStableIndex = idx;
    }

    if (rel.isLatest === true) {
      latestIndices.push(idx);
    }

    for (const sec of SECTIONS) {
      if (rel[sec] === undefined) continue;
      if (!Array.isArray(rel[sec])) {
        errors.push(`${label}: '${sec}' must be an array.`);
        continue;
      }
      rel[sec].forEach((item, itemIdx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`${label}.${sec}[${itemIdx}]: must be a localized object.`);
          return;
        }
        for (const lang of LANGUAGES) {
          if (typeof item[lang] !== 'string' || item[lang].trim().length === 0) {
            errors.push(`${label}.${sec}[${itemIdx}]: missing or empty '${lang}' string.`);
          }
        }
        if (rel.isDev === true) {
          for (const w of humanizeWarnings(item)) {
            warnings.push(`${label}.${sec}[${itemIdx}] ${w}`);
          }
        }
      });
    }

    if (itemCount(rel) === 0) {
      errors.push(`${label}: must contain at least one item in added, changed, or fixed.`);
    }
  });

  if (devIndices.length > 1) {
    errors.push(`Multiple isDev=true entries found at indices ${devIndices.join(', ')} (at most one allowed).`);
  }
  if (latestIndices.length !== 1) {
    errors.push(`Expected exactly one stable entry with isLatest=true, found ${latestIndices.length}.`);
  } else if (firstStableIndex !== -1 && latestIndices[0] !== firstStableIndex) {
    errors.push(`isLatest=true must be on the newest stable release (index ${firstStableIndex}), not index ${latestIndices[0]}.`);
  }

  return { errors, warnings };
}

/** Appends a 5-language item to the active `isDev` release (creating it at index 0 if absent). */
export function addChangelogEntry(
  releases,
  { section, item, version, date = todayIsoDate(), author = DEFAULT_AUTHOR },
) {
  if (!SECTIONS.includes(section)) {
    throw new Error(`Invalid section "${section}". Expected one of: ${SECTIONS.join(', ')}.`);
  }
  if (!item || typeof item !== 'object') {
    throw new Error('Item payload must be an object with pl, en, de, fi, la keys.');
  }

  const normalized = {};
  for (const lang of LANGUAGES) {
    const val = typeof item[lang] === 'string' ? item[lang].trim() : '';
    if (!val) {
      throw new Error(`Missing or empty "${lang}" translation in changelog item.`);
    }
    normalized[lang] = val;
  }

  const next = releases.map((r) => ({ ...r }));
  let devEntry = next[0]?.isDev === true ? { ...next[0] } : null;

  if (!devEntry) {
    devEntry = {
      version: version || '0.0.0-dev',
      codename: DEV_CODENAME,
      date,
      author,
      isDev: true,
      isLatest: false,
      added: [],
      changed: [],
      fixed: [],
    };
    next.unshift(devEntry);
  } else {
    devEntry.date = date;
    if (version) devEntry.version = version;
    next[0] = devEntry;
  }

  const targetList = Array.isArray(devEntry[section]) ? [...devEntry[section]] : [];
  const duplicate = targetList.some(
    (existing) => existing.en === normalized.en && existing.pl === normalized.pl,
  );
  if (!duplicate) {
    targetList.push(normalized);
  }
  devEntry[section] = targetList;

  if (!Array.isArray(devEntry.added)) devEntry.added = [];
  if (!Array.isArray(devEntry.fixed)) devEntry.fixed = [];

  return next;
}

/** Promotes the active `isDev` entry at index 0 into a finalized stable release. */
export function promoteDevRelease(
  releases,
  { version, codename, date = todayIsoDate(), author },
) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error(`Invalid release version "${version}" (expected X.Y.Z).`);
  }
  if (typeof codename !== 'string' || codename.trim().length === 0) {
    throw new Error('Missing release codename.');
  }
  if (!releases[0]?.isDev) {
    throw new Error('No active isDev entry at changelog[0] to promote.');
  }
  if (itemCount(releases[0]) === 0) {
    throw new Error('Cannot promote an empty isDev changelog entry.');
  }

  const next = releases.map((r) => ({ ...r, isLatest: false }));
  const promoted = { ...next[0] };
  delete promoted.isDev;
  promoted.version = version;
  promoted.codename = codename.trim();
  promoted.date = date;
  if (author && author.trim()) promoted.author = author.trim();
  promoted.isLatest = true;
  if (Array.isArray(promoted.changed) && promoted.changed.length === 0) {
    delete promoted.changed;
  }
  next[0] = promoted;

  return next;
}

/** Renders a single release's bullets as clean Markdown release notes. */
export function formatReleaseNotes(release, lang = 'en') {
  const headings = {
    added: '### ✨ Added',
    changed: '### 🔄 Changed',
    fixed: '### 🛠️ Fixed',
  };
  const blocks = [];
  for (const sec of SECTIONS) {
    const items = release?.[sec];
    if (!Array.isArray(items) || items.length === 0) continue;
    const lines = items.map((it) => `- ${it[lang] || it.en || it.pl}`);
    blocks.push(`${headings[sec]}\n${lines.join('\n')}`);
  }
  return blocks.join('\n\n');
}

/** Extracts `codename`, `date`, or `notes` for a specific version from `changelog.json`. */
export function extractReleaseField(releases, version, field, lang = 'en') {
  const rel = releases.find((r) => r.version === version);
  if (!rel) {
    throw new Error(`Version "${version}" not found in src/data/changelog.json.`);
  }
  switch (field) {
    case 'codename':
      return rel.codename;
    case 'date':
      return rel.date;
    case 'notes':
      return formatReleaseNotes(rel, lang);
    default:
      throw new Error(`Unknown field "${field}" (expected codename|date|notes).`);
  }
}

/** Formats Markdown highlights for the active `isDev` entry (used by the rolling dev-build workflow). */
export function formatDevReleaseNotes(releases, lang = 'en') {
  const devEntry = releases.find((r) => r.isDev === true);
  if (!devEntry || itemCount(devEntry) === 0) return '';
  return `#### Unreleased changes in \`v${devEntry.version}\`\n\n${formatReleaseNotes(devEntry, lang)}`;
}

function readPackageVersion(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '1.0.0-dev';
  } catch {
    return '1.0.0-dev';
  }
}

function readChangelog(root) {
  return JSON.parse(fs.readFileSync(path.join(root, CHANGELOG_REL_PATH), 'utf8'));
}

function writeChangelog(root, releases) {
  fs.writeFileSync(
    path.join(root, CHANGELOG_REL_PATH),
    `${JSON.stringify(releases, null, 2)}\n`,
    'utf8',
  );
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { flags, positional };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseFlags(rest);

  try {
    if (cmd === 'validate') {
      const releases = readChangelog(root);
      const { errors, warnings } = validateChangelog(releases);
      for (const w of warnings) console.warn(`⚠️  ${w}`);
      if (errors.length > 0) {
        for (const e of errors) console.error(`❌ ${e}`);
        process.exit(1);
      }
      if (flags['strict-human'] && warnings.length > 0) {
        console.error(`❌ Failing due to ${warnings.length} humanization warning(s).`);
        process.exit(1);
      }
      console.log(`✅ Validated ${releases.length} changelog entries across ${LANGUAGES.length} languages.`);
      return;
    }

    if (cmd === 'add') {
      let payload;
      if (flags.stdin) {
        payload = JSON.parse(fs.readFileSync(0, 'utf8'));
      } else if (typeof flags.file === 'string') {
        payload = JSON.parse(fs.readFileSync(path.resolve(root, flags.file), 'utf8'));
      } else {
        payload = {
          type: flags.type,
          item: {
            en: flags.en,
            pl: flags.pl,
            de: flags.de,
            fi: flags.fi,
            la: flags.la,
          },
        };
      }

      const section = payload.type ?? payload.section;
      const item = payload.item ?? payload;
      const pkgVersion = readPackageVersion(root);
      const version = typeof flags.version === 'string'
        ? flags.version
        : (pkgVersion.endsWith('-dev') ? pkgVersion : `${pkgVersion}-dev`);

      const current = readChangelog(root);
      const updated = addChangelogEntry(current, {
        section,
        item,
        version,
        date: typeof flags.date === 'string' ? flags.date : todayIsoDate(),
        author: typeof flags.author === 'string' ? flags.author : DEFAULT_AUTHOR,
      });

      const { errors } = validateChangelog(updated);
      if (errors.length > 0) {
        for (const e of errors) console.error(`❌ ${e}`);
        process.exit(1);
      }
      for (const w of humanizeWarnings(item)) {
        console.warn(`⚠️  ${w}`);
      }
      writeChangelog(root, updated);
      console.log(`✅ Added ${section} entry to ${updated[0].version} in ${CHANGELOG_REL_PATH}.`);
      return;
    }

    if (cmd === 'promote') {
      const version = flags.version ?? positional[0];
      const codename = flags.codename ?? positional[1];
      const current = readChangelog(root);
      const updated = promoteDevRelease(current, {
        version,
        codename,
        date: typeof flags.date === 'string' ? flags.date : todayIsoDate(),
        author: typeof flags.author === 'string' ? flags.author : undefined,
      });
      const { errors } = validateChangelog(updated);
      if (errors.length > 0) {
        for (const e of errors) console.error(`❌ ${e}`);
        process.exit(1);
      }
      writeChangelog(root, updated);
      console.log(`✅ Promoted changelog[0] to v${version} ("${codename}") with isLatest=true.`);
      return;
    }

    if (cmd === 'notes') {
      const [version, field = 'notes'] = positional;
      if (!version) {
        throw new Error('Usage: node scripts/changelog.mjs notes <X.Y.Z> <codename|date|notes>');
      }
      const releases = readChangelog(root);
      const lang = typeof flags.lang === 'string' ? flags.lang : 'en';
      process.stdout.write(`${extractReleaseField(releases, version, field, lang)}\n`);
      return;
    }

    if (cmd === 'dev-notes') {
      const releases = readChangelog(root);
      const lang = typeof flags.lang === 'string' ? flags.lang : 'en';
      const out = formatDevReleaseNotes(releases, lang);
      if (out) process.stdout.write(`${out}\n`);
      return;
    }

    console.error('Usage: node scripts/changelog.mjs <validate|add|promote|notes|dev-notes>');
    process.exit(2);
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
