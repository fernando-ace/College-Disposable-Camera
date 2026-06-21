import * as React from "react";
import { router } from "expo-router";
import { View } from "react-native";
import { EventFilmApiError } from "@eventfilm/api-client";
import { checkMobileApiConnection, getMobileApiDiagnosticHints, shouldShowMobileApiDiagnostics } from "../src/api";
import { Body, Button, Caption, Card, Field, Heading, Screen, SectionHeader } from "../src/components/ui";
import { useAuth } from "../src/auth";

function authErrorMessage(error: unknown) {
  if (error instanceof EventFilmApiError) {
    if (error.kind === "timeout") return "Request timed out. Run npm run mobile:env:lan, then restart with npm run mobile:start:clear.";
    if (error.kind === "network") return "Could not reach API. Use your computer LAN IP, then restart with npm run mobile:start:clear.";
    if (error.kind === "auth") return "Invalid email or password.";
    if (error.kind === "server") return "Server error. Check the API terminal and database connection.";
  }
  return "Sign-in failed. Try again in a moment.";
}

function connectionErrorMessage(error: unknown) {
  if (error instanceof EventFilmApiError) {
    if (error.kind === "timeout") return "Request timed out.";
    if (error.kind === "network") return "Could not reach API.";
    if (error.kind === "server") return "Server error.";
  }
  return "Connection check failed.";
}

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [connectionStatus, setConnectionStatus] = React.useState("");
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [checkingConnection, setCheckingConnection] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const showDiagnostics = shouldShowMobileApiDiagnostics();
  const apiDiagnostics = getMobileApiDiagnosticHints();

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "login") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      router.replace("/events");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function checkConnection() {
    if (checkingConnection) return;
    setCheckingConnection(true);
    setConnectionStatus("");
    try {
      const result = await checkMobileApiConnection();
      setConnectionStatus(result.ok ? `Connected to ${result.baseUrl} in ${result.latencyMs}ms.` : `Reached ${result.baseUrl}, but health did not return ok.`);
    } catch (err) {
      setConnectionStatus(`${connectionErrorMessage(err)} API: ${apiDiagnostics.baseUrl}. Run npm run mobile:env:lan, then npm run mobile:start:clear.`);
    } finally {
      setCheckingConnection(false);
    }
  }

  return (
    <Screen>
      <Heading>{mode === "login" ? "Welcome back" : "Create account"}</Heading>
      <Card>
        <Field placeholder="Email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} />
        <Field placeholder="Password" secureTextEntry textContentType="password" value={password} onChangeText={setPassword} />
        {error ? <Body tone="danger">{error}</Body> : null}
        <Button loading={loading} disabled={loading} onPress={submit}>{mode === "login" ? "Sign in" : "Sign up"}</Button>
        <View>
          <Button tone="secondary" onPress={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Need an account?" : "Already have an account?"}
          </Button>
        </View>
      </Card>
      {showDiagnostics ? (
        <Card tone="warm" padding={14}>
          <SectionHeader title="Development API" subtitle={apiDiagnostics.baseUrl} action={<Button tone="ghost" onPress={() => setDiagnosticsOpen((open) => !open)}>{diagnosticsOpen ? "Hide" : "Details"}</Button>} />
          {connectionStatus ? <Caption tone={connectionStatus.startsWith("Connected") ? "success" : "danger"}>{connectionStatus}</Caption> : null}
          {diagnosticsOpen ? (
            <View style={{ gap: 8 }}>
              {apiDiagnostics.hints.slice(1).map((hint) => (
                <Caption key={hint}>{hint}</Caption>
              ))}
            </View>
          ) : null}
          <Button tone="secondary" loading={checkingConnection} disabled={checkingConnection} onPress={checkConnection}>
            Check connection
          </Button>
        </Card>
      ) : null}
    </Screen>
  );
}
