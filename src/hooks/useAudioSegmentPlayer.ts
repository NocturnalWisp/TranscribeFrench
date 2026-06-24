import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioExercise } from "../types";
import {
  buildTimedPlaybackSegments,
  clampSegmentsPerClip,
  DEFAULT_PLAYBACK_WINDOW_SECONDS,
  DEFAULT_SEGMENTS_PER_CLIP,
  getExpectedTextForSegment,
  groupWhisperSegments
} from "../utils/whisperSegmentGroups";

const DEFAULT_PLAYBACK_SECONDS = DEFAULT_PLAYBACK_WINDOW_SECONDS;

const isAudioElementReady = (audioElement: HTMLAudioElement): boolean =>
  audioElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

type UseAudioSegmentPlayerOptions = {
  exercise: AudioExercise | null;
  onPlaybackError: (message: string) => void;
};

export function useAudioSegmentPlayer({ exercise, onPlaybackError }: UseAudioSegmentPlayerOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseWatcherRef = useRef<number | null>(null);
  const pendingPlayListenerRef = useRef<(() => void) | null>(null);

  const [isPlayingSegment, setIsPlayingSegment] = useState(false);
  const [isAudioBuffering, setIsAudioBuffering] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentsPerClip, setSegmentsPerClip] = useState(DEFAULT_SEGMENTS_PER_CLIP);
  const [resolvedDurationSeconds, setResolvedDurationSeconds] = useState<number | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);

  const totalDurationSeconds = useMemo(
    () => resolvedDurationSeconds ?? exercise?.durationSeconds ?? null,
    [exercise?.durationSeconds, resolvedDurationSeconds]
  );

  const playbackSegments = useMemo(() => {
    if (exercise?.whisperSegments?.length) {
      return groupWhisperSegments(exercise.whisperSegments, segmentsPerClip);
    }

    if (totalDurationSeconds !== null && totalDurationSeconds > 0) {
      return buildTimedPlaybackSegments(
        totalDurationSeconds,
        DEFAULT_PLAYBACK_WINDOW_SECONDS,
        exercise?.expectedTranscription ?? ""
      );
    }

    if (exercise?.audioUrl) {
      return buildTimedPlaybackSegments(
        DEFAULT_PLAYBACK_SECONDS,
        DEFAULT_PLAYBACK_SECONDS,
        exercise.expectedTranscription ?? ""
      );
    }

    return [];
  }, [exercise, segmentsPerClip, totalDurationSeconds]);

  const safeSegmentIndex =
    playbackSegments.length === 0 ? 0 : Math.min(segmentIndex, playbackSegments.length - 1);

  const currentPlaybackSegment = playbackSegments[safeSegmentIndex];
  const segmentStartSeconds = currentPlaybackSegment?.start ?? 0;
  const currentSegmentEndSeconds =
    currentPlaybackSegment?.end ??
    segmentStartSeconds + (totalDurationSeconds ?? segmentsPerClip ?? DEFAULT_PLAYBACK_SECONDS);
  const currentSegmentText = useMemo(
    () =>
      getExpectedTextForSegment(
        exercise?.whisperSegments,
        safeSegmentIndex,
        segmentsPerClip,
        currentPlaybackSegment,
        {
          fullTranscription: exercise?.expectedTranscription,
          totalDurationSeconds
        }
      ),
    [
      currentPlaybackSegment,
      exercise?.expectedTranscription,
      exercise?.whisperSegments,
      safeSegmentIndex,
      segmentsPerClip,
      totalDurationSeconds
    ]
  );

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

  const clearPendingPlayListener = () => {
    const audioElement = audioRef.current;
    if (pendingPlayListenerRef.current && audioElement) {
      audioElement.removeEventListener("canplay", pendingPlayListenerRef.current);
      audioElement.removeEventListener("loadeddata", pendingPlayListenerRef.current);
      pendingPlayListenerRef.current = null;
    }
  };

  const pauseAudio = () => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    setIsPlayingSegment(false);
    setIsAudioBuffering(false);
    clearPauseWatcher();
    clearPendingPlayListener();
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

  const playSegment = () => {
    if (!exercise || !audioRef.current) {
      return;
    }

    if (!currentPlaybackSegment) {
      onPlaybackError("Exercise data is still loading. Wait a moment and try again.");
      return;
    }

    const audioElement = audioRef.current;
    const segmentEndSeconds = currentSegmentEndSeconds;
    const startSeconds = segmentStartSeconds;

    clearPendingPlayListener();

    const startPlaybackAtSegment = () => {
      clearPendingPlayListener();
      setIsAudioBuffering(false);
      audioElement.currentTime = startSeconds;
      void audioElement
        .play()
        .then(() => {
          setIsAudioReady(true);
          setIsPlayingSegment(true);
          watchForSegmentBoundary(segmentEndSeconds);
        })
        .catch(() => {
          onPlaybackError("Unable to play audio. Verify the clip URL and browser permissions.");
        });
    };

    if (isAudioElementReady(audioElement)) {
      startPlaybackAtSegment();
      return;
    }

    // Many phones block media preload until the user taps — start loading now.
    setIsAudioBuffering(true);

    const onMediaReady = () => {
      if (!isAudioElementReady(audioElement)) {
        return;
      }

      startPlaybackAtSegment();
    };

    pendingPlayListenerRef.current = onMediaReady;
    audioElement.addEventListener("canplay", onMediaReady);
    audioElement.addEventListener("loadeddata", onMediaReady);
    audioElement.load();

    // Must call play() synchronously inside the tap handler on Android.
    void audioElement.play().catch(() => {
      // Expected while buffering; the canplay handler starts the segment.
    });
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

  const goToSegment = (index: number) => {
    if (index < 0 || index >= playbackSegments.length || index === safeSegmentIndex) {
      return;
    }

    pauseAudio();
    setSegmentIndex(index);
  };

  const resetSegment = () => {
    pauseAudio();
    setSegmentIndex(0);
    setResolvedDurationSeconds(null);
    setIsAudioReady(false);
    setIsAudioBuffering(false);
  };

  const updateSegmentsPerClip = (count: number) => {
    pauseAudio();
    setSegmentsPerClip(clampSegmentsPerClip(count));
    setSegmentIndex(0);
  };

  const restorePlaybackState = (state: { segmentIndex: number; segmentsPerClip: number }) => {
    pauseAudio();
    setSegmentsPerClip(clampSegmentsPerClip(state.segmentsPerClip));
    setSegmentIndex(Math.max(0, Math.round(state.segmentIndex)));
  };

  useEffect(() => {
    setIsAudioReady(false);

    const audioElement = audioRef.current;
    if (audioElement && isAudioElementReady(audioElement)) {
      setIsAudioReady(true);
    }
  }, [exercise?.audioUrl, exercise?.id]);

  useEffect(() => {
    return () => {
      clearPauseWatcher();
      clearPendingPlayListener();
    };
  }, []);

  return {
    audioRef,
    audioUrl: exercise?.audioUrl,
    isAudioReady,
    isAudioBuffering,
    isPlayingSegment,
    segmentStartSeconds,
    currentSegmentEndSeconds,
    currentSegmentText,
    safeSegmentIndex,
    totalDurationSeconds,
    segmentsPerClip,
    canGoPrevious,
    canGoNext,
    segmentCount: playbackSegments.length,
    segmentProgressPercent,
    playSegment,
    goNextSegment,
    goPreviousSegment,
    goToSegment,
    pauseAudio,
    resetSegment,
    restorePlaybackState,
    setSegmentsPerClip: updateSegmentsPerClip,
    onLoadedMetadata: (duration: number) => {
      if (!Number.isFinite(duration)) return;
      setResolvedDurationSeconds(duration);
    },
    onCanPlay: () => setIsAudioReady(true),
    onAudioError: () => {
      setIsAudioReady(false);
      setIsAudioBuffering(false);
      clearPendingPlayListener();
      onPlaybackError("Unable to load audio. Check your connection and try again.");
    },
    onPause: () => setIsPlayingSegment(false),
    onPlay: () => setIsPlayingSegment(true)
  };
}
