import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { YStack, Text } from "tamagui";

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
// Web gauge — jar-shaped CSS gauge matching Next.js liquid-gauge.tsx
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

  const pct = max > 0 ? Math.min((optimisticValue / max) * 100, 150) : 0;
  const fillPct = Math.min(pct, 100);
  const isOver = optimisticValue > max && max > 0;

  const fillColor = isOver
    ? "rgb(56,189,248)" // sky-400
    : pct >= 90
      ? "rgb(52,211,153)" // emerald-400
      : "rgb(16,185,129)"; // emerald-500

  const glowColor = isOver ? "rgba(56,189,248,0.3)" : "transparent";

  const displayValue = Number.isInteger(optimisticValue)
    ? String(optimisticValue)
    : optimisticValue.toFixed(1);

  const jarWidth = size;
  const jarHeight = Math.round(size * 1.4);

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

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, userSelect: "none" }}
      className="group"
    >
      {errorFlash && (
        <span
          style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
          aria-live="assertive"
          aria-atomic="true"
        >
          Failed to save {label}
        </span>
      )}

      {/* Label */}
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

      {/* Jar gauge */}
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={readOnly ? undefined : "button"}
        tabIndex={readOnly ? undefined : 0}
        aria-label={
          readOnly
            ? undefined
            : `${label}: ${displayValue}${unit ? ` ${unit}` : ""}. Click to add ${tapAmount}${unit ? ` ${unit}` : ""}.`
        }
        style={{
          position: "relative",
          overflow: "hidden",
          width: jarWidth,
          height: jarHeight,
          borderRadius: "12px 12px 16px 16px",
          background: "rgba(255,255,255,0.06)",
          border: errorFlash
            ? "1px solid rgba(239,68,68,0.8)"
            : "1px solid rgba(255,255,255,0.12)",
          boxShadow: isOver ? `0 0 20px ${glowColor}, inset 0 0 15px ${glowColor}` : "none",
          cursor: readOnly ? "default" : "pointer",
          opacity: readOnly ? 0.6 : 1,
          transition: "transform 200ms, box-shadow 200ms",
          outline: "none",
        }}
        className={readOnly ? "" : "hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500/60"}
      >
        {/* Fill level */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${fillPct}%`,
            background: `linear-gradient(to top, ${fillColor}, ${fillColor}dd)`,
            borderRadius: "0 0 15px 15px",
            transition: "height 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Wave at fill top */}
          <div
            style={{
              position: "absolute",
              top: -4,
              left: -10,
              right: -10,
              height: 10,
              background: `radial-gradient(ellipse at 50% 100%, ${fillColor}88 0%, transparent 70%)`,
              filter: "blur(3px)",
            }}
          />
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
              opacity: 0.1,
              top: -8,
            } as React.CSSProperties}
            aria-hidden="true"
          >
            <div style={{ color: "white" }}>{icon}</div>
          </div>
        )}

        {/* Value + unit */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: size * 0.2,
              fontWeight: 700,
              color: "white",
              lineHeight: 1,
              fontFamily: "system-ui, sans-serif",
              textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            {displayValue}
          </span>
          {unit && (
            <span
              style={{
                fontSize: size * 0.11,
                fontWeight: 400,
                color: "rgb(161,161,170)",
                lineHeight: 1,
                marginTop: -1,
              }}
            >
              {unit}
            </span>
          )}
        </div>

        {/* Jar lid / cap */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "15%",
            right: "15%",
            height: 5,
            background: "rgba(255,255,255,0.15)",
            borderRadius: "4px 4px 0 0",
          }}
        />
      </div>

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
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            fontSize: 12,
            fontWeight: 600,
            color: "rgb(161,161,170)",
            cursor: canDecrement ? "pointer" : "default",
            transition: "opacity 150ms, color 150ms, border-color 150ms",
          }}
          className={
            canDecrement
              ? "opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 hover:text-zinc-200 hover:border-white/20"
              : "opacity-0 pointer-events-none"
          }
        >
          −
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native gauge — circular fill with React Native Pressable
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

  const bgColor = isOver ? "rgb(30,58,82)" : "rgb(39,39,42)";

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
            backgroundColor: bgColor,
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

      {/* Decrement button */}
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
