import { useEffect, useRef, useState, useTransition } from "react";
import { XStack, YStack, Input, Button, Text, View } from "tamagui";
import { API_BASE } from "../../lib/api";

type InlineChatProps = {
  /** Base URL for the API — required on native where relative paths don't work */
  apiBaseUrl?: string;
  /** Called after a successful chat action so the parent can refetch */
  onSuccess?: () => void;
};

export function InlineChat({ apiBaseUrl = API_BASE, onSuccess }: InlineChatProps) {
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
        onSuccess?.();

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

  function handleSubmitEditing() {
    submit();
  }

  return (
    <YStack gap="$2">
      {/* Input row */}
      <XStack items="center" gap="$2">
        <View
          flex={1}
          flexDirection="row"
          items="center"
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$background"
          px="$4"
          py="$2"
          gap="$3"
        >
          <Input
            unstyled
            flex={1}
            bg="transparent"
            value={input}
            onChangeText={setInput}
            placeholder="Log food, gym, run, or ask about progress..."
            placeholderTextColor="$placeholderColor"
            disabled={isPending}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSubmitEditing}
            fontSize={14}
            color={isPending ? "$placeholderColor" : "$color"}
          />
        </View>

        <Button
          unstyled
          onPress={submit}
          disabled={!input.trim() || isPending}
          accessibilityLabel="Send message"
          width={40}
          height={40}
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$background"
          items="center"
          justify="center"
          opacity={!input.trim() || isPending ? 0.4 : 1}
          pressStyle={{ opacity: 0.6 }}
        >
          <Text fontSize={16} color="$color7">{"→"}</Text>
        </Button>
      </XStack>

      {/* Response / status banner */}
      {(isPending || response) && (
        <View
          rounded="$4"
          borderWidth={1}
          borderColor="$borderColor"
          bg="$background"
          px="$4"
          py="$2"
        >
          <Text fontSize={14} color="$placeholderColor">
            {isPending ? "Processing..." : response}
          </Text>
        </View>
      )}
    </YStack>
  );
}
