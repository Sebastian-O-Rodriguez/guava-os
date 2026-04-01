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

export function DayHeader({ dateString, isoDate, onNavigate }: DayHeaderProps) {
  function goBack() {
    onNavigate?.(offsetDate(isoDate, -1));
  }

  function goForward() {
    onNavigate?.(offsetDate(isoDate, 1));
  }

  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3">
      <Button
        unstyled
        backgroundColor="transparent"
        onPress={goBack}
        accessibilityLabel="Previous day"
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.6 }}
      >
        <Text fontSize={20} color="$zinc400" lineHeight={20}>{"‹"}</Text>
      </Button>

      <YStack alignItems="center" gap="$1" flex={1}>
        <Text fontSize={18} fontWeight="600" color="$color" letterSpacing={-0.3} textAlign="center">
          The Stub is the Way
        </Text>
        <Text fontSize={13} color="$placeholderColor" textAlign="center">
          {dateString}
        </Text>
      </YStack>

      <Button
        unstyled
        backgroundColor="transparent"
        onPress={goForward}
        accessibilityLabel="Next day"
        width={32}
        height={32}
        alignItems="center"
        justifyContent="center"
        pressStyle={{ opacity: 0.6 }}
      >
        <Text fontSize={20} color="$zinc400" lineHeight={20}>{"›"}</Text>
      </Button>
    </XStack>
  );
}
