import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { loadFirstHostedExercise } from "./hostedExercises";
import { db } from "./firebase";
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

const normalizeExercise = (id: string, data: Record<string, unknown>): AudioExercise | null => {
  const title = typeof data.title === "string" ? data.title : "";
  const audioUrl = typeof data.audioUrl === "string" ? data.audioUrl : "";
  const transcription = typeof data.transcription === "string" ? data.transcription : "";
  const durationSeconds =
    typeof data.durationSeconds === "number" ? Math.max(0, data.durationSeconds) : undefined;

  if (!title || !audioUrl || !transcription) {
    return null;
  }

  return {
    id,
    title,
    audioUrl,
    expectedTranscription: transcription,
    language: "fr",
    active: data.active !== false,
    durationSeconds
  };
};

const loadFirestoreExercise = async (): Promise<AudioExercise | null> => {
  if (!db) {
    return null;
  }

  const exercisesQuery = query(
    collection(db, "audioExercises"),
    where("active", "==", true),
    limit(20)
  );
  const snapshot = await getDocs(exercisesQuery);
  const exercises = snapshot.docs
    .map((document) => normalizeExercise(document.id, document.data()))
    .filter((exercise): exercise is AudioExercise => exercise !== null);

  if (exercises.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * exercises.length);
  return exercises[randomIndex];
};

export const loadExercise = async (): Promise<AudioExercise> => {
  try {
    const hostedExercise = await loadFirstHostedExercise();
    if (hostedExercise) {
      return hostedExercise;
    }
  } catch {
    // Fall through to Firestore and sample exercise.
  }

  try {
    const firestoreExercise = await loadFirestoreExercise();
    if (firestoreExercise) {
      return firestoreExercise;
    }
  } catch {
    // Fall through to sample exercise.
  }

  return fallbackExercises[0];
};
