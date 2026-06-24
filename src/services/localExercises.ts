import { enrichExerciseWithTranscript, type ExerciseManifestEntry } from "./exerciseEnrichment";
import type { AccessMode } from "../types/auth";
import type { AudioExercise, ExerciseSummary } from "../types";

export const LOCAL_AUDIO_EXERCISES_BASE = "/local-audio-exercises";

type LocalExerciseManifest = {
  exercises: ExerciseManifestEntry[];
};

const resolveLocalAssetUrl = (path: string): string => {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return encodeURI(`${LOCAL_AUDIO_EXERCISES_BASE}/${normalizedPath}`);
};

const normalizeLocalEntry = (entry: ExerciseManifestEntry): AudioExercise | null => {
  const audioUrl = typeof entry.audioUrl === "string" ? entry.audioUrl.trim() : "";
  if (!audioUrl) {
    return null;
  }

  const title =
    typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : entry.id;

  return {
    id: entry.id,
    title,
    audioUrl: resolveLocalAssetUrl(audioUrl),
    expectedTranscription: typeof entry.transcription === "string" ? entry.transcription.trim() : "",
    language: "fr",
    active: entry.active !== false,
    durationSeconds:
      typeof entry.durationSeconds === "number" ? Math.max(0, entry.durationSeconds) : undefined
  };
};

const loadManifest = async (): Promise<ExerciseManifestEntry[]> => {
  const response = await fetch(`${LOCAL_AUDIO_EXERCISES_BASE}/manifest.json`);
  if (!response.ok) {
    throw new Error("Local exercise manifest is not available.");
  }

  const manifest = (await response.json()) as LocalExerciseManifest;
  if (!Array.isArray(manifest.exercises) || manifest.exercises.length === 0) {
    throw new Error("Local exercise manifest is empty.");
  }

  return manifest.exercises.filter((entry) => entry.active !== false);
};

export const listLocalExerciseCatalog = async (): Promise<ExerciseSummary[]> => {
  const entries = await loadManifest();

  return entries
    .map((entry, index) => {
      const title =
        typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : entry.id;

      return {
        id: entry.id,
        title,
        order: index + 1
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, "fr"));
};

const enrichLocalEntry = async (
  exercise: AudioExercise,
  entry: ExerciseManifestEntry
): Promise<AudioExercise> => {
  if (!entry.transcriptUrl) {
    return exercise;
  }

  return enrichExerciseWithTranscript(exercise, {
    ...entry,
    transcriptUrl: resolveLocalAssetUrl(entry.transcriptUrl)
  });
};

export const loadLocalExercise = async (accessMode: AccessMode): Promise<AudioExercise> => {
  const entries = await loadManifest();
  const entry = accessMode === "trial" ? entries[0] : entries[0];

  const exercise = normalizeLocalEntry(entry);
  if (!exercise) {
    throw new Error("Local exercise data is invalid.");
  }

  return enrichLocalEntry(exercise, entry);
};

export const loadLocalExerciseById = async (exerciseId: string): Promise<AudioExercise | null> => {
  const entries = await loadManifest();
  const entry = entries.find((candidate) => candidate.id === exerciseId);
  if (!entry) {
    return null;
  }

  const exercise = normalizeLocalEntry(entry);
  if (!exercise) {
    return null;
  }

  return enrichLocalEntry(exercise, entry);
};
