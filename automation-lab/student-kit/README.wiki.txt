# Mini Quiz Tech and AI Academy: local automation lab

This package is the real Help Desk practice website, its Node API and the same
regression checks in Playwright and Cypress. It runs on your computer. No cloud
workspace, payment card, Docker, Kubernetes or model API account is required.

## 1. Before the class

1. Use a Windows 10/11 x64 computer with Node.js 24 LTS (including npm), Git for
   Windows and Microsoft Edge or Google Chrome installed. Use your preferred editor.
   Official installers: https://nodejs.org/en/download and https://git-scm.com/download/win.
2. Keep at least 2 GiB of disk space for the initial setup. More space may be needed
   for later exercises and reports. Browser automation uses your computer's memory;
   close unnecessary applications if it becomes slow.
3. Download the ZIP from the Academy. Compare its SHA-256 with the Academy release
   information using `Get-FileHash -Algorithm SHA256 '<downloaded ZIP path>'`.
4. Right-click the ZIP and select Extract All. Choose a normal local folder you own.
   Keep each version in a separate folder. Do not open scripts inside the ZIP.
   Network drives, linked folders and synchronized folder redirection are not
   supported by the first release's integrity checks.
5. Open PowerShell in the extracted `Mini Quiz Lab <version>` folder. All commands
   below run there. `Lab.cmd` works without changing PowerShell execution policy.
   `node .\lab.mjs <command>` is equivalent. `Lab.ps1` is optional if your existing
   script policy permits it. Never disable a security policy just to run this lab.

## 2. Check, install and start

```powershell
.\Lab.cmd check
.\Lab.cmd install
.\Lab.cmd start
```

1. Check verifies Node, npm, Git, an installed browser, writable storage, disk space,
   available ports and the hashes of the shipped files. Missing prerequisites are
   reported; the launcher does not install global tools or change Windows settings.
2. Install creates a separate student working copy, runs `npm ci`, installs/verifies
   the pinned Cypress binary and runs `npm run build`. The first setup needs an
   Internet connection. npm registry packages and Cypress downloads may need to be
   allowed by your school's proxy. A failed download stops setup with an error;
   retry Install after fixing the connection. Do not disable TLS checks.
3. Playwright uses your installed Edge or Chrome. It does not download another
   browser for this kit. Cypress downloads its runner and can use Edge or Chrome.
4. Start opens the app at http://127.0.0.1:4173/ and prints the equivalent PowerShell
   and npm commands. Keep that terminal open. Ctrl+C stops this lab only.
5. Use fictional names and tickets. This is a local learning app, not an account
   system. Do not publish its API or terminal to the Internet.

You can also double-click `Lab.cmd` and choose a numbered menu action.

## 3. Where your work lives

```text
Your chosen folder/
  Mini Quiz Lab 1.0.0/                 Downloaded template and launchers
  Mini Quiz Student Work/
    1.0.0/
      practice-app/                   EDIT THESE source files and tests
      NOTES.md                        Your learning notes
      workspace.json                  Source/version identity
    manual-data/                      Your manually created tickets
```

1. The launcher prints the exact working path. Open that `practice-app` folder in
   your editor. The downloaded template is checked by `.\Lab.cmd verify`; do not
   edit it. Edit the student copy instead.
2. Re-running Install preserves source, tests and notes. `npm ci` replaces only
   installed dependencies; the build replaces generated `dist` files.
3. A new release creates a new version folder. It never merges, migrates or overwrites
   your old exercises automatically. Keep the old version, compare the new example
   tests, and copy your chosen changes deliberately. Keep both kit and matching
   workspace if you want to run an older version.
4. Manual records are separate from test records. Each suite resets its own test
   data; pressing Confirm reset in the manual app intentionally resets your manual
   practice records to the three examples. Back up `Mini Quiz Student Work` to keep
   your work. No package update or uninstall command deletes it.
5. To learn Git, open PowerShell in your STUDENT `practice-app` folder and run
   `git init`, `git status`, `git add tests cypress`, then commit when you are ready.
   Configure your own Git name/email if asked. This download has no instructor Git
   history or credentials. Do not commit generated data, dependencies or reports.

## 4. Run tests and inspect evidence

Open another PowerShell window in the downloaded kit folder:

```powershell
.\Lab.cmd test api
.\Lab.cmd test playwright
.\Lab.cmd test cypress
.\Lab.cmd test playwright-headed
.\Lab.cmd test cypress-open
.\Lab.cmd report
```

1. API tests verify validation, persistence, concurrent writes and reset separation.
2. Playwright and Cypress each verify required fields, create/search/reload,
   update/filter, empty-search recovery, cancel/reset and API status validation.
3. `playwright-headed` shows real browser actions. `cypress-open` opens Cypress:
   choose E2E Testing, select Edge or Chrome, then `help-desk.cy.ts` to see the tests.
4. Tests print a nonzero exit code on failure. Read the failing assertion and its
   expected/actual result. The Playwright HTML report is in your working app's
   `playwright-report`; `report` opens its viewer at http://127.0.0.1:8083/.
5. Test wrappers build your current working source first. Direct `npm run` commands
   are also available in the STUDENT working app. Run `npm run build` after changing
   TypeScript, then use `npm run test:api`, `npm run test:playwright` or
   `npm run test:cypress`. For direct browser commands in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:CYPRESS_BROWSER = 'edge'
```

For Chrome, set both values to `chrome`. The kit wrapper chooses an installed
browser automatically, preferring Edge. These variables affect this terminal only.

## 5. Ports and troubleshooting

| Purpose | Port | Saved records |
| --- | --- | --- |
| Manual app | 4173 | Student Work/manual-data |
| Playwright app | 4174 | Version's practice-app/.test-data/playwright |
| Cypress app | 4175 | Version's practice-app/.test-data/cypress |
| Playwright HTML report | 8083 | Version's practice-app/playwright-report |

1. If a port is occupied, stop your previous lab/test window. The kit does not kill
   an unknown process. Do not run two copies of one framework simultaneously.
2. If another app needs 4173, set `$env:LAB_PORT='4183'` in the kit terminal before
   Check or Start. Start prints and opens the adjusted URL. Valid values are
   1024-65535 except 4174/4175. Test ports stay unchanged. Start only one manual
   instance because all manual instances use the same record folder.
3. `start --no-open` starts the same server without opening a browser, useful for
   instructor verification. It does not bind to a public address.
4. A missing or edited template file fails integrity verification. Re-extract the
   matching download; your separate student copy stays in place. A missing workspace
   marker stops installation rather than overwriting an unknown folder.
5. If Node or Git is newly installed, close and reopen PowerShell so PATH refreshes.
   If dependencies cannot be downloaded, repair the connection and retry Install.
6. A fresh extraction rehearsal is evidence for this release on the instructor's
   Windows machine, not proof of every student hardware or school policy setup.

## 6. Learning flow

Requirement -> manual observation -> assertion -> API/UI test -> failure evidence
-> correction -> regression rerun -> saved student work.

Read EXERCISES.md for the guided tasks. Lessons, diagrams and quizzes stay together
in the Academy website; the local app is the hands-on practice target.
