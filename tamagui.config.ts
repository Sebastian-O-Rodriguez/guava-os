import { createTamagui, createTokens } from "@tamagui/core";
import { createAnimations } from "@tamagui/animations-reanimated";
import { config as defaultConfig } from "@tamagui/config/v3";

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const animations = createAnimations({
  fast: { type: "spring", damping: 20, stiffness: 250 },
  medium: { type: "spring", damping: 15, stiffness: 150 },
  slow: { type: "spring", damping: 20, stiffness: 60 },
  tooltip: { type: "spring", damping: 10, stiffness: 100 },
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const tokens = createTokens({
  ...defaultConfig.tokens,

  color: {
    // Inherit all default palette tokens
    ...defaultConfig.tokens.color,

    // Zinc scale
    zinc50: "#fafafa",
    zinc100: "#f4f4f5",
    zinc200: "#e4e4e7",
    zinc300: "#d4d4d8",
    zinc400: "#a1a1aa",
    zinc500: "#71717a",
    zinc600: "#52525b",
    zinc700: "#3f3f46",
    zinc800: "#27272a",
    zinc900: "#18181b",
    zinc950: "#09090b",

    // Named palette
    emerald400: "#34d399",
    emerald500: "#10b981",
    sky400: "#38bdf8",
    red500: "#ef4444",
    amber400: "#fbbf24",

    // White alpha utilities
    white3: "rgba(255,255,255,0.03)",
    white5: "rgba(255,255,255,0.05)",
    white6: "rgba(255,255,255,0.06)",
    white8: "rgba(255,255,255,0.08)",
    white10: "rgba(255,255,255,0.1)",
    white12: "rgba(255,255,255,0.12)",
    white15: "rgba(255,255,255,0.15)",
    white50: "rgba(255,255,255,0.5)",

    // Glass aesthetic
    glassBackground: "rgba(255,255,255,0.03)",
    glassBorder: "rgba(255,255,255,0.08)",
    glassBackgroundHover: "rgba(255,255,255,0.06)",
    glassLid: "rgba(255,255,255,0.15)",

    // Overflow glow / error border
    sky400Glow: "rgba(56,189,248,0.3)",
    red500Border: "rgba(239,68,68,0.8)",

    // Gauge fill states
    fillDefault: "#10b981",
    fillHigh: "#34d399",
    fillOverflow: "#38bdf8",
    fillOverflowGlow: "rgba(56,189,248,0.3)",

    // Semantic status
    success: "#34d399",
    error: "#ef4444",
    warning: "#fbbf24",

    // Text variants (alpha-based, no token reference — raw values required here)
    textPrimary: "rgba(255,255,255,0.9)",
    textSecondary: "rgba(255,255,255,0.5)",
    textMuted: "rgba(255,255,255,0.4)",
    textDisabled: "rgba(255,255,255,0.2)",
  },
});

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const darkTheme = {
  // Base backgrounds
  background: tokens.color.zinc950,
  backgroundHover: tokens.color.zinc900,
  backgroundPress: tokens.color.zinc800,
  backgroundFocus: tokens.color.zinc800,

  // Foreground
  color: tokens.color.textPrimary,
  colorHover: "rgba(255,255,255,0.95)",
  colorPress: tokens.color.textSecondary,
  colorFocus: tokens.color.textSecondary,

  // Borders
  borderColor: tokens.color.zinc800,
  borderColorHover: tokens.color.zinc700,
  borderColorFocus: tokens.color.zinc600,
  borderColorPress: tokens.color.zinc700,

  // Input placeholder
  placeholderColor: tokens.color.textMuted,

  // Glass card surfaces
  glassBackground: tokens.color.glassBackground,
  glassBorder: tokens.color.glassBorder,
  glassBackgroundHover: tokens.color.glassBackgroundHover,
  glassLid: tokens.color.glassLid,

  // Error / overflow border
  errorBorder: tokens.color.red500Border,

  // Shadows
  shadowColor: "rgba(0,0,0,0.5)",
  shadowColorHover: "rgba(0,0,0,0.6)",

  // Gauge fills (available as theme values for components)
  fillDefault: tokens.color.fillDefault,
  fillHigh: tokens.color.fillHigh,
  fillOverflow: tokens.color.fillOverflow,
  fillOverflowGlow: tokens.color.fillOverflowGlow,

  // Status
  success: tokens.color.success,
  error: tokens.color.error,
  warning: tokens.color.warning,
};

// ---------------------------------------------------------------------------
// App config
// ---------------------------------------------------------------------------

const appConfig = createTamagui({
  ...defaultConfig,

  animations,
  tokens,

  themes: {
    dark: darkTheme,
  },

  defaultTheme: "dark",

  settings: {
    styleCompat: "react-native",
  },
});

// ---------------------------------------------------------------------------
// Type augmentation
// ---------------------------------------------------------------------------

export type AppConfig = typeof appConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default appConfig;
