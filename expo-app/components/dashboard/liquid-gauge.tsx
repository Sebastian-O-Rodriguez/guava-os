import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { XStack, YStack, Text, Button } from "tamagui";
import { motion, useSpring, useTransform } from "motion/react";

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
// Web gauge — uses motion/react spring for fill animation
// ---------------------------------------------------------------------------

function LiquidGaugeWeb({
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

  useEffect(() => {
    setOptimisticValue(value);
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

  const pct = max > 0 ? Math.min((optimisticValue / max) * 100, 100) : 0;
  const isOver = optimisticValue > max && max > 0;

  const fillColor = isOver
    ? "rgb(56,189,248)" // sky-400
    : pct >= 90
      ? "rgb(52,211,153)" // emerald-400
      : "rgb(16,185,129)"; // emerald-500

  const ringColor = isOver ? "rgb(30,58,82)" : "rgb(39,39,42)";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  // Spring-animated fill height
  const springPct = useSpring(pct, { stiffness: 120, damping: 20 });
  const fillHeight = useTransform(springPct, (v) => `${v}%`);
  const fillY = useTransform(springPct, (v) => `${100 - v}%`);

  function handleClick() {
    if (readOnly) return;
    const snapshot = optimisticValue;
    setOptimisticValue((prev) => prev + tapAmount);
    onIncrement?.(tapAmount, { rollback: () => triggerErrorFlash(snapshot) });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  function handleDecrement(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (readOnly || optimisticValue <= 0) return;
    const snapshot = optimisticValue;
    setOptimisticValue((prev) => Math.max(0, prev - tapAmount));
    onDecrement?.(tapAmount, { rollback: () => triggerErrorFlash(snapshot) });
  }

  const canDecrement = !readOnly && onDecrement != null && optimisticValue > 0;

  const radius = size / 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, userSelect: "none" }} className="group">
      {errorFlash && (
        <span
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
          aria-live="assertive"
          aria-atomic="true"
        >
          Failed to save {label}
        </span>
      )}

      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgb(161,161,170)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>

      {/* Circular gauge */}
      <motion.div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        aria-label={
          readOnly
            ? undefined
            : `${label}: ${displayValue}${unit ? ` ${unit}` : ""}. Click to add ${tapAmount}${unit ? ` ${unit}` : ""}.`
        }
        whileTap={readOnly ? undefined : { scale: 0.95 }}
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: ringColor,
          cursor: readOnly ? "default" : "pointer",
          overflow: "hidden",
          outline: errorFlash ? "2px solid rgba(239,68,68,0.8)" : undefined,
          outlineOffset: errorFlash ? 2 : undefined,
          transition: "outline 150ms",
          opacity: readOnly ? 0.75 : 1,
        }}
      >
        {/* Animated fill */}
        <motion.div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: fillHeight,
            backgroundColor: fillColor,
            transition: "background-color 300ms",
          }}
        />

        {/* Value text centered */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: size * 0.18,
              fontWeight: 700,
              color: "rgb(255,255,255)",
              lineHeight: 1,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {displayValue}
          </span>
          {unit && (
            <span
              style={{
                fontSize: size * 0.1,
                fontWeight: 400,
                color: "rgb(161,161,170)",
                lineHeight: 1,
                marginTop: 2,
              }}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Icon overlay */}
        {icon && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              opacity: 0.15,
              zIndex: 0,
            }}
            aria-hidden="true"
          >
            <div style={{ color: "rgb(250,250,250)", marginTop: -8 }}>{icon}</div>
          </div>
        )}
      </motion.div>

      {/* Decrement button */}
      {onDecrement != null && (
        <button
          onClick={handleDecrement}
          aria-label={`Decrease ${label}`}
          disabled={!canDecrement}
          style={{
            height: 20,
            width: 32,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgb(39,39,42)",
            background: "transparent",
            fontSize: 12,
            fontWeight: 600,
            color: "rgb(161,161,170)",
            cursor: canDecrement ? "pointer" : "default",
            opacity: canDecrement ? undefined : 0,
            transition: "opacity 150ms, color 150ms, border-color 150ms",
          }}
          className="opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
        >
          −
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native gauge — uses React Native Pressable + plain View
// ---------------------------------------------------------------------------

function LiquidGaugeNative({
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

  useEffect(() => {
    setOptimisticValue(value);
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

  const pct = max > 0 ? Math.min((optimisticValue / max) * 100, 100) : 0;
  const isOver = optimisticValue > max && max > 0;

  const fillColor = isOver
    ? "rgb(56,189,248)"
    : pct >= 90
      ? "rgb(52,211,153)"
      : "rgb(16,185,129)";

  const ringColor = isOver ? "rgb(30,58,82)" : "rgb(39,39,42)";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  const fillHeightPx = (pct / 100) * size;

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
    <YStack alignItems="center" gap={4}>
      <Text
        fontSize={10}
        textTransform="uppercase"
        letterSpacing={1}
        color="$zinc400"
        fontWeight="500"
      >
        {label}
      </Text>

      <Pressable
        onPress={handlePress}
        disabled={readOnly}
        accessibilityRole={readOnly ? undefined : "button"}
        accessibilityLabel={
          readOnly
            ? undefined
            : `${label}: ${displayValue}${unit ? ` ${unit}` : ""}. Tap to add ${tapAmount}${unit ? ` ${unit}` : ""}.`
        }
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: ringColor,
            overflow: "hidden",
            opacity: readOnly ? 0.75 : 1,
            borderWidth: errorFlash ? 2 : 0,
            borderColor: "rgba(239,68,68,0.8)",
          }}
        >
          {/* Fill from bottom */}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: fillHeightPx,
              backgroundColor: fillColor,
            }}
          />

          {/* Value text */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            <Text
              fontSize={size * 0.18}
              fontWeight="700"
              color="white"
              lineHeight={size * 0.2}
            >
              {displayValue}
            </Text>
            {unit && (
              <Text fontSize={size * 0.1} color="$zinc400" lineHeight={size * 0.12}>
                {unit}
              </Text>
            )}
          </View>
        </View>
      </Pressable>

      {/* Decrement button — always visible on native */}
      {onDecrement != null && (
        <Pressable
          onPress={handleDecrementPress}
          disabled={!canDecrement}
          accessibilityLabel={`Decrease ${label}`}
        >
          <View
            style={{
              height: 20,
              width: 32,
              borderRadius: 4,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgb(39,39,42)",
              opacity: canDecrement ? 1 : 0,
            }}
          >
            <Text fontSize={12} fontWeight="600" color="$zinc400">
              −
            </Text>
          </View>
        </Pressable>
      )}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Public export — platform-switches
// ---------------------------------------------------------------------------

export function LiquidGauge(props: LiquidGaugeProps) {
  if (Platform.OS === "web") {
    return <LiquidGaugeWeb {...props} />;
  }
  return <LiquidGaugeNative {...props} />;
}
