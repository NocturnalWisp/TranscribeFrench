import {
  listExerciseCatalog as listRtdbExerciseCatalog,
  loadExerciseById as loadRtdbExerciseById,
  loadTrialExercise
} from "./rtdbExercises";
import {
  listLocalExerciseCatalog,
  loadLocalExercise,
  loadLocalExerciseById
} from "./localExercises";
import { isRealtimeDatabaseConfigured } from "./firebaseApp";
import type { AccessMode } from "../types/auth";
import type { AudioExercise, ExerciseSummary } from "../types";
const fallbackExercises: AudioExercise[] = [
  {
    id: "fallback-1",
    title: "French Listening Practice",
    audioUrl: "https://www.w3schools.com/html/horse.mp3",
    expectedTranscription:
      "Bonjour et bienvenue. Aujourd'hui nous allons ecouter un court enregistrement en francais.",
    language: "fr",
    active: true,
    durationSeconds: 60
  }
];

const loadRemoteExercise = async (accessMode: AccessMode, exerciseId?: string): Promise<AudioExercise> => {
  if (accessMode === "trial") {
    return loadTrialExercise();
  }

  if (exerciseId) {
    const exercise = await loadRtdbExerciseById(exerciseId);
    if (!exercise) {
      throw new Error("Exercise is not available.");
    }

    return exercise;
  }

  const catalog = await listRtdbExerciseCatalog();
  const exercise = await loadRtdbExerciseById(catalog[0].id);
  if (!exercise) {
    throw new Error("Exercise is not available.");
  }

  return exercise;
};

export const listExerciseCatalog = async (): Promise<ExerciseSummary[]> => {
  if (isRealtimeDatabaseConfigured) {
    try {
      return await listRtdbExerciseCatalog();
    } catch {
      if (!import.meta.env.DEV) {
        throw new Error("Unable to load exercise catalog.");
      }
    }
  }

  if (import.meta.env.DEV) {
    return listLocalExerciseCatalog();
  }

  return [];
};

export const loadExercise = async (
  accessMode: AccessMode,
  exerciseId?: string
): Promise<AudioExercise> => {
  if (isRealtimeDatabaseConfigured) {
    try {
      return await loadRemoteExercise(accessMode, exerciseId);
    } catch {
      if (!import.meta.env.DEV) {
        throw new Error("Unable to load exercise.");
      }
    }
  }

  if (import.meta.env.DEV) {
    try {
      if (accessMode === "full" && exerciseId) {
        const exercise = await loadLocalExerciseById(exerciseId);
        if (exercise) {
          return exercise;
        }
      }

      return await loadLocalExercise(accessMode);
    } catch {
      // Fall through to sample exercise.
    }
  }

  return fallbackExercises[0];
};

export const loadExerciseById = async (exerciseId: string): Promise<AudioExercise | null> => {
  if (isRealtimeDatabaseConfigured) {
    try {
      return await loadRtdbExerciseById(exerciseId);
    } catch {
      if (!import.meta.env.DEV) {
        return null;
      }
    }
  }

  if (import.meta.env.DEV) {
    try {
      return await loadLocalExerciseById(exerciseId);
    } catch {
      return null;
    }
  }

  const fallback = fallbackExercises.find((exercise) => exercise.id === exerciseId);
  return fallback ?? null;
};
