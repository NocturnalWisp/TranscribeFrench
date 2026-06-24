export type WhisperSegment = {
  start: number;
  end: number;
  text: string;
};

export type PlaybackSegment = {
  start: number;
  end: number;
  text: string;
};

export const DEFAULT_SEGMENTS_PER_CLIP = 1;
export const MIN_SEGMENTS_PER_CLIP = 1;
export const MAX_SEGMENTS_PER_CLIP = 10;
export const DEFAULT_PLAYBACK_WINDOW_SECONDS = 30;

export function clampSegmentsPerClip(count: number): number {
  return Math.min(MAX_SEGMENTS_PER_CLIP, Math.max(MIN_SEGMENTS_PER_CLIP, Math.round(count)));
}

export function clipIndexFromWhisperSegment(segmentIndex: number, segmentsPerClip: number): number {
  return Math.floor(segmentIndex / clampSegmentsPerClip(segmentsPerClip));
}

export function snapToClipStart(segmentIndex: number, segmentsPerClip: number): number {
  const clipSize = clampSegmentsPerClip(segmentsPerClip);
  return clipIndexFromWhisperSegment(segmentIndex, clipSize) * clipSize;
}

export function restoreWhisperSegmentIndex(
  savedSegmentIndex: number,
  segmentsPerClip: number,
  whisperSegmentCount: number
): number {
  const normalizedIndex = Math.max(0, Math.round(savedSegmentIndex));
  if (whisperSegmentCount <= 0) {
    return normalizedIndex;
  }

  const clipSize = clampSegmentsPerClip(segmentsPerClip);
  const clipCount = Math.ceil(whisperSegmentCount / clipSize);
  const migratedWhisperIndex = normalizedIndex * clipSize;

  if (
    normalizedIndex > 0 &&
    normalizedIndex < clipCount &&
    migratedWhisperIndex < whisperSegmentCount
  ) {
    return migratedWhisperIndex;
  }

  return snapToClipStart(normalizedIndex, clipSize);
}

export function sliceTranscriptionByTimeRange(
  fullText: string,
  totalDurationSeconds: number,
  startSeconds: number,
  endSeconds: number
): string {
  const words = fullText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || totalDurationSeconds <= 0) {
    return "";
  }

  const startIndex = Math.floor((startSeconds / totalDurationSeconds) * words.length);
  const endIndex = Math.max(
    startIndex + 1,
    Math.ceil((endSeconds / totalDurationSeconds) * words.length)
  );

  return words.slice(startIndex, endIndex).join(" ");
}

export function buildTimedPlaybackSegments(
  totalDurationSeconds: number,
  windowSeconds = DEFAULT_PLAYBACK_WINDOW_SECONDS,
  fullTranscription = ""
): PlaybackSegment[] {
  if (totalDurationSeconds <= 0) {
    return [];
  }

  const segments: PlaybackSegment[] = [];

  for (let start = 0; start < totalDurationSeconds; start += windowSeconds) {
    const end = Math.min(start + windowSeconds, totalDurationSeconds);
    segments.push({
      start,
      end,
      text: sliceTranscriptionByTimeRange(fullTranscription, totalDurationSeconds, start, end)
    });
  }

  return segments;
}

export function textForTimeRange(
  segments: WhisperSegment[],
  startSeconds: number,
  endSeconds: number
): string {
  return segments
    .filter((segment) => segment.end > startSeconds && segment.start < endSeconds)
    .map((segment) => (segment.text ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function getExpectedTextForSegment(
  whisperSegments: WhisperSegment[] | undefined,
  segmentIndex: number,
  segmentsPerClip: number,
  playbackSegment: PlaybackSegment | undefined,
  options?: {
    fullTranscription?: string;
    totalDurationSeconds?: number | null;
  }
): string {
  const directText = playbackSegment?.text?.trim();
  if (directText) {
    return directText;
  }

  if (whisperSegments?.length && playbackSegment) {
    const clipIndex = clipIndexFromWhisperSegment(segmentIndex, segmentsPerClip);
    const groupedText = groupWhisperSegments(whisperSegments, segmentsPerClip)[clipIndex]?.text?.trim();
    if (groupedText) {
      return groupedText;
    }

    return textForTimeRange(whisperSegments, playbackSegment.start, playbackSegment.end);
  }

  const fullTranscription = options?.fullTranscription?.trim();
  const totalDurationSeconds = options?.totalDurationSeconds;
  if (fullTranscription && playbackSegment && totalDurationSeconds && totalDurationSeconds > 0) {
    return sliceTranscriptionByTimeRange(
      fullTranscription,
      totalDurationSeconds,
      playbackSegment.start,
      playbackSegment.end
    );
  }

  return "";
}

export function groupWhisperSegments(
  segments: WhisperSegment[],
  segmentsPerClip: number
): PlaybackSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const clipSize = clampSegmentsPerClip(segmentsPerClip);
  const playbackSegments: PlaybackSegment[] = [];

  for (let index = 0; index < segments.length; index += clipSize) {
    const group = segments.slice(index, index + clipSize);
    playbackSegments.push({
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group
        .map((segment) => (segment.text ?? "").trim())
        .filter(Boolean)
        .join(" ")
    });
  }

  return playbackSegments;
}
