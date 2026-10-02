# Class 2: UI automation on the real local Help Desk

## 1. Establish the requirement

1. A submitted ticket must contain a name, title and description of at least three
   characters. New tickets start with Open status.
2. A saved ticket must still appear after refresh. Search finds a ticket by its text.
3. A ticket changed to Resolved must disappear from the Open filter and appear in
   the Resolved filter.
4. Cancel must leave a ticket unchanged. Reset must ask for confirmation.

These are the app's real requirements. A deliberately wrong assertion in the next
exercise is an example of a TEST mistake; it is not evidence of an app defect.

## 2. Observe before automating

1. Start the lab and create `Cannot open the quiz`, using `Practice Student` and
   description `The quiz button returns to the course page.`
2. Observe Open status, refresh, and search for the title. Record the actual result
   in your Student Work version's NOTES.md.
3. Open that ticket, choose Resolved, save, and compare the Open/Resolved filters.
4. Record the action, expected result and observed result. These become assertions.

## 3. Read and run Playwright

1. In your student working app, open `tests/playwright/help-desk.spec.ts`.
2. Find the create/search/reload test. Identify the locator, action and assertion.
3. Run `.\Lab.cmd test playwright-headed` from the downloaded kit. Watch the browser
   and compare its actions with your manual steps. The suite uses its own records.
4. In that test, change the expected initial status `Open` to `Resolved`. Run again.
   Read the failure and open the HTML report with `.\Lab.cmd report`.
5. Restore `Open`, rerun and explain why the requirement makes that assertion correct.

## 4. Compare Cypress

1. Open `cypress/e2e/help-desk.cy.ts` in the STUDENT working copy.
2. Run `.\Lab.cmd test cypress-open`, choose E2E Testing, choose Edge or Chrome,
   then select `help-desk.cy.ts`. Cypress displays the actions and assertions.
3. Compare the create/search/reload assertions with Playwright. Different syntax
   verifies the same requirement; neither framework makes an incorrect expected
   result correct.
4. Stop the Cypress window before using `.\Lab.cmd test cypress` in another terminal.

## 5. Add a regression check

1. Extend the existing update/filter test to select Resolved, save, and verify the
   ticket is absent from Open and present in Resolved.
2. Make the equivalent change in Cypress. Keep your edits in the student working
   copy; leave the downloaded template intact.
3. Run API, Playwright and Cypress checks. A green UI run does not replace API
   validation. Use each failure's evidence to identify the failing layer.
4. Save your test changes in Git and write why this test should run after a change.
5. Reopen the kit and run it again. Verify your edited test and manual ticket remain.

## 6. Connect UI actions to the actual API

| Action | API | Expected result |
| --- | --- | --- |
| View/search tickets | GET /api/tickets?q=text&status=open | 200 and matching records |
| Submit the form | POST /api/tickets | 201; new record status open |
| Save status | PATCH /api/tickets/:id | 200; valid updated status |
| Submit invalid status | PATCH /api/tickets/:id | 400; record unchanged |

1. Inspect the request/response using the browser's Network panel while creating
   a fictional ticket. Relate the form field names to the JSON payload.
2. Read the API create/invalid-status test in both UI suites. It calls this app's
   real local API, not a placeholder external service.
3. Compare API response assertions with visible UI assertions. State what each
   check proves and what it does not prove.

Process flow: requirement -> observe real app -> automate one action -> assert its
result -> inspect a deliberate failure -> repair -> rerun regression -> save work.
