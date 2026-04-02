import { useRouter } from "expo-router";
import { YStack, Text, Button } from "tamagui";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <YStack
      flex={1}
      bg="$background"
      items="center"
      justify="center"
      gap={16}
    >
      <Text color="$color" fontSize={24} fontWeight="bold">
        Page not found
      </Text>
      <Button
        onPress={() => router.replace("/")}
        bg="$color3"
        rounded={12}
        px={20}
        py={12}
      >
        <Text color="$color" fontSize={14} fontWeight="600">Go to Dashboard</Text>
      </Button>
    </YStack>
  );
}
