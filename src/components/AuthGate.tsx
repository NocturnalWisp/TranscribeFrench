import {
  Box,
  Button,
  Heading,
  Stack,
  Text as ChakraText,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useState } from "react";
import { signInWithGoogle } from "../services/auth";
import type { AccessMode } from "../types/auth";

type AuthGateProps = {
  // eslint-disable-next-line no-unused-vars
  onSelectAccessMode: (mode: AccessMode) => void | Promise<void>;
};

export function AuthGate({ onSelectAccessMode }: AuthGateProps) {
  const toast = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  const handleTry = async () => {
    setIsStartingTrial(true);

    try {
      await onSelectAccessMode("trial");
    } finally {
      setIsStartingTrial(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);

    try {
      await signInWithGoogle();
      await onSelectAccessMode("full");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in with Google.";
      toast({
        title: "Sign-in failed",
        description: message,
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Box
      minH="100dvh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={4}
      bg="gray.50"
    >
      <VStack
        spacing={6}
        w="full"
        maxW="420px"
        p={{ base: 6, md: 8 }}
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        boxShadow="sm"
      >
        <Stack spacing={2} textAlign="center">
          <Heading size="md">Transcribe French</Heading>
          <ChakraText color="gray.600" fontSize="sm">
            Practice French listening with short audio clips. Try one exercise for free or sign in
            with Google for full access.
          </ChakraText>
        </Stack>

        <Stack w="full" spacing={3}>
          <Button
            size="lg"
            colorScheme="blue"
            onClick={handleTry}
            isLoading={isStartingTrial}
            loadingText="Loading trial"
          >
            Try
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => void handleGoogleSignIn()}
            isLoading={isSigningIn}
            loadingText="Signing in"
          >
            Continue with Google
          </Button>
        </Stack>
      </VStack>
    </Box>
  );
}
