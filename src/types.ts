export type WhisperSegment = {
  start: number;
  end: number;
  text: string;
};

export type AudioExercise = {
  id: string;
  title: string;
  audioUrl: string;
  expectedTranscription: string;
  language: "fr";
  durationSeconds?: number;
  whisperSegments?: WhisperSegment[];
  active?: boolean;
};

export type GradedWord = {
  text: string;
  isCorrect: boolean;
};

export type GradeResult = {
  score: number;
  wordMatchPercent: number;
  characterSimilarityPercent: number;
  feedback: string;
  gradedWords: GradedWord[];
  correctedWords: GradedWord[];
};
