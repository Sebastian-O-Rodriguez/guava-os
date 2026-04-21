import { useState, useCallback } from "react";
import { computeCardInnerWidth, computeLayout, CARD_GAP } from "../lib/layout";
import type { CardLayout } from "../lib/layout";

/**
 * useCardLayout — measures actual container width via onLayout.
 *
 * Returns the CardLayout object that ALL templates consume.
 * No inline breakpoint logic anywhere else.
 *
 * Usage:
 *   const { layout, onContainerLayout } = useCardLayout();
 *   <View onLayout={onContainerLayout}>...</View>
 *
 * The layout is derived from measured container width, not viewport inference.
 * This hook cannot be safely nested inside non-standard containers without
 * re-measurement — it measures the element it's attached to.
 */
export function useCardLayout() {
  const [layout, setLayout] = useState<CardLayout>(() =>
    // Default to a reasonable starting layout before first measurement
    computeLayout(computeCardInnerWidth(400))
  );

  const onContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const containerWidth = event.nativeEvent.layout.width;
      const innerWidth = computeCardInnerWidth(containerWidth);
      setLayout(computeLayout(innerWidth));
    },
    [],
  );

  return { layout, onContainerLayout };
}
