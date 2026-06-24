# Audio exercises

Local source files for exercises. **This folder is the source of truth** — `npm run seed` syncs from here to Firebase Storage and Realtime Database.

## Workflow

1. Put audio files in this folder (or pass a path to the transcribe tool).
2. Transcribe with Whisper:

```powershell
cd local-tools/whisper-transcribe
.\transcribe.ps1 -All
```

This writes:

- `transcripts/<name>.txt` — full plain-text transcription
- `transcripts/<name>.json` — whisper segments (required for segment playback and grading)
- `manifest.json` — exercise index used by the seed script

3. Push local files to Firebase:

```powershell
npm run seed
```

Use `npm run seed -- --force` to re-upload audio even when the file hash has not changed. RTDB metadata (including whisper segments) is refreshed on every seed run.

4. Deploy the app:

```powershell
npm run deploy
```

## Keep transcripts in git

The `transcripts/` folder must stay with the repo. Each exercise needs both `.txt` and `.json` files. The seed script reads `transcripts/*.json` and writes `whisperSegments` into Realtime Database.

## Storage layout (after seed)

- Audio: `gs://transcribefrench.firebasestorage.app/audio-exercises/{exerciseId}/audio.mp3`
- Metadata: Realtime Database `audioExercises/{exerciseId}` (includes `whisperSegments`, `transcription`, `audioUrl`)

## Credentials

Save a Firebase service account key as `scripts/service-account.json` (see root `README.md`).
