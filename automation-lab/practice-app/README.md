# Academy Help Desk: UI automation practice

This is a real React/TypeScript application backed by a Node HTTP API. Students create, search, filter, and update classroom tickets with Playwright and Cypress. The app stores JSON records in its own workspace. It never connects to academy Firebase scores.

## Start the application

Use Node 22.12 or newer (Cypress supports Node 22, 24, and 26+). From this repository folder in PowerShell:

```powershell
npm ci
npm run build
$env:LAB_MODE = 'true'
npm start
```

Open `http://127.0.0.1:4173/`. Keep this terminal running. In the cloud workspace, use the private Practice application button instead of your laptop's localhost address.

The server binds to `127.0.0.1`. Do not expose it directly to students on a public IP: it relies on a workspace platform to authenticate the owner. `LAB_MODE=true` enables the reset endpoint and confirmation control. The default disables reset. Use fictional names and details.

## Run real tests

Use another terminal. Install browsers once if they are not already in the workspace image:

```powershell
npx playwright install chromium
npx cypress install
npm run test:api
npm run test:playwright
npm run test:cypress
```

The API suite checks persistence, concurrent writes, data separation, validation, and reset gating. Playwright and Cypress each check the same six workflows: required fields, create/search/reload, update/filter, empty search recovery, cancel/reset confirmation, and API create/invalid status.

The frameworks start separate local copies of the same application: Playwright uses port 4174 and `.test-data/playwright`; Cypress uses port 4175 and `.test-data/cypress`. The manual preview stays on port 4173 with `data/`. Tests reset only their own records. Stop a running test UI before starting another suite of that framework. Changing a TypeScript file requires `npm run build` before a production-server test run.

```powershell
npm run test:playwright:headed
npm run test:playwright:ui
npm run report:playwright
npm run test:cypress:open
```

Headed browsers require a display. In the cloud workspace, open the private Test browser desktop to see them. The test does not take control of the browser on a student's laptop. Playwright UI uses port 8082 and the HTML report uses 8083. On a Windows machine with Edge already installed, set `$env:PLAYWRIGHT_CHANNEL='msedge'` before the Playwright command and `$env:CYPRESS_BROWSER='edge'` before the Cypress command. On Linux with Chromium installed, use `CYPRESS_BROWSER=chromium`. Without an override Cypress currently uses its bundled Electron runner, which is deprecated upstream; the pinned version was tested, but use a supported installed browser for ongoing classes.

## First exercise: explain a failure

1. Manually create `Cannot open the quiz`, with a fictional name and a description. Expect its title and **Open** status in the list.
2. Read `tests/playwright/help-desk.spec.ts` and identify the actions and assertions in the create test.
3. In a practice copy of that test, change its expected initial status from `Open` to `Resolved`. Run it and inspect the failure. This is an intentionally incorrect expectation, not an application defect.
4. Restore `Open`, rerun, and explain why the expectation follows the requirement.
5. Repeat the workflow in `cypress/e2e/help-desk.cy.ts`. Compare the assertions; both should check the same behaviour.
6. Add a test that marks a ticket Resolved, then verifies it no longer appears when filtering by Open. Save the test in Git.

## API contract

| Method and path | Purpose | Result |
| --- | --- | --- |
| GET `/api/health` | Read health and reset availability | 200 `{ok, service, labMode}` |
| GET `/api/tickets?q=text&status=open` | Search and filter tickets | 200 `{tickets}` |
| POST `/api/tickets` | Create from `title`, `student`, `description` | 201 `{ticket}`; status always `open` |
| GET `/api/tickets/:id` | Read one record | 200 `{ticket}` or 404 |
| PATCH `/api/tickets/:id` | Update allowed fields or status | 200 `{ticket}`, 400, or 404 |
| POST `/api/test/reset` | Restore the three seed records in lab mode | 200 `{tickets}`; otherwise 404 |

Names and titles are 3–120 trimmed characters; descriptions are 3–500. Status values are `open`, `in_progress`, and `resolved`. Unknown fields and invalid status values are rejected. Each running application process must have a separate `DATA_DIR`: the JSON store serializes writes inside one process, not across multiple processes sharing a file.

## Files and rollback

- `src/`: React interface and styles.
- `server/`: API, validation, and serialized atomic record writes.
- `test/`: Node API checks.
- `tests/playwright/`, `cypress/e2e/`: equivalent browser exercises.
- `DATA_DIR`: configurable local practice storage; defaults to `data/`.
- Stop this app's process to stop the local preview. Preserve `DATA_DIR` to retain records. Rebuild a previous source revision to roll back code. Do not delete a student's workspace volume as a routine rollback.

Process flow: requirement -> manual observation -> test action -> UI/API -> workspace records -> assertion -> inspect evidence -> repeat after a change.
