import { useRef, useState, useTransition } from "react";
import { styled, XStack, YStack, Input, Button, Text } from "tamagui";
import { ReplyBubble } from "./reply-bubble";
import { SuggestionRow } from "./suggestion-row";
import { getDefaultSuggestions, getPostActionSuggestions } from "../../lib/suggestions";
import type { Suggestion } from "../../lib/suggestions";
import type { EstimatedNutritionEntry } from "../../lib/chat-scenarios";
import { API_BASE, authFetch } from "../../lib/api";
import { useThemeMode } from "../../lib/theme-context";

type Props = {
  onSuccess?: () => void;
  compact?: boolean;
};

type PendingAction = {
  scenario: string;
  params: Record<string, unknown>;
  estimates?: EstimatedNutritionEntry[];
};

type ChatResponse = {
  message: string;
  status: "proposed" | "executed" | "info" | "error" | "clarify";
  scenario?: string;
  pendingAction?: PendingAction;
  data?: unknown;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Styled — input bar (same style as original ChatInput)
// ---------------------------------------------------------------------------

const ChatBar = styled(XStack, {
  name: "ChatBar",
  bg: "$color2",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$4",
  items: "center",
  px: "$3",
  py: "$1",
  gap: "$2",
  focusWithinStyle: {
    borderColor: "$accent9",
  },
});

const ChatField = styled(Input, {
  name: "ChatField",
  unstyled: true,
  flex: 1,
  bg: "transparent",
  borderWidth: 0,
  fontSize: 14,
  color: "$color",
  height: 48,
  outlineWidth: 0,
  outlineStyle: "none" as never,
  focusStyle: {
    outlineWidth: 0,
    borderWidth: 0,
  },
});

const SendButton = styled(Button, {
  name: "SendButton",
  rounded: "$3",
  width: 36,
  height: 36,
  items: "center",
  justify: "center",
  bg: "transparent",
  hoverStyle: { bg: "$color3" },
  pressStyle: { bg: "$color3", opacity: 0.7 },
});

// ---------------------------------------------------------------------------
// Placeholder cycling
// ---------------------------------------------------------------------------

const PLACEHOLDERS = [
  "Log food, habits, progress...",
  "How's today going?",
  "What did you eat?",
  "I just finished...",
];

function getPlaceholder(): string {
  // Cycle based on time — changes roughly every 15 minutes
  const index = Math.floor(Date.now() / 900_000) % PLACEHOLDERS.length;
  return PLACEHOLDERS[index];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ChatSurface — container for the chat interaction system.
 *
 * Layout: ReplyBubble → InputBar → SuggestionRow
 *
 * Manages:
 * - Conversation state (last 4 messages for clarification only)
 * - Pending action state (for propose → confirm flow)
 * - Suggestion refresh (reactive post-action)
 */
export function ChatSurface({ onSuccess, compact }: Props) {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState<{ message: string; status: ChatResponse["status"] } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(getDefaultSuggestions());
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const { mode } = useThemeMode();

  // Dark mode: light glow outward. Light mode: dark shadow downward.
  const shadowStyle =
    mode === "dark"
      ? {
          shadowColor: "rgba(255,255,255,0.08)" as never,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
        }
      : {
          shadowColor: "rgba(0,0,0,0.12)" as never,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 1,
        };

  // Whether suggestions should be visible (hidden while typing)
  const suggestionsVisible = input.trim().length === 0 && !isPending;

  function handleInputChange(text: string) {
    setInput(text);
  }

  function handleSuggestionSelect(suggestion: Suggestion) {
    setInput(suggestion.seedMessage);
    // Focus the input field
    inputRef.current?.focus?.();
  }

  function dismissReply() {
    setReply(null);
    setPendingAction(null);
  }

  function submit() {
    const msg = input.trim();
    if (!msg || isPending) return;
    setInput("");

    startTransition(async () => {
      // Add user message to history
      const updatedHistory: ChatMessage[] = [
        ...conversationHistory,
        { role: "user" as const, content: msg },
      ].slice(-4) as ChatMessage[]; // Keep last 4 for clarification context only

      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30_000);

      try {
        const body: Record<string, unknown> = {
          messages: updatedHistory.map((m) => ({ role: m.role, content: m.content })),
        };

        // If we have a pending action, include it for confirmation
        if (pendingAction) {
          body.pendingAction = pendingAction;
        }

        const res = await authFetch(`${API_BASE}/api/chat`, {
          method: "POST",
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const data: ChatResponse = await res.json();

        // Update reply
        setReply({ message: data.message, status: data.status });

        // Update pending action
        if (data.pendingAction) {
          setPendingAction(data.pendingAction);
        } else {
          setPendingAction(null);
        }

        // Add assistant reply to history
        const withAssistant: ChatMessage[] = [
          ...updatedHistory,
          { role: "assistant" as const, content: data.message },
        ].slice(-4) as ChatMessage[];
        setConversationHistory(withAssistant);

        // Refresh suggestions reactively
        if (data.scenario && data.status) {
          setSuggestions(
            getPostActionSuggestions({
              scenario: data.scenario,
              status: data.status,
            }),
          );
        } else {
          setSuggestions(getDefaultSuggestions());
        }

        // Notify parent of successful mutation
        if (data.status === "executed") {
          onSuccess?.();
        }
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        setReply({
          message: isTimeout ? "Timed out — try again?" : "Something went wrong — try again?",
          status: "error",
        });
        setPendingAction(null);
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  return (
    <YStack gap="$2">
      {/* Reply bubble — persists until next message or dismiss */}
      <ReplyBubble
        message={reply?.message ?? null}
        status={reply?.status}
        onDismiss={dismissReply}
      />

      {/* Input bar */}
      <ChatBar {...shadowStyle}>
        <ChatField
          ref={inputRef}
          value={input}
          onChangeText={handleInputChange}
          placeholder={getPlaceholder()}
          placeholderTextColor="$color6"
          disabled={isPending}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={submit}
          color={isPending ? "$color7" : "$color"}
        />
        <SendButton
          onPress={submit}
          disabled={!input.trim() || isPending}
          accessibilityLabel="Send"
          opacity={!input.trim() || isPending ? 0.3 : 1}
        >
          <Text fontSize={15} color="$color7">
            {isPending ? "\u2026" : "\u2192"}
          </Text>
        </SendButton>
      </ChatBar>

      {/* Suggestion chips — collapse on typing, reappear on clear */}
      <SuggestionRow
        suggestions={suggestions}
        visible={suggestionsVisible}
        compact={compact}
        onSelect={handleSuggestionSelect}
      />
    </YStack>
  );
}
