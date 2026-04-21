import { Stack, useRouter, useSegments } from "expo-router";
import { TamaguiProvider, Theme } from "tamagui";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import {
  PlusJakartaSans_300Light,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import config from "../tamagui.config";
import { ThemeModeProvider, useThemeMode } from "../lib/theme-context";
import { AuthProvider, useAuth } from "../lib/auth-context";

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
      </AuthGate>
    </Theme>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Plus Jakarta Sans": PlusJakartaSans_400Regular,
    PlusJakartaSans_300Light,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    "JetBrains Mono": JetBrainsMono_400Regular,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <ThemeModeProvider>
        <AuthProvider>
          <InnerLayout />
        </AuthProvider>
      </ThemeModeProvider>
    </TamaguiProvider>
  );
}
