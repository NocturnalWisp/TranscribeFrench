import { useEffect, useState } from "react";
import { Alert, AlertIcon, Box, Flex } from "@chakra-ui/react";
import { AppHeader } from "./components/AppHeader";
import { AudioControls } from "./components/AudioControls";
import { GradeResults } from "./components/GradeResults";
import { TranscriptionEditor } from "./components/TranscriptionEditor";
import { useAudioSegmentPlayer } from "./hooks/useAudioSegmentPlayer";
import { loadExercise as fetchExercise } from "./services/exercises";
import { gradeTranscription } from "./utils/grading";
import type { AudioExercise, GradeResult } from "./types";

function App() {
  const [exercise, setExercise] = useState<AudioExercise | null>(null);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transcriptionInput, setTranscriptionInput] = useState("");
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);

  const audio = useAudioSegmentPlayer({
    exercise,
    onPlaybackError: (message) => setLoadError(message)
  });

  const loadExercise = async () => {
    setLoadingExercise(true);
    setLoadError(null);
    setGradeResult(null);
    setTranscriptionInput("");
    audio.resetSegment();

    try {
      const nextExercise = await fetchExercise();
      setExercise(nextExercise);
    } catch {
      setLoadError("Unable to load an exercise.");
      setExercise(null);
    } finally {
      setLoadingExercise(false);
    }
  };

  const runGrading = () => {
    const expectedText = audio.currentSegmentText || exercise?.expectedTranscription;
    if (!expectedText) return;
    setGradeResult(gradeTranscription(expectedText, transcriptionInput));
  };

  const handleTranscriptionChange = (value: string) => {
    setTranscriptionInput(value);
    if (gradeResult) {
      setGradeResult(null);
    }
  };

  const resetTranscriptionForNewClip = () => {
    setTranscriptionInput("");
    setGradeResult(null);
  };

  const handlePreviousSegment = () => {
    audio.goPreviousSegment();
    resetTranscriptionForNewClip();
  };

  const handleNextSegment = () => {
    audio.goNextSegment();
    resetTranscriptionForNewClip();
  };

  const handleSegmentsPerClipChange = (count: number) => {
    audio.setSegmentsPerClip(count);
    resetTranscriptionForNewClip();
  };

  useEffect(() => {
    void loadExercise();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segmentLabel =
    audio.currentSegmentText.trim().length > 0
      ? `Clip ${audio.safeSegmentIndex + 1} results`
      : "Results";

  return (
    <Flex
      direction="column"
      minH="100dvh"
      maxW={{ base: "100%", md: "640px" }}
      mx="auto"
      bg="gray.50"
    >
      <AppHeader
        title={exercise?.title ?? "Loading exercise…"}
        subtitle="French audio transcription"
        onReload={loadExercise}
        isLoading={loadingExercise}
      />

      {loadError ? (
        <Alert status="warning" borderRadius={0}>
          <AlertIcon />
          {loadError}
        </Alert>
      ) : null}

      <AudioControls
        audioRef={audio.audioRef}
        isPlayingSegment={audio.isPlayingSegment}
        segmentStartSeconds={audio.segmentStartSeconds}
        currentSegmentEndSeconds={audio.currentSegmentEndSeconds}
        totalDurationSeconds={audio.totalDurationSeconds}
        segmentsPerClip={audio.segmentsPerClip}
        canGoPrevious={audio.canGoPrevious}
        canGoNext={audio.canGoNext}
        segmentProgressPercent={audio.segmentProgressPercent}
        hasExercise={Boolean(exercise)}
        onPlaySegment={audio.playSegment}
        onPreviousSegment={handlePreviousSegment}
        onNextSegment={handleNextSegment}
        onSegmentsPerClipChange={handleSegmentsPerClipChange}
        onLoadedMetadata={audio.onLoadedMetadata}
        onPause={audio.onPause}
        onPlay={audio.onPlay}
      />

      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        minH={0}
        overflowY="auto"
        pb="env(safe-area-inset-bottom, 0px)"
      >
        <TranscriptionEditor
          value={transcriptionInput}
          onChange={handleTranscriptionChange}
          onGrade={runGrading}
          canGrade={Boolean(exercise) && Boolean(transcriptionInput.trim())}
          gradedWords={gradeResult?.gradedWords}
        />

        {gradeResult ? (
          <GradeResults
            result={gradeResult}
            referenceTranscription={audio.currentSegmentText || exercise?.expectedTranscription || ""}
            segmentLabel={segmentLabel}
          />
        ) : null}
      </Box>
    </Flex>
  );
}

export default App;
