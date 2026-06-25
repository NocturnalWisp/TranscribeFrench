import { describe, expect, it } from "vitest";
import {
  getSegmentPracticeTier,
  pickRandomSegmentClipIndex
} from "./randomSegment";
import type { ExerciseProgress } from "../types/progress";

const progress = (
  segments: ExerciseProgress["segments"],
  missedSentences: ExerciseProgress["missedSentences"] = {}
): ExerciseProgress => ({ segments, missedSentences });

describe("getSegmentPracticeTier", () => {
  it("treats segments without progress as incomplete", () => {
    expect(getSegmentPracticeTier(0, 1, null)).toBe("incomplete");
    expect(getSegmentPracticeTier(1, 2, progress({}))).toBe("incomplete");
  });

  it("treats failed segments as missed even when a high score exists", () => {
    expect(
      getSegmentPracticeTier(
        0,
        1,
        progress(
          { "0_1": { highScore: 80, lastFirstGradeDate: "2026-01-01", firstCompletedAt: 1 } },
          { "0_1": { segmentIndex: 0, segmentsPerClip: 1, missedWordCount: 2, updatedAt: 1 } }
        )
      )
    ).toBe("missed");
  });

  it("treats graded successful segments as completed", () => {
    expect(
      getSegmentPracticeTier(
        2,
        1,
        progress({
          "2_1": { highScore: 100, lastFirstGradeDate: "2026-01-01", firstCompletedAt: 1 }
        })
      )
    ).toBe("completed");
  });
});

describe("pickRandomSegmentClipIndex", () => {
  it("prefers incomplete segments over missed and completed ones", () => {
    const exerciseProgress = progress(
      {
        "0_1": { highScore: 70, lastFirstGradeDate: "2026-01-01", firstCompletedAt: 1 },
        "1_1": { highScore: 100, lastFirstGradeDate: "2026-01-01", firstCompletedAt: 2 }
      },
      {
        "0_1": { segmentIndex: 0, segmentsPerClip: 1, missedWordCount: 1, updatedAt: 1 }
      }
    );

    const picked = pickRandomSegmentClipIndex({
      clipCount: 3,
      currentClipIndex: 0,
      segmentsPerClip: 1,
      exerciseProgress,
      random: () => 0
    });

    expect(picked).toBe(2);
  });

  it("falls back to missed segments when nothing is incomplete", () => {
    const exerciseProgress = progress(
      {
        "0_1": { highScore: 70, lastFirstGradeDate: "2026-01-01", firstCompletedAt: 1 },
        "1_1": { highScore: 100, lastFirstGradeDate: "2026-01-01", firstCompletedAt: 2 }
      },
      {
        "0_1": { segmentIndex: 0, segmentsPerClip: 1, missedWordCount: 1, updatedAt: 1 }
      }
    );

    const picked = pickRandomSegmentClipIndex({
      clipCount: 2,
      currentClipIndex: 1,
      segmentsPerClip: 1,
      exerciseProgress,
      random: () => 0
    });

    expect(picked).toBe(0);
  });

  it("avoids the current clip when another option exists in the chosen tier", () => {
    const picked = pickRandomSegmentClipIndex({
      clipCount: 3,
      currentClipIndex: 1,
      segmentsPerClip: 1,
      exerciseProgress: null,
      random: () => 0
    });

    expect(picked).toBe(0);
  });
});
