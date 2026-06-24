import type { GradeResult, GradedWord } from "../types";

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const levenshteinDistance = (source: string, target: string): number => {
  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  const previous = new Array(target.length + 1).fill(0);
  const current = new Array(target.length + 1).fill(0);

  for (let index = 0; index <= target.length; index += 1) {
    previous[index] = index;
  }

  for (let row = 1; row <= source.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= target.length; column += 1) {
      const substitutionCost = source[row - 1] === target[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost
      );
    }

    for (let column = 0; column <= target.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[target.length];
};

const scoreToFeedback = (score: number): string => {
  if (score >= 90) return "Excellent comprehension. Keep pushing for full accuracy.";
  if (score >= 75) return "Strong work. You caught most of the important words.";
  if (score >= 55) return "Good effort. Replay this segment and focus on missed words.";
  return "Keep practicing. Slow down and replay short segments to improve recognition.";
};

type WordAlignment = {
  matchedExpectedIndices: Set<number>;
  matchedSubmittedIndices: Set<number>;
};

const alignWords = (expectedWords: string[], submittedWords: string[]): WordAlignment => {
  const expectedCount = expectedWords.length;
  const submittedCount = submittedWords.length;
  const scores = Array.from({ length: expectedCount + 1 }, () =>
    new Array<number>(submittedCount + 1).fill(0)
  );

  for (let expectedIndex = 1; expectedIndex <= expectedCount; expectedIndex += 1) {
    for (let submittedIndex = 1; submittedIndex <= submittedCount; submittedIndex += 1) {
      if (expectedWords[expectedIndex - 1] === submittedWords[submittedIndex - 1]) {
        scores[expectedIndex][submittedIndex] =
          scores[expectedIndex - 1][submittedIndex - 1] + 1;
      } else {
        scores[expectedIndex][submittedIndex] = Math.max(
          scores[expectedIndex - 1][submittedIndex],
          scores[expectedIndex][submittedIndex - 1]
        );
      }
    }
  }

  const matchedExpectedIndices = new Set<number>();
  const matchedSubmittedIndices = new Set<number>();
  let expectedIndex = expectedCount;
  let submittedIndex = submittedCount;

  while (expectedIndex > 0 && submittedIndex > 0) {
    if (expectedWords[expectedIndex - 1] === submittedWords[submittedIndex - 1]) {
      matchedExpectedIndices.add(expectedIndex - 1);
      matchedSubmittedIndices.add(submittedIndex - 1);
      expectedIndex -= 1;
      submittedIndex -= 1;
    } else if (scores[expectedIndex - 1][submittedIndex] >= scores[expectedIndex][submittedIndex - 1]) {
      expectedIndex -= 1;
    } else {
      submittedIndex -= 1;
    }
  }

  return { matchedExpectedIndices, matchedSubmittedIndices };
};

export const gradeWords = (expected: string, submitted: string): GradedWord[] => {
  const expectedWords = normalizeText(expected).split(" ").filter(Boolean);
  const submittedTokens = submitted.match(/\S+/g) ?? [];
  const submittedWords = submittedTokens.map((token) => normalizeText(token));
  const { matchedSubmittedIndices } = alignWords(expectedWords, submittedWords);

  return submittedTokens.map((token, index) => ({
    text: token,
    isCorrect: matchedSubmittedIndices.has(index)
  }));
};

export const gradeExpectedWords = (expected: string, submitted: string): GradedWord[] => {
  const expectedTokens = expected.match(/\S+/g) ?? [];
  const expectedWords = normalizeText(expected).split(" ").filter(Boolean);
  const submittedWords = normalizeText(submitted).split(" ").filter(Boolean);
  const { matchedExpectedIndices } = alignWords(expectedWords, submittedWords);

  return expectedTokens.map((token, index) => ({
    text: token,
    isCorrect: matchedExpectedIndices.has(index)
  }));
};

export const gradeTranscription = (expected: string, submitted: string): GradeResult => {
  const gradedWords = gradeWords(expected, submitted);
  const normalizedExpected = normalizeText(expected);
  const normalizedSubmitted = normalizeText(submitted);

  if (!normalizedSubmitted) {
    return {
      score: 0,
      wordMatchPercent: 0,
      characterSimilarityPercent: 0,
      feedback: "No transcription detected. Type what you hear and grade again.",
      gradedWords: [],
      correctedWords: gradeExpectedWords(expected, submitted)
    };
  }

  const expectedWords = normalizedExpected.split(" ").filter(Boolean);
  const submittedWords = normalizedSubmitted.split(" ").filter(Boolean);
  const { matchedExpectedIndices, matchedSubmittedIndices } = alignWords(expectedWords, submittedWords);

  const recall = matchedExpectedIndices.size / Math.max(1, expectedWords.length);
  const precision = matchedSubmittedIndices.size / Math.max(1, submittedWords.length);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const editDistance = levenshteinDistance(normalizedSubmitted, normalizedExpected);
  const maxLength = Math.max(normalizedSubmitted.length, normalizedExpected.length, 1);
  const charSimilarity = 1 - editDistance / maxLength;

  const weightedScore = Math.round((f1 * 0.7 + charSimilarity * 0.3) * 100);

  return {
    score: Math.max(0, Math.min(100, weightedScore)),
    wordMatchPercent: Math.round(f1 * 100),
    characterSimilarityPercent: Math.round(charSimilarity * 100),
    feedback: scoreToFeedback(weightedScore),
    gradedWords,
    correctedWords: gradeExpectedWords(expected, submitted)
  };
};
