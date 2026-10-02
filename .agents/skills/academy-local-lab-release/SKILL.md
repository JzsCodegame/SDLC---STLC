---
name: academy-local-lab-release
description: Build, verify and publish the Mini Quiz Academy Windows student lab through its local Jenkins release job. Use for versioned student downloads and release failures; keep daily quiz generation separate.
---

# Academy local lab release

GUNDAM owns Jenkins and Git publication; JARVIS owns `automation-lab/student-kit/` and the practice app; WEB owns the Academy download entry. KFK coordinates requested development and evidence. The successful path is deterministic and makes no model API calls.

Read `automation-lab/release/` for the actual job commands and validation contract. Read `automation-lab/student-kit/README.md` for the student commands. Do not substitute an older cloud deployment runbook. This repository skill does not install a KFK scheduler or authorize cloud provisioning.

## Release boundaries

- Use an isolated, clean app checkout and an exact reviewed Git SHA. Never package the dirty parent KFK checkout or stage unrelated work.
- The existing quiz-content Jenkinsfile/job is independent. Student-roster or daily-question generation must not become a lab release prerequisite.
- Use local compute only. Do not recreate DigitalOcean/Coder resources, add paid runners, or call API-billed models unattended.
- Do not attach a Windows host executor to an anonymous or publicly exposed controller. Authenticate the existing controller before trusting its release outputs; preserve other jobs and credentials.
- Pull-request validation and browser tests receive no publishing credentials. Publish from the trusted operator context only after all gates pass.

## Evidence chain

```text
Requested change -> exact source commit -> local Jenkins gates
  -> allowlisted ZIP + release.json + SHA256SUMS
  -> fresh Windows setup and visible-browser rehearsal
  -> versioned GitHub Release -> Academy descriptor PR
  -> public download/hash readback -> receipt and recall
```

Run package safety tests and the app's build, API, Playwright and Cypress suites. The packager reads regular Git blobs from its explicit allowlist. Its CLI is:

```text
node automation-lab/student-kit/package.mjs --version VERSION --source FULL_SHA --output ABSOLUTE_OUTPUT_DIRECTORY
```

Use a new immutable semantic version. Refuse overwriting published assets or reusing a version for different bytes. Archive source SHA, job number, gate results, exact ZIP SHA-256/bytes and the complete release manifest.

Rehearse the exact ZIP in a fresh Windows path containing spaces using its shipped commands. Record OS, Node/npm/browser versions and whether the machine already had browser/dependency caches. A fresh directory is not proof of a clean operating-system installation. Confirm actual app/API behavior and both visible browser runners; distinguish an opened runner from passing its tests.

The kit template and student work are separate. Preserve `Mini Quiz Student Work`, edited exercises and manual records. Test-port isolation must preserve an instructor's existing manual app. Never kill arbitrary listeners or remove student folders to make a gate pass.

Publish the already-tested bytes, download them publicly and verify the hash. Only then promote `lab-config.json` to a complete `verified` descriptor through the app PR/Pages flow. Read the descriptor validator before generating it. Verify the real Academy page, links and served descriptor after Pages succeeds; repository merge alone is insufficient.

## Failure, rollback and KFK status

A failed gate leaves the current public descriptor unchanged. Preserve failure reports and fix in a new commit; do not retry model repairs indefinitely or mark a failed suite green. Rollback is a new reviewed descriptor change to a previously verified immutable release. It never overwrites the release or deletes student work.

For automatic KFK fleet dispatch, consult a fresh canonical board mirror and the adopted dispatch health checks first. Missing registration or an inactive worker is not proof of a functioning connection. Report direct user-driven Jenkins execution separately from central fleet automation; do not modify unrelated schedulers or forge board/claim receipts to close this distinction.

The release receipt must name the actual source commit, Jenkins run, Windows rehearsal, release URLs, public hash and Pages deployment. Retain outstanding checks as outstanding. Finish with the KFK five-line report and a recall-readable learning record in the parent KFK repository, then verify recall retrieval.
