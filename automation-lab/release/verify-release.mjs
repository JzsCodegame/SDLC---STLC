import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export const windowsChecks = ['freshExtraction', 'integrity', 'prerequisites', 'install', 'appUi', 'api', 'playwright', 'cypress', 'playwrightHeaded', 'cypressVisible', 'preservation', 'secondInstanceRefused'];
export const ciPhases = ['Package and download-descriptor safety tests', 'Install pinned dependencies', 'Build the application', 'API tests', 'Playwright UI tests', 'Cypress UI tests', 'Package exact source'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(['--artifacts', '--ci', '--windows'].includes(argv[i]) && argv[i + 1], 'Expected --artifacts DIRECTORY --ci RECEIPT --windows RECEIPT');
    assert.equal(options[argv[i].slice(2)], undefined, 'Duplicate option');
    options[argv[i].slice(2)] = path.resolve(argv[i + 1]);
  }
  assert.ok(options.artifacts && options.ci && options.windows, 'All three evidence paths are required');
  return options;
}

export async function verifyRelease({artifacts, ci, windows}) {
  const releaseBytes = await fs.readFile(path.join(artifacts, 'release.json'));
  const release = JSON.parse(releaseBytes);
  assert.equal(release.schemaVersion, 1);
  assert.match(release.version || '', /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.match(release.sourceCommit || '', /^[a-f0-9]{40}$/);
  assert.equal(release.platform, 'windows-x64');
  assert.equal(release.filename, `mini-quiz-lab-${release.version}-windows.zip`);
  assert.match(release.sha256 || '', /^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(release.bytes) && release.bytes > 0);
  const archive = await fs.readFile(path.join(artifacts, release.filename));
  assert.equal(archive.length, release.bytes, 'ZIP byte length differs from manifest');
  assert.equal(sha256(archive), release.sha256, 'ZIP checksum differs from manifest');
  const checksumBytes = await fs.readFile(path.join(artifacts, 'SHA256SUMS'));
  assert.equal(checksumBytes.toString('utf8').replace(/\r\n/g, '\n'), `${release.sha256}  ${release.filename}\n`, 'Checksum file differs from manifest');
  const ciBytes = await fs.readFile(ci);
  const windowsBytes = await fs.readFile(windows);
  const ciReceipt = JSON.parse(ciBytes);
  const windowsReceipt = JSON.parse(windowsBytes);
  const artifact = {filename: release.filename, bytes: release.bytes, sha256: release.sha256};
  for (const [label, receipt] of [['CI', ciReceipt], ['Windows', windowsReceipt]]) {
    assert.equal(receipt.schemaVersion, 1, `${label} schema unsupported`);
    assert.equal(receipt.passed, true, `${label} did not pass`);
    assert.equal(receipt.sourceCommit, release.sourceCommit, `${label} source SHA differs`);
    assert.equal(receipt.version, release.version, `${label} version differs`);
    assert.deepEqual(receipt.artifact, artifact, `${label} artifact differs`);
  }
  assert.equal(ciReceipt.platform, 'linux', 'Expected the isolated Linux CI receipt');
  assert.ok(Array.isArray(ciReceipt.phases), 'CI phases missing');
  for (const name of ciPhases) {
    const phases = ciReceipt.phases.filter(item => item.name === name);
    assert.equal(phases.length, 1, `CI phase missing or duplicated: ${name}`);
    assert.equal(phases[0].exitCode, 0, `CI phase failed: ${name}`);
    assert.ok(!phases[0].error && !phases[0].signal, `CI phase was interrupted: ${name}`);
  }
  assert.equal(windowsReceipt.platform, 'win32', 'Windows rehearsal platform missing');
  for (const check of windowsChecks) assert.equal(windowsReceipt.checks?.[check], true, `Windows check missing or failed: ${check}`);
  return {schemaVersion: 1, passed: true, sourceCommit: release.sourceCommit, version: release.version, tag: `local-lab-v${release.version}`, artifact, ciReceiptSha256: sha256(ciBytes), windowsReceiptSha256: sha256(windowsBytes), cleanWindowsMachine: windowsReceipt.cleanMachine === true, assets: [{name: release.filename, sha256: release.sha256, bytes: archive.length}, {name: 'release.json', sha256: sha256(releaseBytes), bytes: releaseBytes.length}, {name: 'SHA256SUMS', sha256: sha256(checksumBytes), bytes: checksumBytes.length}]};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await verifyRelease(parseOptions(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(`Release blocked: ${error.message}`); process.exitCode = 1; }
}
