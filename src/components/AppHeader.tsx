import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import type { User } from "firebase/auth";
import { keepKeyboardOpen } from "../utils/keepKeyboardOpen";
import type { ExerciseSummary } from "../types";

type AppHeaderProps = {
  title: string;
  user?: User | null;
  isTrial?: boolean;
  onLeave?: () => void;
  exercises?: ExerciseSummary[];
  selectedExerciseId?: string;
  isLoadingExercises?: boolean;
  isExerciseLoading?: boolean;
  onSelectExercise?: (exerciseId: string) => void;
};

export function AppHeader({
  title,
  user,
  isTrial = false,
  onLeave,
  exercises = [],
  selectedExerciseId,
  isLoadingExercises = false,
  isExerciseLoading = false,
  onSelectExercise
}: AppHeaderProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const canPickExercise = Boolean(user && !isTrial && exercises.length > 0 && onSelectExercise);

  const handleSelectExercise = (exerciseId: string) => {
    if (exerciseId === selectedExerciseId) {
      setIsPickerOpen(false);
      return;
    }

    onSelectExercise?.(exerciseId);
    setIsPickerOpen(false);
  };

  return (
    <>
      <Box
        as="header"
        px={4}
        pt={{ base: 2, md: 4 }}
        pb={2}
        bg="white"
        borderBottomWidth="1px"
        borderColor="gray.200"
      >
        <Flex align="center" justify="space-between" gap={3}>
          {canPickExercise ? (
            <Button
              variant="ghost"
              flex={1}
              minW={0}
              h="auto"
              py={1}
              px={2}
              justifyContent="flex-start"
              fontWeight="semibold"
              fontSize={{ base: "md", md: "lg" }}
              lineHeight="short"
              onClick={() => setIsPickerOpen(true)}
              onPointerDown={keepKeyboardOpen}
              isDisabled={isExerciseLoading}
              rightIcon={<ChevronDownIcon boxSize={4} flexShrink={0} />}
            >
              <Text as="span" noOfLines={1} textAlign="left">
                {title}
              </Text>
            </Button>
          ) : (
            <Heading size={{ base: "sm", md: "md" }} noOfLines={1} flex={1}>
              {title}
            </Heading>
          )}

          {user ? (
            <HStack spacing={2} flexShrink={0}>
              <Avatar size="sm" name={user.displayName ?? undefined} src={user.photoURL ?? undefined} />
              <Button size="sm" variant="ghost" onClick={onLeave} onPointerDown={keepKeyboardOpen}>
                Sign out
              </Button>
            </HStack>
          ) : isTrial ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onLeave}
              onPointerDown={keepKeyboardOpen}
              flexShrink={0}
            >
              Sign in
            </Button>
          ) : null}
        </Flex>
      </Box>

      {canPickExercise ? (
        <Modal
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          scrollBehavior="inside"
          size="md"
        >
          <ModalOverlay />
          <ModalContent mx={4}>
            <ModalHeader>Choose an exercise</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={4}>
              {isLoadingExercises ? (
                <Text color="gray.500" fontSize="sm">
                  Loading exercises…
                </Text>
              ) : (
                <VStack align="stretch" spacing={1} maxH="60dvh" overflowY="auto">
                  {exercises.map((entry) => {
                    const isSelected = entry.id === selectedExerciseId;

                    return (
                      <Button
                        key={entry.id}
                        variant={isSelected ? "solid" : "ghost"}
                        colorScheme={isSelected ? "teal" : undefined}
                        justifyContent="flex-start"
                        whiteSpace="normal"
                        textAlign="left"
                        h="auto"
                        py={3}
                        onClick={() => handleSelectExercise(entry.id)}
                        onPointerDown={keepKeyboardOpen}
                        isDisabled={isExerciseLoading}
                      >
                        {entry.title}
                      </Button>
                    );
                  })}
                </VStack>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      ) : null}
    </>
  );
}
