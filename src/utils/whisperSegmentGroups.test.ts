import { describe, expect, it } from "vitest";
import { groupWhisperSegments } from "./whisperSegmentGroups";

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
