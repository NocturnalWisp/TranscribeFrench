# Audio exercises (deployed to Firebase Hosting)

Drop audio files in this folder. They are copied into `dist/audio-exercises/` when you run `npm run build`, then published with `npm run deploy:hosting`.

## Workflow

1. Copy audio files here, or pass a direct path to the transcribe tool (it will copy them for you).
2. Run the local Whisper tool to generate transcripts:

```powershell
cd local-tools/whisper-transcribe
.\transcribe.ps1 "C:\path\to\your-audio.mp3"
```

Or transcribe everything already in this folder:

```powershell
.\transcribe.ps1 -All
```

3. Transcripts are written to `transcripts/` and a `manifest.json` is updated.
4. Deploy:

```powershell
npm run deploy:hosting
```

## Hosted URLs

After deploy, files are available at:

- Audio: `https://transcribefrench.web.app/audio-exercises/<filename>`
- Transcript: `https://transcribefrench.web.app/audio-exercises/transcripts/<filename>.txt`

Use the audio URL as `audioUrl` in Firestore `audioExercises` documents. Copy the transcript text into the `transcription` field (or read it from the hosted `.txt` file).
