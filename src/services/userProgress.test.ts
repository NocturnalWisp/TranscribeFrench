import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseProgress } from "../types/progress";

const mockUpdate = vi.fn();
const mockRef = vi.fn((_db: unknown, path: string) => ({ path }));

vi.mock("firebase/database", () => ({
  get: vi.fn(),
  onValue: vi.fn(),
  ref: (...args: unknown[]) => mockRef(...args),
  update: (...args: unknown[]) => mockUpdate(...args)
}));

vi.mock("./firebaseRtdb", () => ({
  rtdb: {}
}));

import { mergeExerciseProgressState, saveGradeProgress } from "../services/userProgress";

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

describe("saveGradeProgress", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockRef.mockClear();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("writes path-based updates so existing missed segments are not replaced", async () => {
    const exerciseId = "easy-french-161";
    const uid = "user-1";

    await saveGradeProgress(uid, exerciseId, {
      segmentKey: "0_1",
      segmentProgress: {
        highScore: 70,
        lastFirstGradeDate: "2026-06-25",
        firstCompletedAt: 1000
      },
      missedSentenceUpdates: [
        {
          key: "0_1",
          value: {
            segmentIndex: 0,
            segmentsPerClip: 1,
            missedWordCount: 2,
            updatedAt: 1000
          }
        }
      ],
      dailyStats: {
        date: "2026-06-25",
        totalWords: 10,
        missedWords: 2,
        accuracyPercent: 80,
        updatedAt: 1000
      },
      missedWordUpdates: []
    });

    await saveGradeProgress(uid, exerciseId, {
      segmentKey: "1_1",
      segmentProgress: {
        highScore: 60,
        lastFirstGradeDate: "2026-06-25",
        firstCompletedAt: 2000
      },
      missedSentenceUpdates: [
        {
          key: "1_1",
          value: {
            segmentIndex: 1,
            segmentsPerClip: 1,
            missedWordCount: 3,
            updatedAt: 2000
          }
        }
      ],
      dailyStats: {
        date: "2026-06-25",
        totalWords: 20,
        missedWords: 5,
        accuracyPercent: 75,
        updatedAt: 2000
      },
      missedWordUpdates: []
    });

    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockRef).toHaveBeenCalledWith({}, `users/${uid}`);

    const firstPayload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    const secondPayload = mockUpdate.mock.calls[1][1] as Record<string, unknown>;

    expect(firstPayload).toEqual({
      [`progress/${exerciseId}/segments/0_1`]: {
        highScore: 70,
        lastFirstGradeDate: "2026-06-25",
        firstCompletedAt: 1000
      },
      [`progress/${exerciseId}/missedSentences/0_1`]: {
        segmentIndex: 0,
        segmentsPerClip: 1,
        missedWordCount: 2,
        updatedAt: 1000
      },
      "dailyStats/2026-06-25": {
        date: "2026-06-25",
        totalWords: 10,
        missedWords: 2,
        accuracyPercent: 80,
        updatedAt: 1000
      }
    });

    expect(secondPayload).toEqual({
      [`progress/${exerciseId}/segments/1_1`]: {
        highScore: 60,
        lastFirstGradeDate: "2026-06-25",
        firstCompletedAt: 2000
      },
      [`progress/${exerciseId}/missedSentences/1_1`]: {
        segmentIndex: 1,
        segmentsPerClip: 1,
        missedWordCount: 3,
        updatedAt: 2000
      },
      "dailyStats/2026-06-25": {
        date: "2026-06-25",
        totalWords: 20,
        missedWords: 5,
        accuracyPercent: 75,
        updatedAt: 2000
      }
    });

    expect(firstPayload).not.toHaveProperty("progress");
    expect(secondPayload).not.toHaveProperty("progress");
  });

  it("can clear individual missed segments without replacing the progress subtree", async () => {
    const exerciseId = "easy-french-161";

    await saveGradeProgress("user-1", exerciseId, {
      segmentKey: "0_1",
      segmentProgress: {
        highScore: 100,
        lastFirstGradeDate: "2026-06-25",
        firstCompletedAt: 3000
      },
      missedSentenceUpdates: [{ key: "0_1", value: null }],
      dailyStats: {
        date: "2026-06-25",
        totalWords: 5,
        missedWords: 0,
        accuracyPercent: 100,
        updatedAt: 3000
      },
      missedWordUpdates: []
    });

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;

    expect(payload[`progress/${exerciseId}/missedSentences/0_1`]).toBeNull();
    expect(payload).not.toHaveProperty("progress");
  });
});
