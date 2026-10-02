import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {checkContent, checkPins, digest, ensureWorkspace, noLinks, safeRelative, verifyKit} from './lib.mjs';
import {validateAllowlist, zipFiles} from './package.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '../practice-app');
const required = {'lab.mjs': '// fixture launcher\n', 'lib.mjs': '// fixture helper\n', 'practice-app/package.json': '{"name":"fixture"}\n', 'practice-app/package-lock.json': '{}\n', 'practice-app/server/index.js': '// fixture server\n', 'practice-app/tests/my-test.ts': 'expect(true).toBe(true);\n'};

async function fixture(version = '1.0.0', parent) {
  parent ||= await fs.mkdtemp(path.join(os.tmpdir(), 'Mini Quiz test with spaces '));
  const root = path.join(parent, `Mini Quiz Lab ${version}`);
  await fs.mkdir(root);
  const files = [];
  for (const [name, text] of Object.entries(required)) { const target = path.join(root, name); await fs.mkdir(path.dirname(target), {recursive: true}); await fs.writeFile(target, text); files.push({path: name, bytes: Buffer.byteLength(text), sha256: digest(Buffer.from(text))}); }
  const manifest = {schemaVersion: 1, version, sourceCommit: 'a'.repeat(40), files};
  await fs.writeFile(path.join(root, 'kit-manifest.json'), JSON.stringify(manifest));
  return {root, manifest, parent};
}

test('allowlist excludes traversal, device names, secrets, cloud, private data and case collisions', async () => {
  for (const value of ['../outside.txt', '/absolute.txt', 'x/../../outside', 'x\\escape', 'C:/escape', 'x/CON.txt', 'x/foo.', 'x/foo ', 'x//foo', 'practice-app/.env', 'automation-lab/infra/token.json', 'practice-app/data/tickets.json', 'practice-app/node_modules/x.js']) assert.throws(() => safeRelative(value), value);
  const approved = JSON.parse(await fs.readFile(path.join(here, 'allowlist.json'), 'utf8'));
  assert.ok(validateAllowlist(approved).length > 20);
  assert.throws(() => validateAllowlist({schemaVersion: 1, files: [['automation-lab/practice-app/src/a.ts', 'A.ts'], ['automation-lab/practice-app/src/b.ts', 'a.ts']]}), /Duplicate/);
  assert.throws(() => validateAllowlist({schemaVersion: 1, files: [['governance/policy.txt', 'policy.txt']]}), /outside/);
});

test('credential detector blocks representative secrets and reports only the file path', () => {
  for (const secret of ['-----BEGIN ' + 'PRIVATE KEY-----\nnot-real', 'ghp_' + 'z'.repeat(36), 'dop_v1_' + 'a'.repeat(64), 'api_key="' + 'x'.repeat(32) + '"']) assert.throws(() => checkContent('fixture.txt', Buffer.from(secret)), error => error.message === 'Possible credential in allowlisted file: fixture.txt');
  checkContent('safe.txt', Buffer.from('const apiUrl = "/api/tickets";'));
});

test('lock integrity rejects package drift, unpinned dependencies and untrusted download source', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
  const lock = JSON.parse(await fs.readFile(path.join(app, 'package-lock.json'), 'utf8'));
  checkPins(pkg, lock);
  const drift = structuredClone(lock); drift.packages[''].dependencies.react = '0.0.0'; assert.throws(() => checkPins(pkg, drift), /mismatch/);
  const loose = structuredClone(pkg); loose.dependencies.react = '^19.3.0'; assert.throws(() => checkPins(loose, lock));
  const network = structuredClone(lock); network.packages['node_modules/react'].resolved = 'https://example.invalid/react.tgz'; assert.throws(() => checkPins(pkg, network), /Nonregistry/);
});

test('download verification catches missing and altered files before any workspace is created', async () => {
  const kit = await fixture();
  assert.equal((await verifyKit(kit.root)).version, '1.0.0');
  await fs.writeFile(path.join(kit.root, 'practice-app/server/index.js'), 'changed');
  await assert.rejects(() => verifyKit(kit.root), /integrity failed/);
  await assert.rejects(() => fs.access(path.join(kit.parent, 'Mini Quiz Student Work')));
  const missing = await fixture(); await fs.rename(path.join(missing.root, 'lab.mjs'), path.join(missing.root, 'removed.mjs'));
  await assert.rejects(() => verifyKit(missing.root), /ENOENT/);
});

test('reinstall and a new version preserve student test changes and shared manual records', async () => {
  const kit = await fixture(); const first = await ensureWorkspace(kit.root, await verifyKit(kit.root));
  assert.equal(first.created, true);
  const edited = path.join(first.app, 'tests/my-test.ts'); await fs.writeFile(edited, 'my student edits');
  await fs.mkdir(first.data); await fs.writeFile(path.join(first.data, 'tickets.json'), 'student manual records');
  const again = await ensureWorkspace(kit.root, kit.manifest); assert.equal(again.created, false);
  assert.equal(await fs.readFile(edited, 'utf8'), 'my student edits');
  const upgrade = await fixture('1.0.1', kit.parent); const next = await ensureWorkspace(upgrade.root, await verifyKit(upgrade.root));
  assert.notEqual(first.app, next.app); assert.equal(first.data, next.data);
  assert.equal(await fs.readFile(edited, 'utf8'), 'my student edits');
  assert.equal(await fs.readFile(path.join(next.data, 'tickets.json'), 'utf8'), 'student manual records');
  assert.equal(await fs.readFile(path.join(next.app, 'tests/my-test.ts'), 'utf8'), required['practice-app/tests/my-test.ts']);
});

test('unknown existing workspace and changed source identity fail without overwriting files', async () => {
  const kit = await fixture(); const target = path.join(kit.parent, 'Mini Quiz Student Work/1.0.0');
  await fs.mkdir(target, {recursive: true}); await fs.writeFile(path.join(target, 'keep.txt'), 'keep');
  await assert.rejects(() => ensureWorkspace(kit.root, kit.manifest), /no valid workspace marker/);
  assert.equal(await fs.readFile(path.join(target, 'keep.txt'), 'utf8'), 'keep');
  const another = await fixture(); await ensureWorkspace(another.root, another.manifest);
  await assert.rejects(() => ensureWorkspace(another.root, {...another.manifest, sourceCommit: 'b'.repeat(40)}), /source does not match/);
});

test('linked template or workspace paths are rejected', async () => {
  const kit = await fixture(); const redirect = path.join(kit.parent, 'redirect');
  await fs.symlink(kit.root, redirect, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => noLinks(redirect), /Linked|Redirected/);
  await assert.rejects(() => verifyKit(redirect), /Linked|Redirected/);
});

test('ZIP is deterministic and contains only requested regular file entries and exact bytes', () => {
  const files = [{path: 'Mini Quiz Lab 1.0.0/hello.txt', bytes: Buffer.from('hello\n')}, {path: 'Mini Quiz Lab 1.0.0/app/test.ts', bytes: Buffer.from('test source')}];
  const first = zipFiles(files); assert.deepEqual(first, zipFiles(files));
  let offset = 0; const found = [];
  while (first.readUInt32LE(offset) === 0x04034b50) {
    const size = first.readUInt32LE(offset + 18); const nameLength = first.readUInt16LE(offset + 26); const extra = first.readUInt16LE(offset + 28);
    const name = first.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extra;
    found.push({path: name, bytes: inflateRawSync(first.subarray(start, start + size))}); offset = start + size;
  }
  assert.deepEqual(found, files); assert.equal(first.readUInt32LE(offset), 0x02014b50); assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);
  assert.throws(() => zipFiles([{path: '../escape', bytes: Buffer.from('x')}]));
});

test('paired teaching guides are identical ASCII text', async () => {
  for (const name of ['README', 'EXERCISES']) {
    const markdown = await fs.readFile(path.join(here, `${name}.md`)); const wiki = await fs.readFile(path.join(here, `${name}.wiki.txt`));
    assert.deepEqual(markdown, wiki); assert.ok(markdown.every(byte => byte < 128));
  }
});
