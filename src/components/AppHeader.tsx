import { Box, Flex, Heading, IconButton, Text } from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onReload: () => void;
  isLoading: boolean;
};

export function AppHeader({ title, subtitle, onReload, isLoading }: AppHeaderProps) {
  return (
    <Box
      as="header"
      px={4}
      pt={{ base: 3, md: 6 }}
      pb={3}
      bg="white"
      borderBottomWidth="1px"
      borderColor="gray.200"
    >
      <Flex align="center" justify="space-between" gap={3}>
        <Box minW={0}>
          <Heading size={{ base: "sm", md: "md" }} noOfLines={1}>
            {title}
          </Heading>
          {subtitle ? (
            <Text fontSize="sm" color="gray.600" mt={0.5} noOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </Box>
        <IconButton
          aria-label="Load another clip"
          icon={<RepeatIcon />}
          size="touch"
          variant="outline"
          colorScheme="blue"
          onClick={onReload}
          isLoading={isLoading}
          flexShrink={0}
        />
      </Flex>
    </Box>
  );
}
