import { loadAuthenticatedExercise, loadExerciseById as loadRtdbExerciseById, loadTrialExercise } from "./rtdbExercises";
import { loadLocalExercise, loadLocalExerciseById } from "./localExercises";
import { isRealtimeDatabaseConfigured } from "./firebase";
import type { AccessMode } from "../types/auth";
import type { AudioExercise } from "../types";
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

const loadRemoteExercise = async (accessMode: AccessMode): Promise<AudioExercise> => {
  if (accessMode === "trial") {
    return loadTrialExercise();
  }

  return loadAuthenticatedExercise();
};

export const loadExercise = async (accessMode: AccessMode): Promise<AudioExercise> => {
  if (isRealtimeDatabaseConfigured) {
    try {
      return await loadRemoteExercise(accessMode);
    } catch {
      if (!import.meta.env.DEV) {
        throw new Error("Unable to load exercise.");
      }
    }
  }

  if (import.meta.env.DEV) {
    try {
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
