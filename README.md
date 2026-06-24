# Transcribe French



A simple Firebase + React learning app for French listening comprehension:



- Google sign-in with per-user profiles in Realtime Database

- **Try** mode loads one trial exercise without signing in

- Loads audio clips and expected transcriptions from Realtime Database

- Plays audio in short 30-second segments

- Lets the learner type a transcription attempt

- Grades the attempt with a combined word-match and character-similarity score



## 1) Install



```bash

npm install

```



## 2) Configure Firebase



Copy `.env.example` to `.env.production` for production builds. Local dev loads `.env.development` automatically.



```bash
cp .env.example .env.production
```

Local dev loads `.env.development` automatically. Override with `.env` or `.env.local` if needed.



Required variables:



- `VITE_FIREBASE_API_KEY`

- `VITE_FIREBASE_AUTH_DOMAIN`

- `VITE_FIREBASE_PROJECT_ID`

- `VITE_FIREBASE_STORAGE_BUCKET`

- `VITE_FIREBASE_MESSAGING_SENDER_ID`

- `VITE_FIREBASE_APP_ID`

- `VITE_FIREBASE_DATABASE_URL`



Enable **Google** sign-in in Firebase Authentication and create a Realtime Database if you have not already.



## 3) Sync local exercises to Firebase (one way)

`content/audio-exercises/` is the **source of truth**. `npm run seed` pushes local audio and transcripts **to** Firebase Storage and Realtime Database (not the other way around).

1. Transcribe locally (writes `content/audio-exercises/transcripts/*.json` with whisper segments).
2. Firebase Console → Project settings → Service accounts → **Generate new private key**
3. Save as `scripts/service-account.json` (gitignored)
4. Run:

```bash
npm run seed
```

This uploads audio to Storage and writes RTDB records including `whisperSegments` from each local `transcripts/*.json`.

Re-sync after transcript or audio changes:

```bash
npm run seed -- --force
```



## 4) Deploy



Deploy rules, storage, database content, and hosting:



```bash

npm run deploy

```



Or deploy only data/rules without rebuilding the app:



```bash

npm run deploy:data

```



## 5) Realtime Database data model



Deploy security rules:



```bash

npm run deploy:database

npm run deploy:storage

```



### Paths



`config/trialExerciseId` — exercise id exposed to the **Try** button (public read).



`audioExercises/{exerciseId}` — exercise library (Google users only, except the trial id).



`users/{uid}` — profile created on first Google sign-in (readable/writable only by that user).



Example record (created by the seed script):



```json

{

  "config": {

    "trialExerciseId": "01_LCP001_-_Apprendre_le_francais (1)"

  },

  "audioExercises": {

    "01_LCP001_-_Apprendre_le_francais (1)": {

      "title": "01 LCP001 Apprendre le francais (1)",

      "audioUrl": "https://firebasestorage.googleapis.com/v0/b/transcribefrench.firebasestorage.app/o/...",

      "transcription": "Bonjour et bienvenue...",

      "whisperSegments": [{ "start": 0, "end": 5.84, "text": "..." }],

      "durationSeconds": 1200,

      "active": true,

      "order": 1

    }

  }

}

```



## 6) Run locally



```bash

npm run dev

```



In dev, audio is served from `content/audio-exercises/` at `/local-audio-exercises/`. The app tries Firebase first, then falls back to those local files.



## Notes



- Grading logic lives in `src/utils/grading.ts`.

- Local transcription workflow: `local-tools/whisper-transcribe/README.md`


