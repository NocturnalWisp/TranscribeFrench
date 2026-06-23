import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioExercise } from "../types";
import {
  clampSegmentsPerClip,
  DEFAULT_SEGMENTS_PER_CLIP,
  groupWhisperSegments
} from "../utils/whisperSegmentGroups";

type UseAudioSegmentPlayerOptions = {
  exercise: AudioExercise | null;
  onPlaybackError: (message: string) => void;
};

export function useAudioSegmentPlayer({ exercise, onPlaybackError }: UseAudioSegmentPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseWatcherRef = useRef<number | null>(null);

  const [isPlayingSegment, setIsPlayingSegment] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentsPerClip, setSegmentsPerClip] = useState(DEFAULT_SEGMENTS_PER_CLIP);
  const [resolvedDurationSeconds, setResolvedDurationSeconds] = useState<number | null>(null);

  const totalDurationSeconds = useMemo(
    () => resolvedDurationSeconds ?? exercise?.durationSeconds ?? null,
    [exercise?.durationSeconds, resolvedDurationSeconds]
  );

  const playbackSegments = useMemo(() => {
    if (exercise?.whisperSegments?.length) {
      return groupWhisperSegments(exercise.whisperSegments, segmentsPerClip);
    }

    if (totalDurationSeconds !== null) {
      return [{ start: 0, end: totalDurationSeconds }];
    }

    return [];
  }, [exercise, segmentsPerClip, totalDurationSeconds]);

  const safeSegmentIndex =
    playbackSegments.length === 0 ? 0 : Math.min(segmentIndex, playbackSegments.length - 1);

  const currentPlaybackSegment = playbackSegments[safeSegmentIndex];
  const segmentStartSeconds = currentPlaybackSegment?.start ?? 0;
  const currentSegmentEndSeconds =
    currentPlaybackSegment?.end ?? segmentStartSeconds + segmentsPerClip;
  const currentSegmentText = currentPlaybackSegment?.text ?? "";

  const canGoPrevious = safeSegmentIndex > 0;
  const canGoNext = safeSegmentIndex < playbackSegments.length - 1;

  const segmentProgressPercent = totalDurationSeconds
    ? (segmentStartSeconds / totalDurationSeconds) * 100
    : 0;

  const clearPauseWatcher = () => {
    if (pauseWatcherRef.current !== null) {
      window.clearInterval(pauseWatcherRef.current);
      pauseWatcherRef.current = null;
    }
  };

  const pauseAudio = () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    setIsPlayingSegment(false);
    clearPauseWatcher();
  };

  const watchForSegmentBoundary = (segmentEndSeconds: number) => {
    clearPauseWatcher();

    pauseWatcherRef.current = window.setInterval(() => {
      const audioElement = audioRef.current;
      if (!audioElement) return;

      if (audioElement.currentTime >= segmentEndSeconds || audioElement.ended) {
        pauseAudio();
      }
    }, 150);
  };

  const playSegment = async () => {
    if (!exercise || !audioRef.current || !currentPlaybackSegment) {
      return;
    }

    const audioElement = audioRef.current;
    const segmentEndSeconds = currentSegmentEndSeconds;
    const resolvedAudioUrl = exercise.audioUrl;

    if (!audioElement.src.endsWith(decodeURI(resolvedAudioUrl))) {
      audioElement.src = resolvedAudioUrl;
    }

    audioElement.currentTime = segmentStartSeconds;

    try {
      await audioElement.play();
      setIsPlayingSegment(true);
      watchForSegmentBoundary(segmentEndSeconds);
    } catch {
      onPlaybackError("Unable to play audio. Verify the clip URL and browser permissions.");
    }
  };

  const goNextSegment = () => {
    if (!canGoNext) return;
    pauseAudio();
    setSegmentIndex((value) => value + 1);
  };

  const goPreviousSegment = () => {
    if (!canGoPrevious) return;
    pauseAudio();
    setSegmentIndex((value) => value - 1);
  };

  const resetSegment = () => {
    pauseAudio();
    setSegmentIndex(0);
    setResolvedDurationSeconds(null);
  };

  const updateSegmentsPerClip = (count: number) => {
    pauseAudio();
    setSegmentsPerClip(clampSegmentsPerClip(count));
    setSegmentIndex(0);
  };

  useEffect(() => {
    return () => {
      clearPauseWatcher();
    };
  }, []);

  return {
    audioRef,
    isPlayingSegment,
    segmentStartSeconds,
    currentSegmentEndSeconds,
    currentSegmentText,
    safeSegmentIndex,
    totalDurationSeconds,
    segmentsPerClip,
    canGoPrevious,
    canGoNext,
    segmentProgressPercent,
    playSegment,
    goNextSegment,
    goPreviousSegment,
    pauseAudio,
    resetSegment,
    setSegmentsPerClip: updateSegmentsPerClip,
    onLoadedMetadata: (duration: number) => {
      if (!Number.isFinite(duration)) return;
      setResolvedDurationSeconds(duration);
    },
    onPause: () => setIsPlayingSegment(false),
    onPlay: () => setIsPlayingSegment(true)
  };
}
