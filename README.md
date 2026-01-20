# Mini Quiz Academy

This is a starter static quiz site built for GitHub Pages with Firebase Firestore integration.

## How it works
- Students enter their name
- A 10-question quiz starts with a 5-minute timer
- Results show at the end
- Quiz scores are automatically saved to Firestore

## Firebase Firestore Integration

This app uses Firebase Firestore for:
- **Loading questions**: Questions are fetched from the `questions` collection in Firestore
- **Storing scores**: Quiz results are saved to the `scores` collection with student name, score, total, percentage, and timestamp
- **Fallback support**: If Firestore fails or returns no data, the app falls back to loading from `questions.json`

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
Edit `questions.json` to update the quiz content. This file serves as a fallback when Firestore is unavailable. Each question has:
- `question`: the question text
- `choices`: array of answer options
- `answer`: the index of the correct choice (0-based)

## Run locally
Open `index.html` directly in your browser or serve the folder with any local web server.

## Deploy
Enable GitHub Pages from the repository settings and select the `main` branch root.

