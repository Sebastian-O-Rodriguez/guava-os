import { Stack } from "expo-router";
import { TamaguiProvider, Theme } from "tamagui";
import { StatusBar } from "expo-status-bar";
import config from "../tamagui.config";

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Theme name="dark">
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#09090b" },
          }}
        />
      </Theme>
    </TamaguiProvider>
  );
}
