import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => index % 2 ? pairs : [...pairs, [value, all[index + 1]]], []));
const source = args['--source'];
const version = args['--version'];
const output = path.resolve(args['--output'] || 'artifacts');
assert.match(source || '', /^[0-9a-f]{40}$/);
assert.match(version || '', /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/);
const repository = process.cwd();
const app = path.join(repository, 'automation-lab/practice-app');
fs.mkdirSync(output, {recursive: true});
const receipt = {schemaVersion: 1, sourceCommit: source, version, startedAt: new Date().toISOString(), platform: process.platform, node: process.version, image: process.env.LAB_CI_IMAGE || null, phases: [], passed: false, windowsAcceptanceRequired: true, published: false};

function command(name, executable, argv, cwd = app) {
  const start = Date.now();
  console.log(`\n${name}`);
  const result = spawnSync(executable, argv, {cwd, stdio: 'inherit', env: {...process.env, CI: '1'}, timeout: 15 * 60 * 1000});
  receipt.phases.push({name, exitCode: result.status, signal: result.signal, elapsedMs: Date.now() - start, error: result.error?.message || null});
  if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.status ?? result.error?.code})`);
}

try {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'});
  assert.equal(head.status, 0);
  assert.equal(head.stdout.trim(), source, 'Checked out source does not match requested SHA');
  const tracked = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], {encoding: 'utf8'});
  assert.equal(tracked.status, 0);
  assert.equal(tracked.stdout.trim(), '', 'Tracked source must be clean');
  command('Package and download-descriptor safety tests', process.execPath, ['--test', 'automation-lab/student-kit/package.test.mjs', 'tests/automation-release.test.mjs'], repository);
  command('Install pinned dependencies', 'npm', ['ci']);
  command('Build the application', 'npm', ['run', 'build']);
  command('API tests', 'npm', ['run', 'test:api']);
  command('Playwright UI tests', 'npm', ['run', 'test:playwright']);
  command('Cypress UI tests', 'npm', ['run', 'test:cypress']);
  command('Package exact source', process.execPath, ['automation-lab/student-kit/package.mjs', '--version', version, '--source', source, '--output', output], repository);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'release.json'), 'utf8'));
  assert.equal(manifest.sourceCommit, source);
  assert.equal(manifest.version, version);
  assert.equal(path.basename(manifest.filename), manifest.filename, 'Archive must stay inside artifact directory');
  const archive = fs.readFileSync(path.join(output, manifest.filename));
  assert.equal(archive.length, manifest.bytes);
  assert.equal(createHash('sha256').update(archive).digest('hex'), manifest.sha256);
  receipt.artifact = {filename: manifest.filename, bytes: manifest.bytes, sha256: manifest.sha256};
  receipt.passed = true;
} catch (error) {
  receipt.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  for (const folder of ['playwright-report', 'test-results', 'cypress/screenshots']) {
    const from = path.join(app, folder);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(output, 'reports', folder), {recursive: true});
  }
  receipt.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'ci-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({passed: receipt.passed, sourceCommit: source, version, artifact: receipt.artifact || null}));
}
