import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Alert, AlertIcon, Box, Flex, Spinner } from "@chakra-ui/react";
import { keepKeyboardOpen } from "./utils/keepKeyboardOpen";
import { AppHeader } from "./components/AppHeader";
import { AudioControls } from "./components/AudioControls";
import { AuthGate } from "./components/AuthGate";
import { TranscriptionEditor } from "./components/TranscriptionEditor";
import { useAudioSegmentPlayer } from "./hooks/useAudioSegmentPlayer";
import { useAuth } from "./hooks/useAuth";
import { signOutUser } from "./services/auth";
import { loadExercise as fetchExercise, loadExerciseById } from "./services/exercises";
import { getUserSessionState, saveUserSessionState } from "./services/userSession";
import { gradeTranscription } from "./utils/grading";
import type { AudioExercise, GradeResult } from "./types";
import type { UserSessionState } from "./types/auth";

function App() {
  const { user, authReady, accessMode, setAccessMode, clearAccess, isTrial, hasAccess } =
    useAuth();
  const [exercise, setExercise] = useState<AudioExercise | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingExercise, setIsLoadingExercise] = useState(false);
  const [transcriptionInput, setTranscriptionInput] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [gradedSubmission, setGradedSubmission] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const restoredAccessRef = useRef(false);
  const keepKeyboardOpenRef = useRef(false);
  const isGradedRef = useRef(false);
  const pendingSessionRestoreRef = useRef<UserSessionState | null>(null);
  const [isSessionRestored, setIsSessionRestored] = useState(false);

  const audio = useAudioSegmentPlayer({
    exercise,
    onPlaybackError: (message) => setLoadError(message)
  });

  const loadExercise = async (mode: NonNullable<typeof accessMode>) => {
    setIsLoadingExercise(true);
    setLoadError(null);
    setGradeResult(null);
    setGradedSubmission("");
    setTranscriptionInput("");
    audio.resetSegment();
    setIsSessionRestored(false);
    pendingSessionRestoreRef.current = null;

    try {
      let nextExercise: AudioExercise | null = null;

      if (mode === "full" && user) {
        const session = await getUserSessionState(user.uid);
        if (session?.exerciseId) {
          nextExercise = await loadExerciseById(session.exerciseId);
          if (nextExercise) {
            pendingSessionRestoreRef.current = session;
          }
        }
      }

      if (!nextExercise) {
        nextExercise = await fetchExercise(mode);
      }

      setExercise(nextExercise);
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

  const runGrading = () => {
    const expectedText = audio.currentSegmentText.trim();
    if (!expectedText) {
      setLoadError("Segment transcript is not available yet. Try another segment or reload.");
      return;
    }
    setLoadError(null);
    setGradedSubmission(transcriptionInput);
    setGradeResult(gradeTranscription(expectedText, transcriptionInput));
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
      focusTranscriptionForEditing();
      return;
    }
    runGrading();
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const resetTranscriptionForNewClip = () => {
    setTranscriptionInput("");
    setGradeResult(null);
    setGradedSubmission("");
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
    restoredAccessRef.current = false;
    clearAccess();
    setExercise(null);
    setLoadError(null);
    setGradeResult(null);
    setGradedSubmission("");
    setTranscriptionInput("");
    audio.resetSegment();
  };

  const beginSession = async (mode: NonNullable<typeof accessMode>) => {
    restoredAccessRef.current = true;
    setAccessMode(mode);
    await loadExercise(mode);
  };

  useEffect(() => {
    if (!authReady || !hasAccess || !accessMode || restoredAccessRef.current) {
      return;
    }

    restoredAccessRef.current = true;
    void loadExercise(accessMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, hasAccess, accessMode, user?.uid]);

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

  if (!authReady) {
    return (
      <Flex minH="100dvh" align="center" justify="center" bg="gray.50">
        <Spinner size="lg" color="teal.500" />
      </Flex>
    );
  }

  if (!hasAccess) {
    return <AuthGate onSelectAccessMode={beginSession} />;
  }

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
        />
      </Box>
    </Flex>
  );
}

export default App;
