import { ScrollView } from "react-native";
import { styled, XStack, Text } from "tamagui";
import { motion, AnimatePresence } from "motion/react";
import type { Suggestion } from "../../lib/suggestions";

type Props = {
  suggestions: Suggestion[];
  visible: boolean;
  compact?: boolean;
  onSelect: (suggestion: Suggestion) => void;
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Chip = styled(XStack, {
  name: "SuggestionChip",
  bg: "$color3",
  rounded: "$10",
  px: "$2.5",
  height: 32,
  items: "center",
  cursor: "pointer",
  hoverStyle: { bg: "$color4" },
  pressStyle: { bg: "$color5", opacity: 0.8 },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Suggestion row — horizontal scrollable chips below the input bar.
 *
 * Rules:
 * - Tap: prefills input + focuses (does NOT send)
 * - Collapse on typing (visible=false), reappear on clear
 * - Compact (<406px): max 3 chips, 13px text
 * - Wide (≥406px): max 4 chips, 14px text
 * - Post-action: reactive suggestions based on last action
 */
export function SuggestionRow({ suggestions, visible, compact, onSelect }: Props) {
  const maxChips = compact ? 3 : 4;
  const fontSize = compact ? 13 : 14;
  const displaySuggestions = suggestions.slice(0, maxChips);

  return (
    <AnimatePresence>
      {visible && displaySuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          style={{ overflow: "hidden" }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          >
            {displaySuggestions.map((suggestion) => (
              <Chip
                key={suggestion.id}
                onPress={() => onSelect(suggestion)}
                accessibilityLabel={suggestion.label}
                accessibilityRole="button"
              >
                <Text
                  fontSize={fontSize}
                  color="$color11"
                  fontWeight="400"
                  numberOfLines={1}
                >
                  {suggestion.label}
                </Text>
              </Chip>
            ))}
          </ScrollView>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
