// RoutineMe — Layout system constants
// Single source of truth for card layout. No deviations.

// ---------------------------------------------------------------------------
// Spacing (Tamagui token values in pixels)
// ---------------------------------------------------------------------------

/** Card internal padding — matches Tamagui $4 */
export const CARD_PADDING = 18;

/** Card border width */
export const CARD_BORDER = 1;

/** Gap between columns inside a card, and between tiles — matches Tamagui $3 */
export const CARD_GAP = 13;

/** Content max width */
export const CONTENT_MAX_WIDTH = 620;

/** Content horizontal padding — matches Tamagui $2.5 */
export const CONTENT_PADDING = 10;

/** Gap between cards — matches Content gap $2.5 */
export const CONTENT_GAP = 10;

/** Section label to content gap — matches Tamagui $3 */
export const SECTION_GAP = 13;

// ---------------------------------------------------------------------------
// Tile sizes (tokenized — no arbitrary pixel values)
// ---------------------------------------------------------------------------

export type TileSize = "sm" | "md";

export const TILE_SIZES: Record<TileSize, number> = {
  sm: 64,
  md: 80,
};

/** Max tile columns cap */
export const MAX_TILE_COLUMNS = 6;

/** Max tile columns in DailyCard tile grid (left column) */
export const DAILY_TILE_COLUMNS = 3;

/** Minimum doughnut size in DailyCard */
export const DAILY_DOUGHNUT_MIN = 140;

/**
 * Minimum card inner width for DailyCard side-by-side layout.
 * Derived: 3 tiles × 80px + 2 gaps × 13px + card gap + doughnut(140) = 406px
 */
export const DAILY_TWO_COL_MIN = 406;

/** Supported habit range: 1–20. Beyond 20 is undefined/future. */
export const MAX_SUPPORTED_HABITS = 20;

// ---------------------------------------------------------------------------
// Breakpoint
// ---------------------------------------------------------------------------

/**
 * Minimum card inner width for 2-column layout.
 * Derived from measured minimums:
 *   doughnut(160) + gap(13) + bars(150) = 323px
 *   + headroom for legend (191px) alignment = 402px
 */
export const TWO_COL_MIN_INNER_WIDTH = 402;

// ---------------------------------------------------------------------------
// Layout computation (pure functions — no React, testable independently)
// ---------------------------------------------------------------------------

export type CardLayout = {
  /** Number of columns for Summary+Breakdown (1 or 2) */
  columns: 1 | 2;
  /** Inner width of the card (after padding + border) */
  innerWidth: number;
  /** Gap between columns and between tiles */
  gap: number;
  /** Whether we're in compact (1-col) mode */
  isCompact: boolean;
  /** Width for the summary slot in Summary+Breakdown (50/50 split) */
  summaryWidth: number;
  /** Width for the breakdown slot in Summary+Breakdown (50/50 split) */
  breakdownWidth: number;
  /** GoalTile size token to use */
  tileSize: TileSize;
  /** Max tile columns for Collection template */
  maxTileColumns: number;
};

/** Compute card inner width from container width */
export function computeCardInnerWidth(containerWidth: number): number {
  return containerWidth - 2 * CARD_PADDING - 2 * CARD_BORDER;
}

/** Compute full layout from inner width. Pure function. */
export function computeLayout(innerWidth: number): CardLayout {
  const isCompact = innerWidth < TWO_COL_MIN_INNER_WIDTH;
  const columns: 1 | 2 = isCompact ? 1 : 2;
  const gap = CARD_GAP;

  // Symmetric split — asymmetry requires measurable failure proof
  const halfWidth = columns === 2 ? (innerWidth - gap) / 2 : innerWidth;
  const summaryWidth = halfWidth;
  const breakdownWidth = halfWidth;

  const tileSize: TileSize = isCompact ? "sm" : "md";
  const tilePx = TILE_SIZES[tileSize];
  const rawCols = Math.floor((innerWidth + gap) / (tilePx + gap));
  const maxTileColumns = Math.min(rawCols, MAX_TILE_COLUMNS);

  return {
    columns,
    innerWidth,
    gap,
    isCompact,
    summaryWidth,
    breakdownWidth,
    tileSize,
    maxTileColumns,
  };
}
