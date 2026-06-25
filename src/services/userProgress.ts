import { get, onValue, ref, update, type Unsubscribe } from "firebase/database";
import type {
  DailyStats,
  ExerciseProgress,
  MissedSentence,
  MissedWordEntry,
  SegmentProgress
} from "../types/progress";
import { normalizeWordKey } from "../utils/grading";
import { clampSegmentsPerClip } from "../utils/whisperSegmentGroups";
import { rtdb } from "./firebaseRtdb";

const exerciseProgressRef = (uid: string, exerciseId: string) =>
  ref(rtdb!, `users/${uid}/progress/${exerciseId}`);

const dailyStatsRef = (uid: string, dateKey: string) =>
  ref(rtdb!, `users/${uid}/dailyStats/${dateKey}`);

const missedWordsRef = (uid: string) => ref(rtdb!, `users/${uid}/missedWords`);

const emptyExerciseProgress = (): ExerciseProgress => ({
  segments: {},
  missedSentences: {}
});

const normalizeSegmentProgress = (value: unknown): SegmentProgress | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<SegmentProgress>;
  const highScore =
    typeof data.highScore === "number" && Number.isFinite(data.highScore)
      ? Math.max(0, Math.min(100, Math.round(data.highScore)))
      : null;
  const lastFirstGradeDate =
    typeof data.lastFirstGradeDate === "string" ? data.lastFirstGradeDate.trim() : "";
  const firstCompletedAt =
    typeof data.firstCompletedAt === "number" && Number.isFinite(data.firstCompletedAt)
      ? data.firstCompletedAt
      : null;

  if (highScore === null || !lastFirstGradeDate || firstCompletedAt === null) {
    return null;
  }

  return {
    highScore,
    lastFirstGradeDate,
    firstCompletedAt
  };
};

const normalizeMissedSentence = (value: unknown): MissedSentence | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<MissedSentence>;
  const segmentIndex =
    typeof data.segmentIndex === "number" && Number.isFinite(data.segmentIndex)
      ? Math.max(0, Math.round(data.segmentIndex))
      : null;
  const segmentsPerClip =
    typeof data.segmentsPerClip === "number" && Number.isFinite(data.segmentsPerClip)
      ? clampSegmentsPerClip(data.segmentsPerClip)
      : null;
  const missedWordCount =
    typeof data.missedWordCount === "number" && Number.isFinite(data.missedWordCount)
      ? Math.max(0, Math.round(data.missedWordCount))
      : null;
  const updatedAt =
    typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt) ? data.updatedAt : null;

  if (
    segmentIndex === null ||
    segmentsPerClip === null ||
    missedWordCount === null ||
    updatedAt === null ||
    missedWordCount < 1
  ) {
    return null;
  }

  return {
    segmentIndex,
    segmentsPerClip,
    missedWordCount,
    updatedAt
  };
};

const normalizeExerciseProgress = (value: unknown): ExerciseProgress => {
  if (!value || typeof value !== "object") {
    return emptyExerciseProgress();
  }

  const data = value as {
    segments?: Record<string, unknown>;
    missedSentences?: Record<string, unknown>;
  };

  const segments: Record<string, SegmentProgress> = {};
  for (const [key, segmentValue] of Object.entries(data.segments ?? {})) {
    const normalized = normalizeSegmentProgress(segmentValue);
    if (normalized) {
      segments[key] = normalized;
    }
  }

  const missedSentences: Record<string, MissedSentence> = {};
  for (const [key, sentenceValue] of Object.entries(data.missedSentences ?? {})) {
    const normalized = normalizeMissedSentence(sentenceValue);
    if (normalized) {
      const segmentKey = `${normalized.segmentIndex}_${normalized.segmentsPerClip}`;
      const existing = missedSentences[segmentKey];
      if (!existing || normalized.updatedAt >= existing.updatedAt) {
        missedSentences[segmentKey] = normalized;
      }
    }
  }

  return { segments, missedSentences };
};

const exerciseProgressHasData = (progress: ExerciseProgress | undefined): boolean => {
  if (!progress) {
    return false;
  }

  return (
    Object.keys(progress.segments).length > 0 || Object.keys(progress.missedSentences).length > 0
  );
};

export const mergeExerciseProgressState = (
  current: Record<string, ExerciseProgress>,
  fromServer: Record<string, ExerciseProgress>
): Record<string, ExerciseProgress> => {
  const merged: Record<string, ExerciseProgress> = { ...current };

  for (const [exerciseId, serverProgress] of Object.entries(fromServer)) {
    const localProgress = current[exerciseId];
    const serverHasData = exerciseProgressHasData(serverProgress);
    const localHasData = exerciseProgressHasData(localProgress);

    if (serverHasData || !localHasData) {
      merged[exerciseId] = serverProgress;
    }
  }

  return merged;
};

const normalizeDailyStats = (value: unknown): DailyStats | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<DailyStats>;
  const date = typeof data.date === "string" ? data.date.trim() : "";
  const totalWords =
    typeof data.totalWords === "number" && Number.isFinite(data.totalWords)
      ? Math.max(0, Math.round(data.totalWords))
      : null;
  const missedWords =
    typeof data.missedWords === "number" && Number.isFinite(data.missedWords)
      ? Math.max(0, Math.round(data.missedWords))
      : null;
  const accuracyPercent =
    typeof data.accuracyPercent === "number" && Number.isFinite(data.accuracyPercent)
      ? Math.max(0, Math.min(100, Math.round(data.accuracyPercent)))
      : null;
  const updatedAt =
    typeof data.updatedAt === "number" && Number.isFinite(data.updatedAt) ? data.updatedAt : null;

  if (
    !date ||
    totalWords === null ||
    missedWords === null ||
    accuracyPercent === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    date,
    totalWords,
    missedWords,
    accuracyPercent,
    updatedAt
  };
};

const normalizeMissedWordEntry = (value: unknown): MissedWordEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Partial<MissedWordEntry>;
  const text = typeof data.text === "string" ? data.text.trim() : "";
  const normalized = typeof data.normalized === "string" ? data.normalized.trim() : "";
  const missCount =
    typeof data.missCount === "number" && Number.isFinite(data.missCount)
      ? Math.max(1, Math.round(data.missCount))
      : null;
  const lastMissedAt =
    typeof data.lastMissedAt === "number" && Number.isFinite(data.lastMissedAt)
      ? data.lastMissedAt
      : null;

  if (!text || !normalized || missCount === null || lastMissedAt === null) {
    return null;
  }

  return {
    text,
    normalized,
    missCount,
    lastMissedAt
  };
};

export const getExerciseProgress = async (
  uid: string,
  exerciseId: string
): Promise<ExerciseProgress> => {
  if (!rtdb || !uid.trim() || !exerciseId.trim()) {
    return emptyExerciseProgress();
  }

  const snapshot = await get(exerciseProgressRef(uid, exerciseId));
  if (!snapshot.exists()) {
    return emptyExerciseProgress();
  }

  return normalizeExerciseProgress(snapshot.val());
};

export const subscribeExerciseProgress = (
  uid: string,
  exerciseId: string,
  callback: (progress: ExerciseProgress) => void
): Unsubscribe => {
  if (!rtdb || !uid.trim() || !exerciseId.trim()) {
    callback(emptyExerciseProgress());
    return () => {};
  }

  return onValue(exerciseProgressRef(uid, exerciseId), (snapshot) => {
    callback(normalizeExerciseProgress(snapshot.val()));
  });
};

export const subscribeAllExerciseProgress = (
  uid: string,
  callback: (progressByExercise: Record<string, ExerciseProgress>) => void
): Unsubscribe => {
  if (!rtdb || !uid.trim()) {
    callback({});
    return () => {};
  }

  return onValue(ref(rtdb, `users/${uid}/progress`), (snapshot) => {
    if (!snapshot.exists()) {
      callback({});
      return;
    }

    const progressByExercise: Record<string, ExerciseProgress> = {};
    for (const [exerciseId, value] of Object.entries(
      snapshot.val() as Record<string, unknown>
    )) {
      progressByExercise[exerciseId] = normalizeExerciseProgress(value);
    }

    callback(progressByExercise);
  });
};

export const getDailyStats = async (uid: string, dateKey: string): Promise<DailyStats | null> => {
  if (!rtdb || !uid.trim() || !dateKey.trim()) {
    return null;
  }

  const snapshot = await get(dailyStatsRef(uid, dateKey));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeDailyStats(snapshot.val());
};

export const subscribeDailyStats = (
  uid: string,
  dateKey: string,
  callback: (stats: DailyStats | null) => void
): Unsubscribe => {
  if (!rtdb || !uid.trim() || !dateKey.trim()) {
    callback(null);
    return () => {};
  }

  return onValue(dailyStatsRef(uid, dateKey), (snapshot) => {
    callback(snapshot.exists() ? normalizeDailyStats(snapshot.val()) : null);
  });
};

export const getMissedWords = async (
  uid: string
): Promise<Record<string, MissedWordEntry>> => {
  if (!rtdb || !uid.trim()) {
    return {};
  }

  const snapshot = await get(missedWordsRef(uid));
  if (!snapshot.exists()) {
    return {};
  }

  const entries: Record<string, MissedWordEntry> = {};
  for (const [key, value] of Object.entries(snapshot.val() as Record<string, unknown>)) {
    const normalized = normalizeMissedWordEntry(value);
    if (normalized) {
      entries[key] = normalized;
    }
  }

  return entries;
};

export type SaveGradeProgressInput = {
  segmentKey: string;
  segmentProgress: SegmentProgress;
  missedSentenceUpdates: Array<{
    key: string;
    value: MissedSentence | null;
  }>;
  dailyStats: DailyStats;
  missedWordUpdates: Array<{
    normalized: string;
    entry: MissedWordEntry;
  }>;
};

export const saveGradeProgress = async (
  uid: string,
  exerciseId: string,
  input: SaveGradeProgressInput
): Promise<void> => {
  if (!rtdb) {
    throw new Error("Progress storage is not configured.");
  }

  if (!uid.trim() || !exerciseId.trim()) {
    throw new Error("Unable to save progress for this exercise.");
  }

  const payload: Record<string, unknown> = {
    [`progress/${exerciseId}/segments/${input.segmentKey}`]: input.segmentProgress,
    [`dailyStats/${input.dailyStats.date}`]: input.dailyStats
  };

  for (const { key, value } of input.missedSentenceUpdates) {
    payload[`progress/${exerciseId}/missedSentences/${key}`] = value;
  }

  for (const { normalized, entry } of input.missedWordUpdates) {
    if (!normalized) {
      continue;
    }

    payload[`missedWords/${normalized}`] = entry;
  }

  try {
    await update(ref(rtdb, `users/${uid}`), payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    throw new Error(`Progress save failed: ${message}`);
  }
};

export const buildMissedWordUpdates = (
  existingWords: Record<string, MissedWordEntry>,
  missedWords: string[],
  now = Date.now()
): Array<{ normalized: string; entry: MissedWordEntry }> => {
  const updates = new Map<string, MissedWordEntry>();

  for (const word of missedWords) {
    const normalized = normalizeWordKey(word);
    if (!normalized) {
      continue;
    }

    const prior = existingWords[normalized] ?? updates.get(normalized);
    updates.set(normalized, {
      text: word,
      normalized,
      missCount: (prior?.missCount ?? 0) + 1,
      lastMissedAt: now
    });
  }

  return Array.from(updates.entries()).map(([normalized, entry]) => ({ normalized, entry }));
};
