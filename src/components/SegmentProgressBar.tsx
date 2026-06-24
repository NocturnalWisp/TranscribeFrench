import {
  Box,
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack
} from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";
import type { DailyStats, SegmentProgress } from "../types/progress";
import { getLocalDateKey } from "../utils/dateKey";
import { keepKeyboardOpen } from "../utils/keepKeyboardOpen";
import { canBeatHighScoreToday } from "../utils/segmentProgress";

export type GradeHighlight =
  | "first_completion"
  | "beat_high_score"
  | "below_high_score"
  | "matched_high_score"
  | null;

type PracticeStatusBarProps = {
  isTrial: boolean;
  progress: SegmentProgress | null;
  dailyStats: DailyStats | null;
  currentScore?: number | null;
  isGraded: boolean;
  gradeHighlight: GradeHighlight;
  missedSegmentCount: number;
  readyToRetryCount: number;
  isMissedListOpen: boolean;
  onOpenMissedList: () => void;
};

export function PracticeStatusBar({
  isTrial,
  progress,
  dailyStats,
  currentScore,
  isGraded,
  gradeHighlight,
  missedSegmentCount,
  readyToRetryCount,
  isMissedListOpen,
  onOpenMissedList
}: PracticeStatusBarProps) {
  const today = getLocalDateKey();
  const canBeatToday = progress ? canBeatHighScoreToday(progress, today) : false;
  const isPerfectHighScore = (progress?.highScore ?? 0) >= 100;

  let segmentMessage = progress ? null : "No high score yet for this segment";
  if (progress && isGraded && currentScore !== null && currentScore !== undefined) {
    if (gradeHighlight === "first_completion") {
      segmentMessage =
        currentScore >= 100 ? "Perfect score — high score set at 100%" : `High score set: ${currentScore}%`;
    } else if (gradeHighlight === "beat_high_score") {
      segmentMessage = `New high score: ${currentScore}%`;
    } else if (gradeHighlight === "matched_high_score") {
      segmentMessage =
        currentScore >= 100
          ? "Perfect score — matches your high score"
          : `Today's score: ${currentScore}% — matches your high score`;
    } else if (gradeHighlight === "below_high_score") {
      segmentMessage = `Today's score: ${currentScore}% — high score: ${progress.highScore}%`;
    } else if (isPerfectHighScore || currentScore >= 100) {
      segmentMessage = "Perfect score on this segment";
    } else {
      segmentMessage = `Today's score: ${currentScore}% — high score stays ${progress.highScore}% until tomorrow`;
    }
  } else if (progress && isPerfectHighScore) {
    segmentMessage = "High score: 100% — perfect on this segment";
  } else if (progress && canBeatToday) {
    segmentMessage = `High score: ${progress.highScore}% — try to beat it today`;
  } else if (progress) {
    segmentMessage = `High score: ${progress.highScore}% — come back tomorrow to improve it`;
  }

  const dailyMessage =
    dailyStats?.date === today
      ? `Today: ${dailyStats.accuracyPercent}% accuracy (${dailyStats.missedWords}/${dailyStats.totalWords} missed)`
      : "Today: no grades yet";

  const reviewLabel =
    missedSegmentCount > 0
      ? `Review missed segments (${missedSegmentCount}${
          readyToRetryCount > 0 ? `, ${readyToRetryCount} ready` : ""
        })`
      : "Review missed segments";

  return (
    <Box px={4} py={2} bg="purple.50" borderBottomWidth="1px" borderColor="purple.100">
      <VStack align="stretch" spacing={2}>
        <Flex justify="flex-end" align="center">
          <Text fontSize="xs" color="purple.700" flexShrink={0}>
            {isTrial ? "Sign in to save progress" : dailyMessage}
          </Text>
        </Flex>

        <Flex justify="space-between" align="center" gap={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="semibold" color="purple.800" minW={0}>
            {segmentMessage ?? "Grade this segment to set your first high score"}
          </Text>

          {!isTrial ? (
            <Button
              size="xs"
              variant={isMissedListOpen ? "solid" : "outline"}
              colorScheme="purple"
              onClick={onOpenMissedList}
              onPointerDown={keepKeyboardOpen}
              flexShrink={0}
              leftIcon={
                readyToRetryCount > 0 ? (
                  <WarningIcon color="yellow.400" boxSize={3.5} />
                ) : undefined
              }
            >
              {reviewLabel}
            </Button>
          ) : null}
        </Flex>
      </VStack>
    </Box>
  );
}

type MissedSentencesPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  segments: Array<{
    id: string;
    exerciseId: string;
    exerciseTitle: string;
    segmentIndex: number;
    segmentsPerClip: number;
    isReadyToRetry: boolean;
  }>;
  currentExerciseId?: string;
  currentSegmentIndex: number;
  onNavigate: (exerciseId: string, segmentIndex: number, segmentsPerClip: number) => void;
};

export function MissedSentencesPanel({
  isOpen,
  onClose,
  segments,
  currentExerciseId,
  currentSegmentIndex,
  onNavigate
}: MissedSentencesPanelProps) {
  const handleNavigate = (
    exerciseId: string,
    segmentIndex: number,
    segmentsPerClip: number
  ) => {
    onNavigate(exerciseId, segmentIndex, segmentsPerClip);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} scrollBehavior="inside" size="md">
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Review missed segments</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={4}>
          {segments.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              No failed segments yet. Grade a segment with any missed words to add it here.
            </Text>
          ) : (
            <VStack align="stretch" spacing={1} maxH="60dvh" overflowY="auto">
              {segments.map((segment) => {
                const isCurrent =
                  segment.exerciseId === currentExerciseId &&
                  segment.segmentIndex === currentSegmentIndex;

                return (
                  <Button
                    key={segment.id}
                    variant={isCurrent ? "solid" : "ghost"}
                    colorScheme={isCurrent ? "purple" : undefined}
                    justifyContent="flex-start"
                    whiteSpace="normal"
                    textAlign="left"
                    h="auto"
                    py={3}
                    onClick={() =>
                      handleNavigate(
                        segment.exerciseId,
                        segment.segmentIndex,
                        segment.segmentsPerClip
                      )
                    }
                    onPointerDown={keepKeyboardOpen}
                    leftIcon={
                      segment.isReadyToRetry ? (
                        <WarningIcon color="yellow.400" boxSize={4} flexShrink={0} />
                      ) : undefined
                    }
                  >
                    <Text fontSize="sm" fontWeight="semibold">
                      {segment.exerciseTitle} · Segment {segment.segmentIndex + 1}
                    </Text>
                  </Button>
                );
              })}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export const SegmentProgressBar = PracticeStatusBar;
