import { useRef, useState, useTransition } from "react";
import { styled, XStack, YStack, Input, Button, Text } from "tamagui";
import { ReplyBubble } from "./reply-bubble";
import type { EstimatedNutritionEntry } from "../../lib/chat-scenarios";
import type { Action } from "../../lib/actions/types";
import { API_BASE, authFetch } from "../../lib/api";
import { useThemeMode } from "../../lib/theme-context";
import { useActionModal, type ActionType } from "../../lib/action-modal-context";

type Props = {
  onSuccess?: () => void;
  onAdd?: () => void;
  compact?: boolean;
};

/** pendingAction is now a full Action object from lib/actions/types.ts */
type PendingAction = Action;

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
  rounded: "$3",
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

const PLACEHOLDER = "Log food or activity\u2026";

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
export function ChatSurface({ onSuccess, onAdd, compact }: Props) {
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState<{ message: string; status: ChatResponse["status"] } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const { mode } = useThemeMode();
  const actionModal = useActionModal();

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

  function handleInputChange(text: string) {
    setInput(text);
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

        // If proposed → open action modal instead of inline confirm
        if (data.status === "proposed" && data.pendingAction) {
          const modalPayload = chatResponseToModalPayload(data);
          actionModal.open(modalPayload);
          setReply(null);
          setPendingAction(null);
        } else {
          // Non-proposal responses: show inline reply
          setReply({ message: data.message, status: data.status });
          setPendingAction(null);
        }

        // Add assistant reply to history
        const withAssistant: ChatMessage[] = [
          ...updatedHistory,
          { role: "assistant" as const, content: data.message },
        ].slice(-4) as ChatMessage[];
        setConversationHistory(withAssistant);

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
          placeholder={PLACEHOLDER}
          placeholderTextColor="$color6"
          disabled={isPending}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={submit}
          color={isPending ? "$color7" : "$color"}
        />
        {onAdd && (
          <SendButton
            onPress={onAdd}
            disabled={isPending}
            accessibilityLabel="Add entry"
            opacity={isPending ? 0.3 : 1}
          >
            <Text fontSize={16} fontWeight="600" color="$accent9">+</Text>
          </SendButton>
        )}
        <SendButton
          onPress={submit}
          disabled={!input.trim() || isPending}
          accessibilityLabel="Send"
          opacity={!input.trim() || isPending ? 0.3 : 1}
        >
          <Text fontSize={16} color="$color7">
            {isPending ? "\u2026" : "\u2192"}
          </Text>
        </SendButton>
      </ChatBar>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Map chat API response to modal payload
// ---------------------------------------------------------------------------

const SCENARIO_TO_TYPE: Record<string, ActionType> = {
  log_nutrition: "nutrition",
  log_gym: "gym",
  log_run: "running",
  mark_habit: "custom",
  increment_goal: "custom",
  set_goal: "custom",
};

function chatResponseToModalPayload(data: ChatResponse & { pendingAction?: PendingAction }) {
  // pendingAction is now a full Action object — round-tripped back on confirm.
  const action = data.pendingAction;
  const scenario = data.scenario ?? action?.intent ?? "";
  const type: ActionType = SCENARIO_TO_TYPE[scenario] ?? "custom";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = (action?.payload as Record<string, any>) ?? {};

  const fields: Record<string, string | number> = {};

  if (type === "nutrition" && payload.entries && payload.entries.length > 0) {
    const entries = payload.entries as EstimatedNutritionEntry[];
    if (entries.length === 1) {
      fields.item = entries[0].item ?? "";
      fields.calories = entries[0].calories ?? 0;
      fields.protein = entries[0].protein ?? 0;
      fields.fat = entries[0].fat ?? 0;
      fields.carbs = entries[0].carbs ?? 0;
    } else {
      fields.item = entries.map((e) => e.item).join(", ");
      fields.calories = entries.reduce((s, e) => s + (e.calories ?? 0), 0);
      fields.protein = entries.reduce((s, e) => s + (e.protein ?? 0), 0);
      fields.fat = entries.reduce((s, e) => s + (e.fat ?? 0), 0);
      fields.carbs = entries.reduce((s, e) => s + (e.carbs ?? 0), 0);
    }
  } else if (type === "running") {
    fields.miles = (payload.miles as number) ?? 0;
    fields.duration = (payload.duration as string) ?? "";
  } else if (type === "gym") {
    fields.bodyPart = (payload.bodyPart as string) ?? "";
  } else {
    fields.value = (payload.value as number) ?? 1;
  }

  return {
    type,
    fields,
    pendingAction: action,
    source: "chat" as const,
  };
}
