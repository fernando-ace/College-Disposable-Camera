import * as React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#fff8ed" },
        tabBarActiveTintColor: "#1c1917",
        tabBarInactiveTintColor: "#78716c",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" },
        tabBarStyle: {
          minHeight: 68,
          backgroundColor: "#fffbf5",
          borderTopColor: "#e7ded3",
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Welcome", tabBarLabel: "Home", tabBarIcon: tabIcon("home-outline") }} />
      <Tabs.Screen name="events" options={{ title: "Events", tabBarIcon: tabIcon("calendar-outline") }} />
      <Tabs.Screen name="upload" options={{ title: "Join", tabBarLabel: "Join", tabBarIcon: tabIcon("qr-code-outline") }} />
      <Tabs.Screen name="challenges" options={{ title: "Challenges", tabBarIcon: tabIcon("sparkles-outline") }} />
    </Tabs>
  );
}
