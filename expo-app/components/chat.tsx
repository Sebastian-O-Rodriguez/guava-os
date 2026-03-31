import { useRef, useState } from "react";
import { Platform, ScrollView as RNScrollView, View } from "react-native";
import { YStack, XStack, Text, Button, Input, ScrollView } from "tamagui";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_PROMPTS = [
  "I had 200g chicken breast and a cup of rice",
  "Did chest today — bench press and flys",
  "Ran 1.5 miles this morning",
];

type ChatProps = {
  compact?: boolean;
  /** Base URL for API calls — required on native */
  apiBaseUrl?: string;
};

// ---------------------------------------------------------------------------
// Sparkles icon
// ---------------------------------------------------------------------------

function SparklesIcon({ size = 24 }: { size?: number }) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgb(52,211,153)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
        <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75z" />
        <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75z" />
      </svg>
    );
  }
  return <Text fontSize={size} color="$emerald400">{"*"}</Text>;
}

// ---------------------------------------------------------------------------
// Send icon
// ---------------------------------------------------------------------------

function SendIcon() {
  if (Platform.OS === "web") {
    return (
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    );
  }
  return <Text fontSize={14}>{"→"}</Text>;
}

// ---------------------------------------------------------------------------
// Loading dots
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: "rgb(39,39,42)",
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignSelf: "flex-start",
      }}
    >
      <Text color="$placeholderColor" fontSize={14}>
        ...
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Chat({ compact = false, apiBaseUrl = "" }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<RNScrollView | null>(null);

  async function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message ?? "Done." },
      ]);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isTimeout
            ? "Request timed out. Please try again."
            : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      // Scroll to bottom after render
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd?.({ animated: true });
      });
    }
  }

  function handleExampleClick(prompt: string) {
    setInput(prompt);
  }

  // --- Empty state ---------------------------------------------------------

  const emptyState = (
    <YStack
      alignItems="center"
      justifyContent="center"
      gap={compact ? 16 : 24}
      paddingVertical={compact ? 24 : 48}
    >
      <View
        style={{
          width: compact ? 48 : 64,
          height: compact ? 48 : 64,
          borderRadius: compact ? 24 : 32,
          backgroundColor: "rgba(16,185,129,0.1)",
          borderWidth: 1,
          borderColor: "rgba(16,185,129,0.2)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SparklesIcon size={compact ? 20 : 28} />
      </View>

      <YStack alignItems="center" gap={4}>
        <Text
          fontSize={compact ? 14 : 16}
          fontWeight="600"
          color="$color"
          textAlign="center"
        >
          Log food, workouts, and runs
        </Text>
        <Text fontSize={14} color="$placeholderColor" textAlign="center" maxWidth={320}>
          Tell me what you ate, where you trained, or how far you ran.
        </Text>
      </YStack>

      <YStack gap={8} width="100%" maxWidth={compact ? 9999 : 384}>
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <Button
            key={i}
            unstyled
            onPress={() => handleExampleClick(prompt)}
            borderRadius={12}
            borderWidth={1}
            borderColor="$zinc800"
            backgroundColor="$zinc900"
            paddingHorizontal={compact ? 12 : 16}
            paddingVertical={compact ? 8 : 12}
            pressStyle={{ borderColor: "$zinc700", opacity: 0.8 }}
          >
            <Text fontSize={14} color="$placeholderColor" textAlign="left">
              "{prompt}"
            </Text>
          </Button>
        ))}
      </YStack>
    </YStack>
  );

  // --- Message bubbles -----------------------------------------------------

  const messageList = (
    <>
      {messages.map((msg, i) => (
        <YStack
          key={i}
          alignItems={msg.role === "user" ? "flex-end" : "flex-start"}
          gap={8}
        >
          <View
            style={{
              borderRadius: 16,
              borderBottomRightRadius: msg.role === "user" ? 4 : 16,
              borderBottomLeftRadius: msg.role === "assistant" ? 4 : 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              maxWidth: "85%",
              backgroundColor: msg.role === "user" ? "rgb(16,185,129)" : "rgb(39,39,42)",
            }}
          >
            <Text
              fontSize={14}
              lineHeight={22}
              color={msg.role === "user" ? "white" : "$color"}
            >
              {msg.content}
            </Text>
          </View>
        </YStack>
      ))}

      {loading && <LoadingDots />}
    </>
  );

  // --- Input area ----------------------------------------------------------

  const inputArea = (
    <XStack gap={8} alignItems="flex-end">
      <View style={{ flex: 1 }}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder="Log food, gym, run, or ask about progress..."
          style={{ placeholderTextColor: "rgb(113,113,122)" } as never}
          disabled={loading}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          multiline
          numberOfLines={1}
          fontSize={14}
          color="$color"
          borderRadius={12}
          borderWidth={1}
          borderColor="$zinc700"
          backgroundColor="$zinc900"
          paddingHorizontal={16}
          paddingVertical={12}
          minHeight={44}
          focusStyle={{
            borderColor: "rgba(16,185,129,0.5)",
          }}
        />
      </View>

      <Button
        onPress={handleSubmit}
        disabled={loading || !input.trim()}
        accessibilityLabel="Send message"
        height={44}
        paddingHorizontal={16}
        borderRadius={12}
        backgroundColor="$emerald500"
        pressStyle={{ opacity: 0.8 }}
        disabledStyle={{ opacity: 0.4 }}
      >
        <SendIcon />
      </Button>
    </XStack>
  );

  // --- Compose layout ------------------------------------------------------

  return (
    <YStack flex={1} gap={24}>
      <ScrollView
        ref={scrollViewRef}
        flex={1}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (messages.length > 0 || loading) {
            scrollViewRef.current?.scrollToEnd?.({ animated: true });
          }
        }}
      >
        <YStack
          gap={16}
          minHeight={compact ? 100 : 200}
          padding={4}
          aria-live="polite"
          aria-label="Conversation"
        >
          {messages.length === 0 && !loading ? emptyState : messageList}
        </YStack>
      </ScrollView>

      {inputArea}
    </YStack>
  );
}
