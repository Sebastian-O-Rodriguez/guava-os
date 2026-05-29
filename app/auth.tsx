import { useState } from "react";
import { Platform } from "react-native";
import { styled, YStack, XStack, Input, Button, Text, View, Spinner } from "tamagui";
import { useAuth } from "../lib/auth-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { ACCENT } from "../lib/palette";

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Container = styled(YStack, {
  flex: 1,
  items: "center",
  justify: "center",
  px: "$4",
  bg: "$background",
});

const Card = styled(YStack, {
  width: "100%",
  maxW: 400,
  bg: "$color2",
  rounded: "$5",
  px: "$5",
  py: "$6",
  gap: "$3",
  borderWidth: 1,
  borderColor: "$color3",
});

const Field = styled(Input, {
  bg: "$color1",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$3",
  px: "$3",
  height: 48,
  fontSize: 14,
  color: "$color",
  focusStyle: { borderColor: "$accent9" },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  function switchMode(next: "login" | "signup" | "forgot") {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function handleGoogle() {
    setError(null);
    const redirectTo = Platform.OS === "web"
      ? window.location.origin + "/auth"
      : "https://routineme.expo.app/auth";

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      const msg = oauthError.message.toLowerCase();
      if (msg.includes("provider") || msg.includes("not enabled") || msg.includes("unsupported")) {
        setError("Google login is not available yet. Use email instead.");
      } else {
        setError(oauthError.message);
      }
    }
  }

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    const trimEmail = email.trim().toLowerCase();

    // --- Forgot password ---
    if (mode === "forgot") {
      if (!trimEmail) { setError("Enter your email address."); return; }
      setLoading(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimEmail, {
          redirectTo: "https://routineme.expo.app/auth",
        });
        if (resetError) setError(resetError.message);
        else setInfo("Check your email for a password reset link.");
      } finally { setLoading(false); }
      return;
    }

    // --- Login / Signup ---
    const trimPassword = password.trim();
    if (!trimEmail || !trimPassword) { setError("Email and password are required."); return; }
    if (trimPassword.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        const result = await signIn(trimEmail, trimPassword);
        if (result.error) {
          const msg = result.error.toLowerCase();
          if (msg.includes("invalid login")) setError("Invalid email or password.");
          else if (msg.includes("email not confirmed")) setError("Please confirm your email before logging in.");
          else setError(result.error);
        } else {
          router.replace("/");
        }
      } else {
        const result = await signUp(trimEmail, trimPassword);
        if (result.error) {
          setError(result.error);
        } else if (result.needsConfirmation) {
          setInfo("Check your email to confirm your account, then log in.");
          setMode("login");
          setPassword("");
        } else {
          router.replace("/");
        }
      }
    } finally { setLoading(false); }
  }

  const title =
    mode === "login" ? "Welcome back" :
    mode === "signup" ? "Create your account" :
    "Reset password";

  const cta =
    mode === "login" ? "Log in" :
    mode === "signup" ? "Create account" :
    "Send reset link";

  return (
    <Container>
      <Card>
        {/* Branding */}
        <YStack gap="$1" mb="$2">
          <Text fontSize={28} fontWeight="800" color="$color" text="center" letterSpacing={-1}>
            RoutineMe
          </Text>
          <Text fontSize={14} color="$color7" text="center">
            {title}
          </Text>
          {mode === "signup" && (
            <Text fontSize={11} color="$color6" text="center" mt="$1">
              No spam. Your data stays yours.
            </Text>
          )}
        </YStack>

        {/* Google OAuth */}
        {mode !== "forgot" && (
          <>
            <Button
              bg="$color1"
              borderWidth={1}
              borderColor="$color4"
              rounded="$3"
              height={48}
              items="center"
              justify="center"
              onPress={handleGoogle}
              disabled={loading}
              pressStyle={{ opacity: 0.8, bg: "$color3" }}
            >
              <XStack gap="$2" items="center">
                <Text fontSize={16}>G</Text>
                <Text fontSize={14} fontWeight="500" color="$color">
                  Continue with Google
                </Text>
              </XStack>
            </Button>

            <XStack items="center" gap="$3" my="$1">
              <View flex={1} height={1} bg="$color4" />
              <Text fontSize={11} color="$color6">or</Text>
              <View flex={1} height={1} bg="$color4" />
            </XStack>
          </>
        )}

        {/* Email field */}
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="$color6"
          autoCapitalize="none"
          keyboardType="email-address"
          disabled={loading}
        />

        {/* Password field (hidden on forgot) */}
        {mode !== "forgot" && (
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="$color6"
            secureTextEntry
            disabled={loading}
            onSubmitEditing={handleSubmit}
          />
        )}

        {/* Error */}
        {error && (
          <YStack bg="$red2" rounded="$2" px="$3" py="$2">
            <Text fontSize={12} color="$red10" text="center">{error}</Text>
          </YStack>
        )}

        {/* Info / success */}
        {info && (
          <YStack bg="$green2" rounded="$2" px="$3" py="$2">
            <Text fontSize={12} color="$green10" text="center">{info}</Text>
          </YStack>
        )}

        {/* Primary CTA */}
        <Button
          bg={ACCENT.mid as never}
          rounded="$3"
          height={48}
          items="center"
          justify="center"
          onPress={handleSubmit}
          disabled={loading}
          pressStyle={{ opacity: 0.85 }}
          mt="$1"
        >
          {loading ? (
            <Spinner size="small" color="white" />
          ) : (
            <Text fontSize={15} fontWeight="600" color="white">{cta}</Text>
          )}
        </Button>

        {/* Secondary links */}
        <YStack gap="$1" mt="$1" items="center">
          {mode === "login" && (
            <Button unstyled onPress={() => switchMode("forgot")} pressStyle={{ opacity: 0.6 }}>
              <Text fontSize={12} color="$color7">Forgot password?</Text>
            </Button>
          )}

          <Button
            unstyled
            onPress={() => switchMode(mode === "signup" ? "login" : mode === "login" ? "signup" : "login")}
            pressStyle={{ opacity: 0.6 }}
          >
            <Text fontSize={13} color="$color7">
              {mode === "signup"
                ? "Already have an account? Log in"
                : "Don't have an account? Sign up"}
            </Text>
          </Button>
        </YStack>
      </Card>
    </Container>
  );
}
