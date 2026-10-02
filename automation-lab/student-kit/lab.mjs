import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {ensureWorkspace, noLinks, readManifest, studentPaths, verifyKit} from './lib.mjs';

const kitRoot = path.dirname(fileURLToPath(import.meta.url));
const originalArguments = process.argv.slice(2);
const children = new Set();
function manualPort() {
  const value = process.env.LAB_PORT || '4173';
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1024 || port > 65535 || [4174, 4175].includes(port)) throw new Error('LAB_PORT must be 1024-65535, excluding the test ports 4174 and 4175.');
  return port;
}
process.on('SIGINT', () => { for (const child of children) child.kill(); process.exitCode = 130; });
process.on('SIGTERM', () => { for (const child of children) child.kill(); process.exitCode = 143; });

function nodeVersion() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error(`This release requires Node.js 24.x LTS; found ${process.version}. Install Node 24, then reopen PowerShell.`);
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This release is verified for Windows x64. Other platforms have not passed the student setup rehearsal.');
}

async function npmCli() {
  const candidates = [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  try { for (const entry of execFileSync('where.exe', ['npm.cmd'], {encoding: 'utf8', windowsHide: true}).trim().split(/\r?\n/)) candidates.push(path.join(path.dirname(entry), 'node_modules/npm/bin/npm-cli.js')); } catch {}
  for (const candidate of candidates) { try { await fs.access(candidate); return candidate; } catch {} }
  throw new Error('npm was not found. Repair the Node.js 24 installation with npm selected, then reopen PowerShell.');
}

async function browser() {
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean);
  for (const [relative, playwright, cypress, label] of [['Microsoft/Edge/Application/msedge.exe', 'msedge', 'edge', 'Microsoft Edge'], ['Google/Chrome/Application/chrome.exe', 'chrome', 'chrome', 'Google Chrome']]) {
    for (const root of roots) { const candidate = path.join(root, relative); try { await fs.access(candidate); return {playwright, cypress, label}; } catch {} }
  }
  throw new Error('Install Microsoft Edge or Google Chrome, then run the setup check again. This kit uses your installed browser; it does not install a system browser.');
}

async function requirePort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', error => reject(new Error(`Port ${port} is unavailable (${error.code}). Stop your previous lab/test window, or identify the application using that port. Nothing was stopped automatically.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

async function guardWorkspace(locations, manifest) {
  for (const entry of [locations.workspace, locations.app, locations.data, path.join(locations.app, 'node_modules'), path.join(locations.app, 'dist'), path.join(locations.app, '.test-data'), ...manifest.files.filter(file => file.path.startsWith('practice-app/')).map(file => path.join(locations.workspace, file.path))]) await noLinks(entry);
}

function runNode(args, cwd, extraEnvironment = {}) {
  return new Promise((resolve, reject) => {
    const environment = {...process.env, ...extraEnvironment};
    delete environment.ELECTRON_RUN_AS_NODE;
    const child = spawn(process.execPath, args, {cwd, stdio: 'inherit', env: environment, windowsHide: false});
    children.add(child);
    child.once('error', error => { children.delete(child); reject(error); });
    child.once('exit', (code, signal) => { children.delete(child); code === 0 ? resolve() : reject(new Error(`Command stopped with ${signal || `exit code ${code}`}. Review the output above; no release or success is inferred.`)); });
  });
}

async function runNpm(args, cwd, environment = {}) {
  console.log(`\nPowerShell equivalent: npm ${args.join(' ')}\nWorking folder: ${cwd}\n`);
  await runNode([await npmCli(), ...args], cwd, environment);
}

async function prerequisiteCheck(manifest) {
  nodeVersion(); await npmCli();
  let git;
  try { git = execFileSync('git', ['--version'], {encoding: 'utf8', windowsHide: true}).trim(); }
  catch { throw new Error('Git was not found. Install Git for Windows, then reopen PowerShell.'); }
  const selected = await browser();
  const locations = studentPaths(kitRoot, manifest.version);
  await noLinks(locations.workRoot);
  await fs.access(path.dirname(kitRoot), fs.constants.W_OK);
  const disk = await fs.statfs(path.dirname(kitRoot));
  if (disk.bavail * disk.bsize < 2 * 1024 ** 3) throw new Error('Keep at least 2 GiB of free disk space for dependencies and browser components before setup.');
  console.log(`Node ${process.version}; ${git}; ${selected.label}.`);
  console.log(`Available disk: ${(disk.bavail * disk.bsize / 1024 ** 3).toFixed(1)} GiB. Installed RAM: ${(os.totalmem() / 1024 ** 3).toFixed(1)} GiB.`);
  console.log(`Student files: ${locations.app}\nManual records: ${locations.data}`);
  return selected;
}

async function workspace(manifest) {
  const locations = studentPaths(kitRoot, manifest.version);
  await noLinks(path.join(locations.workspace, 'workspace.json'));
  let marker;
  try { marker = JSON.parse(await fs.readFile(path.join(locations.workspace, 'workspace.json'), 'utf8')); }
  catch { throw new Error('This version has not been installed. Run .\\Lab.cmd install first.'); }
  if (marker.version !== manifest.version || marker.sourceCommit !== manifest.sourceCommit) throw new Error('Student workspace belongs to another source revision. Use its matching kit; no files were changed.');
  await guardWorkspace(locations, manifest);
  return locations;
}

async function startLab(locations, shouldOpen) {
  const port = manualPort();
  const url = `http://127.0.0.1:${port}/`;
  await requirePort(port);
  await fs.access(path.join(locations.app, 'dist/index.html')).catch(() => { throw new Error('Built app is missing. Run .\\Lab.cmd install, or npm run build in your student working folder.'); });
  await fs.mkdir(locations.data, {recursive: true});
  const lockFile = path.join(locations.data, '.manual-session.lock');
  await noLinks(lockFile);
  const lockContents = JSON.stringify({pid: process.pid, port, session: randomUUID()});
  try { await fs.writeFile(lockFile, lockContents, {flag: 'wx'}); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`A manual lab already owns this record folder, or its previous session crashed. Stop that lab first. If no lab is running, inspect ${lockFile} and remove only that stale lock file; keep tickets.json.`);
    throw error;
  }
  try {
  console.log(`\nPowerShell equivalent:\n$env:HOST='127.0.0.1'; $env:PORT='${port}'; $env:LAB_MODE='true'\n$env:DATA_DIR='${locations.data.replaceAll("'", "''")}'\nnpm start\n\nOpen ${url} . Keep this terminal open; Ctrl+C stops this lab.\n`);
  const child = spawn(process.execPath, ['server/index.js'], {cwd: locations.app, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], env: {...process.env, HOST: '127.0.0.1', PORT: String(port), LAB_MODE: 'true', DATA_DIR: locations.data}});
  children.add(child);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('The lab did not report readiness in 30 seconds.')); }, 30000);
    child.once('message', async message => {
      if (!message?.ready) return;
      clearTimeout(timer);
      if (shouldOpen) {
        const opener = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {stdio: 'ignore', windowsHide: true});
        opener.on('error', () => console.log('Open the localhost address above in your browser.'));
        opener.unref();
      }
    });
    child.once('error', error => { clearTimeout(timer); children.delete(child); reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timer); children.delete(child); (code === 0 || process.exitCode === 130 || signal === 'SIGTERM') ? resolve() : reject(new Error(`Lab stopped with exit code ${code}.`)); });
  });
  } finally {
    // Release only the temporary lock this process created, never student records.
    await noLinks(lockFile);
    if (await fs.readFile(lockFile, 'utf8').catch(() => '') === lockContents) await fs.unlink(lockFile);
  }
}

async function main(args) {
  const [command = 'help', target] = args;
  if (command === 'help') { console.log('Mini Quiz local lab\nCommands: check | install | start [--no-open] | test api|playwright|cypress|playwright-headed|cypress-open | report | verify\nUse .\\Lab.cmd <command> from PowerShell. Read README.md and EXERCISES.md.'); return; }
  if (!['check', 'install', 'start', 'test', 'report', 'verify'].includes(command)) throw new Error('Unknown command. Run .\\Lab.cmd help.');
  nodeVersion();
  const manifest = command === 'check' || command === 'install' || command === 'verify' ? await verifyKit(kitRoot) : await readManifest(kitRoot);
  console.log(`Mini Quiz Lab ${manifest.version}; source ${manifest.sourceCommit}`);
  if (command === 'verify') { console.log(`Verified ${manifest.files.length} shipped files. Student edits are separate.`); return; }
  if (command === 'check') { await prerequisiteCheck(manifest); for (const port of [manualPort(), 4174, 4175]) await requirePort(port); console.log('Setup check passed. Initial install needs Internet for pinned npm packages and Cypress.'); return; }
  if (command === 'install') {
    await prerequisiteCheck(manifest);
    const locations = await ensureWorkspace(kitRoot, manifest); await guardWorkspace(locations, manifest);
    console.log(locations.created ? 'Created a separate student working copy.' : 'Using your existing student copy; edited files are preserved.');
    await runNpm(['ci'], locations.app, {CYPRESS_INSTALL_BINARY: ''});
    await runNode(['node_modules/cypress/bin/cypress', 'install'], locations.app);
    await runNode(['node_modules/cypress/bin/cypress', 'verify'], locations.app);
    await runNpm(['run', 'build'], locations.app);
    console.log('Installed and built. Run .\\Lab.cmd start, then open another PowerShell window for tests.'); return;
  }
  const locations = await workspace(manifest);
  if (command === 'start') return startLab(locations, target !== '--no-open');
  if (command === 'report') { await requirePort(8083); return runNpm(['run', 'report:playwright'], locations.app); }
  const scripts = {api: 'test:api', playwright: 'test:playwright', cypress: 'test:cypress', 'playwright-headed': 'test:playwright:headed', 'cypress-open': 'test:cypress:open'};
  if (!scripts[target]) throw new Error('Choose test api, playwright, cypress, playwright-headed or cypress-open.');
  if (target === 'api') return runNpm(['run', scripts[target]], locations.app);
  const selected = await browser();
  await requirePort(target.startsWith('playwright') ? 4174 : 4175);
  await runNpm(['run', 'build'], locations.app);
  return runNpm(['run', scripts[target]], locations.app, {PLAYWRIGHT_CHANNEL: selected.playwright, CYPRESS_BROWSER: selected.cypress});
}

try {
  if (originalArguments.length || !process.stdin.isTTY) await main(originalArguments);
  else {
    const terminal = createInterface({input: process.stdin, output: process.stdout});
    console.log('Mini Quiz Tech and AI Academy\n1. Check setup\n2. Install dependencies\n3. Start practice app\n4. Run API tests\n5. Run visible Playwright tests\n6. Open Cypress\n7. Verify downloaded files');
    const choice = await terminal.question('Choose 1-7: '); terminal.close();
    const options = {'1': ['check'], '2': ['install'], '3': ['start'], '4': ['test', 'api'], '5': ['test', 'playwright-headed'], '6': ['test', 'cypress-open'], '7': ['verify']};
    if (!options[choice]) throw new Error('No valid menu option selected.');
    await main(options[choice]);
    if (!process.exitCode) { const done = createInterface({input: process.stdin, output: process.stdout}); await done.question('Press Enter to close. '); done.close(); }
  }
} catch (error) {
  console.error(`\nLab stopped: ${error.message}\nYour exercises and manual records were not deleted. For download errors, check your Internet/proxy settings and retry Install. Do not disable Windows security policy.`);
  process.exitCode = 1;
  if (originalArguments.length === 0 && process.stdin.isTTY) {
    const failed = createInterface({input: process.stdin, output: process.stdout});
    await failed.question('Press Enter to close after reading the error. ');
    failed.close();
  }
}
