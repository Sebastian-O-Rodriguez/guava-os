import { useEffect, useRef, useState } from "react";
import { YStack, View } from "tamagui";
import { TileFrame, TileLabel, TileValue, TileDenom, TileUnit } from "../ui/tile";
import { TileFluidFill } from "../ui/tile-fluid-fill";
import type { TileSize } from "../../lib/layout";

export type TileCallbacks = { rollback: () => void };

type Props = {
  label: string;
  value: number;
  max: number;
  unit?: string;
  size?: TileSize;
  tapAmount?: number;
  onIncrement?: (amount: number, cbs: TileCallbacks) => void;
  onLongPress?: () => void;
};

export function GoalTile({
  label,
  value,
  max,
  unit,
  size = "md",
  tapAmount = 1,
  onIncrement,
  onLongPress,
}: Props) {
  const [val, setVal] = useState(value);
  const [flash, setFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServer = useRef(value);

  useEffect(() => {
    if (value !== lastServer.current) {
      lastServer.current = value;
      setVal(value);
    }
  }, [value]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function rollback(snapshot: number) {
    setVal(snapshot);
    setFlash(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setFlash(false), 1000);
  }

  const pct = max > 0 ? (val / max) * 100 : 0;
  const fillPct = Math.min(pct, 100);
  const isOver = val > max && max > 0;
  const isDone = fillPct >= 100;

  const state = flash
    ? "error" as const
    : isOver
      ? "over" as const
      : isDone
        ? "complete" as const
        : "idle" as const;

  const display = Number.isInteger(val) ? String(val) : val.toFixed(1);

  function handleTap() {
    const snap = val;
    setVal((v) => v + tapAmount);
    onIncrement?.(tapAmount, { rollback: () => rollback(snap) });
  }

  return (
    <YStack items="center" gap="$1" select="none">
      <TileLabel>{label}</TileLabel>
      <TileFrame
        size={size}
        tileState={state}
        onPress={handleTap}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}${unit ? ` ${unit}` : ""}. Tap to add ${tapAmount}.`}
        hoverStyle={{ borderColor: "$color5" }}
        pressStyle={{ opacity: 0.85 }}
      >
        {/* Fluid fill — animated wave on web, solid on native */}
        <TileFluidFill
          fillPct={fillPct}
          isComplete={isDone}
          isOver={isOver}
          size={size}
        />

        {/* Text overlay */}
        <View position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" pointerEvents="none">
          <View flexDirection="row" items="baseline" gap={2}>
            <TileValue size={size} complete={isDone || isOver}>{display}</TileValue>
            {unit && <TileUnit size={size} complete={isDone || isOver}>{unit}</TileUnit>}
          </View>
          <TileDenom size={size} complete={isDone || isOver}>/ {max}</TileDenom>
        </View>
      </TileFrame>
    </YStack>
  );
}
