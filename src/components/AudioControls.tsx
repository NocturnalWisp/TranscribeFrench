import type { RefObject } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Progress,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  VStack
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { formatTime } from "../utils/formatTime";
import { MAX_SEGMENTS_PER_CLIP, MIN_SEGMENTS_PER_CLIP } from "../utils/whisperSegmentGroups";

type AudioControlsProps = {
  audioRef: RefObject<HTMLAudioElement>;
  isPlayingSegment: boolean;
  segmentStartSeconds: number;
  currentSegmentEndSeconds: number;
  totalDurationSeconds: number | null;
  segmentsPerClip: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  segmentProgressPercent: number;
  hasExercise: boolean;
  onPlaySegment: () => void;
  onPreviousSegment: () => void;
  onNextSegment: () => void;
  onSegmentsPerClipChange: (count: number) => void;
  onLoadedMetadata: (duration: number) => void;
  onPause: () => void;
  onPlay: () => void;
};

export function AudioControls({
  audioRef,
  isPlayingSegment,
  segmentStartSeconds,
  currentSegmentEndSeconds,
  totalDurationSeconds,
  segmentsPerClip,
  canGoPrevious,
  canGoNext,
  segmentProgressPercent,
  hasExercise,
  onPlaySegment,
  onPreviousSegment,
  onNextSegment,
  onSegmentsPerClipChange,
  onLoadedMetadata,
  onPause,
  onPlay
}: AudioControlsProps) {
  return (
    <Box
      as="section"
      px={4}
      py={3}
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
    >
      <VStack align="stretch" spacing={3}>
        <Flex justify="space-between" align="center" gap={2}>
          <Text fontSize="sm" fontWeight="semibold" color="purple.700">
            {formatTime(segmentStartSeconds)} – {formatTime(currentSegmentEndSeconds)}
          </Text>
          {totalDurationSeconds !== null ? (
            <Text fontSize="xs" color="gray.500">
              of {formatTime(totalDurationSeconds)}
            </Text>
          ) : null}
        </Flex>

        {totalDurationSeconds ? (
          <Progress
            value={segmentProgressPercent}
            size="sm"
            borderRadius="full"
            colorScheme="purple"
          />
        ) : null}

        <Box>
          <Flex justify="space-between" align="center" mb={1}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.600">
              Segments per clip
            </Text>
            <Text fontSize="xs" color="gray.500">
              {segmentsPerClip} Whisper {segmentsPerClip === 1 ? "segment" : "segments"}
            </Text>
          </Flex>
          <Slider
            aria-label="Whisper segments per clip"
            min={MIN_SEGMENTS_PER_CLIP}
            max={MAX_SEGMENTS_PER_CLIP}
            step={1}
            value={segmentsPerClip}
            onChange={onSegmentsPerClipChange}
            isDisabled={!hasExercise}
            colorScheme="purple"
          >
            <SliderTrack>
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
          <Flex justify="space-between" mt={1}>
            <Text fontSize="xs" color="gray.400">
              {MIN_SEGMENTS_PER_CLIP}
            </Text>
            <Text fontSize="xs" color="gray.400">
              {MAX_SEGMENTS_PER_CLIP}
            </Text>
          </Flex>
        </Box>

        <HStack spacing={2}>
          <IconButton
            aria-label="Previous segment"
            icon={<ChevronLeftIcon boxSize={6} />}
            size="touch"
            variant="outline"
            onClick={onPreviousSegment}
            isDisabled={!canGoPrevious}
            flexShrink={0}
          />
          <Button
            flex={1}
            size="touch"
            colorScheme="teal"
            onClick={onPlaySegment}
            isDisabled={!hasExercise}
          >
            {isPlayingSegment ? "Replay segment" : "Play segment"}
          </Button>
          <IconButton
            aria-label="Next segment"
            icon={<ChevronRightIcon boxSize={6} />}
            size="touch"
            variant="outline"
            onClick={onNextSegment}
            isDisabled={!canGoNext}
            flexShrink={0}
          />
        </HStack>

        <audio
          ref={audioRef}
          preload="metadata"
          controls
          style={{ width: "100%", height: "36px" }}
          onLoadedMetadata={(event) => {
            onLoadedMetadata(event.currentTarget.duration);
          }}
          onPause={onPause}
          onPlay={onPlay}
        />
      </VStack>
    </Box>
  );
}
