# Whisper Transcription (local only)

Local Python tool for generating French transcriptions from audio files. This folder lives in the repo for version control but is **not deployed** to Firebase Hosting (only the Vite `dist/` build is published).

## Setup

Run the setup script from this folder (uses Python 3.13 and CUDA 12.8 for RTX 50-series GPUs):

```powershell
cd local-tools/whisper-transcribe
.\setup.ps1
```

Manual setup is also fine:

```powershell
cd local-tools/whisper-transcribe
C:\Python313\python.exe -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
pip install -r requirements.txt
```

Notes:

- Use **Python 3.13** for CUDA wheels. Python 3.14 currently only gets CPU PyTorch.
- RTX 50-series GPUs need the **cu128** PyTorch build, not cu124.
- The first transcription run downloads the `large-v3` model (~3 GB).

## Usage

Always use the virtual environment Python, not the system `python` command.

### Batch mode (default)

Drop audio files into `public/audio-exercises/`, then transcribe everything:

```powershell
.\transcribe.ps1 -All
```

This writes:

- `public/audio-exercises/transcripts/<name>.txt` — plain text for Firestore
- `public/audio-exercises/transcripts/<name>.json` — full Whisper output
- `public/audio-exercises/manifest.json` — hosted URLs and transcription text

Re-run with `-Force` to overwrite existing transcripts.

### Single file

Pass any audio path. Files outside `public/audio-exercises/` are copied there first, then transcribed:

```powershell
.\transcribe.ps1 "C:\Users\helmt\Downloads\01_LCP001_-_Apprendre_le_francais (1).mp3"
```

Or target a file already in the exercises folder:

```powershell
.\transcribe.ps1 "..\..\public\audio-exercises\my-audio.mp3"
```

Use `-Force` to replace an existing copied audio file and regenerate its transcript.

## Deploy audio to Firebase Hosting

After transcribing:

```powershell
cd ..\..
npm run deploy:hosting
```

Hosted files are served from:

- `https://transcribefrench.web.app/audio-exercises/<filename>`
- `https://transcribefrench.web.app/audio-exercises/transcripts/<filename>.txt`

Use values from `public/audio-exercises/manifest.json` when creating Firestore `audioExercises` documents.

## Supported audio formats

`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.webm`, `.mp4`, `.mkv`
