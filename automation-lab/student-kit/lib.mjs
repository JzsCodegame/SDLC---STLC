import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const validVersion = value => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);

export function safeRelative(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9._ /-]+$/.test(value) || value.includes('\\')) throw new Error('Unsafe package path.');
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe package path.');
  if (parts.some(part => /^(\.git|\.env(?:\..*)?|node_modules|infra|private|data|\.test-data|evidence)$/i.test(part))) throw new Error('Excluded package path.');
  return value;
}

export async function noLinks(target) {
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink()) throw new Error(`Linked path is not allowed: ${current}`);
      // realpath also detects Windows junction redirection.
      const real = await fs.realpath(current);
      if (path.resolve(real).toLowerCase() !== path.resolve(current).toLowerCase()) throw new Error(`Redirected path is not allowed: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return absolute;
}

export function checkContent(name, bytes) {
  const text = bytes.toString('utf8');
  const patterns = [/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/, /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|dop_v1_[a-f0-9]{40,})\b/, /(?:api[_-]?key|access[_-]?token|password|secret)\s*[=:]\s*["'][A-Za-z0-9_+/=-]{20,}["']/i];
  if (patterns.some(pattern => pattern.test(text))) throw new Error(`Possible credential in allowlisted file: ${name}`);
}

export function checkPins(pkg, lock) {
  if (lock.lockfileVersion !== 3 || lock.name !== pkg.name || lock.version !== pkg.version) throw new Error('Package lock identity mismatch.');
  for (const group of ['dependencies', 'devDependencies']) {
    const expected = pkg[group] || {};
    const actual = lock.packages?.['']?.[group] || {};
    if (JSON.stringify(Object.entries(expected).sort()) !== JSON.stringify(Object.entries(actual).sort())) throw new Error(`Lockfile ${group} mismatch.`);
    for (const [name, version] of Object.entries(expected)) {
      if (!/^\d+\.\d+\.\d+$/.test(version) || lock.packages?.[`node_modules/${name}`]?.version !== version) throw new Error(`Unpinned dependency: ${name}`);
    }
  }
  for (const [name, entry] of Object.entries(lock.packages || {})) {
    if (!name) continue;
    if (entry.link || !entry.resolved?.startsWith('https://registry.npmjs.org/') || !/^sha512-/.test(entry.integrity || '')) throw new Error(`Nonregistry or unhashed dependency: ${name}`);
  }
}

export async function readManifest(kitRoot) {
  await noLinks(kitRoot);
  await noLinks(path.join(kitRoot, 'kit-manifest.json'));
  const manifest = JSON.parse(await fs.readFile(path.join(kitRoot, 'kit-manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !validVersion(manifest.version) || !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || !Array.isArray(manifest.files)) throw new Error('Invalid kit manifest. Download and extract a complete release again.');
  const seen = new Set();
  for (const file of manifest.files) {
    safeRelative(file.path);
    if (seen.has(file.path.toLowerCase()) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) throw new Error('Invalid manifest file entry.');
    seen.add(file.path.toLowerCase());
  }
  for (const required of ['lab.mjs', 'lib.mjs', 'practice-app/package.json', 'practice-app/package-lock.json', 'practice-app/server/index.js']) {
    if (!seen.has(required)) throw new Error(`Manifest is missing ${required}.`);
  }
  return manifest;
}

export async function verifyKit(kitRoot) {
  const manifest = await readManifest(kitRoot);
  for (const file of manifest.files) {
    const target = path.join(kitRoot, file.path);
    await noLinks(target);
    const info = await fs.lstat(target);
    if (!info.isFile()) throw new Error(`Not a regular file: ${file.path}`);
    const bytes = await fs.readFile(target);
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Package integrity failed: ${file.path}. Re-extract the downloaded kit; edit the student working copy instead.`);
  }
  return manifest;
}

export function studentPaths(kitRoot, version) {
  if (!validVersion(version)) throw new Error('Invalid workspace version.');
  const workRoot = path.join(path.dirname(path.resolve(kitRoot)), 'Mini Quiz Student Work');
  return {workRoot, workspace: path.join(workRoot, version), app: path.join(workRoot, version, 'practice-app'), data: path.join(workRoot, 'manual-data')};
}

export async function ensureWorkspace(kitRoot, manifest) {
  const locations = studentPaths(kitRoot, manifest.version);
  await noLinks(locations.workspace);
  await noLinks(locations.data);
  const markerPath = path.join(locations.workspace, 'workspace.json');
  try {
    await fs.access(locations.workspace);
    await noLinks(markerPath);
    const marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
    if (marker.version !== manifest.version || marker.sourceCommit !== manifest.sourceCommit) throw new Error('Workspace source does not match this kit. Keep your existing work and extract a different release version.');
    await noLinks(locations.app);
    return {...locations, created: false};
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // An existing folder without a valid marker is never adopted or overwritten.
    try { await fs.access(locations.workspace); throw new Error('Existing student folder has no valid workspace marker. Preserve or move it before installing this version.'); } catch (check) { if (check.code !== 'ENOENT') throw check; }
  }
  await fs.mkdir(locations.workRoot, {recursive: true});
  await noLinks(locations.workRoot);
  const staging = path.join(locations.workRoot, `.install-${manifest.version}-${randomUUID()}`);
  await fs.mkdir(staging);
  for (const file of manifest.files.filter(file => file.path.startsWith('practice-app/'))) {
    const source = path.join(kitRoot, file.path);
    await noLinks(source);
    const bytes = await fs.readFile(source);
    if (digest(bytes) !== file.sha256) throw new Error('Template changed during installation.');
    const target = path.join(staging, file.path);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, bytes, {flag: 'wx'});
  }
  await fs.writeFile(path.join(staging, 'workspace.json'), JSON.stringify({schemaVersion: 1, version: manifest.version, sourceCommit: manifest.sourceCommit}, null, 2) + '\n', {flag: 'wx'});
  await fs.writeFile(path.join(staging, 'NOTES.md'), '# My automation observations\n\nRecord a requirement, action, expected result and evidence for each exercise.\n', {flag: 'wx'});
  // rename is atomic and refuses an existing, non-empty destination on Windows.
  try { await fs.access(locations.workspace); throw new Error('Student workspace appeared during installation; preserved both folders.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.rename(staging, locations.workspace);
  return {...locations, created: true};
}
