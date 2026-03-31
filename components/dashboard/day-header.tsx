import { Platform } from "react-native";
import { XStack, YStack, Text, Button } from "tamagui";

type DayHeaderProps = {
  dateString: string;
  /** YYYY-MM-DD of the currently viewed date */
  isoDate: string;
  /** True when the viewed date is today — disables the forward button */
  isToday: boolean;
  /** Called with the new ISO date string when the user navigates */
  onNavigate?: (isoDate: string) => void;
};

function offsetDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

function getTodayIso(): string {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Chevron icons — simple SVG on web, text on native
// ---------------------------------------------------------------------------

function ChevronLeft({ disabled }: { disabled?: boolean }) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={disabled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.4)"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    );
  }
  return (
    <Text fontSize={20} color={disabled ? "$zinc700" : "$zinc400"} lineHeight={20}>
      {"‹"}
    </Text>
  );
}

function ChevronRight({ disabled }: { disabled?: boolean }) {
  if (Platform.OS === "web") {
    return (
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={disabled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.4)"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    );
  }
  return (
    <Text fontSize={20} color={disabled ? "$zinc700" : "$zinc400"} lineHeight={20}>
      {"›"}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DayHeader({ dateString, isoDate, isToday, onNavigate }: DayHeaderProps) {
  function goBack() {
    onNavigate?.(offsetDate(isoDate, -1));
  }

  function goForward() {
    if (isToday) return;
    const next = offsetDate(isoDate, 1);
    const todayIso = getTodayIso();
    // When next is today, navigate to today (canonical)
    onNavigate?.(next === todayIso ? todayIso : next);
  }

  return (
    <XStack alignItems="center" justifyContent="space-between" gap={16}>
      {/* Back button */}
      <Button
        unstyled
        onPress={goBack}
        accessibilityLabel="Previous day"
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        borderRadius={8}
        pressStyle={{ opacity: 0.6 }}
      >
        <ChevronLeft />
      </Button>

      {/* Title + date */}
      <YStack alignItems="center" gap={2} flex={1}>
        <Text
          fontSize={18}
          fontWeight="600"
          color={Platform.OS === "web" ? "rgba(255,255,255,0.9)" : "$color"}
          letterSpacing={-0.3}
          textAlign="center"
        >
          The Stub is the Way
        </Text>
        <Text
          fontSize={13}
          color={Platform.OS === "web" ? "rgba(255,255,255,0.4)" : "$placeholderColor"}
          textAlign="center"
        >
          {dateString}
        </Text>
      </YStack>

      {/* Forward button */}
      <Button
        unstyled
        onPress={goForward}
        disabled={isToday}
        accessibilityLabel="Next day"
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        borderRadius={8}
        pressStyle={{ opacity: 0.6 }}
        opacity={isToday ? 0.3 : 1}
      >
        <ChevronRight disabled={isToday} />
      </Button>
    </XStack>
  );
}
