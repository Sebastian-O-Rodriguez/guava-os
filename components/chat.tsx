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
  items: "center",
  justify: "center",
  borderColor: "$green9",
  bg: "$green9",

  variants: {
    size: {
      sm: { width: 48, height: 48, rounded: 24 },
      md: { width: 64, height: 64, rounded: 32 },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

const UserBubble = styled(View, {
  name: "UserBubble",
  rounded: 16,
  px: "$4",
  py: "$3",
  maxW: "85%",
  bg: "$green9",
});

const AssistantBubble = styled(View, {
  name: "AssistantBubble",
  rounded: 16,
  px: "$4",
  py: "$3",
  maxW: "85%",
  bg: "$color3",
});

const LoadingBubble = styled(View, {
  name: "LoadingBubble",
  rounded: 16,
  bg: "$color3",
  px: "$4",
  py: "$3",
  self: "flex-start",
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
      items="center"
      justify="center"
      gap={compact ? "$4" : "$6"}
      py={compact ? "$6" : "$12"}
    >
      <IconCircle size={compact ? "sm" : "md"} opacity={0.15}>
        <Text fontSize={compact ? 20 : 28} color="$color">{"*"}</Text>
      </IconCircle>

      <YStack items="center" gap="$1">
        <Text
          fontSize={compact ? 14 : 16}
          fontWeight="600"
          color="$color"
          text="center"
        >
          Log food, workouts, and runs
        </Text>
        <Text fontSize={14} color="$placeholderColor" text="center" maxW={320}>
          Tell me what you ate, where you trained, or how far you ran.
        </Text>
      </YStack>

      <YStack gap="$2" width="100%" maxW={compact ? 9999 : 384}>
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <Button
            key={i}
            unstyled
            onPress={() => handleExampleClick(prompt)}
            rounded="$4"
            borderWidth={1}
            borderColor="$borderColor"
            bg="$backgroundHover"
            px={compact ? "$3" : "$4"}
            py={compact ? "$2" : "$3"}
            pressStyle={{ borderColor: "$borderColorHover", opacity: 0.8 }}
          >
            <Text fontSize={14} color="$placeholderColor" text="left">
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
          items={msg.role === "user" ? "flex-end" : "flex-start"}
          gap="$2"
        >
          {msg.role === "user" ? (
            <UserBubble>
              <Text fontSize={14} lineHeight={22} color="$color12">
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
    <XStack gap="$2" items="flex-end">
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
        rounded="$4"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$backgroundHover"
        px="$4"
        py="$3"
        minH={44}
        focusStyle={{ borderColor: "$green9" }}
      />

      <Button
        onPress={handleSubmit}
        disabled={loading || !input.trim()}
        accessibilityLabel="Send message"
        height={44}
        px="$4"
        rounded="$4"
        bg="$green9"
        pressStyle={{ opacity: 0.8 }}
        disabledStyle={{ opacity: 0.4 }}
      >
        <Text fontSize={14} color="$color12">{"→"}</Text>
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
          minH={compact ? 100 : 200}
          p="$1"
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
