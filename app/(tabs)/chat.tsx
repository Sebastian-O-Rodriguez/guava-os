import { Platform, View } from "react-native";
import { ScrollView, YStack, Text } from "tamagui";
import { Chat } from "../../components/chat";

// ---------------------------------------------------------------------------
// Chat tab screen
// ---------------------------------------------------------------------------

export default function ChatScreen() {
  if (Platform.OS === "web") {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#09090b",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 768,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "32px 16px 32px",
            gap: 24,
          }}
        >
          {/* Header */}
          <div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "rgb(250,250,250)",
                margin: 0,
              }}
            >
              Chat
            </h1>
            <p style={{ marginTop: 4, fontSize: 14, color: "rgb(113,113,122)", margin: "4px 0 0 0" }}>
              Log food, workouts, runs, or ask about your progress.
            </p>
          </div>

          {/* Chat component fills remaining height */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Chat />
          </div>
        </div>
      </div>
    );
  }

  // Native: full-screen dark background
  return (
    <View style={{ flex: 1, backgroundColor: "#09090b" }}>
      <YStack flex={1} p={16} gap={16}>
        {/* Header */}
        <YStack gap={4} pt={8}>
          <Text fontSize={28} fontWeight="700" color="$color" letterSpacing={-0.5}>
            Chat
          </Text>
          <Text fontSize={14} color="$placeholderColor">
            Log food, workouts, runs, or ask about your progress.
          </Text>
        </YStack>

        {/* Chat fills remaining space */}
        <YStack flex={1}>
          <Chat />
        </YStack>
      </YStack>
    </View>
  );
}
