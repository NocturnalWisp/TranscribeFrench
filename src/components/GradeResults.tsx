import { useEffect, useRef } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Heading,
  SimpleGrid,
  Text,
  VStack
} from "@chakra-ui/react";
import type { GradeResult } from "../types";

type GradeResultsProps = {
  result: GradeResult;
  referenceTranscription: string;
  segmentLabel?: string;
};

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="gray.50" borderRadius="lg" px={3} py={2} textAlign="center">
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Text fontSize="lg" fontWeight="bold" color="gray.800">
        {value}
      </Text>
    </Box>
  );
}

export function GradeResults({ result, referenceTranscription, segmentLabel }: GradeResultsProps) {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  return (
    <Box
      ref={sectionRef}
      as="section"
      px={4}
      py={4}
      bg="white"
      borderTopWidth="1px"
      borderColor="gray.200"
    >
      <VStack align="stretch" spacing={4}>
        <Heading size="sm">{segmentLabel ?? "This clip"}</Heading>

        <SimpleGrid columns={3} spacing={2}>
          <ScoreCard label="Overall" value={`${result.score}%`} />
          <ScoreCard label="Words" value={`${result.wordMatchPercent}%`} />
          <ScoreCard label="Chars" value={`${result.characterSimilarityPercent}%`} />
        </SimpleGrid>

        <Alert
          status={result.score >= 70 ? "success" : "info"}
          borderRadius="lg"
          alignItems="flex-start"
        >
          <AlertIcon mt={0.5} />
          <Text fontSize="sm">{result.feedback}</Text>
        </Alert>

        <Box>
          <Text fontSize="xs" fontWeight="semibold" color="gray.500" mb={1}>
            Reference for this clip
          </Text>
          <Box bg="gray.50" borderRadius="lg" p={3}>
            <Text fontSize="sm" lineHeight="tall">
              {referenceTranscription}
            </Text>
          </Box>
        </Box>
      </VStack>
    </Box>
  );
}
