# Mini Quiz Academy: Windows student lab

Follow these steps in order. This kit runs the Help Desk practice website,
Playwright and Cypress on your Windows computer. You do not need Docker or
an Academy workspace login. Use Windows 10/11 x64, Internet access and at least
2 GiB of free disk space. Installation may ask for Windows administrator approval.

## 1. Download and extract

1. Download the Windows ZIP from the Academy's Automation page.
2. In File Explorer, open Downloads. Right-click the ZIP, choose Properties,
   select Unblock if shown, then Apply. This applies only to this downloaded ZIP;
   do not change your computer's PowerShell security policy.
3. Right-click the ZIP > Extract All. Extract into a local folder you own,
   such as Downloads. Do not run files while viewing the ZIP.
4. Open the extracted folder, then open `Mini Quiz Lab <version>` inside it.
   You should see `Setup.cmd`, `Lab.cmd` and this README.

## 2. Run setup once

Double-click **Setup.cmd**. Keep its window open until it says **SETUP SUCCEEDED**.

- It checks Node 24 (with npm), Git, Edge/Chrome and VS Code.
- Compatible tools print PASS and are kept. Missing/unsupported tools are installed
  or updated using Windows App Installer (winget). Approve the named installer if
  Windows asks. The kit never disables security checks or uninstalls unrelated apps.
- It then installs the exact project versions of Playwright, Cypress and the app's
  dependencies, verifies Cypress, and builds the Help Desk.
- It prints the exact location of your editable practice folder.
- Re-running setup keeps your saved source/tests/notes and manual records.
  Dependency installation refreshes node_modules and the generated build only.

If you see SETUP STOPPED, setup did not succeed. Read the first error above it.
Fix the stated issue and double-click Setup.cmd again. If App Installer is missing,
install/update **App Installer** in Microsoft Store, then retry. A school-managed
computer may need its administrator to approve installation. If scripts are blocked
by school policy, ask the instructor; do not bypass that policy.

Optional: from this folder in PowerShell, ` .\Setup.cmd -CheckOnly ` checks tools
without installing. ` .\Setup.cmd -UpdateTools ` requests available Git, browser
and editor updates. Node stays on compatible 24.x; the kit never jumps it to a
new major version. Updates can require closing the affected applications.

## 3. Open PowerShell in the correct folder

In File Explorer, stay in the folder containing **Lab.cmd**.
Click the address bar, type **powershell**, and press Enter.
In the PowerShell window, type this and press Enter:

```powershell
Get-Location
Get-ChildItem Lab.cmd
```

The first command shows your current folder. The second should show Lab.cmd.
If it says the file does not exist, you are in the wrong folder. Close this
PowerShell window and repeat the File Explorer steps above.

If your instructor gives you a folder path, this command moves into it; replace
only the example path with your actual extracted kit folder and keep the quotes:

```powershell
Set-Location "C:\Users\YourName\Downloads\Mini Quiz Lab 1.1.0"
```

## 4. Run your first visible Playwright test

In that PowerShell window, run:

```powershell
.\Lab.cmd test playwright-headed
```

This command builds your saved practice app, starts a separate test server,
opens a real browser and runs the example tests. You do **not** need to run
Start first. Watch the browser fill forms and check outcomes. The browser closes
when the run finishes. The terminal prints passed/failed counts. If something
fails, keep the error text for your instructor. To open the report, run:

```powershell
.\Lab.cmd report
```

## 5. Find your files and change a test

```powershell
.\Lab.cmd folder
```

This opens your **editable practice folder** and prints its exact path.
In VS Code, choose File > Open Folder and select that printed folder.
Open `tests/playwright/help-desk.spec.ts`. Save your change, return to the kit
PowerShell window, and run `.\Lab.cmd test playwright-headed` again.
Edit the student working copy, not the downloaded template.

## 6. Open the app for manual practice

```powershell
.\Lab.cmd start
```

This opens http://127.0.0.1:4173/ for you to use manually. Keep this terminal open.
Press **Ctrl+C** in it to stop the app. Browser tests use their own separate server.
Use fictional records; this practice app is not a student authentication system.

## 7. Where your work lives

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

## 8. Run tests and inspect evidence

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

## 9. Ports and troubleshooting

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

## 10. Learning flow

Requirement -> manual observation -> assertion -> API/UI test -> failure evidence
-> correction -> regression rerun -> saved student work.

Read EXERCISES.md for the guided tasks. Lessons, diagrams and quizzes stay together
in the Academy website; the local app is the hands-on practice target.
