# Transcribe French

A simple Firebase + React learning app for French listening comprehension:

- Loads an audio clip and expected transcription from Firestore
- Plays audio in short 30-second segments
- Lets the learner type a transcription attempt
- Grades the attempt with a combined word-match and character-similarity score

## 1) Install

```bash
npm install
```

## 2) Configure Firebase

Copy `.env.example` to `.env` and fill in your Firebase web app values:

```bash
cp .env.example .env
```

Required variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## 3) Firestore data model

Collection: `audioExercises`

Each document should include:

```json
{
  "title": "Conversation au cafe",
  "audioUrl": "https://your-cdn-or-firebase-storage/audio/cafe-001.mp3",
  "transcription": "Bonjour madame, je voudrais un cafe s'il vous plait.",
  "durationSeconds": 92,
  "active": true
}
```

## 4) Run

```bash
npm run dev
```

If Firebase is not configured or data is unavailable, the app falls back to a built-in sample exercise so the UI still works.

## Notes

- Segment size is currently fixed to 30 seconds in `src/App.tsx` (`SEGMENT_SECONDS`).
- Grading logic lives in `src/utils/grading.ts`.
