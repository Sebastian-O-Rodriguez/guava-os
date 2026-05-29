import { Stack, useRouter, useSegments } from "expo-router";
import { TamaguiProvider, Theme } from "tamagui";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import config from "../tamagui.config";
import { ThemeModeProvider, useThemeMode } from "../lib/theme-context";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { ActionModalProvider } from "../lib/action-modal-context";
import { ActionModal } from "../components/ui/action-modal";

/**
 * Auth guard — redirects to /auth if not logged in.
 * Allows /auth route without session.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const onAuthPage = segments[0] === "auth";

    if (!session && !onAuthPage) {
      router.replace("/auth");
    } else if (session && onAuthPage) {
      router.replace("/");
    }
  }, [session, loading, segments]);

  if (loading) return null;

  return <>{children}</>;
}

function InnerLayout() {
  const { mode } = useThemeMode();
  return (
    <Theme name={mode}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: mode === "dark" ? "hsl(5, 6%, 7%)" : "#FEFEFE",
            },
          }}
        />
        <ActionModal />
      </AuthGate>
    </Theme>
  );
}

/**
 * Load fonts dynamically — avoids expo-font SSR crash on web.
 * On native, uses expo-font useFonts hook.
 * On web, fonts load via Tamagui config (CSS @font-face).
 */
function useFontsLoaded(): boolean {
  const [loaded, setLoaded] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS === "web") return;
    // Dynamic import to avoid SSR crash
    Promise.all([
      import("expo-font"),
      import("@expo-google-fonts/plus-jakarta-sans"),
      import("@expo-google-fonts/inter"),
      import("@expo-google-fonts/jetbrains-mono"),
    ]).then(([expoFont, jakarta, inter, jetbrains]) => {
      expoFont.loadAsync({
        "Plus Jakarta Sans": jakarta.PlusJakartaSans_400Regular,
        PlusJakartaSans_300Light: jakarta.PlusJakartaSans_300Light,
        PlusJakartaSans_400Regular: jakarta.PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium: jakarta.PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold: jakarta.PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold: jakarta.PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold: jakarta.PlusJakartaSans_800ExtraBold,
        Inter_300Light: inter.Inter_300Light,
        Inter_400Regular: inter.Inter_400Regular,
        Inter_500Medium: inter.Inter_500Medium,
        Inter_600SemiBold: inter.Inter_600SemiBold,
        Inter_700Bold: inter.Inter_700Bold,
        Inter_800ExtraBold: inter.Inter_800ExtraBold,
        "JetBrains Mono": jetbrains.JetBrainsMono_400Regular,
        JetBrainsMono_400Regular: jetbrains.JetBrainsMono_400Regular,
        JetBrainsMono_700Bold: jetbrains.JetBrainsMono_700Bold,
      }).then(() => setLoaded(true));
    });
  }, []);

  return loaded;
}

export default function RootLayout() {
  const fontsLoaded = useFontsLoaded();

  if (!fontsLoaded) return null;

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <ThemeModeProvider>
        <AuthProvider>
          <ActionModalProvider>
            <InnerLayout />
          </ActionModalProvider>
        </AuthProvider>
      </ThemeModeProvider>
    </TamaguiProvider>
  );
}
