import { useRef, useState } from "react";
import { styled, YStack, XStack, View, Text, Button, Input, ScrollView } from "tamagui";
import { API_BASE } from "../lib/api";

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
// Styled components
// ---------------------------------------------------------------------------

const IconCircle = styled(View, {
  name: "IconCircle",
  borderWidth: 1,
  alignItems: "center",
  justifyContent: "center",
  borderColor: "$fillDefault",
  backgroundColor: "$fillDefault",

  variants: {
    size: {
      sm: { width: 48, height: 48, borderRadius: 24 },
      md: { width: 64, height: 64, borderRadius: 32 },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

const UserBubble = styled(View, {
  name: "UserBubble",
  borderRadius: 16,
  borderBottomRightRadius: 4,
  paddingHorizontal: "$4",
  paddingVertical: "$3",
  maxWidth: "85%",
  backgroundColor: "$fillDefault",
});

const AssistantBubble = styled(View, {
  name: "AssistantBubble",
  borderRadius: 16,
  borderBottomLeftRadius: 4,
  paddingHorizontal: "$4",
  paddingVertical: "$3",
  maxWidth: "85%",
  backgroundColor: "$zinc800",
});

const LoadingBubble = styled(View, {
  name: "LoadingBubble",
  borderRadius: 16,
  backgroundColor: "$zinc800",
  paddingHorizontal: "$4",
  paddingVertical: "$3",
  alignSelf: "flex-start",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Chat({ compact = false, apiBaseUrl = API_BASE }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollViewRef = useRef<any>(null);

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
      gap={compact ? "$4" : "$6"}
      paddingVertical={compact ? "$6" : "$12"}
    >
      <IconCircle size={compact ? "sm" : "md"} opacity={0.15}>
        <Text fontSize={compact ? 20 : 28} color="$color">{"*"}</Text>
      </IconCircle>

      <YStack alignItems="center" gap="$1">
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

      <YStack gap="$2" width="100%" maxWidth={compact ? 9999 : 384}>
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <Button
            key={i}
            unstyled
            onPress={() => handleExampleClick(prompt)}
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$backgroundHover"
            paddingHorizontal={compact ? "$3" : "$4"}
            paddingVertical={compact ? "$2" : "$3"}
            pressStyle={{ borderColor: "$borderColorHover", opacity: 0.8 }}
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
          gap="$2"
        >
          {msg.role === "user" ? (
            <UserBubble>
              <Text fontSize={14} lineHeight={22} color="$zinc50">
                {msg.content}
              </Text>
            </UserBubble>
          ) : (
            <AssistantBubble>
              <Text fontSize={14} lineHeight={22} color="$color">
                {msg.content}
              </Text>
            </AssistantBubble>
          )}
        </YStack>
      ))}

      {loading && (
        <LoadingBubble>
          <Text color="$placeholderColor" fontSize={14}>
            ...
          </Text>
        </LoadingBubble>
      )}
    </>
  );

  // --- Input area ----------------------------------------------------------

  const inputArea = (
    <XStack gap="$2" alignItems="flex-end">
      <Input
        flex={1}
        value={input}
        onChangeText={setInput}
        placeholder="Log food, gym, run, or ask about progress..."
        placeholderTextColor="$placeholderColor"
        disabled={loading}
        maxLength={500}
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        multiline
        numberOfLines={1}
        fontSize={14}
        color="$color"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$backgroundHover"
        paddingHorizontal="$4"
        paddingVertical="$3"
        minHeight={44}
        focusStyle={{ borderColor: "$fillDefault" }}
      />

      <Button
        onPress={handleSubmit}
        disabled={loading || !input.trim()}
        accessibilityLabel="Send message"
        height={44}
        paddingHorizontal="$4"
        borderRadius="$4"
        backgroundColor="$fillDefault"
        pressStyle={{ opacity: 0.8 }}
        disabledStyle={{ opacity: 0.4 }}
      >
        <Text fontSize={14} color="$zinc50">{"→"}</Text>
      </Button>
    </XStack>
  );

  // --- Compose layout ------------------------------------------------------

  return (
    <YStack flex={1} gap="$6">
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
          gap="$4"
          minHeight={compact ? 100 : 200}
          padding="$1"
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
