#!/usr/bin/env node
// Real Coder workspace rehearsal. This script never creates resources.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const [tokenFile, countText, reportFile] = process.argv.slice(2);
const count = Number(countText);
if (!tokenFile || ![1, 10, 50].includes(count) || !reportFile) {
  console.error('Usage: node scripts/rehearse.mjs <private-tokens.json> <1|10|50> <report.json>');
  process.exit(2);
}
const url = process.env.CODER_URL;
if (!url || !/^https:\/\//.test(url)) throw new Error('CODER_URL must be HTTPS');
const accounts = JSON.parse(readFileSync(tokenFile, 'utf8'));
if (!Array.isArray(accounts) || accounts.length < count) throw new Error(`Need ${count} student tokens`);
const cohort = accounts.slice(0, count);
if (new Set(cohort.map(a => a.username)).size !== count) throw new Error('Duplicate student usernames');
for (const a of cohort) {
  if (!a.username || !a.token || !a.workspace) throw new Error('Each account needs username, token, workspace');
}

const commands = [
  ['preview', ['curl', '-fsS', 'http://127.0.0.1:4173/api/health']],
  ['ide', ['curl', '-fsS', 'http://127.0.0.1:13337/healthz']],
  ['browser', ['curl', '-fsS', 'http://127.0.0.1:6080/vnc.html']],
  ['playwright-headed', ['env', 'DISPLAY=:99', 'CYPRESS_BROWSER=chromium', 'npm', '--prefix', '/home/coder/academy/automation-lab/practice-app', 'run', 'test:playwright:headed']],
];

function run(account, args) {
  return new Promise(resolve => {
    const child = spawn('coder', ['ssh', '--disable-autostart', account.workspace, '--', ...args], {
      env: { ...process.env, CODER_SESSION_TOKEN: account.token, CODER_URL: url },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    // Drain output without retaining it: test logs may contain student data.
    child.stdout.resume();
    child.stderr.resume();
    const timeout = setTimeout(() => child.kill(), 8 * 60 * 1000);
    child.on('error', error => { clearTimeout(timeout); resolve({ ok: false, errorCode: error.code || 'spawn-error' }); });
    child.on('close', code => { clearTimeout(timeout); resolve({ ok: code === 0, exitCode: code }); });
  });
}

const startedAt = new Date().toISOString();
const results = await Promise.all(cohort.map(async account => {
  const begin = performance.now();
  const checks = {};
  for (const [name, command] of commands) {
    checks[name] = await run(account, command);
    if (!checks[name].ok) break;
  }
  return { username: account.username, workspace: account.workspace, durationMs: Math.round(performance.now() - begin), checks };
}));
const report = {
  scope: 'same-owner workspace workload and headed browser tests only; isolation, persistence, and browser proxy require separate acceptance',
  startedAt,
  finishedAt: new Date().toISOString(),
  coderUrl: url,
  cohortSize: count,
  passed: results.filter(r => Object.keys(r.checks).length === commands.length && Object.values(r.checks).every(c => c.ok)).length,
  results,
};
writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
console.log(`${report.passed}/${count} real student workspaces passed; report: ${reportFile}`);
if (report.passed !== count) process.exitCode = 1;
