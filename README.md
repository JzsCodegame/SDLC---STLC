# Mini Quiz Academy

This is a starter static quiz site built for GitHub Pages with Firebase Firestore integration.

## How it works
- Students enter their name
- A 20-question quiz starts with a 5-minute timer
- Results show at the end
- Quiz scores are automatically saved to Firestore
- Flashcard section below the quiz button includes all question/answer pairs

## Firebase Firestore Integration

This app uses Firebase Firestore for:
- **Loading questions**: Questions are loaded from `questions.json` (primary source)
- **Storing scores**: Quiz results are saved to the `scores` collection with student name, score, total, percentage, and timestamp
- **Fallback support**: If `questions.json` is unavailable/empty, the app falls back to the `questions` collection in Firestore

### Seeding Questions to Firestore

To add questions to Firestore:
1. Go to your Firebase Console (https://console.firebase.google.com/)
2. Navigate to Firestore Database
3. Create a collection named `questions`
4. Add documents with the following structure:
   ```json
   {
     "question": "Your question text here",
     "choices": ["Option 1", "Option 2", "Option 3", "Option 4"],
     "answer": 1
   }
   ```
   Note: `answer` is the 0-based index of the correct choice

Alternatively, you can import the existing `questions.json` file into Firestore using Firebase CLI or custom scripts.

## Update questions
Edit `questions.json` to update the quiz content. This file is the primary question source used by students. Each question has:
- `question`: the question text
- `choices`: array of answer options
- `answer`: the index of the correct choice (0-based)

## Run locally
Open `index.html` directly in your browser or serve the folder with any local web server.

## Deploy
Enable GitHub Pages from the repository settings and select the `main` branch root.

---

## DevOps Wiki: Docker + Jenkins + Student Publishing Pipeline

This section is written as a step-by-step operational notebook so any teammate can set up, run, and troubleshoot the full flow.

### 1) What this pipeline does
When Jenkins runs this project, it will:
1. Check out this repository.
2. Read student data from a **Google Sheet CSV export URL**.
3. Publish the first `MAX_STUDENTS` (default: 20) into `students.json`.
4. Build a Docker image for the app.
5. Archive `students.json` as a Jenkins build artifact.

---

### 2) Repository files involved
- `Dockerfile` — defines the container image (Node 22 Alpine), serves the static app on port `8080`.
- `Jenkinsfile` — CI/CD pipeline stages and build environment variables.
- `scripts/publish-students.js` — fetches + parses CSV and writes `students.json`.
- `students.json` — generated output artifact (created during pipeline run).

---

### 3) Prerequisites
Before using this workflow, make sure you have:
- A Jenkins server with pipeline jobs enabled.
- A Jenkins agent that can run:
  - `node` (recommended Node 22+),
  - `docker` (for image build stage).
- A Google Sheet accessible through CSV export URL format.

Optional but recommended:
- GitHub webhook to trigger Jenkins automatically on push.
- Jenkins credentials storage for environment variables/secrets.

---

### 4) Prepare your Google Sheet correctly
Your sheet should include a header row and student names.

Recommended minimal format:
```csv
name
Alice Johnson
Bob Smith
...
```

The script checks common header names in this order:
- `name`
- `student`
- `student_name`
- fallback: first column value

If header names vary, keep student names in the first column to remain compatible.

---

### 5) Build the CSV URL from Google Sheets
Use the format:

```text
https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<TAB_GID>
```

How to get values:
- `<SHEET_ID>`: from the Google Sheet URL.
- `<TAB_GID>`: from the selected tab URL (`gid=...`).

Important:
- The current script expects a **Google Sheet CSV URL**, not a Google Docs page URL.
- If the sheet is private, ensure Jenkins runtime has access (or publish a safe shared view).

---

### 6) Jenkins environment variables
Configure these in Jenkins job or global environment:

#### Required
- `GOOGLE_SHEET_CSV_URL`
  - Source CSV endpoint for student data.

#### Optional
- `MAX_STUDENTS` (default: `20`)
  - Number of students to publish from top of sheet.
- `STUDENTS_OUTPUT_FILE` (default: `students.json`)
  - Output filename path for generated JSON.
- `SOURCE_DOCUMENT_URL`
  - Traceability metadata included in output.
  - Current pipeline default is set to:
    `https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso`

---



### 7.1) Make it true CI/CD (event-driven + scheduled)
A pure hourly cron is useful for periodic publishing, but it is **not** full CI by itself.
For true CI/CD behavior, use both:

1. **GitHub webhook trigger (recommended)** for immediate builds on push/PR events.
2. **Hourly schedule** as a backup for time-based content refresh and resilience.

Recommended Jenkins job trigger setup:
- Enable **GitHub hook trigger for GITScm polling** (or Multibranch webhook indexing).
- Keep a light cron such as `H * * * *` for hourly refresh jobs.
- Disable duplicate-trigger races with `disableConcurrentBuilds()` (already in pipeline options).

How to wire webhook:
1. In GitHub repo → **Settings → Webhooks → Add webhook**.
2. Payload URL: `https://<your-jenkins>/github-webhook/`
3. Content type: `application/json`
4. Events: at minimum **Just the push event** (optionally PR events too).
5. In Jenkins, ensure the job has webhook trigger enabled and repository URL matches.

Alternative if webhook cannot be used:
- Enable **Poll SCM** with a short interval (example: `H/5 * * * *`).
- This is less real-time and more resource-heavy than webhooks.

### 7) Jenkins pipeline stages (what to expect)
`Jenkinsfile` runs these stages:

1. **Checkout**
   - Pulls repository source.
2. **Publish students from Google Sheet**
   - Validates `GOOGLE_SHEET_CSV_URL` is set.
   - Runs `node scripts/publish-students.js`.
3. **Build Docker image**
   - Runs `docker build -t mini-quiz-academy:<build_number> .`.
4. **Archive generated students file**
   - Stores `students.json` as Jenkins artifact.

---

### 8) How to run locally (developer workflow)
#### A) Generate students file only
```bash
export GOOGLE_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=0"
export MAX_STUDENTS=20
export STUDENTS_OUTPUT_FILE=students.json
export SOURCE_DOCUMENT_URL="https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso"
node scripts/publish-students.js
```

#### B) Build and run Docker image
```bash
docker build -t mini-quiz-academy:local .
docker run --rm -p 8080:8080 mini-quiz-academy:local
```

Then open:
- `http://localhost:8080`

---

### 9) Output contract (`students.json`)
Generated structure:

```json
{
  "publishedAt": "2026-05-08T00:00:00.000Z",
  "totalPublished": 20,
  "sourceDocumentUrl": "...",
  "students": [
    { "id": 1, "name": "Alice Johnson" }
  ]
}
```

Field notes:
- `publishedAt`: ISO timestamp of generation.
- `totalPublished`: final number written (can be `< MAX_STUDENTS` if source has fewer valid names).
- `sourceDocumentUrl`: metadata for traceability.
- `students`: ordered list based on source row order.

---

### 10) Troubleshooting guide
#### Error: `GOOGLE_SHEET_CSV_URL is required`
- Cause: variable not set in Jenkins/job shell.
- Fix: add it to Jenkins environment configuration.

#### Error: `Failed to fetch sheet. HTTP 403/404`
- Cause: bad URL, wrong `gid`, or access restrictions.
- Fix: verify URL format and sharing permissions.

#### `students.json` has fewer than 20 students
- Cause: sheet has fewer valid name rows or blank entries.
- Fix: clean rows and ensure names exist in expected column.

#### Docker build fails in Jenkins
- Cause: agent has no Docker runtime/permission.
- Fix: run job on Docker-capable agent or configure Docker-in-Docker/host socket policy.


#### Push rejected: `! [rejected] HEAD -> main (fetch first)`
- Cause: job is committing from a detached `HEAD` or stale local ref while `main` advanced remotely.
- Fix: before push, switch to the target branch and rebase on remote, then push.
  Example:
  ```bash
  git checkout "$GITHUB_BRANCH"
  git fetch origin "$GITHUB_BRANCH"
  git pull --rebase origin "$GITHUB_BRANCH"
  git push origin "HEAD:$GITHUB_BRANCH"
  ```
- Note: if multiple timers/jobs publish concurrently, keep `disableConcurrentBuilds()` (or equivalent job-level serialization) enabled to reduce push races.

---

### 11) Operational best practices
- Keep `GOOGLE_SHEET_CSV_URL` in Jenkins config, not hardcoded in scripts.
- If student data is sensitive, avoid public sharing and enforce least-privilege access.
- Archive `students.json` per build for auditability.
- Pin Jenkins agents to compatible Node and Docker versions.
- Add alerting for failed publish/build stages.

---

### 12) Suggested future improvements
- Add schema validation for input/output JSON.
- Add unit tests for CSV parsing edge cases.
- Add retry/backoff for transient network errors.
- Add notification hooks (Slack/Email) on success/failure.
- Add deployment stage for serving updated artifact to downstream systems.
