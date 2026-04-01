import { Stack } from "expo-router";
import { TamaguiProvider, Theme } from "tamagui";
import { StatusBar } from "expo-status-bar";
import config from "../tamagui.config";
import { ThemeModeProvider, useThemeMode } from "../lib/theme-context";

function InnerLayout() {
  const { mode } = useThemeMode();
  return (
    <Theme name={mode}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: mode === "dark" ? "#09090b" : "#fafafa" },
        }}
      />
    </Theme>
  );
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <ThemeModeProvider>
        <InnerLayout />
      </ThemeModeProvider>
    </TamaguiProvider>
  );
}
