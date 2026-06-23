import { Box, Button, Text, Textarea, VStack } from "@chakra-ui/react";
import type { GradedWord } from "../types";

type TranscriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onGrade: () => void;
  canGrade: boolean;
  gradedWords?: GradedWord[] | null;
};

export function TranscriptionEditor({
  value,
  onChange,
  onGrade,
  canGrade,
  gradedWords
}: TranscriptionEditorProps) {
  return (
    <Box
      as="section"
      flex={1}
      display="flex"
      flexDirection="column"
      minH={0}
      px={4}
      py={3}
    >
      <VStack align="stretch" spacing={3} flex={1} minH={0}>
        <Text fontSize="sm" fontWeight="semibold" color="gray.700">
          Your transcription
        </Text>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type what you hear in French…"
          flex={1}
          minH={{ base: "140px", md: "200px" }}
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
        />

        {gradedWords && gradedWords.length > 0 ? (
          <Box bg="gray.50" borderRadius="md" px={3} py={2}>
            <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1}>
              Incorrect words highlighted
            </Text>
            <Text fontSize="sm" lineHeight="tall">
              {gradedWords.map((word, index) => (
                <Text
                  as="span"
                  key={`${word.text}-${index}`}
                  color={word.isCorrect ? "gray.800" : "red.500"}
                  fontWeight={word.isCorrect ? "normal" : "semibold"}
                >
                  {word.text}
                  {index < gradedWords.length - 1 ? " " : ""}
                </Text>
              ))}
            </Text>
          </Box>
        ) : null}

        <Text fontSize="xs" color="gray.500">
          Grade this clip, then edit and grade again until it looks right.
        </Text>
        <Button
          size="touch"
          colorScheme="green"
          w="full"
          onClick={onGrade}
          isDisabled={!canGrade}
        >
          Grade this clip
        </Button>
      </VStack>
    </Box>
  );
}
