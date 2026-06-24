import type { DailyStats } from "../types/progress";
import { getLocalDateKey } from "./dateKey";

export function computeDailyStatsUpdate(
  current: DailyStats | null,
  expectedWordCount: number,
  missedWordCount: number,
  today = getLocalDateKey()
): DailyStats {
  const base: DailyStats =
    current?.date === today
      ? current
      : {
          date: today,
          totalWords: 0,
          missedWords: 0,
          accuracyPercent: 100,
          updatedAt: Date.now()
        };

  const totalWords = base.totalWords + expectedWordCount;
  const missedWords = base.missedWords + missedWordCount;
  const accuracyPercent =
    totalWords === 0
      ? 100
      : Math.round(((totalWords - missedWords) / totalWords) * 100);

  return {
    date: today,
    totalWords,
    missedWords,
    accuracyPercent,
    updatedAt: Date.now()
  };
}
