import * as React from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { Body, Button, Card, Field, Heading, Screen } from "../src/components/ui";
import { useAuth } from "../src/auth";

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      if (mode === "login") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      router.replace("/events");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Heading>{mode === "login" ? "Welcome back" : "Create account"}</Heading>
      <Card>
        <Field placeholder="Email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} />
        <Field placeholder="Password" secureTextEntry textContentType="password" value={password} onChangeText={setPassword} />
        {error ? <Body tone="danger">{error}</Body> : null}
        <Button loading={loading} onPress={submit}>{mode === "login" ? "Sign in" : "Sign up"}</Button>
        <View>
          <Button tone="secondary" onPress={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Need an account?" : "Already have an account?"}
          </Button>
        </View>
      </Card>
    </Screen>
  );
}
