import type { SegmentProgress } from "../types/progress";
import { getLocalDateKey } from "./dateKey";

export function segmentProgressKey(segmentIndex: number, segmentsPerClip: number): string {
  return `${segmentIndex}_${segmentsPerClip}`;
}

export function computeUpdatedSegmentProgress(
  current: SegmentProgress | null,
  score: number,
  today = getLocalDateKey()
): SegmentProgress {
  if (!current) {
    return {
      highScore: score,
      lastFirstGradeDate: today,
      firstCompletedAt: Date.now()
    };
  }

  if (current.lastFirstGradeDate === today) {
    return current;
  }

  return {
    ...current,
    highScore: Math.max(current.highScore, score),
    lastFirstGradeDate: today
  };
}

export function canBeatHighScoreToday(progress: SegmentProgress | null, today = getLocalDateKey()): boolean {
  if (!progress) {
    return false;
  }

  return progress.lastFirstGradeDate !== today;
}
