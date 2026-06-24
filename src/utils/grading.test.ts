import { describe, expect, it } from "vitest";
import { gradeExpectedWords, gradeTranscription } from "./grading";

describe("gradeExpectedWords", () => {
  it("marks skipped expected words as incorrect while keeping later matches", () => {
    const result = gradeExpectedWords("bonjour le monde", "bonjour monde");

    expect(result.map((word) => [word.text, word.isCorrect])).toEqual([
      ["bonjour", true],
      ["le", false],
      ["monde", true]
    ]);
  });

  it("marks wrong submitted words without breaking later alignment", () => {
    const result = gradeExpectedWords("bonjour le monde", "bonjour la monde");

    expect(result.map((word) => [word.text, word.isCorrect])).toEqual([
      ["bonjour", true],
      ["le", false],
      ["monde", true]
    ]);
  });

  it("allows multiple skipped words", () => {
    const result = gradeExpectedWords("un deux trois quatre", "un quatre");

    expect(result.map((word) => word.isCorrect)).toEqual([true, false, false, true]);
  });
});

describe("gradeTranscription", () => {
  it("scores skipped words more fairly than strict positional matching", () => {
    const result = gradeTranscription("bonjour le monde", "bonjour monde");

    expect(result.wordMatchPercent).toBeGreaterThan(50);
    expect(result.correctedWords.filter((word) => !word.isCorrect).map((word) => word.text)).toEqual([
      "le"
    ]);
  });
});
