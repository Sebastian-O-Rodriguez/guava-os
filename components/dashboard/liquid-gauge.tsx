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
  borderColor: "rgba(255,255,255,0.12)",
  bg: "rgba(255,255,255,0.06)",

  variants: {
    hasError: {
      true: {
        borderColor: "$red9",
      },
      false: {},
    },
    isOver: {
      true: {
        borderColor: "$blue9",
        shadowColor: "rgba(59,130,246,0.4)",
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
      },
      false: {},
    },
    interactive: {
      true: {
        hoverStyle: {
          borderColor: "rgba(255,255,255,0.15)",
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

  // Use raw colors since custom tokens are gone in v5
  const fillColor: string = isOver
    ? "rgb(59,130,246)"   // blue-500
    : pct >= 90
      ? "rgb(52,211,153)" // emerald-400
      : "rgb(16,185,129)"; // emerald-500

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
    <YStack items="center" gap="$1.5" select="none">
      {/* Label */}
      <Text
        fontSize={10}
        textTransform="uppercase"
        letterSpacing={1}
        color="$color7"
        fontWeight="500"
      >
        {label}
      </Text>

      {/* Jar gauge tap target */}
      <JarContainer
        width={jarWidth}
        height={jarHeight}
        rounded={12}
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
        <View
          position="absolute"
          b={0}
          l={0}
          r={0}
          height={`${fillPct}%` as unknown as number}
          bg={fillColor as never}
          rounded={15}
        />

        {/* Icon overlay */}
        {icon && (
          <View
            position="absolute"
            t={-8}
            l={0}
            r={0}
            b={0}
            items="center"
            justify="center"
            opacity={0.1}
            pointerEvents="none"
          >
            {icon}
          </View>
        )}

        {/* Value + unit */}
        <View
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          items="center"
          justify="center"
          pointerEvents="none"
        >
          <Text
            fontSize={size * 0.2}
            fontWeight="700"
            color={"rgba(255,255,255,0.9)" as never}
            lineHeight={size * 0.22}
          >
            {displayValue}
          </Text>
          {unit && (
            <Text
              fontSize={size * 0.11}
              fontWeight="400"
              color="$color7"
              lineHeight={size * 0.14}
            >
              {unit}
            </Text>
          )}
        </View>

        {/* Jar lid / cap */}
        <View
          position="absolute"
          t={0}
          l="15%"
          r="15%"
          height={5}
          bg="rgba(255,255,255,0.15)"
          rounded={4}
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
          rounded="$1"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.10)"
          bg="rgba(255,255,255,0.05)"
          items="center"
          justify="center"
          opacity={canDecrement ? 1 : 0}
          pressStyle={{ opacity: 0.6 }}
        >
          <Text fontSize={12} fontWeight="600" color="$color7">
            {"−"}
          </Text>
        </Button>
      )}
    </YStack>
  );
}
