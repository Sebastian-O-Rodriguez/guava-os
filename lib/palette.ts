// RoutineMe — Theme palette config
// Change primary/secondary to retheme the entire app.
// Values map to Tamagui children theme names (green → dark_green, purple → dark_purple, etc.)

// Section palettes — wrap goal sections in <Theme name={SECTION_THEMES.weekly}>
// To retheme later, just change these strings. Any Tamagui children theme works:
// green, purple, blue, orange, pink, red, yellow, teal
export const SECTION_THEMES = {
  weekly: "purple",
  daily: "purple",
  misc: "purple",
} as const;

// Legacy alias
export const PALETTE = {
  primary: SECTION_THEMES.weekly,
  secondary: SECTION_THEMES.daily,
} as const;

// Tile sizing — canonical source is lib/layout.ts TILE_SIZES
// These re-exports maintain backward compatibility for existing imports.
import { TILE_SIZES as _TILE_SIZES } from "./layout";
import type { TileSize as _TileSize } from "./layout";

export type GoalSize = _TileSize;
export const GOAL_SIZES = _TILE_SIZES;

// ---------------------------------------------------------------------------
// Accent hex palette — explicit purple values for components that need
// colored accents without being wrapped in <Theme name="purple">.
// This keeps tiles in the base theme (neutral whites/slates) while
// still using purple for fluid fill and completion states.
// ---------------------------------------------------------------------------

export const ACCENT = {
  // Light purples (for completion bg, borders)
  light: "#ecd9fa",       // purple12 — very pale purple
  lightMid: "#d19dff",    // purple11 — medium light purple
  // Mid purples (for completion supporting text)
  mid: "#8e4ec6",         // purple9 — standard purple
  midLight: "#9a5cd0",    // purple10 — slightly lighter
  // Dark purples (for deep accents)
  dark: "#664282",        // purple7
  darker: "#48295c",      // purple5
  // Fluid fill (very pale, visible on white bg)
  fluidFill: "#ecd9fa",   // purple12 — pale purple wash
  fluidWave: "#d19dff",   // purple11 — slightly deeper for wave tint
} as const;
