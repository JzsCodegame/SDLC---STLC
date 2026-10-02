# Local lab release

The dedicated Jenkins job `mini-quiz-local-lab-release` reads `Jenkinsfile.local-lab`.
It accepts a reviewed full `SOURCE_COMMIT` and `PACKAGE_VERSION`. It has no schedule,
cloud provisioning, model calls, publishing credential or Windows host executor.
The existing quiz-content job and its Jenkinsfile remain separate.

## Local build boundary

The existing Linux controller launches one temporary container from official
`cypress/included:16.1.1`, pinned by its Linux amd64 image digest in the Jenkinsfile.
The verified image contains Node 24.21.0, npm 11.19.0 and Chrome 154.0.8037.92.
Only the checked-out public app repository is copied into it. No host folder,
Docker socket, controller home, credential, secret or public port is mounted.
The container uses at most four CPUs and 4 GiB RAM. It is removed after the run;
the candidate ZIP, checksums, manifest, CI receipt and failure reports are archived.

Before enabling this job, require Jenkins sign-in and deny anonymous read/build.
The instructor approves the exact source SHA; a branch name is insufficient.
Do not give pull-request source access to publishing credentials.

## Release gates

1. Exact clean source -> npm ci -> build -> API -> Playwright -> Cypress.
2. The portable student packager reads that source commit and emits the ZIP,
   release.json and SHA256SUMS; CI independently checks archive size and hash.
3. Extract that exact ZIP into a fresh Windows directory containing spaces.
   Run the shipped check/install/verify commands, start the app with LAB_PORT=4183,
   and verify both visible test frameworks. Preserve the existing port 4173 app.
4. Record the Windows receipt against sourceCommit and archive SHA-256. Linux CI
   alone cannot prove Windows setup or the visible desktop experience.
5. Publish the tested bytes as release `local-lab-v<version>` through the existing
   instructor GitHub release procedure, then update the Academy download descriptor.
6. Verify the public ZIP hash and Pages descriptor before recording success.

The operator must run `verify-release.mjs --artifacts DIRECTORY --ci RECEIPT
--windows RECEIPT`. It fails closed for missing or failed checks, differing source
commits, versions, byte lengths or hashes. `publish-release.mjs` accepts the same
arguments and runs that gate before any GitHub mutation. Resolve the existing
instructor GitHub credential into process-only `GITHUB_TOKEN`; never put it in a
command argument, repository file, Jenkins job or student package. Publication
creates a draft, verifies each uploaded asset, publishes it, and verifies public
bytes. It never changes the Academy descriptor; that follows through a reviewed PR.

Windows receipt schema: schemaVersion 1, platform `win32`, passed true,
sourceCommit, version, artifact {filename, bytes, sha256}, environment, cleanMachine,
and checks. Required true checks are freshExtraction, integrity, prerequisites,
install, appUi, api, playwright, cypress, playwrightHeaded, cypressVisible,
preservation and secondInstanceRefused. A receipt records observed results, never
assumed success. Linux CI supplies its separate receipt and every named phase.

If any gate fails, keep the preceding Academy download current. A partial release
upload is not promotion. Never overwrite a version with different bytes. Roll back
the current-download descriptor through a reviewed follow-up commit, preserving
student work and previous release assets.

Process flow: exact source -> isolated Linux checks -> candidate ZIP -> Windows
rehearsal -> matching receipts -> versioned release -> Academy link -> public hash.
