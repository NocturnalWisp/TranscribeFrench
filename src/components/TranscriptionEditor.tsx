import { forwardRef } from "react";
import { Box, Text, Textarea, VStack } from "@chakra-ui/react";
import type { GradedWord } from "../types";

type TranscriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  isGraded?: boolean;
  submittedText?: string;
  correctedWords?: GradedWord[] | null;
  onFocus?: () => void;
  onBlur?: () => void;
};

function WordHighlight({ words }: { words: GradedWord[] }) {
  return (
    <Text fontSize="md" lineHeight="tall">
      {words.map((word, index) => (
        <Text
          as="span"
          key={`${word.text}-${index}`}
          color={word.isCorrect ? "gray.800" : "red.500"}
          fontWeight={word.isCorrect ? "normal" : "bold"}
          textDecoration={word.isCorrect ? "none" : "underline"}
          textDecorationStyle={word.isCorrect ? undefined : "solid"}
          textDecorationThickness={word.isCorrect ? undefined : "2px"}
          textUnderlineOffset={word.isCorrect ? undefined : "3px"}
          bg={word.isCorrect ? "transparent" : "blackAlpha.100"}
          px={word.isCorrect ? 0 : 0.5}
          borderRadius={word.isCorrect ? undefined : "sm"}
        >
          {word.text}
          {index < words.length - 1 ? " " : ""}
        </Text>
      ))}
    </Text>
  );
}

export const TranscriptionEditor = forwardRef<HTMLTextAreaElement, TranscriptionEditorProps>(
  function TranscriptionEditor(
    { value, onChange, isGraded = false, submittedText = "", correctedWords, onFocus, onBlur },
    ref
  ) {
    return (
      <Box
        as="section"
        flex={1}
        display="flex"
        flexDirection="column"
        minH={0}
        px={4}
        pt={2}
        pb={2}
        overflow="hidden"
        position="relative"
      >
        {isGraded ? (
          <VStack align="stretch" spacing={4} flex={1} overflowY="auto" pt={1} pb={2}>
            <Box>
              <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1}>
                Your answer
              </Text>
              <Text fontSize="md" lineHeight="tall" color="gray.800">
                {submittedText}
              </Text>
            </Box>

            {correctedWords && correctedWords.length > 0 ? (
              <Box>
                <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1}>
                  Correct answer
                </Text>
                <WordHighlight words={correctedWords} />
              </Box>
            ) : null}
          </VStack>
        ) : null}

        <Textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Type what you hear in French…"
          flex={isGraded ? undefined : 1}
          minH={isGraded ? "1px" : 0}
          h={isGraded ? "1px" : undefined}
          resize="none"
          fontSize="16px"
          lineHeight="tall"
          bg="white"
          borderColor="gray.300"
          _focus={{ borderColor: "teal.400", boxShadow: "0 0 0 1px var(--chakra-colors-teal-400)" }}
          enterKeyHint="done"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          position={isGraded ? "absolute" : "relative"}
          opacity={isGraded ? 0 : 1}
          pointerEvents={isGraded ? "none" : "auto"}
          overflow={isGraded ? "hidden" : undefined}
          p={isGraded ? 0 : undefined}
          border={isGraded ? "none" : undefined}
        />
      </Box>
    );
  }
);
