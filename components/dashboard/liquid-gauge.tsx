import { useEffect, useRef, useState } from "react";
import { styled, YStack, Text, Button, View } from "tamagui";

export type GaugeActionCallbacks = {
  rollback: () => void;
};

type LiquidGaugeProps = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  size?: number;
  onIncrement?: (amount: number, cbs: GaugeActionCallbacks) => void;
  onDecrement?: (amount: number, cbs: GaugeActionCallbacks) => void;
  tapAmount?: number;
  icon?: React.ReactNode;
  readOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Styled jar container
// ---------------------------------------------------------------------------

const JarContainer = styled(View, {
  name: "JarContainer",
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "$white12",
  backgroundColor: "$white6",

  variants: {
    hasError: {
      true: {
        borderColor: "$errorBorder",
      },
      false: {},
    },
    isOver: {
      true: {
        borderColor: "$fillOverflow",
        shadowColor: "$fillOverflowGlow",
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
      },
      false: {},
    },
    interactive: {
      true: {
        hoverStyle: {
          borderColor: "$white15",
        },
        pressStyle: {
          opacity: 0.85,
        },
      },
      false: {},
    },
  } as const,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiquidGauge({
  label,
  value,
  max,
  unit,
  size = 80,
  onIncrement,
  onDecrement,
  tapAmount = 1,
  icon,
  readOnly = false,
}: LiquidGaugeProps) {
  const [optimisticValue, setOptimisticValue] = useState(value);
  const [errorFlash, setErrorFlash] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerValue = useRef(value);

  // Only sync from server when the server value actually changed
  // (not when parent re-renders with same stale value)
  useEffect(() => {
    if (value !== lastServerValue.current) {
      lastServerValue.current = value;
      setOptimisticValue(value);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  function triggerErrorFlash(snapshot: number) {
    setOptimisticValue(snapshot);
    setErrorFlash(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorFlash(false), 1200);
  }

  const pct = max > 0 ? Math.min((optimisticValue / max) * 100, 150) : 0;
  const fillPct = Math.min(pct, 100);
  const isOver = optimisticValue > max && max > 0;

  const fillColor: string = isOver
    ? "$fillOverflow"
    : pct >= 90
      ? "$fillHigh"
      : "$fillDefault";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  const jarWidth = size;
  const jarHeight = Math.round(size * 1.4);

  function handlePress() {
    if (readOnly) return;
    const snapshot = optimisticValue;
    setOptimisticValue((prev) => prev + tapAmount);
    onIncrement?.(tapAmount, { rollback: () => triggerErrorFlash(snapshot) });
  }

  function handleDecrementPress() {
    if (readOnly || optimisticValue <= 0) return;
    const snapshot = optimisticValue;
    setOptimisticValue((prev) => Math.max(0, prev - tapAmount));
    onDecrement?.(tapAmount, { rollback: () => triggerErrorFlash(snapshot) });
  }

  const canDecrement = !readOnly && onDecrement != null && optimisticValue > 0;

  return (
    <YStack alignItems="center" gap="$1.5" userSelect="none">
      {/* Label */}
      <Text
        fontSize={10}
        textTransform="uppercase"
        letterSpacing={1}
        color="$zinc400"
        fontWeight="500"
      >
        {label}
      </Text>

      {/* Jar gauge tap target */}
      <JarContainer
        width={jarWidth}
        height={jarHeight}
        borderRadius={12}
        hasError={errorFlash}
        isOver={isOver}
        interactive={!readOnly}
        opacity={readOnly ? 0.6 : 1}
        onPress={readOnly ? undefined : handlePress}
        accessibilityRole={readOnly ? undefined : "button"}
        accessibilityLabel={
          readOnly
            ? undefined
            : `${label}: ${displayValue}${unit ? ` ${unit}` : ""}. Tap to add ${tapAmount}${unit ? ` ${unit}` : ""}.`
        }
      >
        {/* Fill level */}
        <YStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          height={`${fillPct}%` as unknown as number}
          backgroundColor={fillColor}
          borderRadius={15}
        />

        {/* Icon overlay */}
        {icon && (
          <View
            position="absolute"
            top={-8}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            opacity={0.1}
            pointerEvents="none"
          >
            {icon}
          </View>
        )}

        {/* Value + unit */}
        <View
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <Text
            fontSize={size * 0.2}
            fontWeight="700"
            color="$white50"
            lineHeight={size * 0.22}
          >
            {displayValue}
          </Text>
          {unit && (
            <Text
              fontSize={size * 0.11}
              fontWeight="400"
              color="$zinc400"
              lineHeight={size * 0.14}
            >
              {unit}
            </Text>
          )}
        </View>

        {/* Jar lid / cap */}
        <View
          position="absolute"
          top={0}
          left="15%"
          right="15%"
          height={5}
          backgroundColor="$glassLid"
          borderRadius={4}
        />
      </JarContainer>

      {/* Decrement button */}
      {onDecrement != null && (
        <Button
          unstyled
          onPress={handleDecrementPress}
          disabled={!canDecrement}
          accessibilityLabel={`Decrease ${label}`}
          height={20}
          width={32}
          borderRadius="$1"
          borderWidth={1}
          borderColor="$white10"
          backgroundColor="$white5"
          alignItems="center"
          justifyContent="center"
          opacity={canDecrement ? 1 : 0}
          pressStyle={{ opacity: 0.6 }}
        >
          <Text fontSize={12} fontWeight="600" color="$zinc400">
            {"−"}
          </Text>
        </Button>
      )}
    </YStack>
  );
}
