import { describe, expect, it } from "vitest";
import {
  buildTimedPlaybackSegments,
  getExpectedTextForSegment,
  groupWhisperSegments,
  sliceTranscriptionByTimeRange
} from "./whisperSegmentGroups";

describe("groupWhisperSegments", () => {
  const segments = [
    { start: 0, end: 5, text: "Bonjour" },
    { start: 5, end: 10, text: "et bienvenue" },
    { start: 10, end: 15, text: "dans ce podcast" },
    { start: 15, end: 20, text: "aujourd'hui" },
    { start: 20, end: 25, text: "merci" }
  ];

  it("groups one Whisper segment per clip by default", () => {
    expect(groupWhisperSegments(segments, 1)).toEqual([
      { start: 0, end: 5, text: "Bonjour" },
      { start: 5, end: 10, text: "et bienvenue" },
      { start: 10, end: 15, text: "dans ce podcast" },
      { start: 15, end: 20, text: "aujourd'hui" },
      { start: 20, end: 25, text: "merci" }
    ]);
  });

  it("groups multiple Whisper segments into one clip", () => {
    expect(groupWhisperSegments(segments, 3)).toEqual([
      { start: 0, end: 15, text: "Bonjour et bienvenue dans ce podcast" },
      { start: 15, end: 25, text: "aujourd'hui merci" }
    ]);
  });
});

describe("getExpectedTextForSegment", () => {
  const segments = [
    { start: 0, end: 5, text: "Bonjour" },
    { start: 5, end: 10, text: "et bienvenue" },
    { start: 10, end: 15, text: "dans ce podcast" }
  ];

  it("returns grouped text for the active segment", () => {
    const playbackSegment = { start: 5, end: 10, text: "" };

    expect(getExpectedTextForSegment(segments, 1, 1, playbackSegment)).toBe("et bienvenue");
  });

  it("returns only the text for the requested segment index", () => {
    const playbackSegment = { start: 10, end: 15, text: "" };

    expect(getExpectedTextForSegment(segments, 2, 1, playbackSegment)).toBe("dans ce podcast");
  });

  it("slices the full transcript when only timing data is available", () => {
    const playbackSegment = { start: 0, end: 30, text: "" };
    const fullTranscription = "un deux trois quatre cinq six sept huit neuf dix";

    expect(
      getExpectedTextForSegment(undefined, 0, 1, playbackSegment, {
        fullTranscription,
        totalDurationSeconds: 60
      })
    ).toBe("un deux trois quatre cinq");
  });
});

describe("buildTimedPlaybackSegments", () => {
  it("splits long audio into fixed windows with transcript slices", () => {
    const fullTranscription = "alpha beta gamma delta epsilon zeta";

    expect(buildTimedPlaybackSegments(60, 30, fullTranscription)).toEqual([
      { start: 0, end: 30, text: "alpha beta gamma" },
      { start: 30, end: 60, text: "delta epsilon zeta" }
    ]);
  });
});

describe("sliceTranscriptionByTimeRange", () => {
  it("returns a proportional slice of words", () => {
    expect(sliceTranscriptionByTimeRange("a b c d", 40, 10, 20)).toBe("b");
  });
});
