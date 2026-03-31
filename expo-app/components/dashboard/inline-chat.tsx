import { useEffect, useRef, useState, useTransition } from "react";
import { Platform, View } from "react-native";
import { XStack, YStack, Input, Button, Text } from "tamagui";

type InlineChatProps = {
  /** Base URL for the API — required on native where relative paths don't work */
  apiBaseUrl?: string;
};

// ---------------------------------------------------------------------------
// Web input — plain <input> so we get full browser behavior (autocorrect, etc.)
// ---------------------------------------------------------------------------

function WebInput({
  value,
  onChange,
  onKeyDown,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      maxLength={500}
      disabled={disabled}
      aria-label="Log activity or ask about progress"
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        outline: "none",
        fontSize: 14,
        color: disabled ? "rgb(113,113,122)" : "rgb(250,250,250)",
        cursor: disabled ? "not-allowed" : "text",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Send icon — SVG on web, text on native
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
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    );
  }
  return <Text fontSize={16} color="$zinc400">{"→"}</Text>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineChat({ apiBaseUrl = "" }: InlineChatProps) {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    const msg = trimmed;
    setInput("");

    startTransition(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const res = await fetch(`${apiBaseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: msg }],
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        const text: string = data.message ?? "Done.";
        setResponse(text);

        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setResponse(null), 4000);
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        setResponse(
          isTimeout ? "Request timed out. Try again." : "Something went wrong. Try again.",
        );
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setResponse(null), 4000);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit();
  }

  // --- Web render ----------------------------------------------------------

  if (Platform.OS === "web") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Input row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(8px)",
              padding: "8px 16px",
              gap: 12,
              transition: "border-color 150ms",
            }}
          >
            <WebInput
              value={input}
              onChange={setInput}
              onKeyDown={handleKeyDown}
              disabled={isPending}
              placeholder="Log food, gym, run, or ask about progress..."
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || isPending}
            aria-label="Send message"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: !input.trim() || isPending ? "not-allowed" : "pointer",
              color: "rgb(161,161,170)",
              opacity: !input.trim() || isPending ? 0.4 : 1,
              transition: "opacity 150ms",
            }}
          >
            <SendIcon />
          </button>
        </div>

        {/* Response / status banner */}
        <div aria-live="polite" aria-atomic="true">
          {isPending && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.06)",
                backgroundColor: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(8px)",
                padding: "8px 16px",
                fontSize: 14,
                color: "rgb(161,161,170)",
              }}
            >
              Processing...
            </div>
          )}
          {!isPending && response && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.06)",
                backgroundColor: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(8px)",
                padding: "8px 16px",
                fontSize: 14,
                color: "rgb(212,212,216)",
              }}
            >
              {response}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Native render -------------------------------------------------------

  return (
    <YStack gap={8}>
      <XStack alignItems="center" gap={8}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(39,39,42,0.6)",
            backgroundColor: "rgba(24,24,27,0.8)",
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 12,
          }}
        >
          <Input
            unstyled
            flex={1}
            value={input}
            onChangeText={setInput}
            placeholder="Log food, gym, run..."
            style={{ placeholderTextColor: "rgb(113,113,122)" } as never}
            disabled={isPending}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={submit}
            fontSize={14}
            color="$color"
          />
        </View>

        <Button
          unstyled
          onPress={submit}
          disabled={!input.trim() || isPending}
          accessibilityLabel="Send message"
          width={40}
          height={40}
          borderRadius={12}
          borderWidth={1}
          borderColor="rgba(39,39,42,0.6)"
          backgroundColor="rgba(24,24,27,0.8)"
          alignItems="center"
          justifyContent="center"
          opacity={!input.trim() || isPending ? 0.4 : 1}
          pressStyle={{ opacity: 0.6 }}
        >
          <SendIcon />
        </Button>
      </XStack>

      {/* Response / status banner */}
      {(isPending || response) && (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(39,39,42,0.4)",
            backgroundColor: "rgba(24,24,27,0.6)",
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text fontSize={14} color="$placeholderColor">
            {isPending ? "Processing..." : response}
          </Text>
        </View>
      )}
    </YStack>
  );
}
