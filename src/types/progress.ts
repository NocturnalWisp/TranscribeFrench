export type SegmentProgress = {
  highScore: number;
  lastFirstGradeDate: string;
  firstCompletedAt: number;
};

export type MissedSentence = {
  segmentIndex: number;
  segmentsPerClip: number;
  missedWordCount: number;
  updatedAt: number;
};

export type ExerciseProgress = {
  segments: Record<string, SegmentProgress>;
  missedSentences: Record<string, MissedSentence>;
};

export type MissedSegmentRef = {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  segmentIndex: number;
  segmentsPerClip: number;
  isReadyToRetry: boolean;
};

/** @deprecated Use MissedSegmentRef */
export type MissedSentenceRef = MissedSegmentRef;

export type MissedWordEntry = {
  text: string;
  normalized: string;
  missCount: number;
  lastMissedAt: number;
};

export type DailyStats = {
  date: string;
  totalWords: number;
  missedWords: number;
  accuracyPercent: number;
  updatedAt: number;
};
