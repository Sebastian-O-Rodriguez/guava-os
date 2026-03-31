import { createTamagui, createTokens } from "@tamagui/core";
import { config as defaultConfig } from "@tamagui/config/v3";

const tokens = createTokens({
  ...defaultConfig.tokens,
  color: {
    ...defaultConfig.tokens.color,
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
    emerald400: "#34d399",
    emerald500: "#10b981",
    sky400: "#38bdf8",
    red500: "#ef4444",
    white5: "rgba(255,255,255,0.05)",
    white10: "rgba(255,255,255,0.1)",
  },
});

const appConfig = createTamagui({
  ...defaultConfig,
  tokens,
  themes: {
    dark: {
      background: tokens.color.zinc950,
      backgroundHover: tokens.color.zinc900,
      backgroundPress: tokens.color.zinc800,
      backgroundFocus: tokens.color.zinc800,
      color: tokens.color.zinc50,
      colorHover: tokens.color.zinc200,
      colorPress: tokens.color.zinc300,
      colorFocus: tokens.color.zinc300,
      borderColor: tokens.color.zinc800,
      borderColorHover: tokens.color.zinc700,
      borderColorFocus: tokens.color.zinc600,
      borderColorPress: tokens.color.zinc700,
      placeholderColor: tokens.color.zinc500,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowColorHover: "rgba(0,0,0,0.6)",
    },
  },
  defaultTheme: "dark",
});

export type AppConfig = typeof appConfig;

declare module "@tamagui/core" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default appConfig;
