import { useEffect, useState, type RefObject } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  VStack
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { formatTime } from "../utils/formatTime";
import { keepKeyboardOpen } from "../utils/keepKeyboardOpen";
import { MAX_SEGMENTS_PER_CLIP, MIN_SEGMENTS_PER_CLIP } from "../utils/whisperSegmentGroups";

type AudioControlsProps = {
  audioRef: RefObject<HTMLAudioElement>;
  audioUrl?: string;
  isAudioBuffering: boolean;
  isPlayingSegment: boolean;
  segmentIndex: number;
  segmentCount: number;
  segmentStartSeconds: number;
  currentSegmentEndSeconds: number;
  segmentsPerClip: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  hasExercise: boolean;
  onPlaySegment: () => void;
  onStopSegment: () => void;
  onPreviousSegment: () => void;
  onNextSegment: () => void;
  onSelectSegment: (index: number) => void;
  onRandomSegment: () => void;
  canRandomizeSegment: boolean;
  onSegmentsPerClipChange: (count: number) => void;
  onLoadedMetadata: (duration: number) => void;
  onCanPlay: () => void;
  onAudioError: () => void;
  onPause: () => void;
  onPlay: () => void;
  isGraded: boolean;
  onGradeOrRetry: () => void;
  gradeDisabled: boolean;
};

export function AudioControls({
  audioRef,
  audioUrl,
  isAudioBuffering,
  isPlayingSegment,
  segmentIndex,
  segmentCount,
  segmentStartSeconds,
  currentSegmentEndSeconds,
  segmentsPerClip,
  canGoPrevious,
  canGoNext,
  hasExercise,
  onPlaySegment,
  onStopSegment,
  onPreviousSegment,
  onNextSegment,
  onSelectSegment,
  onRandomSegment,
  canRandomizeSegment,
  onSegmentsPerClipChange,
  onLoadedMetadata,
  onCanPlay,
  onAudioError,
  onPause,
  onPlay,
  isGraded,
  onGradeOrRetry,
  gradeDisabled
}: AudioControlsProps) {
  const [segmentInput, setSegmentInput] = useState(String(segmentIndex + 1));

  useEffect(() => {
    setSegmentInput(String(segmentIndex + 1));
  }, [segmentIndex]);

  const commitSegmentInput = () => {
    if (segmentCount <= 0) {
      setSegmentInput("1");
      return;
    }

    const parsed = Number.parseInt(segmentInput, 10);
    if (!Number.isFinite(parsed)) {
      setSegmentInput(String(segmentIndex + 1));
      return;
    }

    const clamped = Math.min(segmentCount, Math.max(1, parsed));
    setSegmentInput(String(clamped));

    if (clamped - 1 !== segmentIndex) {
      onSelectSegment(clamped - 1);
    }
  };

  return (    <Box
      as="section"
      px={4}
      py={2}
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
    >
      <VStack align="stretch" spacing={2}>
        <Flex justify="space-between" align="center" gap={2}>
          <Flex align="center" gap={2} minW={0}>
            <IconButton
              aria-label="Random segment"
              icon={
                <Icon viewBox="0 0 24 24" boxSize={4}>
                  <path
                    fill="currentColor"
                    d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
                  />
                </Icon>
              }
              size="sm"
              variant="outline"
              onClick={onRandomSegment}
              onPointerDown={keepKeyboardOpen}
              isDisabled={!canRandomizeSegment}
              flexShrink={0}
            />
            <Input
              type="number"
              inputMode="numeric"
              aria-label="Current segment"
              value={segmentInput}
              onChange={(event) => setSegmentInput(event.target.value)}
              onBlur={commitSegmentInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitSegmentInput();
                }
              }}
              min={1}
              max={segmentCount > 0 ? segmentCount : 1}
              w="3.25rem"
              h="2rem"
              px={1}
              textAlign="center"
              fontSize="16px"
              flexShrink={0}
              isDisabled={!hasExercise || segmentCount <= 0}
            />
            <Text fontSize="sm" color="gray.500" flexShrink={0}>
              {segmentCount > 0 ? 1 : "—"}
            </Text>
            <Text fontSize="sm" color="gray.400" flexShrink={0}>
              –
            </Text>
            <Text fontSize="sm" color="gray.500" flexShrink={0}>
              {segmentCount > 0 ? segmentCount : "—"}
            </Text>
          </Flex>
          <Text fontSize="sm" color="gray.600" flexShrink={0}>
            {formatTime(segmentStartSeconds)} – {formatTime(currentSegmentEndSeconds)}
          </Text>
        </Flex>
        <Box>
          <Flex justify="space-between" align="center" mb={1}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.600">
              Segments per clip
            </Text>
            <Text fontSize="xs" color="gray.500">
              {segmentsPerClip} Whisper {segmentsPerClip === 1 ? "segment" : "segments"}
            </Text>
          </Flex>
          <Flex align="center" gap={2}>
            <Text fontSize="xs" color="gray.400" flexShrink={0} w={4} textAlign="center">
              {MIN_SEGMENTS_PER_CLIP}
            </Text>
            <Slider
              aria-label="Whisper segments per clip"
              flex={1}
              min={MIN_SEGMENTS_PER_CLIP}
              max={MAX_SEGMENTS_PER_CLIP}
              step={1}
              value={segmentsPerClip}
              onChange={onSegmentsPerClipChange}
              onPointerDown={keepKeyboardOpen}
              isDisabled={!hasExercise || isPlayingSegment || isAudioBuffering}
              colorScheme="purple"
            >
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
            <Text fontSize="xs" color="gray.400" flexShrink={0} w={4} textAlign="center">
              {MAX_SEGMENTS_PER_CLIP}
            </Text>
          </Flex>
        </Box>

        <HStack spacing={2}>
          <IconButton
            aria-label="Previous segment"
            icon={<ChevronLeftIcon boxSize={5} />}
            size="md"
            variant="outline"
            onClick={onPreviousSegment}
            onPointerDown={keepKeyboardOpen}
            isDisabled={!canGoPrevious}
            flexShrink={0}
          />
          <Button
            flex={1}
            size="md"
            colorScheme={isPlayingSegment ? "red" : "teal"}
            onClick={isPlayingSegment ? onStopSegment : onPlaySegment}
            onPointerDown={keepKeyboardOpen}
            isDisabled={!hasExercise}
            isLoading={isAudioBuffering}
            loadingText="Buffering…"
          >
            {isPlayingSegment ? "Stop" : "Play"}
          </Button>
          <Button
            size="sm"
            colorScheme={isGraded ? "gray" : "green"}
            onClick={onGradeOrRetry}
            onPointerDown={keepKeyboardOpen}
            isDisabled={gradeDisabled}
            flexShrink={0}
            minW="4.5rem"
          >
            {isGraded ? "Retry" : "Grade"}
          </Button>
          <IconButton
            aria-label="Next segment"
            icon={<ChevronRightIcon boxSize={5} />}
            size="md"
            variant="outline"
            onClick={onNextSegment}
            onPointerDown={keepKeyboardOpen}
            isDisabled={!canGoNext}
            flexShrink={0}
          />
        </HStack>

        <audio
          ref={audioRef}
          src={audioUrl}
          preload={audioUrl ? "metadata" : "none"}
          playsInline
          hidden
          onLoadedMetadata={(event) => {
            onLoadedMetadata(event.currentTarget.duration);
          }}
          onCanPlay={onCanPlay}
          onError={onAudioError}
          onPause={onPause}
          onPlay={onPlay}
        />
      </VStack>
    </Box>
  );
}
