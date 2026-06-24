import type { WhisperSegment } from "../types";
import { snapToClipStart } from "./whisperSegmentGroups";
import { gradeExpectedWords } from "./grading";

export type SentenceMissAnalysis = {
  sentenceIndex: number;
  text: string;
  missedWordCount: number;
};

const SENTENCE_SPLIT_PATTERN = /(?<=[.!?…])\s+/;

export function splitIntoSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_PATTERN)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function getWhisperSegmentsInClip(
  whisperSegments: WhisperSegment[] | undefined,
  segmentIndex: number,
  segmentsPerClip: number
): WhisperSegment[] {
  if (!whisperSegments?.length) {
    return [];
  }

  const clipStart = snapToClipStart(segmentIndex, segmentsPerClip);
  return whisperSegments.slice(clipStart, clipStart + segmentsPerClip);
}

export function analyzeMissedWordsBySentence(
  expectedText: string,
  submittedText: string,
  whisperSegmentsInClip: WhisperSegment[] = []
): SentenceMissAnalysis[] {
  const sentences =
    whisperSegmentsInClip.length > 0
      ? whisperSegmentsInClip
          .map((segment, index) => ({ text: segment.text.trim(), index }))
          .filter((entry) => entry.text)
      : splitIntoSentences(expectedText).map((text, index) => ({ text, index }));

  return sentences.map(({ text, index }) => {
    const correctedWords = gradeExpectedWords(text, submittedText);
    const missedWordCount = correctedWords.filter((word) => !word.isCorrect).length;
    return {
      sentenceIndex: index,
      text,
      missedWordCount
    };
  });
}

export function missedSentenceKey(
  segmentIndex: number,
  segmentsPerClip: number,
  sentenceIndex: number
): string {
  return `${segmentIndex}_${segmentsPerClip}_${sentenceIndex}`;
}
