# Academy public practice website

This separate, static application gives students real UI workflows to automate:
demo login, commerce checkout, banking transfers, insurance quotes/claims and telecom
plans/bills/support. All transactions and records are fictional. There is no payment
processor, shared API, server account, Copilot runtime or hosted terminal.

## Develop and verify

Use Node.js 24 and the pinned package lock:

```text
npm ci
npm test
npm run build
npm run test:ui
npm run dev
```

The UI smoke tests use an installed Edge on Windows. On other instructor systems,
provision a Playwright Chromium browser or set PLAYWRIGHT_CHANNEL to an installed
supported browser. Playwright runs on the instructor/student computer, not inside
the public website. Students can also write Cypress tests against the public page
using their own local test runtime.

## Architecture and publication

1. src/model.ts owns deterministic business operations and input validation. Money
   is integer cents. Invalid operations do not mutate records.
2. src/store.ts saves versioned fictional domain data in localStorage and the demo
   login in sessionStorage. The published demo credentials are not real security.
   No password is persisted. Logout retains records; Reset demo data restores seeds.
3. Browser storage belongs to that browser/profile and site origin. Another student
   on another browser has separate records. Another tab may hold an older in-memory
   view; this is a single-tab classroom demo, not synchronized multi-user storage.
4. Invalid or unsupported saved data falls back to fictional seeds with a warning.
   Storage failures keep the current tab usable and explain that saving failed.
5. Vite builds the public output into the repository's practice/ folder. Relative
   assets and hash-based navigation support the GitHub Pages project path
   /SDLC---STLC/practice/. The Academy link is ../index.html from the built page.
6. Publish the built practice/ files with the Academy entry link. Do not overwrite
   the existing Help Desk local API, student-kit release or quiz/Firebase data.
7. tests/model.test.mjs verifies workflow outcomes, validation, money conservation,
   state preservation, reset and storage recovery. The UI suite serves built assets
   below the real project prefix and verifies forms and visible outcomes.

Insurance premiums are an illustrative classroom formula, not real underwriting.
Plan changes affect the selected demo plan; the existing demo bill stays unchanged.
Enter fictional data only; checkout never asks for a real payment card.

Process flow: Academy link -> public practice website -> demo login -> fictional
workflow -> visible result -> local automated assertion -> reset and repeat.
