#!/usr/bin/env node
// End-to-end release & dev->main merge preparation pipeline.
//
// Commands:
//   npm run release:prepare -- [patch|minor|major|X.Y.Z] --codename "..." [--codename-pl "..."] [--dry-run] [--push]
//   npm run release:check [-- X.Y.Z]
//   npm run release:aur [-- X.Y.Z]
//
// Full guide: docs/developer/release-pipeline.md
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  promoteDevRelease,
  todayIsoDate,
  validateChangelog,
} from './changelog.mjs';

const REPO = 'Das-Letzte-Kemonomimi/Aura-Lune';
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(version) {
  const m = SEMVER_RE.exec((version ?? '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`Invalid SemVer comparison: "${a}" vs "${b}".`);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function bumpSemver(baseVersion, kind) {
  const parts = parseSemver(baseVersion);
  if (!parts) throw new Error(`Invalid base version "${baseVersion}".`);
  const [maj, min, pat] = parts;
  switch (kind) {
    case 'major':
      return `${maj + 1}.0.0`;
    case 'minor':
      return `${maj}.${min + 1}.0`;
    case 'patch':
      return `${maj}.${min}.${pat + 1}`;
    default:
      throw new Error(`Unsupported SemVer bump kind "${kind}".`);
  }
}

export function nextDevVersion(stableVersion) {
  return `${bumpSemver(stableVersion, 'patch')}-dev`;
}

/** Suggests SemVer bump kind from the active dev changelog and latest version. */
export function resolveTargetVersion({ spec, latestStableVersion, devEntry }) {
  const cleanSpec = (spec ?? '').trim();
  const base = latestStableVersion || '0.0.0';

  if (parseSemver(cleanSpec)) {
    if (latestStableVersion && compareSemver(cleanSpec, latestStableVersion) <= 0) {
      throw new Error(`Target version ${cleanSpec} must be newer than latest release ${latestStableVersion}.`);
    }
    return cleanSpec;
  }

  let kind = cleanSpec;
  if (!kind || kind === 'auto') {
    const hasAdded = Array.isArray(devEntry?.added) && devEntry.added.length > 0;
    kind = hasAdded ? 'minor' : 'patch';
  }
  if (!['major', 'minor', 'patch'].includes(kind)) {
    throw new Error(`Invalid version spec "${cleanSpec}". Use X.Y.Z, patch, minor, or major.`);
  }
  return bumpSemver(base, kind);
}

/** Shields.io path segment encoder preserving curly quotes cleanly. */
export function encodeShieldsPart(text) {
  const escaped = String(text).replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_');
  return encodeURIComponent(escaped)
    .replace(/%E2%80%9C/g, '“')
    .replace(/%E2%80%9D/g, '”')
    .replace(/%E2%80%9E/g, '„');
}

/** Updates version tag link + shields badge line inside README.md or README.pl.md. */
export function rewriteReadmeBadge(content, { version, codename, label = 'version', quotes = 'english' }) {
  const [openQ, closeQ] = quotes === 'polish' ? ['„', '”'] : ['“', '”'];
  const encodedTitle = encodeShieldsPart(`${openQ}${codename}${closeQ}`);
  const alt = label === 'wersja' ? 'Wersja' : 'Version';
  const nextLine = `    <a href="https://github.com/${REPO}/releases/tag/v${version}"><img src="https://img.shields.io/badge/${label}-${version}_${encodedTitle}-f43f5e.svg?style=for-the-badge" alt="${alt}" /></a>`;
  const lineRe = /^[ \t]*<a href="https:\/\/github\.com\/[^"]+\/releases\/tag\/v[^"]+"><img src="https:\/\/img\.shields\.io\/badge\/(?:version|wersja)-[^"]+"[^>]*><\/a>/m;
  if (!lineRe.test(content)) {
    throw new Error(`Could not locate existing '${label}' shields badge line in README.`);
  }
  return content.replace(lineRe, nextLine);
}

/** Reads declared versions across manifests, installer, Arch packages, docs, and changelog. */
export function collectVersionState(root) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const cargo = read('Cargo.toml');
  const pkg = JSON.parse(read('package.json'));
  const pkgLock = JSON.parse(read('package-lock.json'));
  const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
  const installSh = read('install.sh');
  const pkgbuild = read('packaging/archlinux/PKGBUILD');
  const pkgbuildBin = read('packaging/archlinux/PKGBUILD-bin');
  const srcinfo = read('packaging/archlinux/.SRCINFO');
  const featureMatrix = read('docs/FEATURE_MATRIX.md');
  const developmentMd = read('DEVELOPMENT.md');
  const readmeEn = read('README.md');
  const readmePl = read('README.pl.md');
  const changelog = JSON.parse(read(path.join('src', 'data', 'changelog.json')));

  const matchOne = (text, re) => re.exec(text)?.[1] ?? null;

  return {
    cargo: matchOne(cargo, /^version = "([^"]+)"/m),
    packageJson: pkg.version ?? null,
    packageLock: pkgLock.version ?? null,
    tauriConf: tauri.version ?? null,
    installSh: matchOne(installSh, /^VERSION="([^"]+)"/m),
    pkgbuild: matchOne(pkgbuild, /^pkgver=(.+)$/m)?.trim() ?? null,
    pkgbuildBin: matchOne(pkgbuildBin, /^pkgver=(.+)$/m)?.trim() ?? null,
    srcinfoPkgver: matchOne(srcinfo, /^\s*pkgver\s*=\s*(.+)$/m)?.trim() ?? null,
    featureMatrix: matchOne(featureMatrix, /\(v([0-9]+\.[0-9]+\.[0-9]+[^)]*)\)/),
    developmentAppImage: matchOne(developmentMd, /Auralune_([0-9]+\.[0-9]+\.[0-9]+)_amd64\.AppImage/),
    developmentDeb: matchOne(developmentMd, /auralune_([0-9]+\.[0-9]+\.[0-9]+)_amd64\.deb/),
    readmeEnHasTag: (v) => readmeEn.includes(`releases/tag/v${v}`),
    readmePlHasTag: (v) => readmePl.includes(`releases/tag/v${v}`),
    changelogTop: changelog[0] ?? null,
  };
}

/** Verifies every release file matches exact stable version `expectedVersion`. */
export function verifyVersionParity(state, expectedVersion) {
  const errors = [];
  if (!parseSemver(expectedVersion)) {
    return [`Expected stable X.Y.Z version, got "${expectedVersion}".`];
  }

  const fields = [
    ['Cargo.toml', state.cargo],
    ['package.json', state.packageJson],
    ['package-lock.json', state.packageLock],
    ['src-tauri/tauri.conf.json', state.tauriConf],
    ['install.sh', state.installSh],
    ['packaging/archlinux/PKGBUILD', state.pkgbuild],
    ['packaging/archlinux/PKGBUILD-bin', state.pkgbuildBin],
    ['packaging/archlinux/.SRCINFO', state.srcinfoPkgver],
    ['docs/FEATURE_MATRIX.md', state.featureMatrix],
    ['DEVELOPMENT.md (AppImage)', state.developmentAppImage],
    ['DEVELOPMENT.md (.deb)', state.developmentDeb],
  ];

  for (const [label, actual] of fields) {
    if (actual !== expectedVersion) {
      errors.push(`${label}: version is "${actual}", expected "${expectedVersion}".`);
    }
  }
  if (!state.readmeEnHasTag(expectedVersion)) {
    errors.push(`README.md: missing releases/tag/v${expectedVersion} badge link.`);
  }
  if (!state.readmePlHasTag(expectedVersion)) {
    errors.push(`README.pl.md: missing releases/tag/v${expectedVersion} badge link.`);
  }
  const top = state.changelogTop;
  if (!top || top.version !== expectedVersion || top.isLatest !== true || top.isDev === true) {
    errors.push(`src/data/changelog.json[0]: must be finalized stable release ${expectedVersion} with isLatest=true.`);
  }
  return errors;
}

function runGit(root, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function runShell(root, cmd, args) {
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
  }
}

function latestGitTagVersion(root) {
  const raw = runGit(root, ['tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=-v:refname'], { allowFail: true }) ?? '';
  const first = raw.split(/\r?\n/).find(Boolean);
  return first ? first.replace(/^v/, '') : null;
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

function cmdCheck(root, versionArg) {
  const state = collectVersionState(root);
  const version = versionArg || state.cargo;
  if (!parseSemver(version)) {
    throw new Error(`Current version "${version}" is not a stable X.Y.Z version.`);
  }
  const changelog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/changelog.json'), 'utf8'));
  const { errors: clErrors, warnings } = validateChangelog(changelog);
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  const parityErrors = verifyVersionParity(state, version);
  const allErrors = [...clErrors, ...parityErrors];
  if (allErrors.length > 0) {
    for (const e of allErrors) console.error(`❌ ${e}`);
    process.exit(1);
  }
  console.log(`✅ Release parity verified cleanly for v${version}.`);
}

function cmdPrepare(root, flags, positional) {
  const branch = runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'dev' && branch !== 'develop') {
    throw new Error(`Must run release:prepare from branch 'dev' (currently on '${branch}').`);
  }

  const dirty = runGit(root, ['status', '--porcelain']);
  if (dirty) {
    throw new Error('Working tree is not clean. Commit or stash existing edits before releasing.');
  }

  if (!flags['no-fetch']) {
    runGit(root, ['fetch', 'origin', '--tags', '--quiet'], { allowFail: true });
    const devBehind = runGit(root, ['rev-list', '--count', 'HEAD..origin/dev'], { allowFail: true });
    if (devBehind && Number(devBehind) > 0) {
      throw new Error(`Local dev is ${devBehind} commit(s) behind origin/dev. Pull/rebase first.`);
    }
  }

  const prMode = Boolean(flags.pr);
  if (!prMode && !flags['no-merge']) {
    const hasMain = runGit(root, ['rev-parse', '--verify', 'refs/heads/main'], { allowFail: true });
    if (!hasMain) {
      throw new Error('Local branch "main" does not exist. Create/track "main" first or pass --pr / --no-merge.');
    }
    const mergedCleanly = spawnSync('git', ['merge-base', '--is-ancestor', 'main', 'HEAD'], { cwd: root });
    if (mergedCleanly.status !== 0) {
      throw new Error('"main" has commits not present on "dev". Merge origin/main into dev first.');
    }
  }

  runShell(root, 'npm', ['run', 'skills:check']);

  const changelogPath = path.join(root, 'src', 'data', 'changelog.json');
  const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
  const devEntry = changelog[0]?.isDev === true ? changelog[0] : null;
  if (!devEntry) {
    throw new Error('No active isDev=true entry in src/data/changelog.json. Add release highlights first via npm run changelog:add.');
  }

  const latestStable = latestGitTagVersion(root)
    ?? changelog.find((r) => !r.isDev && r.isLatest)?.version
    ?? changelog.find((r) => !r.isDev)?.version;

  const targetVersion = resolveTargetVersion({
    spec: flags.version ?? positional[0] ?? 'auto',
    latestStableVersion: latestStable,
    devEntry,
  });

  const codename = typeof flags.codename === 'string' ? flags.codename.trim() : '';
  if (!codename) {
    throw new Error('Missing --codename "<English release codename>".');
  }
  const codenamePl = typeof flags['codename-pl'] === 'string' && flags['codename-pl'].trim()
    ? flags['codename-pl'].trim()
    : codename;
  const date = typeof flags.date === 'string' ? flags.date.trim() : todayIsoDate();
  const nextDev = typeof flags.next === 'string' ? flags.next.trim() : nextDevVersion(targetVersion);
  if (!/^\d+\.\d+\.\d+-dev$/.test(nextDev)) {
    throw new Error(`Invalid --next dev version "${nextDev}" (expected X.Y.Z-dev).`);
  }

  const localTag = runGit(root, ['rev-parse', '-q', '--verify', `refs/tags/v${targetVersion}`], { allowFail: true });
  if (localTag) {
    throw new Error(`Tag v${targetVersion} already exists locally.`);
  }

  console.log(`\n🌸 Release Plan: v${targetVersion} — „${codename}” (PL badge: „${codenamePl}”)`);
  console.log(`   Base stable : v${latestStable ?? 'none'}`);
  console.log(`   Next dev    : v${nextDev}`);
  console.log(`   Merge mode  : ${prMode ? `PR branch release/v${targetVersion} -> main` : flags['no-merge'] ? 'dev only (--no-merge)' : 'local merge dev -> main (--no-ff)'}\n`);

  if (flags['dry-run']) {
    console.log('🧪 --dry-run enabled: no files or git commits were modified.');
    return;
  }

  const startDevSha = runGit(root, ['rev-parse', 'HEAD']);
  const startMainSha = !prMode && !flags['no-merge'] ? runGit(root, ['rev-parse', 'main']) : null;

  try {
    // 1. Promote changelog.json
    const promoted = promoteDevRelease(changelog, { version: targetVersion, codename, date });
    const { errors } = validateChangelog(promoted);
    if (errors.length > 0) throw new Error(errors.join('\n'));
    fs.writeFileSync(changelogPath, `${JSON.stringify(promoted, null, 2)}\n`, 'utf8');

    // 2. Rewrite README badges
    const readmeEnPath = path.join(root, 'README.md');
    const readmePlPath = path.join(root, 'README.pl.md');
    fs.writeFileSync(
      readmeEnPath,
      rewriteReadmeBadge(fs.readFileSync(readmeEnPath, 'utf8'), {
        version: targetVersion,
        codename,
        label: 'version',
        quotes: 'english',
      }),
      'utf8',
    );
    fs.writeFileSync(
      readmePlPath,
      rewriteReadmeBadge(fs.readFileSync(readmePlPath, 'utf8'), {
        version: targetVersion,
        codename: codenamePl,
        label: 'wersja',
        quotes: 'polish',
      }),
      'utf8',
    );

    // 3. Bump versions & verify parity
    runShell(root, 'bash', ['packaging/bump-version.sh', targetVersion]);
    runShell(root, 'bash', ['packaging/check-release-content.sh', targetVersion]);
    cmdCheck(root, targetVersion);

    // 4. Full local quality gate
    const testArgs = flags.fast ? ['--fix', '--fast'] : ['--fix'];
    runShell(root, 'bash', ['tests/run_all_tests.sh', ...testArgs]);

    // 5. Commit & branch topology
    if (prMode) {
      const relBranch = `release/v${targetVersion}`;
      runGit(root, ['checkout', '-b', relBranch]);
      runGit(root, ['add', '-A']);
      runGit(root, ['commit', '-m', `chore(release): prepare v${targetVersion} (${codename})`]);
      runGit(root, ['checkout', branch]);
      runShell(root, 'bash', ['packaging/bump-version.sh', nextDev]);
      runGit(root, ['add', '-A']);
      runGit(root, ['commit', '-m', `chore: start ${nextDev}`]);

      if (flags.push) {
        runShell(root, 'git', ['push', 'origin', relBranch, branch]);
        const notes = execFileSync('node', ['scripts/changelog.mjs', 'notes', targetVersion, 'notes'], {
          cwd: root,
          encoding: 'utf8',
        });
        runShell(root, 'gh', [
          'pr',
          'create',
          '--base',
          'main',
          '--head',
          relBranch,
          '--title',
          `Release v${targetVersion} — ${codename}`,
          '--body',
          `Release **v${targetVersion} — „${codename}”**.\n\nMerging this PR automatically builds and publishes \`v${targetVersion}\` on \`main\`.\n\n${notes}`,
        ]);
      } else {
        console.log(`\n✅ Prepared ${relBranch} and started ${nextDev} on ${branch}.`);
        console.log(`   Next: git push origin ${relBranch} ${branch} && gh pr create --base main --head ${relBranch}`);
      }
      return;
    }

    runGit(root, ['add', '-A']);
    runGit(root, ['commit', '-m', `chore(release): prepare v${targetVersion} (${codename})`]);

    if (!flags['no-merge']) {
      runGit(root, ['checkout', 'main']);
      runGit(root, ['merge', '--no-ff', branch, '-m', `Release v${targetVersion} — ${codename}`]);
      runGit(root, ['checkout', branch]);
      runShell(root, 'bash', ['packaging/bump-version.sh', nextDev]);
      runGit(root, ['add', '-A']);
      runGit(root, ['commit', '-m', `chore: start ${nextDev}`]);

      if (flags.push) {
        runShell(root, 'git', ['push', 'origin', 'main', branch]);
        console.log(`\n🚀 Pushed main (v${targetVersion}) and ${branch} (v${nextDev}). CI will now build & publish.`);
      } else {
        console.log(`\n✅ Release v${targetVersion} merged cleanly into main and ${branch} bumped to ${nextDev}.`);
        console.log(`   Review with: git log --graph --oneline -n 6 main ${branch}`);
        console.log(`   Publish by pushing both branches: git push origin main ${branch}`);
      }
    } else {
      console.log(`\n✅ Prepared v${targetVersion} on ${branch} (--no-merge).`);
    }
  } catch (err) {
    console.error(`\n❌ Release preparation failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error('↩️  Inspect changes or reset cleanly to pre-release commit if needed:');
    console.error(`    git merge --abort 2>/dev/null || true`);
    console.error(`    git checkout ${branch} && git reset --hard ${startDevSha}`);
    if (startMainSha) console.error(`    git branch -f main ${startMainSha}`);
    process.exit(1);
  }
}

function cmdAur(root, versionArg) {
  const pkgbuildBin = fs.readFileSync(path.join(root, 'packaging/archlinux/PKGBUILD-bin'), 'utf8');
  const version = versionArg || (/^pkgver=(.+)$/m.exec(pkgbuildBin)?.[1]?.trim() ?? '');
  if (!parseSemver(version)) {
    throw new Error(`Invalid AUR version "${version}" (expected X.Y.Z).`);
  }
  runShell(root, 'bash', ['packaging/archlinux/update-aur-checksum.sh', version]);
  const dirty = runGit(root, ['status', '--porcelain', 'packaging/archlinux/PKGBUILD-bin', 'packaging/archlinux/.SRCINFO']);
  if (dirty) {
    runGit(root, ['add', 'packaging/archlinux/PKGBUILD-bin', 'packaging/archlinux/.SRCINFO']);
    runGit(root, ['commit', '-m', `chore(aur): update AppImage sha256 checksum for v${version}`]);
  }
  runShell(root, 'bash', ['packaging/archlinux/publish-to-aur.sh']);
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseFlags(rest);

  try {
    if (cmd === 'prepare') {
      cmdPrepare(root, flags, positional);
      return;
    }
    if (cmd === 'check') {
      cmdCheck(root, flags.version ?? positional[0]);
      return;
    }
    if (cmd === 'aur') {
      cmdAur(root, flags.version ?? positional[0]);
      return;
    }
    console.error('Usage: node scripts/release.mjs <prepare|check|aur>');
    process.exit(2);
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
