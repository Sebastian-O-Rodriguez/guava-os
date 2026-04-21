import { useState } from "react";
import { styled, YStack, XStack, Input, Button, Text, H2 } from "tamagui";
import { useAuth } from "../lib/auth-context";
import { useRouter } from "expo-router";
import { useThemeMode } from "../lib/theme-context";

const Container = styled(YStack, {
  flex: 1,
  items: "center",
  justify: "center",
  px: "$4",
  bg: "$background",
});

const Card = styled(YStack, {
  width: "100%",
  maxW: 380,
  bg: "$color2",
  rounded: "$4",
  px: "$4",
  py: "$5",
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
  focusStyle: {
    borderColor: "$accent9",
  },
});

const ActionButton = styled(Button, {
  bg: "$accent9",
  rounded: "$3",
  height: 48,
  items: "center",
  justify: "center",
  pressStyle: { opacity: 0.8 },
});

const SwitchButton = styled(Button, {
  bg: "transparent",
  pressStyle: { opacity: 0.7 },
});

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  async function handleSubmit() {
    setError(null);
    const trimEmail = email.trim().toLowerCase();
    const trimPassword = password.trim();

    if (!trimEmail || !trimPassword) {
      setError("Email and password are required.");
      return;
    }
    if (trimPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = mode === "login"
        ? await signIn(trimEmail, trimPassword)
        : await signUp(trimEmail, trimPassword);

      if (result.error) {
        setError(result.error);
      } else {
        router.replace("/");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <Card>
        <H2
          fontSize={22}
          fontWeight="700"
          color="$color"
          text="center"
          letterSpacing={-0.5}
        >
          RoutineMe
        </H2>
        <Text fontSize={13} color="$color7" text="center">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </Text>

        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="$color6"
          autoCapitalize="none"
          keyboardType="email-address"
          disabled={loading}
        />

        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="$color6"
          secureTextEntry
          disabled={loading}
          onSubmitEditing={handleSubmit}
        />

        {error && (
          <Text fontSize={12} color="$red10" text="center">
            {error}
          </Text>
        )}

        <ActionButton onPress={handleSubmit} disabled={loading}>
          <Text fontSize={14} fontWeight="600" color="white">
            {loading ? "..." : mode === "login" ? "Log in" : "Sign up"}
          </Text>
        </ActionButton>

        <SwitchButton
          onPress={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          <Text fontSize={13} color="$color7">
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Log in"}
          </Text>
        </SwitchButton>
      </Card>
    </Container>
  );
}
