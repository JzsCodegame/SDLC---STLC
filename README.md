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


## Docker + Jenkins automation for publishing students

This project now includes:
- `Dockerfile` (Node 22 Alpine) to containerize and serve the app on port `8080`
- `Jenkinsfile` to run CI stages and generate `students.json` from a Google Sheet
- `scripts/publish-students.js` to fetch a Google Sheet (CSV export URL) and publish the first 20 students

### Google Sheet format
Use a sheet with a header row. Recommended first column/header: `name`.

Example:
```csv
name
Alice
Bob
...
```

### Required Jenkins environment variable
- `GOOGLE_SHEET_CSV_URL`: Google Sheet CSV export URL (for example: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=0`)

### Local run (script only)
```bash
export GOOGLE_SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=0"
node scripts/publish-students.js
```

This generates `students.json` containing up to 20 students with publish metadata.


### Source document URL added
- `SOURCE_DOCUMENT_URL` is set in `Jenkinsfile` to:
  `https://docs.google.com/document/d/1RzyuPH6ryIVD6z5iRuyJxmUa6jGLJE_wAB5R4S4mUWA/edit?tab=t.0#heading=h.fmjzqinx4dso`
- The publish script includes this URL in `students.json` as `sourceDocumentUrl` for traceability.
