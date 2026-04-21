import { useState } from "react";
import { styled, XStack, YStack, Text, Button } from "tamagui";
import { motion, AnimatePresence } from "motion/react";
import { ACCENT } from "../../lib/palette";
import { useThemeMode } from "../../lib/theme-context";

type Props = {
  message: string | null;
  status?: "proposed" | "executed" | "info" | "error" | "clarify";
  onDismiss: () => void;
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const BubbleFrame = styled(YStack, {
  name: "BubbleFrame",
  rounded: "$3",
  px: "$3",
  py: "$2",
  gap: "$1",
});

const DismissButton = styled(Button, {
  name: "DismissButton",
  unstyled: true,
  width: 24,
  height: 24,
  items: "center",
  justify: "center",
  rounded: "$2",
  hoverStyle: { opacity: 0.7 },
  pressStyle: { opacity: 0.5 },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reply bubble — shows the last assistant response above the input bar.
 *
 * Rules:
 * - Persists until next message or user dismisses (NO auto-dismiss timer)
 * - Error state: distinct background color
 * - Mutation badge for executed actions
 * - Max 2 lines truncated, tap expands inline
 */
export function ReplyBubble({ message, status = "info", onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { mode } = useThemeMode();

  if (!message) return null;

  const isError = status === "error";

  // Colors — hardcoded hex to avoid purple theme token remapping
  const bg = isError
    ? mode === "dark" ? "#3b1a1a" : "#fde8e8"
    : mode === "dark" ? ACCENT.darker : ACCENT.light;

  const textColor = isError
    ? mode === "dark" ? "#fca5a5" : "#991b1b"
    : mode === "dark" ? "#f0e4f8" : "#1c1917";

  const dismissColor = isError
    ? mode === "dark" ? "#fca5a5" : "#991b1b"
    : mode === "dark" ? "#a0a0a0" : "#737373";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <BubbleFrame bg={bg as never}>
          <XStack items="flex-start" gap="$2">
            <YStack flex={1}>
              {isError && (
                <Text
                  fontSize={11}
                  fontWeight="600"
                  color={dismissColor as never}
                  mb="$0.5"
                >
                  Error
                </Text>
              )}
              <Text
                fontSize={13}
                color={textColor as never}
                lineHeight={18}
                numberOfLines={expanded ? undefined : 2}
                onPress={() => setExpanded((prev) => !prev)}
                cursor="pointer"
              >
                {message}
              </Text>
            </YStack>

            <DismissButton onPress={onDismiss}>
              <Text fontSize={14} color={dismissColor as never}>
                {"\u00d7"}
              </Text>
            </DismissButton>
          </XStack>

          {/* Mutation badge for executed actions */}
          {status === "executed" && (
            <XStack>
              <Text
                fontSize={11}
                color={ACCENT.mid as never}
                fontWeight="500"
                mt="$0.5"
              >
                Logged
              </Text>
            </XStack>
          )}
        </BubbleFrame>
      </motion.div>
    </AnimatePresence>
  );
}
