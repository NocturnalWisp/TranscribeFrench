import { describe, expect, it } from "vitest";
import { mergeExerciseProgressState } from "../services/userProgress";
import type { ExerciseProgress } from "../types/progress";

const progressWithSegment = (highScore: number): ExerciseProgress => ({
  segments: {
    "0_1": {
      highScore,
      lastFirstGradeDate: "2026-06-24",
      firstCompletedAt: 1
    }
  },
  missedSentences: {}
});

describe("mergeExerciseProgressState", () => {
  it("keeps unsaved local progress when the server snapshot is still empty", () => {
    const local = {
      "easy-french-161": progressWithSegment(72)
    };

    const merged = mergeExerciseProgressState(local, {
      "easy-french-161": { segments: {}, missedSentences: {} }
    });

    expect(merged["easy-french-161"].segments["0_1"].highScore).toBe(72);
  });

  it("accepts server progress once data has been written", () => {
    const local = {
      "easy-french-161": progressWithSegment(72)
    };

    const merged = mergeExerciseProgressState(local, {
      "easy-french-161": progressWithSegment(80)
    });

    expect(merged["easy-french-161"].segments["0_1"].highScore).toBe(80);
  });
});
