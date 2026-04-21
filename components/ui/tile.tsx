import { styled, View, Text } from "tamagui";
import { TILE_SIZES } from "../../lib/layout";
import { ACCENT } from "../../lib/palette";

// ---------------------------------------------------------------------------
// TileFrame — square tile
//
// Uses base theme tokens for neutral bg/text (white, slate).
// Purple accent colors come from ACCENT hex constants, not theme tokens,
// so tiles do NOT need to be wrapped in <Theme name="purple">.
// ---------------------------------------------------------------------------

export const TileFrame = styled(View, {
  name: "TileFrame",
  overflow: "hidden",
  borderWidth: 2.5,
  borderColor: "#2a2a2a",
  bg: "#ffffff",
  rounded: "$3",
  position: "relative",

  variants: {
    size: {
      sm: { width: TILE_SIZES.sm, height: TILE_SIZES.sm },
      md: { width: TILE_SIZES.md, height: TILE_SIZES.md },
    },
    tileState: {
      idle: {
        borderColor: "$color3",
      },
      complete: {
        borderColor: ACCENT.light,
      },
      over: {
        borderColor: "$blue9",
        shadowColor: "$blue9",
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
      },
      error: {
        borderColor: "$red9",
      },
    },
  } as const,

  defaultVariants: {
    size: "md",
    tileState: "idle",
  },
});

// ---------------------------------------------------------------------------
// TileFill — legacy solid fill (kept for compat, not used by fluid tiles)
// ---------------------------------------------------------------------------

export const TileFill = styled(View, {
  name: "TileFill",
  position: "absolute",
  b: 0,
  l: 0,
  r: 0,

  variants: {
    tone: {
      under: { bg: "$color5" },
      complete: { bg: "$color9" },
      over: { bg: "$blue9" },
    },
  } as const,

  defaultVariants: { tone: "under" },
});

// ---------------------------------------------------------------------------
// TileLabel — small text above tile
// ---------------------------------------------------------------------------

export const TileLabel = styled(Text, {
  name: "TileLabel",
  fontSize: 10,
  fontWeight: "500",
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "$color8",
  text: "center",
});

// ---------------------------------------------------------------------------
// TileValue — big number inside tile
//
// Default: dark slate on white bg (in-progress)
// Complete: white on purple bg
// ---------------------------------------------------------------------------

export const TileValue = styled(Text, {
  name: "TileValue",
  fontWeight: "700",
  color: "#1c1917",
  text: "center",

  variants: {
    size: {
      sm: { fontSize: 14 },
      md: { fontSize: 18 },
    },
    complete: {
      true: { color: "$color12" },
    },
  } as const,

  defaultVariants: { size: "md" },
});

// ---------------------------------------------------------------------------
// TileDenom — "/ 5" text
//
// Default: dark supporting on white bg
// Complete: slate on purple bg (slightly darker than bg)
// ---------------------------------------------------------------------------

export const TileDenom = styled(Text, {
  name: "TileDenom",
  fontWeight: "400",
  color: "#664282",
  text: "center",

  variants: {
    size: {
      sm: { fontSize: 8 },
      md: { fontSize: 10 },
    },
    complete: {
      true: { color: ACCENT.dark as any },
    },
  } as const,

  defaultVariants: { size: "md" },
});

// ---------------------------------------------------------------------------
// TileUnit — unit text next to value
//
// Default: dark supporting on white bg
// Complete: slate on purple bg
// ---------------------------------------------------------------------------

export const TileUnit = styled(Text, {
  name: "TileUnit",
  fontWeight: "400",
  color: "#664282",
  text: "center",

  variants: {
    size: {
      sm: { fontSize: 7 },
      md: { fontSize: 8 },
    },
    complete: {
      true: { color: ACCENT.dark as any },
    },
  } as const,

  defaultVariants: { size: "md" },
});
