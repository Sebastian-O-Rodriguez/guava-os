import { useState } from "react";
import { styled, XStack, YStack, Text, Button } from "tamagui";
import { motion, AnimatePresence } from "motion/react";

type Props = {
  message: string | null;
  status?: "proposed" | "executed" | "info" | "error" | "clarify";
  onDismiss: () => void;
};

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
  width: 36,
  height: 36,
  items: "center",
  justify: "center",
  rounded: "$2",
  hoverStyle: { opacity: 0.7 },
  pressStyle: { opacity: 0.5 },
});

export function ReplyBubble({ message, status = "info", onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!message) return null;

  const isError = status === "error";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <BubbleFrame bg={isError ? "$red2" : "$accent3"}>
          <XStack items="flex-start" gap="$2">
            <YStack flex={1}>
              {isError && (
                <Text fontSize={10} fontWeight="600" color="$red9" mb="$0.5">
                  Error
                </Text>
              )}
              <Text
                fontSize={14}
                color={isError ? "$red11" : "$color12"}
                lineHeight={20}
                numberOfLines={expanded ? undefined : 2}
                onPress={() => setExpanded((prev) => !prev)}
                cursor="pointer"
              >
                {message}
              </Text>
            </YStack>

            <DismissButton onPress={onDismiss}>
              <Text fontSize={14} color="$color7">{"\u00d7"}</Text>
            </DismissButton>
          </XStack>

          {status === "executed" && (
            <Text fontSize={10} color="$accent9" fontWeight="500" mt="$0.5">
              Logged
            </Text>
          )}
        </BubbleFrame>
      </motion.div>
    </AnimatePresence>
  );
}
