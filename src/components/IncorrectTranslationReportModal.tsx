import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack
} from "@chakra-ui/react";

type IncorrectTranslationReportModalProps = {
  isOpen: boolean;
  word: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onCloseComplete?: () => void;
  onSubmit: () => void;
};

export function IncorrectTranslationReportModal({
  isOpen,
  word,
  isSubmitting,
  onClose,
  onCloseComplete,
  onSubmit
}: IncorrectTranslationReportModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      onCloseComplete={onCloseComplete}
    >
      <ModalOverlay />
      <ModalContent mx={4}>
        <ModalHeader>Report word</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text fontSize="sm" color="gray.600">
              Selected word
            </Text>
            <Text fontSize="lg" fontWeight="semibold" color="gray.800">
              {word}
            </Text>
            <Text fontSize="sm" color="gray.600">
              If the expected French text is wrong for this exercise segment, send a report so we
              can review it.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={onClose} isDisabled={isSubmitting}>
            Cancel
          </Button>
          <Button colorScheme="teal" onClick={onSubmit} isLoading={isSubmitting}>
            Report incorrect translation
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
