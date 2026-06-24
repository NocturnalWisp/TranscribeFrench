import { get, ref } from "firebase/database";
import { enrichExerciseWithTranscript } from "./exerciseEnrichment";
import { rtdb } from "./firebase";
import type { AudioExercise, WhisperSegment } from "../types";

type RtdbExerciseRecord = {
  title?: unknown;
  audioUrl?: unknown;
  transcription?: unknown;
  durationSeconds?: unknown;
  active?: unknown;
  order?: unknown;
  transcriptUrl?: unknown;
  whisperSegments?: unknown;
};

const normalizeWhisperSegments = (value: unknown): WhisperSegment[] | undefined => {
  if (!value) {
    return undefined;
  }

  const rawSegments = Array.isArray(value)
    ? value
    : typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];

  const segments = rawSegments
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return null;
      }

      const start = (segment as { start?: unknown }).start;
      const end = (segment as { end?: unknown }).end;
      const text = (segment as { text?: unknown }).text;

      if (typeof start !== "number" || typeof end !== "number" || end <= start) {
        return null;
      }

      return {
        start,
        end,
        text: typeof text === "string" ? text.trim() : ""
      };
    })
    .filter((segment): segment is WhisperSegment => segment !== null);

  return segments.length > 0 ? segments : undefined;
};

const normalizeExercise = (id: string, data: RtdbExerciseRecord): AudioExercise | null => {
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const audioUrl = typeof data.audioUrl === "string" ? data.audioUrl.trim() : "";
  const transcription = typeof data.transcription === "string" ? data.transcription.trim() : "";

  if (!title || !audioUrl) {
    return null;
  }

  const whisperSegments = normalizeWhisperSegments(data.whisperSegments);
  const durationSeconds =
    typeof data.durationSeconds === "number"
      ? Math.max(0, data.durationSeconds)
      : whisperSegments && whisperSegments.length > 0
        ? whisperSegments[whisperSegments.length - 1].end
        : undefined;

  return {
    id,
    title,
    audioUrl,
    expectedTranscription: transcription,
    language: "fr",
    active: data.active !== false,
    durationSeconds,
    whisperSegments
  };
};

const maybeEnrichExercise = async (
  exercise: AudioExercise,
  data: RtdbExerciseRecord
): Promise<AudioExercise> => {
  const transcriptUrl = typeof data.transcriptUrl === "string" ? data.transcriptUrl.trim() : "";
  if (!transcriptUrl) {
    return exercise;
  }

  return enrichExerciseWithTranscript(exercise, {
    id: exercise.id,
    title: exercise.title,
    audioUrl: exercise.audioUrl,
    transcriptUrl,
    transcription: exercise.expectedTranscription,
    active: exercise.active,
    durationSeconds: exercise.durationSeconds
  });
};

const getTrialExerciseId = async (): Promise<string | null> => {
  const snapshot = await get(ref(rtdb!, "config/trialExerciseId"));
  const value = snapshot.val();
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const loadExerciseById = async (exerciseId: string): Promise<AudioExercise | null> => {
  const snapshot = await get(ref(rtdb!, `audioExercises/${exerciseId}`));
  if (!snapshot.exists()) {
    return null;
  }

  const exercise = normalizeExercise(exerciseId, snapshot.val() as RtdbExerciseRecord);
  if (!exercise || exercise.active === false) {
    return null;
  }

  return maybeEnrichExercise(exercise, snapshot.val() as RtdbExerciseRecord);
};

export const loadTrialExercise = async (): Promise<AudioExercise> => {
  if (!rtdb) {
    throw new Error("Realtime Database is not configured.");
  }

  const trialExerciseId = await getTrialExerciseId();
  if (!trialExerciseId) {
    throw new Error("Trial exercise is not configured.");
  }

  const exercise = await loadExerciseById(trialExerciseId);
  if (!exercise) {
    throw new Error("Trial exercise is not available.");
  }

  return exercise;
};

export const loadAuthenticatedExercise = async (): Promise<AudioExercise> => {
  if (!rtdb) {
    throw new Error("Realtime Database is not configured.");
  }

  const snapshot = await get(ref(rtdb, "audioExercises"));
  if (!snapshot.exists()) {
    throw new Error("No exercises are available.");
  }

  const exercises = Object.entries(snapshot.val() as Record<string, RtdbExerciseRecord>)
    .map(([id, data]) => normalizeExercise(id, data))
    .filter((exercise): exercise is AudioExercise => exercise !== null && exercise.active !== false);

  if (exercises.length === 0) {
    throw new Error("No active exercises are available.");
  }

  const randomIndex = Math.floor(Math.random() * exercises.length);
  const selected = exercises[randomIndex];
  const rawData = (snapshot.val() as Record<string, RtdbExerciseRecord>)[selected.id];
  return maybeEnrichExercise(selected, rawData);
};
