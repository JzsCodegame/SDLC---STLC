import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ciPhases, windowsChecks, sha256, verifyRelease} from './verify-release.mjs';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mqa-release-gate-'));
  const bytes = Buffer.from('synthetic archive for evidence-gate tests');
  const release = {schemaVersion: 1, version: '1.0.0', sourceCommit: 'a'.repeat(40), platform: 'windows-x64', filename: 'mini-quiz-lab-1.0.0-windows.zip', bytes: bytes.length, sha256: sha256(bytes)};
  const artifact = {filename: release.filename, bytes: release.bytes, sha256: release.sha256};
  const common = {schemaVersion: 1, passed: true, sourceCommit: release.sourceCommit, version: release.version, artifact};
  const ciReceipt = {...common, platform: 'linux', phases: ciPhases.map(name => ({name, exitCode: 0, error: null, signal: null}))};
  const windowsReceipt = {...common, platform: 'win32', checks: Object.fromEntries(windowsChecks.map(name => [name, true])), cleanMachine: false};
  const options = {artifacts: root, ci: path.join(root, 'ci.json'), windows: path.join(root, 'windows.json')};
  await fs.writeFile(path.join(root, release.filename), bytes);
  await fs.writeFile(path.join(root, 'release.json'), JSON.stringify(release));
  await fs.writeFile(path.join(root, 'SHA256SUMS'), `${release.sha256}  ${release.filename}\n`);
  await fs.writeFile(options.ci, JSON.stringify(ciReceipt));
  await fs.writeFile(options.windows, JSON.stringify(windowsReceipt));
  await fs.writeFile(path.join(root, 'current-descriptor.json'), 'previous verified release');
  return {root, release, ciReceipt, windowsReceipt, options};
}

test('matching Linux and Windows evidence unlocks only the exact immutable package', async () => {
  const f = await fixture();
  const result = await verifyRelease(f.options);
  assert.equal(result.passed, true);
  assert.equal(result.cleanWindowsMachine, false);
  assert.equal(result.tag, 'local-lab-v1.0.0');
  assert.equal(result.assets.length, 3);
});

test('red CI, missing Windows proof, mismatched source and altered ZIP all fail before promotion', async () => {
  for (const fault of ['red-ci', 'missing-windows', 'wrong-source', 'wrong-bytes', 'missing-visible-check']) {
    const f = await fixture();
    if (fault === 'red-ci') { f.ciReceipt.passed = false; await fs.writeFile(f.options.ci, JSON.stringify(f.ciReceipt)); }
    if (fault === 'missing-windows') f.options.windows = path.join(f.root, 'missing.json');
    if (fault === 'wrong-source') { f.windowsReceipt.sourceCommit = 'b'.repeat(40); await fs.writeFile(f.options.windows, JSON.stringify(f.windowsReceipt)); }
    if (fault === 'wrong-bytes') await fs.appendFile(path.join(f.root, f.release.filename), 'altered');
    if (fault === 'missing-visible-check') { f.windowsReceipt.checks.cypressVisible = false; await fs.writeFile(f.options.windows, JSON.stringify(f.windowsReceipt)); }
    await assert.rejects(verifyRelease(f.options), undefined, fault);
    assert.equal(await fs.readFile(path.join(f.root, 'current-descriptor.json'), 'utf8'), 'previous verified release');
  }
});
