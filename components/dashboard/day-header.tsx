import { Platform } from "react-native";
import { XStack, YStack, Text, Button } from "tamagui";

type DayHeaderProps = {
  dateString: string;
  isoDate: string;
  isToday: boolean;
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

export function DayHeader({ dateString, isoDate, isToday, onNavigate }: DayHeaderProps) {
  function goBack() {
    onNavigate?.(offsetDate(isoDate, -1));
  }

  function goForward() {
    if (isToday) return;
    const next = offsetDate(isoDate, 1);
    const todayIso = getTodayIso();
    onNavigate?.(next === todayIso ? todayIso : next);
  }

  if (Platform.OS === "web") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button
          onClick={goBack}
          aria-label="Previous day"
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: -0.3 }}>
            The Stub is the Way
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {dateString}
          </div>
        </div>

        <button
          onClick={goForward}
          disabled={isToday}
          aria-label="Next day"
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: isToday ? "default" : "pointer",
            padding: 0,
            opacity: isToday ? 0.2 : 1,
            flexShrink: 0,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    );
  }

  // Native
  return (
    <XStack alignItems="center" justifyContent="space-between" gap={16}>
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
        <Text fontSize={20} color="$zinc400" lineHeight={20}>{"‹"}</Text>
      </Button>

      <YStack alignItems="center" gap={2} flex={1}>
        <Text fontSize={18} fontWeight="600" color="$color" letterSpacing={-0.3} textAlign="center">
          The Stub is the Way
        </Text>
        <Text fontSize={13} color="$placeholderColor" textAlign="center">
          {dateString}
        </Text>
      </YStack>

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
        <Text fontSize={20} color={isToday ? "$zinc700" : "$zinc400"} lineHeight={20}>{"›"}</Text>
      </Button>
    </XStack>
  );
}
