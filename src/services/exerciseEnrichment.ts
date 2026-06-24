import type { AudioExercise, WhisperSegment } from "../types";

export type ExerciseManifestEntry = {
  id: string;
  title: string;
  audioUrl: string;
  transcriptUrl?: string;
  transcription?: string;
  active?: boolean;
  durationSeconds?: number;
};

const normalizeWhisperSegments = (value: unknown): WhisperSegment[] => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const payload = value as { segments?: unknown };
  let rawSegments: unknown[] = [];

  if (Array.isArray(payload.segments)) {
    rawSegments = payload.segments;
  } else if (payload.segments && typeof payload.segments === "object") {
    rawSegments = Object.values(payload.segments as Record<string, unknown>);
  } else if (Array.isArray(value)) {
    rawSegments = value;
  }

  return rawSegments
    .map((segment) => {
      if (!segment || typeof segment !== "object") {
        return null;
      }

      const start = (segment as { start?: unknown }).start;
      const end = (segment as { end?: unknown }).end;
      const text = (segment as { text?: unknown }).text;

      if (typeof start !== "number" || typeof end !== "number" || end <= start) {
        return null;
      }

      return {
        start,
        end,
        text: typeof text === "string" ? text.trim() : ""
      };
    })
    .filter((segment): segment is WhisperSegment => segment !== null);
};

const fetchTranscriptText = async (transcriptUrl: string): Promise<string> => {
  const response = await fetch(transcriptUrl);
  if (!response.ok) {
    return "";
  }

  return (await response.text()).trim();
};

const transcriptJsonUrlFromTxt = (transcriptUrl: string): string => {
  return transcriptUrl.replace(/\.txt$/i, ".json");
};

const fetchWhisperSegments = async (transcriptUrl: string): Promise<WhisperSegment[]> => {
  const jsonUrl = transcriptJsonUrlFromTxt(transcriptUrl);
  const response = await fetch(jsonUrl);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as unknown;
  return normalizeWhisperSegments(payload);
};

export const enrichExerciseWithTranscript = async (
  exercise: AudioExercise,
  entry: ExerciseManifestEntry
): Promise<AudioExercise> => {
  if (!entry.transcriptUrl) {
    return exercise;
  }

  const [transcription, whisperSegments] = await Promise.all([
    exercise.expectedTranscription
      ? Promise.resolve(exercise.expectedTranscription)
      : fetchTranscriptText(entry.transcriptUrl),
    fetchWhisperSegments(entry.transcriptUrl)
  ]);

  const durationSeconds =
    exercise.durationSeconds ??
    (whisperSegments.length > 0 ? whisperSegments[whisperSegments.length - 1].end : undefined);

  return {
    ...exercise,
    expectedTranscription: transcription || exercise.expectedTranscription,
    whisperSegments: whisperSegments.length > 0 ? whisperSegments : undefined,
    durationSeconds
  };
};
