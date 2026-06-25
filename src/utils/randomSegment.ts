import type { ExerciseProgress } from "../types/progress";
import { segmentProgressKey } from "./segmentProgress";

export type SegmentPracticeTier = "incomplete" | "missed" | "completed";

export function getSegmentPracticeTier(
  clipIndex: number,
  segmentsPerClip: number,
  exerciseProgress: ExerciseProgress | null
): SegmentPracticeTier {
  const key = segmentProgressKey(clipIndex, segmentsPerClip);
  const hasHighScore = exerciseProgress?.segments[key] != null;
  const isMissed = exerciseProgress?.missedSentences[key] != null;

  if (!hasHighScore) {
    return "incomplete";
  }

  if (isMissed) {
    return "missed";
  }

  return "completed";
}

const TIER_PRIORITY: SegmentPracticeTier[] = ["incomplete", "missed", "completed"];

export function pickRandomSegmentClipIndex(options: {
  clipCount: number;
  currentClipIndex: number;
  segmentsPerClip: number;
  exerciseProgress: ExerciseProgress | null;
  random?: () => number;
}): number | null {
  const { clipCount, currentClipIndex, segmentsPerClip, exerciseProgress, random = Math.random } =
    options;

  if (clipCount <= 0) {
    return null;
  }

  for (const tier of TIER_PRIORITY) {
    const candidates: number[] = [];

    for (let clipIndex = 0; clipIndex < clipCount; clipIndex += 1) {
      if (getSegmentPracticeTier(clipIndex, segmentsPerClip, exerciseProgress) === tier) {
        candidates.push(clipIndex);
      }
    }

    if (candidates.length === 0) {
      continue;
    }

    const pool =
      candidates.length > 1
        ? candidates.filter((clipIndex) => clipIndex !== currentClipIndex)
        : candidates;

    return pool[Math.floor(random() * pool.length)] ?? null;
  }

  return null;
}
