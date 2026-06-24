import { Avatar, Box, Button, Flex, Heading, HStack } from "@chakra-ui/react";
import type { User } from "firebase/auth";
import { keepKeyboardOpen } from "../utils/keepKeyboardOpen";

type AppHeaderProps = {
  title: string;
  user?: User | null;
  isTrial?: boolean;
  onLeave?: () => void;
};

export function AppHeader({ title, user, isTrial = false, onLeave }: AppHeaderProps) {
  return (
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
        <Heading size={{ base: "sm", md: "md" }} noOfLines={1} flex={1}>
          {title}
        </Heading>

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
  );
}
