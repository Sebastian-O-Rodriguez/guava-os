import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { styled, View, Text, XStack, YStack } from "tamagui";
import { useCardLayout } from "../../hooks/use-card-layout";
import {
  CARD_PADDING,
  CARD_BORDER,
  CARD_GAP,
  SECTION_GAP,
  DAILY_TILE_COLUMNS,
  DAILY_DOUGHNUT_MIN,
  DAILY_TWO_COL_MIN,
  TILE_SIZES,
} from "../../lib/layout";
import type { CardLayout, TileSize } from "../../lib/layout";

// ---------------------------------------------------------------------------
// CardBase — low-level primitive. NOT exported for screen use.
// Templates are the only composition entry point.
// ---------------------------------------------------------------------------

const CardBase = styled(YStack, {
  name: "CardBase",
  bg: "$color2",
  borderWidth: CARD_BORDER,
  borderColor: "$color3",
  rounded: "$5",
  p: CARD_PADDING,
});

const CardLabel = styled(Text, {
  name: "CardLabel",
  fontSize: 11,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color: "$color7",
});

const CardError = styled(Text, {
  name: "CardError",
  fontSize: 13,
  fontWeight: "500",
  color: "$red9",
});

const CardEmpty = styled(Text, {
  name: "CardEmpty",
  fontSize: 13,
  fontWeight: "400",
  color: "$color7",
});

// ---------------------------------------------------------------------------
// Layout context — passed to children that need sizing info
// ---------------------------------------------------------------------------

export type { CardLayout };

// ---------------------------------------------------------------------------
// CollectionCard
// ---------------------------------------------------------------------------

type CollectionCardProps = {
  /** Section label — required */
  label: string;
  /** GoalTile elements only. Min 1, max 20. Empty = empty state. */
  children: ReactNode;
  /** Override tile size — normally derived from layout */
  tileSize?: TileSize;
};

/**
 * Collection template — homogeneous repeated items.
 * Only GoalTile children allowed. flexWrap permitted here only.
 */
export function CollectionCard({ label, children, tileSize: tileSizeOverride }: CollectionCardProps) {
  const { layout, onContainerLayout } = useCardLayout();

  const childArray = Children.toArray(children).filter(isValidElement);

  return (
    <CardBase onLayout={onContainerLayout}>
      <YStack gap={SECTION_GAP}>
        <CardLabel>{label}</CardLabel>

        {childArray.length === 0 ? (
          <CardEmpty>No {label.toLowerCase()} goals yet.</CardEmpty>
        ) : (
          <XStack flexWrap="wrap" gap={CARD_GAP} items="flex-start">
            {children}
          </XStack>
        )}
      </YStack>
    </CardBase>
  );
}

// ---------------------------------------------------------------------------
// SummaryBreakdownCard
// ---------------------------------------------------------------------------

type SummaryBreakdownCardProps = {
  /** Section label — required */
  label: string;
  /** Exactly 1 summary visualization — receives available width for sizing */
  summary: ((width: number) => ReactElement) | ReactElement | null;
  /** Exactly 1 breakdown element — required */
  breakdown: ReactElement | null;
  /** Loading state */
  loading?: boolean;
  /** Error state — overrides content */
  error?: string;
};

/**
 * Summary+Breakdown template.
 * Exactly 1 summary + 1 breakdown via props (NOT children).
 * Atomic rendering: both succeed or card shows error.
 * 2-col at wide, 1-col at compact. 50/50 symmetric split.
 */
export function SummaryBreakdownCard({
  label,
  summary,
  breakdown,
  loading,
  error,
}: SummaryBreakdownCardProps) {
  const { layout, onContainerLayout } = useCardLayout();

  // Enforcement: both summary and breakdown must be provided
  const missingSlot = !summary ? "summary" : !breakdown ? "breakdown" : null;

  // Resolve summary — if it's a render function, call with available width
  const summaryWidth = layout.columns === 2 ? layout.summaryWidth : layout.innerWidth;
  const resolvedSummary = typeof summary === "function"
    ? summary(Math.floor(summaryWidth * 0.9))
    : summary;

  return (
    <CardBase onLayout={onContainerLayout}>
      <YStack gap={SECTION_GAP}>
        <CardLabel>{label}</CardLabel>

        {error ? (
          <CardError>{error}</CardError>
        ) : missingSlot ? (
          <CardError>SummaryBreakdownCard: missing required {missingSlot} slot.</CardError>
        ) : loading ? (
          <SummaryBreakdownSkeleton layout={layout} />
        ) : layout.columns === 2 ? (
          <XStack gap={layout.gap} items="center">
            <View width={layout.summaryWidth} items="center">
              {resolvedSummary}
            </View>
            <YStack flex={1} gap={CARD_GAP}>
              {breakdown}
            </YStack>
          </XStack>
        ) : (
          <YStack gap={CARD_GAP} items="center">
            <View width="100%" items="center">
              {resolvedSummary}
            </View>
            <YStack width="100%" gap={CARD_GAP}>
              {breakdown}
            </YStack>
          </YStack>
        )}
      </YStack>
    </CardBase>
  );
}


// ---------------------------------------------------------------------------
// DailyCard
// ---------------------------------------------------------------------------

type DailyCardProps = {
  /** Section label */
  label: string;
  /** GoalTile elements — rendered in explicit grid (left column) */
  children: ReactNode;
  /** Doughnut visualization — rendered in right column */
  doughnut: ((size: number) => ReactElement) | ReactElement;
  /** Tile size override */
  tileSize?: TileSize;
};

/**
 * DailyCard — mixed-content template.
 *
 * LEFT: tile grid (explicit columns, no flexWrap)
 * RIGHT: doughnut chart (visual anchor)
 *
 * At compact width, stacks: tiles on top, doughnut below.
 * Tiles grow by adding rows, never by resizing.
 */
export function DailyCard({ label, children, doughnut, tileSize = "md" }: DailyCardProps) {
  const { layout, onContainerLayout } = useCardLayout();
  const childArray = Children.toArray(children).filter(isValidElement);

  const isCompact = layout.innerWidth < DAILY_TWO_COL_MIN;
  const tilePx = TILE_SIZES[tileSize];

  // Tile grid: explicit columns (max DAILY_TILE_COLUMNS)
  const cols = isCompact
    ? Math.min(Math.floor((layout.innerWidth + CARD_GAP) / (tilePx + CARD_GAP)), DAILY_TILE_COLUMNS)
    : DAILY_TILE_COLUMNS;

  // Grid width: cols × tileSize + (cols-1) × gap
  const gridWidth = cols * tilePx + (cols - 1) * CARD_GAP;

  // Doughnut gets remaining space (side-by-side) or full width (compact)
  const doughnutSize = isCompact
    ? Math.min(layout.innerWidth * 0.6, 200)
    : Math.max(DAILY_DOUGHNUT_MIN, layout.innerWidth - gridWidth - CARD_GAP);

  // Arrange tiles into explicit rows
  const rows: ReactElement[][] = [];
  for (let i = 0; i < childArray.length; i++) {
    const rowIdx = Math.floor(i / cols);
    if (!rows[rowIdx]) rows[rowIdx] = [];
    rows[rowIdx].push(childArray[i] as ReactElement);
  }

  const resolvedDoughnut = typeof doughnut === "function"
    ? doughnut(Math.floor(doughnutSize * 0.9))
    : doughnut;

  const tileGrid = (
    <YStack gap={CARD_GAP}>
      {rows.map((row, ri) => (
        <XStack key={ri} gap={CARD_GAP}>
          {row}
        </XStack>
      ))}
    </YStack>
  );

  return (
    <CardBase onLayout={onContainerLayout}>
      <YStack gap={SECTION_GAP}>
        <CardLabel>{label}</CardLabel>

        {childArray.length === 0 ? (
          <CardEmpty>No {label.toLowerCase()} goals yet.</CardEmpty>
        ) : isCompact ? (
          /* Compact: stack vertically */
          <YStack gap={CARD_GAP} items="center">
            {tileGrid}
            {resolvedDoughnut}
          </YStack>
        ) : (
          /* Wide: explicit side-by-side */
          <XStack gap={CARD_GAP} items="center">
            <View>{tileGrid}</View>
            <View flex={1} items="center">
              {resolvedDoughnut}
            </View>
          </XStack>
        )}
      </YStack>
    </CardBase>
  );
}

// ---------------------------------------------------------------------------
// SingleFocusCard
// ---------------------------------------------------------------------------

type SingleFocusCardProps = {
  /** Section label — required */
  label: string;
  /** Exactly 1 child — required */
  children: ReactNode;
};

/**
 * Single-focus template — one visualization filling the card.
 * Enforces exactly 1 child.
 */
export function SingleFocusCard({ label, children }: SingleFocusCardProps) {
  const { layout, onContainerLayout } = useCardLayout();

  const childArray = Children.toArray(children).filter(isValidElement);

  return (
    <CardBase onLayout={onContainerLayout}>
      <YStack gap={SECTION_GAP}>
        <CardLabel>{label}</CardLabel>

        {childArray.length !== 1 ? (
          <CardError>
            SingleFocusCard: expected exactly 1 child, got {childArray.length}.
          </CardError>
        ) : (
          <View items="center" width="100%">
            {childArray[0]}
          </View>
        )}
      </YStack>
    </CardBase>
  );
}

// ---------------------------------------------------------------------------
// Skeleton placeholders
// ---------------------------------------------------------------------------

function SummaryBreakdownSkeleton({ layout }: { layout: CardLayout }) {
  const skeletonBar = (
    <YStack gap={8}>
      <View height={12} width="60%" bg="$color3" rounded="$2" />
      <View height={16} width="100%" bg="$color3" rounded="$3" />
    </YStack>
  );

  const skeletonCircle = (
    <View
      width={layout.columns === 2 ? layout.summaryWidth * 0.85 : 200}
      height={layout.columns === 2 ? layout.summaryWidth * 0.85 : 200}
      bg="$color3"
      rounded={9999}
      self="center"
    />
  );

  if (layout.columns === 2) {
    return (
      <XStack gap={layout.gap} items="center">
        <View width={layout.summaryWidth} items="center">
          {skeletonCircle}
        </View>
        <YStack flex={1} gap={CARD_GAP}>
          {skeletonBar}
          {skeletonBar}
          {skeletonBar}
        </YStack>
      </XStack>
    );
  }

  return (
    <YStack gap={CARD_GAP} items="center">
      {skeletonCircle}
      <YStack width="100%" gap={CARD_GAP}>
        {skeletonBar}
        {skeletonBar}
        {skeletonBar}
      </YStack>
    </YStack>
  );
}
