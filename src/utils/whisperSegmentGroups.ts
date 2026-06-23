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

export function clampSegmentsPerClip(count: number): number {
  return Math.min(MAX_SEGMENTS_PER_CLIP, Math.max(MIN_SEGMENTS_PER_CLIP, Math.round(count)));
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
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" ")
    });
  }

  return playbackSegments;
}
