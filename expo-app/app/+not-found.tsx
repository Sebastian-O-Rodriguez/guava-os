import { useRouter } from "expo-router";
import { YStack, Text, Button } from "tamagui";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <YStack
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      gap={16}
    >
      <Text color="$color" fontSize={24} fontWeight="bold">
        Page not found
      </Text>
      <Button
        onPress={() => router.replace("/")}
        backgroundColor="$zinc800"
        borderRadius={12}
        paddingHorizontal={20}
        paddingVertical={12}
      >
        <Text color="$color" fontSize={14} fontWeight="600">Go to Dashboard</Text>
      </Button>
    </YStack>
  );
}
