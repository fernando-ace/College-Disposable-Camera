import * as React from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerLargeTitle: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "#fff8ed" },
          headerTintColor: "#653e00",
          headerTitleStyle: { color: "#1c1917", fontWeight: "800" },
          contentStyle: { backgroundColor: "#fff8ed" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Home" }} />
        <Stack.Screen name="auth" options={{ title: "Account", presentation: "modal" }} />
        <Stack.Screen name="create-event" options={{ title: "Create Event", headerBackTitle: "Events" }} />
        <Stack.Screen name="events/[eventId]" options={{ title: "Event", headerBackTitle: "Events" }} />
        <Stack.Screen name="events/[eventId]/share" options={{ title: "Share", headerBackTitle: "Event" }} />
        <Stack.Screen name="album/[slug]" options={{ title: "Album", headerBackTitle: "Event" }} />
      </Stack>
    </AuthProvider>
  );
}
