import { View, Text, XStack, YStack } from "tamagui";
import { ACCENT } from "../../lib/palette";

type Props = {
  label: string;
  value: number;
  max: number;
  unit?: string;
};

/**
 * Minimal progress bar — label + bar + value/max.
 * Uses ACCENT hex colors (not theme tokens) for consistency with tiles.
 */
export function ProgressBar({ label, value, max, unit }: Props) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isComplete = value >= max;

  return (
    <YStack gap="$1">
      <XStack justify="space-between" items="center">
        <Text fontSize={14} fontWeight="500" color="$color11">{label}</Text>
        <Text fontSize={12} color="$color7">
          {value}{unit ? ` ${unit}` : ""} / {max}
        </Text>
      </XStack>
      <View height={6} bg="$color3" rounded="$2" overflow="hidden">
        <View
          height={6}
          rounded="$2"
          bg={isComplete ? (ACCENT.mid as never) : (ACCENT.lightMid as never)}
          width={`${pct}%` as never}
        />
      </View>
    </YStack>
  );
}
