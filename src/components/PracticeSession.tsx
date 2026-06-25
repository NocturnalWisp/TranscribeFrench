import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { User } from "firebase/auth";
import { Alert, AlertIcon, Box, Flex, useToast } from "@chakra-ui/react";
import { keepKeyboardOpen } from "../utils/keepKeyboardOpen";
import { AppHeader } from "./AppHeader";
import { AudioControls } from "./AudioControls";
import {
  MissedSentencesPanel,
  PracticeStatusBar,
  type GradeHighlight
} from "./SegmentProgressBar";
import { TranscriptionEditor } from "./TranscriptionEditor";
import { IncorrectTranslationReportModal } from "./IncorrectTranslationReportModal";
import { useAudioSegmentPlayer } from "../hooks/useAudioSegmentPlayer";
import { signOutUser } from "../services/authActions";
import {
  listExerciseCatalog,
  loadExercise as fetchExercise,
  loadExerciseById
} from "../services/exercises";
import {
  buildMissedWordUpdates,
  getMissedWords,
  mergeExerciseProgressState,
  saveGradeProgress,
  subscribeAllExerciseProgress,
  subscribeDailyStats
} from "../services/userProgress";
import { getUserSessionState, saveUserSessionState } from "../services/userSession";
import { reportIncorrectTranslation } from "../services/supportReports";
import { getLocalDateKey } from "../utils/dateKey";
import { computeDailyStatsUpdate } from "../utils/dailyStats";
import {
  countExpectedWords,
  extractMissedExpectedWords,
  gradeTranscription
} from "../utils/grading";
import { pickRandomSegmentClipIndex } from "../utils/randomSegment";
import {
  computeUpdatedSegmentProgress,
  canBeatHighScoreToday,
  segmentProgressKey
} from "../utils/segmentProgress";
import { snapToClipStart } from "../utils/whisperSegmentGroups";
import type { AudioExercise, ExerciseSummary, GradeResult } from "../types";
import type {
  DailyStats,
  ExerciseProgress,
  MissedSegmentRef,
  MissedWordEntry
} from "../types/progress";
import type { AccessMode, UserSessionState } from "../types/auth";

type PracticeSessionProps = {
  user: User | null;
  accessMode: AccessMode;
  isTrial: boolean;
  onLeave: () => void;
};

export default function PracticeSession({
  user,
  accessMode,
  isTrial,
  onLeave
}: PracticeSessionProps) {
  const [exercise, setExercise] = useState<AudioExercise | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingExercise, setIsLoadingExercise] = useState(false);
  const [transcriptionInput, setTranscriptionInput] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [gradedSubmission, setGradedSubmission] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keepKeyboardOpenRef = useRef(false);
  const isGradedRef = useRef(false);
  const pendingSessionRestoreRef = useRef<UserSessionState | null>(null);
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const [exerciseCatalog, setExerciseCatalog] = useState<ExerciseSummary[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [allExerciseProgress, setAllExerciseProgress] = useState<Record<string, ExerciseProgress>>(
    {}
  );
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
  const [missedWords, setMissedWords] = useState<Record<string, MissedWordEntry>>({});
  const [gradeHighlight, setGradeHighlight] = useState<GradeHighlight>(null);
  const [isMissedListOpen, setIsMissedListOpen] = useState(false);
  const [reportWord, setReportWord] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const toast = useToast();

  const audio = useAudioSegmentPlayer({
    exercise,
    onPlaybackError: (message) => setLoadError(message)
  });

  const loadExercise = async (
    mode: NonNullable<AccessMode>,
    options?: {
      preferredExerciseId?: string | null;
      catalog?: ExerciseSummary[];
    }
  ) => {
    const catalog = options?.catalog ?? exerciseCatalog;
    const preferredExerciseId = options?.preferredExerciseId;
    setIsLoadingExercise(true);
    setLoadError(null);
    setGradeResult(null);
    setGradedSubmission("");
    setTranscriptionInput("");
    setIsMissedListOpen(false);
    audio.resetSegment();
    setIsSessionRestored(false);
    pendingSessionRestoreRef.current = null;

    try {
      let nextExercise: AudioExercise | null = null;
      let sessionToRestore: UserSessionState | null = null;
      let exerciseId = preferredExerciseId?.trim() || null;

      if (mode === "full" && user) {
        if (!exerciseId) {
          const session = await getUserSessionState(user.uid);
          if (session?.exerciseId) {
            exerciseId = session.exerciseId;
            sessionToRestore = session;
          }
        }

        if (!exerciseId && catalog.length > 0) {
          exerciseId = catalog[0].id;
        }
      }

      if (exerciseId) {
        nextExercise = await loadExerciseById(exerciseId);
        if (nextExercise && sessionToRestore?.exerciseId === nextExercise.id) {
          pendingSessionRestoreRef.current = sessionToRestore;
        }
      }

      if (!nextExercise) {
        nextExercise = await fetchExercise(mode, exerciseId ?? undefined);
      }

      setExercise(nextExercise);

      if (mode === "full" && user && nextExercise && !sessionToRestore) {
        await saveUserSessionState(user.uid, {
          exerciseId: nextExercise.id,
          segmentIndex: 0,
          segmentsPerClip: 1,
          transcriptionInput: ""
        });
      }
    } catch {
      setLoadError(
        mode === "trial"
          ? "Unable to load the trial exercise."
          : "Unable to load an exercise."
      );
      setExercise(null);
    } finally {
      setIsLoadingExercise(false);
    }
  };

  const handleExerciseSelect = async (exerciseId: string) => {
    if (!user || isTrial || exercise?.id === exerciseId) {
      return;
    }

    setIsLoadingExercise(true);
    setLoadError(null);
    setGradeResult(null);
    setGradedSubmission("");
    setTranscriptionInput("");
    audio.pauseAudio();
    audio.resetSegment();
    setIsSessionRestored(false);
    pendingSessionRestoreRef.current = null;

    try {
      const nextExercise = await loadExerciseById(exerciseId);
      if (!nextExercise) {
        setLoadError("Unable to load the selected exercise.");
        return;
      }

      setExercise(nextExercise);
      setIsMissedListOpen(false);
      await saveUserSessionState(user.uid, {
        exerciseId: nextExercise.id,
        segmentIndex: 0,
        segmentsPerClip: 1,
        transcriptionInput: ""
      });
      setIsSessionRestored(true);
    } catch {
      setLoadError("Unable to load the selected exercise.");
    } finally {
      setIsLoadingExercise(false);
    }
  };

  const runGrading = async () => {
    const expectedText = audio.currentSegmentText.trim();
    if (!expectedText) {
      setLoadError("Segment transcript is not available yet. Try another segment or reload.");
      return;
    }
    setLoadError(null);
    setGradedSubmission(transcriptionInput);
    const result = gradeTranscription(expectedText, transcriptionInput);
    setGradeResult(result);

    const progressClipIndex = audio.progressClipIndex;
    const segmentKey = segmentProgressKey(progressClipIndex, audio.segmentsPerClip);
    const exerciseId = exercise?.id;
    const priorProgress =
      exerciseId ? (allExerciseProgress[exerciseId]?.segments[segmentKey] ?? null) : null;
    const today = getLocalDateKey();
    const isFirstGradeOfDay = !priorProgress || priorProgress.lastFirstGradeDate !== today;

    if (!priorProgress) {
      setGradeHighlight("first_completion");
    } else if (!isFirstGradeOfDay) {
      setGradeHighlight(null);
    } else if (result.score > priorProgress.highScore) {
      setGradeHighlight("beat_high_score");
    } else if (result.score === priorProgress.highScore) {
      setGradeHighlight("matched_high_score");
    } else {
      setGradeHighlight("below_high_score");
    }

    if (!user || !exercise || !exerciseId || isTrial) {
      return;
    }

    const updatedSegmentProgress = computeUpdatedSegmentProgress(priorProgress, result.score, today);
    const expectedWordCount = countExpectedWords(expectedText);
    const missedExpectedWords = extractMissedExpectedWords(expectedText, transcriptionInput);
    const missedWordCount = missedExpectedWords.length;
    const nextDailyStats = computeDailyStatsUpdate(dailyStats, expectedWordCount, missedWordCount, today);
    const missedWordUpdates = buildMissedWordUpdates(missedWords, missedExpectedWords);
    const segmentFailed = missedWordCount >= 1;
    const missedSentenceUpdates: Array<{
      key: string;
      value: {
        segmentIndex: number;
        segmentsPerClip: number;
        missedWordCount: number;
        updatedAt: number;
      } | null;
    }> = [
      {
        key: segmentKey,
        value: segmentFailed
          ? {
              segmentIndex: progressClipIndex,
              segmentsPerClip: audio.segmentsPerClip,
              missedWordCount,
              updatedAt: Date.now()
            }
          : null
      }
    ];

    const legacyPrefix = `${progressClipIndex}_${audio.segmentsPerClip}_`;
    for (const key of Object.keys(allExerciseProgress[exerciseId]?.missedSentences ?? {})) {
      if (key.startsWith(legacyPrefix) && key !== segmentKey) {
        missedSentenceUpdates.push({ key, value: null });
      }
    }

    const nextExerciseProgress: ExerciseProgress = {
      segments: {
        ...(allExerciseProgress[exerciseId]?.segments ?? {}),
        [segmentKey]: updatedSegmentProgress
      },
      missedSentences: { ...(allExerciseProgress[exerciseId]?.missedSentences ?? {}) }
    };

    for (const update of missedSentenceUpdates) {
      if (update.value) {
        nextExerciseProgress.missedSentences[update.key] = update.value;
      } else {
        delete nextExerciseProgress.missedSentences[update.key];
      }
    }

    setAllExerciseProgress((current) => ({
      ...current,
      [exerciseId]: nextExerciseProgress
    }));
    setDailyStats(nextDailyStats);
    if (missedWordUpdates.length > 0) {
      setMissedWords((current) => {
        const next = { ...current };
        for (const update of missedWordUpdates) {
          next[update.normalized] = update.entry;
        }
        return next;
      });
    }

    try {
      await saveGradeProgress(user.uid, exerciseId, {
        segmentKey,
        segmentProgress: updatedSegmentProgress,
        missedSentenceUpdates,
        dailyStats: nextDailyStats,
        missedWordUpdates
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save your progress.";
      setLoadError(message);
    }
  };

  const handleTranscriptionChange = (value: string) => {
    if (isGradedRef.current) {
      return;
    }
    setTranscriptionInput(value);
  };

  const focusTranscriptionForEditing = () => {
    keepKeyboardOpenRef.current = true;
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const handleTranscriptionFocus = () => {
    keepKeyboardOpenRef.current = true;
  };

  const handleTranscriptionBlur = () => {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea || !keepKeyboardOpenRef.current) {
        return;
      }

      const active = document.activeElement;
      const movedToOtherField =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (movedToOtherField && active !== textarea) {
        keepKeyboardOpenRef.current = false;
        return;
      }

      textarea.focus({ preventScroll: true });
    });
  };

  const handleKeepKeyboardPointerDown = (event: PointerEvent) => {
    if (!keepKeyboardOpenRef.current || isGradedRef.current) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, button, a, [role='slider']")) {
      return;
    }

    keepKeyboardOpen(event);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleGradeOrRetry = () => {
    if (gradeResult) {
      setGradeResult(null);
      setGradedSubmission("");
      setTranscriptionInput("");
      setGradeHighlight(null);
      focusTranscriptionForEditing();
      return;
    }
    void runGrading();
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const resetTranscriptionForNewClip = () => {
    setTranscriptionInput("");
    setGradeResult(null);
    setGradedSubmission("");
    setGradeHighlight(null);
  };

  const handlePreviousSegment = () => {
    audio.goPreviousSegment();
    resetTranscriptionForNewClip();
    focusTranscriptionForEditing();
  };

  const handleNextSegment = () => {
    audio.goNextSegment();
    resetTranscriptionForNewClip();
    focusTranscriptionForEditing();
  };

  const handleSelectSegment = (index: number) => {
    audio.goToSegment(index);
    resetTranscriptionForNewClip();
    focusTranscriptionForEditing();
  };

  const handleNavigateToMissedSegment = async (
    exerciseId: string,
    segmentIndex: number,
    segmentsPerClip: number
  ) => {
    if (!user || isTrial) {
      return;
    }

    if (exercise?.id !== exerciseId) {
      setIsLoadingExercise(true);
      setLoadError(null);
      setGradeResult(null);
      setGradedSubmission("");
      setTranscriptionInput("");
      audio.pauseAudio();
      setIsSessionRestored(false);

      try {
        const nextExercise = await loadExerciseById(exerciseId);
        if (!nextExercise) {
          setLoadError("Unable to load the selected exercise.");
          return;
        }

        pendingSessionRestoreRef.current = {
          exerciseId: nextExercise.id,
          segmentIndex,
          segmentsPerClip,
          transcriptionInput: ""
        };
        setExercise(nextExercise);
        await saveUserSessionState(user.uid, {
          exerciseId: nextExercise.id,
          segmentIndex,
          segmentsPerClip,
          transcriptionInput: ""
        });
      } catch {
        setLoadError("Unable to load the selected exercise.");
      } finally {
        setIsLoadingExercise(false);
      }

      return;
    }

    audio.restorePlaybackState({ segmentIndex, segmentsPerClip });
    resetTranscriptionForNewClip();
    focusTranscriptionForEditing();
  };

  const handleSegmentsPerClipChange = (count: number) => {
    audio.setSegmentsPerClip(count);
    resetTranscriptionForNewClip();
    focusTranscriptionForEditing();
  };

  const handleLeaveSession = async () => {
    if (user) {
      await signOutUser();
    }

    audio.pauseAudio();
    onLeave();
  };

  useEffect(() => {
    const restoreSession = async () => {
      let catalog: ExerciseSummary[] = [];
      if (accessMode === "full") {
        setIsLoadingCatalog(true);
        try {
          catalog = await listExerciseCatalog();
          setExerciseCatalog(catalog);
        } catch {
          setExerciseCatalog([]);
          setLoadError("Unable to load the exercise list.");
        } finally {
          setIsLoadingCatalog(false);
        }
      }

      await loadExercise(accessMode, { catalog });
    };

    void restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessMode, user?.uid]);

  useEffect(() => {
    if (!user || isTrial) {
      setAllExerciseProgress({});
      setDailyStats(null);
      setMissedWords({});
      return;
    }

    let cancelled = false;

    const loadMissedWords = async () => {
      const words = await getMissedWords(user.uid);
      if (!cancelled) {
        setMissedWords(words);
      }
    };

    void loadMissedWords();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, isTrial]);

  useEffect(() => {
    if (!user || isTrial) {
      setAllExerciseProgress({});
      return;
    }

    const unsubscribe = subscribeAllExerciseProgress(user.uid, (progressByExercise) => {
      setAllExerciseProgress((current) => mergeExerciseProgressState(current, progressByExercise));
    });

    return unsubscribe;
  }, [user?.uid, isTrial]);

  useEffect(() => {
    if (!user || isTrial) {
      setDailyStats(null);
      return;
    }

    const today = getLocalDateKey();
    const unsubscribe = subscribeDailyStats(user.uid, today, (stats) => {
      setDailyStats(stats);
    });

    return unsubscribe;
  }, [user?.uid, isTrial]);

  useEffect(() => {
    if (!exercise) {
      return;
    }

    const pendingSession = pendingSessionRestoreRef.current;
    if (!pendingSession || pendingSession.exerciseId !== exercise.id) {
      setIsSessionRestored(true);
      return;
    }

    pendingSessionRestoreRef.current = null;
    audio.restorePlaybackState({
      segmentIndex: pendingSession.segmentIndex,
      segmentsPerClip: pendingSession.segmentsPerClip
    });
    setTranscriptionInput(pendingSession.transcriptionInput);
    setIsSessionRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  useEffect(() => {
    if (!user || !exercise || isTrial || !isSessionRestored) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveUserSessionState(user.uid, {
        exerciseId: exercise.id,
        segmentIndex: audio.safeSegmentIndex,
        segmentsPerClip: audio.segmentsPerClip,
        transcriptionInput
      });
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    user?.uid,
    exercise?.id,
    audio.safeSegmentIndex,
    audio.segmentsPerClip,
    transcriptionInput,
    isTrial,
    isSessionRestored
  ]);

  const isGraded = Boolean(gradeResult);
  isGradedRef.current = isGraded;

  const exerciseProgress = useMemo(
    () => (exercise?.id ? (allExerciseProgress[exercise.id] ?? null) : null),
    [allExerciseProgress, exercise?.id]
  );

  const handleRandomSegment = () => {
    const clipIndex = pickRandomSegmentClipIndex({
      clipCount: audio.clipCount,
      currentClipIndex: audio.progressClipIndex,
      segmentsPerClip: audio.segmentsPerClip,
      exerciseProgress
    });

    if (clipIndex === null) {
      return;
    }

    const hasWhisperSegments = Boolean(exercise?.whisperSegments?.length);
    const segmentIndex = hasWhisperSegments
      ? snapToClipStart(clipIndex * audio.segmentsPerClip, audio.segmentsPerClip)
      : clipIndex;
    handleSelectSegment(segmentIndex);
  };

  const currentSegmentProgress = useMemo(() => {
    if (!exerciseProgress) {
      return null;
    }

    const key = segmentProgressKey(audio.progressClipIndex, audio.segmentsPerClip);
    return exerciseProgress.segments[key] ?? null;
  }, [exerciseProgress, audio.progressClipIndex, audio.segmentsPerClip]);

  const missedSegments = useMemo((): MissedSegmentRef[] => {
    const today = getLocalDateKey();
    const titleByExerciseId = new Map(exerciseCatalog.map((entry) => [entry.id, entry.title]));
    const items: MissedSegmentRef[] = [];

    for (const [exerciseId, progress] of Object.entries(allExerciseProgress)) {
      const exerciseTitle = titleByExerciseId.get(exerciseId) ?? "Audio clip";

      for (const [id, segment] of Object.entries(progress.missedSentences)) {
        const segmentKey = segmentProgressKey(segment.segmentIndex, segment.segmentsPerClip);
        const segmentProgress = progress.segments[segmentKey] ?? null;
        const isReadyToRetry = segmentProgress
          ? canBeatHighScoreToday(segmentProgress, today)
          : true;

        items.push({
          id: `${exerciseId}_${id}`,
          exerciseId,
          exerciseTitle,
          segmentIndex: segment.segmentIndex,
          segmentsPerClip: segment.segmentsPerClip,
          isReadyToRetry
        });
      }
    }

    return items.sort((left, right) => {
      if (left.exerciseTitle !== right.exerciseTitle) {
        return left.exerciseTitle.localeCompare(right.exerciseTitle);
      }

      return left.segmentIndex - right.segmentIndex;
    });
  }, [allExerciseProgress, exerciseCatalog]);

  const readyToRetryCount = useMemo(
    () => missedSegments.filter((segment) => segment.isReadyToRetry).length,
    [missedSegments]
  );

  const canReportWords = Boolean(user && !isTrial && isGraded && exercise?.audioUrl);

  const handleWordClick = (word: string) => {
    if (!canReportWords) {
      return;
    }

    setReportWord(word);
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    if (isSubmittingReport) {
      return;
    }

    setIsReportModalOpen(false);
    setReportWord(null);
  };

  const handleSubmitIncorrectTranslationReport = async () => {
    if (!reportWord || !exercise?.audioUrl || !user) {
      return;
    }

    setIsSubmittingReport(true);

    try {
      const result = await reportIncorrectTranslation({
        word: reportWord,
        segmentText: audio.currentSegmentText,
        segmentIndex: audio.safeSegmentIndex,
        segmentsPerClip: audio.segmentsPerClip,
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        audioUrl: exercise.audioUrl
      });

      toast({
        title: "Report sent",
        description: result.emailSent
          ? "Thanks — we'll review this translation."
          : "Your report was saved. Email notification is temporarily unavailable.",
        status: result.emailSent ? "success" : "warning",
        duration: 5000,
        isClosable: true
      });
      setIsReportModalOpen(false);
      setReportWord(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send your report right now.";
      toast({
        title: "Report failed",
        description: message,
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <Flex
      direction="column"
      minH="100dvh"
      maxW={{ base: "100%", md: "640px" }}
      mx="auto"
      bg="gray.50"
      onPointerDownCapture={handleKeepKeyboardPointerDown}
    >
      <AppHeader
        title={exercise?.title ?? (isLoadingExercise ? "Loading exercise…" : "Transcribe French")}
        user={user}
        isTrial={isTrial}
        onLeave={() => void handleLeaveSession()}
        exercises={!isTrial && user ? exerciseCatalog : undefined}
        selectedExerciseId={exercise?.id}
        isLoadingExercises={isLoadingCatalog}
        isExerciseLoading={isLoadingExercise}
        onSelectExercise={(exerciseId) => void handleExerciseSelect(exerciseId)}
      />

      {loadError ? (
        <Alert status="warning" borderRadius={0}>
          <AlertIcon />
          {loadError}
        </Alert>
      ) : null}

      <AudioControls
        audioRef={audio.audioRef}
        audioUrl={audio.audioUrl}
        isAudioBuffering={audio.isAudioBuffering}
        isPlayingSegment={audio.isPlayingSegment}
        segmentIndex={audio.safeSegmentIndex}
        segmentCount={audio.segmentCount}
        segmentStartSeconds={audio.segmentStartSeconds}
        currentSegmentEndSeconds={audio.currentSegmentEndSeconds}
        segmentsPerClip={audio.segmentsPerClip}
        canGoPrevious={audio.canGoPrevious}
        canGoNext={audio.canGoNext}
        hasExercise={Boolean(exercise)}
        onPlaySegment={audio.playSegment}
        onStopSegment={audio.pauseAudio}
        onPreviousSegment={handlePreviousSegment}
        onNextSegment={handleNextSegment}
        onSelectSegment={handleSelectSegment}
        onRandomSegment={handleRandomSegment}
        canRandomizeSegment={Boolean(exercise) && audio.clipCount > 1}
        onSegmentsPerClipChange={handleSegmentsPerClipChange}
        onLoadedMetadata={audio.onLoadedMetadata}
        onCanPlay={audio.onCanPlay}
        onAudioError={audio.onAudioError}
        onPause={audio.onPause}
        onPlay={audio.onPlay}
        isGraded={isGraded}
        onGradeOrRetry={handleGradeOrRetry}
        gradeDisabled={!exercise || (!isGraded && !transcriptionInput.trim())}
      />

      <PracticeStatusBar
        isTrial={isTrial}
        progress={currentSegmentProgress}
        dailyStats={dailyStats}
        currentScore={gradeResult?.score ?? null}
        isGraded={isGraded}
        gradeHighlight={gradeHighlight}
        missedSegmentCount={missedSegments.length}
        readyToRetryCount={readyToRetryCount}
        isMissedListOpen={isMissedListOpen}
        onOpenMissedList={() => setIsMissedListOpen(true)}
      />
      {!isTrial ? (
        <MissedSentencesPanel
          isOpen={isMissedListOpen}
          onClose={() => setIsMissedListOpen(false)}
          segments={missedSegments}
          currentExerciseId={exercise?.id}
          currentSegmentIndex={audio.progressClipIndex}
          onNavigate={(exerciseId, segmentIndex, segmentsPerClip) =>
            void handleNavigateToMissedSegment(exerciseId, segmentIndex, segmentsPerClip)
          }
        />
      ) : null}

      <IncorrectTranslationReportModal
        isOpen={isReportModalOpen}
        word={reportWord}
        isSubmitting={isSubmittingReport}
        onClose={handleCloseReportModal}
        onCloseComplete={focusTranscriptionForEditing}
        onSubmit={() => void handleSubmitIncorrectTranslationReport()}
      />

      <Box flex={1} display="flex" flexDirection="column" minH={0} overflow="hidden">
        <TranscriptionEditor
          ref={textareaRef}
          value={transcriptionInput}
          onChange={handleTranscriptionChange}
          onFocus={handleTranscriptionFocus}
          onBlur={handleTranscriptionBlur}
          isGraded={isGraded}
          submittedText={gradedSubmission}
          correctedWords={gradeResult?.correctedWords}
          canReportWords={canReportWords}
          onWordClick={handleWordClick}
        />
      </Box>
    </Flex>
  );
}
