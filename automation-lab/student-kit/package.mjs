import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {deflateRawSync} from 'node:zlib';
import {checkContent, checkPins, digest, noLinks, safeRelative, validVersion} from './lib.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const git = (repo, args, encoding = 'utf8') => execFileSync('git', ['-C', repo, ...args], {encoding, maxBuffer: 16 * 1024 * 1024, windowsHide: true});

export function validateAllowlist(list) {
  if (list.schemaVersion !== 1 || !Array.isArray(list.files) || list.files.length === 0) throw new Error('Invalid allowlist.');
  const destinations = new Set(); const sources = new Set();
  for (const entry of list.files) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid allowlist entry.');
    const [source, destination] = entry;
    safeRelative(source); safeRelative(destination);
    if (!source.startsWith('automation-lab/practice-app/') && !source.startsWith('automation-lab/student-kit/')) throw new Error('Source outside student package scope.');
    if (destinations.has(destination.toLowerCase()) || sources.has(source.toLowerCase())) throw new Error('Duplicate or case-colliding allowlist entry.');
    destinations.add(destination.toLowerCase()); sources.add(source.toLowerCase());
  }
  return list.files;
}

// Small, deterministic ZIP writer: regular files only, UTF-8 names, fixed DOS date.
// No executable installer, archive dependency or filesystem recursion is involved.
export function zipFiles(files) {
  let offset = 0; const locals = []; const central = [];
  for (const file of files) {
    safeRelative(file.path);
    const name = Buffer.from(file.path); const bytes = file.bytes; const compressed = deflateRawSync(bytes, {level: 9});
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
    const index = Buffer.alloc(46); index.writeUInt32LE(0x02014b50); index.writeUInt16LE(20, 4); index.writeUInt16LE(20, 6); index.writeUInt16LE(0x800, 8); index.writeUInt16LE(8, 10); index.writeUInt16LE(33, 14); index.writeUInt32LE(crc, 16); index.writeUInt32LE(compressed.length, 20); index.writeUInt32LE(bytes.length, 24); index.writeUInt16LE(name.length, 28); index.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed); central.push(index, name); offset += local.length + name.length + compressed.length;
  }
  const directoryBytes = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directoryBytes.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
}

export async function buildPackage({repo, source, version, output}) {
  if (!validVersion(version)) throw new Error('Use a release version such as 1.0.0 (no reuse).');
  if (!/^[a-f0-9]{40}$/.test(source || '')) throw new Error('An exact 40-character --source Git commit is required.');
  repo = await noLinks(repo); output = await noLinks(output);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  if (source !== head) throw new Error('Requested source must equal checked-out HEAD.');
  if (git(repo, ['status', '--porcelain', '--untracked-files=all']).trim()) throw new Error('Package source must be clean, including untracked files. Commit reviewed paths first; use an ignored output folder.');
  const definition = 'automation-lab/student-kit/allowlist.json';
  const list = validateAllowlist(JSON.parse(git(repo, ['show', `${source}:${definition}`])));
  const files = [];
  for (const [from, to] of list) {
    const tree = git(repo, ['ls-tree', source, '--', from]).trim();
    if (!tree.startsWith('100644 blob ') && !tree.startsWith('100755 blob ')) throw new Error(`Missing or nonregular Git blob: ${from}`);
    await noLinks(path.join(repo, from));
    const bytes = git(repo, ['show', `${source}:${from}`], null);
    checkContent(from, bytes);
    files.push({path: to, bytes});
  }
  const jsonFile = name => JSON.parse(files.find(file => file.path === name)?.bytes.toString('utf8') || 'null');
  checkPins(jsonFile('practice-app/package.json'), jsonFile('practice-app/package-lock.json'));
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const manifest = {
    schemaVersion: 1, version, sourceCommit: source, platform: 'windows-x64',
    prerequisites: {node: '24.x', git: '2.x', browser: 'Microsoft Edge or Google Chrome', internetForInitialInstall: true},
    files: files.map(file => ({path: file.path, bytes: file.bytes.length, sha256: digest(file.bytes)}))
  };
  files.push({path: 'kit-manifest.json', bytes: Buffer.from(JSON.stringify(manifest, null, 2) + '\n')});
  const zip = zipFiles(files.map(file => ({...file, path: `Mini Quiz Lab ${version}/${file.path}`})));
  const filename = `mini-quiz-lab-${version}-windows.zip`;
  const release = {...manifest, filename, bytes: zip.length, sha256: digest(zip)};
  await fs.mkdir(output, {recursive: true});
  await noLinks(output);
  const artifacts = [[filename, zip], ['release.json', Buffer.from(JSON.stringify(release, null, 2) + '\n')], ['SHA256SUMS', Buffer.from(`${release.sha256}  ${filename}\n`)]];
  for (const [name, bytes] of artifacts) {
    const target = path.join(output, name); await noLinks(target);
    try {
      const existing = await fs.readFile(target);
      if (!existing.equals(bytes)) throw new Error(`Refusing to replace existing release artifact: ${name}. Use a new version/output folder.`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const [name, bytes] of artifacts) {
    try { await fs.writeFile(path.join(output, name), bytes, {flag: 'wx'}); }
    catch (error) { if (error.code !== 'EEXIST' || !(await fs.readFile(path.join(output, name))).equals(bytes)) throw error; }
  }
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = {};
    for (let index = 2; index < process.argv.length; index += 2) {
      const key = process.argv[index]; const value = process.argv[index + 1];
      if (!['--version', '--source', '--output'].includes(key) || !value) throw new Error('Usage: node package.mjs --version 1.0.0 --source <40hex> --output <directory>');
      options[key.slice(2)] = value;
    }
    if (!options.output) throw new Error('--output is required.');
    const result = await buildPackage({repo: path.resolve(directory, '../..'), ...options});
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(`Package failed: ${error.message}`); process.exitCode = 1; }
}
