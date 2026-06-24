#!/usr/bin/env python3
"""Transcribe French audio locally with OpenAI Whisper large-v3 on GPU."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import whisper


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EXERCISES_DIR = REPO_ROOT / "content" / "audio-exercises"
DEFAULT_TRANSCRIPTS_DIR = DEFAULT_EXERCISES_DIR / "transcripts"
DEFAULT_MANIFEST_PATH = DEFAULT_EXERCISES_DIR / "manifest.json"

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4", ".mkv"}
WHISPER_SAMPLE_RATE = 16000


def resolve_ffmpeg_executable() -> str:
    ffmpeg_on_path = shutil.which("ffmpeg")
    if ffmpeg_on_path:
        return ffmpeg_on_path

    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass

    common_locations = [
        Path("C:/ffmpeg/bin/ffmpeg.exe"),
        Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "ffmpeg/bin/ffmpeg.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/WinGet/Links/ffmpeg.exe",
    ]
    for candidate in common_locations:
        if candidate.exists():
            return str(candidate)

    raise SystemExit(
        "ffmpeg was not found. Install it with `winget install Gyan.FFmpeg` and restart "
        "your terminal, or reinstall tool dependencies with .\\setup.ps1 "
        "(bundled ffmpeg via imageio-ffmpeg)."
    )


def load_audio_waveform(audio_path: Path) -> np.ndarray:
    ffmpeg_executable = resolve_ffmpeg_executable()
    command = [
        ffmpeg_executable,
        "-nostdin",
        "-threads",
        "0",
        "-i",
        str(audio_path),
        "-f",
        "s16le",
        "-ac",
        "1",
        "-acodec",
        "pcm_s16le",
        "-ar",
        str(WHISPER_SAMPLE_RATE),
        "-",
    ]

    try:
        completed = subprocess.run(command, capture_output=True, check=True)
    except FileNotFoundError as error:
        raise SystemExit(
            f"Could not run ffmpeg at '{ffmpeg_executable}'. "
            "Re-run .\\setup.ps1 or install ffmpeg and restart your terminal."
        ) from error
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.decode("utf-8", errors="replace").strip()
        raise SystemExit(f"Failed to decode audio with ffmpeg: {stderr}") from error

    return np.frombuffer(completed.stdout, np.int16).flatten().astype(np.float32) / 32768.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Transcribe audio with Whisper large-v3 (French by default)."
    )
    parser.add_argument(
        "audio",
        nargs="?",
        type=Path,
        help="Path to a single input audio file.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Transcribe every audio file in the exercises folder.",
    )
    parser.add_argument(
        "--exercises-dir",
        type=Path,
        default=DEFAULT_EXERCISES_DIR,
        help=f"Folder containing audio files (default: {DEFAULT_EXERCISES_DIR}).",
    )
    parser.add_argument(
        "--transcripts-dir",
        type=Path,
        default=DEFAULT_TRANSCRIPTS_DIR,
        help=f"Folder for transcript output (default: {DEFAULT_TRANSCRIPTS_DIR}).",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST_PATH,
        help=f"Manifest JSON path (default: {DEFAULT_MANIFEST_PATH}).",
    )
    parser.add_argument(
        "--no-manifest",
        action="store_true",
        help="Do not update manifest.json.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Write plain-text transcription to this file (single-file mode only).",
    )
    parser.add_argument(
        "--json",
        type=Path,
        help="Write full Whisper result as JSON (single-file mode only).",
    )
    parser.add_argument(
        "--language",
        default="fr",
        help="Language code passed to Whisper (default: fr).",
    )
    parser.add_argument(
        "--model",
        default="large-v3",
        help="Whisper model name (default: large-v3).",
    )
    parser.add_argument(
        "--device",
        choices=("cuda", "cpu", "auto"),
        default="auto",
        help="Compute device (default: auto).",
    )
    parser.add_argument(
        "--require-gpu",
        action="store_true",
        help="Exit with an error if CUDA is not available.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing audio copies and transcript files.",
    )
    return parser.parse_args()


def resolve_device(requested: str, require_gpu: bool) -> str:
    if requested == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = requested

    if require_gpu and device != "cuda":
        raise SystemExit(
            "CUDA GPU was required but is not available. "
            "Install a CUDA-enabled PyTorch build and verify your NVIDIA driver."
        )

    return device


def validate_audio_path(audio_path: Path) -> Path:
    if not audio_path.exists():
        raise SystemExit(f"Audio file not found: {audio_path}")

    if not audio_path.is_file():
        raise SystemExit(f"Expected a file, got: {audio_path}")

    if audio_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise SystemExit(
            f"Unsupported file type '{audio_path.suffix}'. Supported: {supported}"
        )

    return audio_path.resolve()


def list_audio_files(exercises_dir: Path) -> list[Path]:
    if not exercises_dir.exists():
        raise SystemExit(f"Exercises folder not found: {exercises_dir}")

    audio_files = sorted(
        path
        for path in exercises_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not audio_files:
        raise SystemExit(f"No audio files found in {exercises_dir}")

    return audio_files


def is_within_directory(path: Path, directory: Path) -> bool:
    try:
        path.resolve().relative_to(directory.resolve())
    except ValueError:
        return False
    return True


def stage_audio_in_exercises_dir(
    source_path: Path,
    exercises_dir: Path,
    *,
    force: bool,
) -> Path:
    source_path = validate_audio_path(source_path)
    exercises_dir = exercises_dir.resolve()
    exercises_dir.mkdir(parents=True, exist_ok=True)

    if is_within_directory(source_path, exercises_dir):
        return source_path

    destination = exercises_dir / source_path.name

    if destination.exists():
        if force:
            print(f"Replacing existing audio at {destination}", file=sys.stderr)
            shutil.copy2(source_path, destination)
        else:
            print(f"Using existing audio at {destination}", file=sys.stderr)
        return destination.resolve()

    print(f"Copying {source_path} -> {destination}", file=sys.stderr)
    shutil.copy2(source_path, destination)
    return destination.resolve()


def update_manifest_for_exercises_dir(args: argparse.Namespace) -> None:
    if args.no_manifest:
        return

    write_manifest(
        args.manifest.resolve(),
        args.exercises_dir.resolve(),
        args.transcripts_dir.resolve(),
    )


def title_from_filename(stem: str) -> str:
    normalized = re.sub(r"[_-]+", " ", stem).strip()
    return normalized[:1].upper() + normalized[1:] if normalized else stem


def transcript_paths(audio_path: Path, transcripts_dir: Path) -> tuple[Path, Path]:
    transcript_txt = transcripts_dir / f"{audio_path.stem}.txt"
    transcript_json = transcripts_dir / f"{audio_path.stem}.json"
    return transcript_txt, transcript_json


def load_whisper_model(model_name: str, device: str):
    print(f"Loading Whisper model '{model_name}' on {device}...", file=sys.stderr)
    return whisper.load_model(model_name, device=device)


def transcribe_with_model(
    model,
    audio_path: Path,
    *,
    language: str,
) -> dict:
    print(f"Transcribing {audio_path.name}...", file=sys.stderr)
    audio_waveform = load_audio_waveform(audio_path)
    return model.transcribe(
        audio_waveform,
        language=language,
        verbose=False,
    )


def write_transcript_outputs(
    audio_path: Path,
    result: dict,
    *,
    transcript_txt: Path,
    transcript_json: Path,
) -> str:
    text = result.get("text", "").strip()
    transcript_txt.parent.mkdir(parents=True, exist_ok=True)
    transcript_txt.write_text(text + "\n", encoding="utf-8")

    payload = {
        "audio": str(audio_path),
        "text": text,
        "segments": result.get("segments", []),
    }
    transcript_json.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {transcript_txt}", file=sys.stderr)
    print(f"Wrote {transcript_json}", file=sys.stderr)
    return text


def build_manifest_entry(audio_path: Path, transcription: str) -> dict:
    audio_name = audio_path.name
    return {
        "id": audio_path.stem,
        "title": title_from_filename(audio_path.stem),
        "audioUrl": audio_name,
        "transcriptUrl": f"transcripts/{audio_path.stem}.txt",
        "transcription": transcription,
        "active": True,
    }


def write_manifest(manifest_path: Path, exercises_dir: Path, transcripts_dir: Path) -> None:
    entries: list[dict] = []

    for audio_path in list_audio_files(exercises_dir):
        transcript_txt, _ = transcript_paths(audio_path, transcripts_dir)
        if not transcript_txt.exists():
            continue

        transcription = transcript_txt.read_text(encoding="utf-8").strip()
        entries.append(build_manifest_entry(audio_path, transcription))

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "exercises": entries,
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote manifest with {len(entries)} exercise(s) to {manifest_path}", file=sys.stderr)


def transcribe_file(
    model,
    audio_path: Path,
    *,
    language: str,
    transcripts_dir: Path,
    force: bool,
) -> str | None:
    audio_path = validate_audio_path(audio_path)
    transcript_txt, transcript_json = transcript_paths(audio_path, transcripts_dir)

    if transcript_txt.exists() and not force:
        print(f"Skipping {audio_path.name} (transcript already exists).", file=sys.stderr)
        return transcript_txt.read_text(encoding="utf-8").strip()

    result = transcribe_with_model(model, audio_path, language=language)
    return write_transcript_outputs(
        audio_path,
        result,
        transcript_txt=transcript_txt,
        transcript_json=transcript_json,
    )


def run_batch(args: argparse.Namespace, device: str) -> int:
    exercises_dir = args.exercises_dir.resolve()
    transcripts_dir = args.transcripts_dir.resolve()
    audio_files = list_audio_files(exercises_dir)

    if device == "cuda":
        print(f"Using GPU: {torch.cuda.get_device_name(0)}", file=sys.stderr)
    else:
        print("Using CPU. Transcription will be much slower.", file=sys.stderr)

    model = load_whisper_model(args.model, device)
    processed = 0

    for audio_path in audio_files:
        text = transcribe_file(
            model,
            audio_path,
            language=args.language,
            transcripts_dir=transcripts_dir,
            force=args.force,
        )
        if text is not None:
            processed += 1
            print(text)
            print("", file=sys.stdout)

    if not args.no_manifest:
        write_manifest(args.manifest.resolve(), exercises_dir, transcripts_dir)

    print(f"Processed {processed} file(s).", file=sys.stderr)
    return 0


def run_single(args: argparse.Namespace, device: str) -> int:
    if args.audio is None:
        raise SystemExit("Provide an audio file path or use --all.")

    exercises_dir = args.exercises_dir.resolve()
    transcripts_dir = args.transcripts_dir.resolve()
    audio_path = stage_audio_in_exercises_dir(
        args.audio,
        exercises_dir,
        force=args.force,
    )
    transcript_txt, transcript_json = transcript_paths(audio_path, transcripts_dir)

    if device == "cuda":
        print(f"Using GPU: {torch.cuda.get_device_name(0)}", file=sys.stderr)
    else:
        print("Using CPU. Transcription will be much slower.", file=sys.stderr)

    if transcript_txt.exists() and not args.force:
        text = transcript_txt.read_text(encoding="utf-8").strip()
        print(f"Skipping transcription for {audio_path.name} (transcript already exists).", file=sys.stderr)
        print(text)
        update_manifest_for_exercises_dir(args)
        return 0

    model = load_whisper_model(args.model, device)
    result = transcribe_with_model(model, audio_path, language=args.language)
    text = result.get("text", "").strip()
    print(text)

    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
        print(f"Wrote transcription to {args.output}", file=sys.stderr)
    else:
        write_transcript_outputs(
            audio_path,
            result,
            transcript_txt=transcript_txt,
            transcript_json=transcript_json,
        )

    if args.json:
        payload = {
            "audio": str(audio_path),
            "model": args.model,
            "language": args.language,
            "device": device,
            "text": text,
            "segments": result.get("segments", []),
        }
        args.json.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote JSON output to {args.json}", file=sys.stderr)

    update_manifest_for_exercises_dir(args)
    return 0


def main() -> int:
    args = parse_args()
    device = resolve_device(args.device, args.require_gpu)

    if args.all:
        return run_batch(args, device)

    return run_single(args, device)


if __name__ == "__main__":
    raise SystemExit(main())
