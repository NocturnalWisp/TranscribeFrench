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

export const gradeWords = (expected: string, submitted: string): GradedWord[] => {
  const expectedWords = normalizeText(expected).split(" ").filter(Boolean);
  const submittedTokens = submitted.match(/\S+/g) ?? [];

  return submittedTokens.map((token, index) => ({
    text: token,
    isCorrect: normalizeText(token) === (expectedWords[index] ?? "")
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
      gradedWords: []
    };
  }

  const expectedWords = normalizedExpected.split(" ").filter(Boolean);
  const submittedWords = normalizedSubmitted.split(" ").filter(Boolean);

  const expectedSet = new Set(expectedWords);
  const submittedSet = new Set(submittedWords);
  let intersectionCount = 0;

  for (const word of submittedSet) {
    if (expectedSet.has(word)) {
      intersectionCount += 1;
    }
  }

  const precision = intersectionCount / Math.max(1, submittedSet.size);
  const recall = intersectionCount / Math.max(1, expectedSet.size);
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
    gradedWords
  };
};
