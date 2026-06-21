import * as React from "react";
import { Link } from "expo-router";
import { View } from "react-native";
import { Badge, Body, Button, Card, HeroHeader, Screen, SectionHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

export default function WelcomeScreen() {
  const { user } = useAuth();

  return (
    <Screen>
      <HeroHeader
        eyebrow="EventFilm"
        title="A social photo album that starts with a QR code."
        body="Hosts create a private event. Guests scan, upload, and come back for the reveal."
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Badge>No guest app required</Badge>
          <Badge tone="stone">Private event albums</Badge>
        </View>
      </HeroHeader>

      <Card>
        <SectionHeader title="Host from the app" subtitle="Create events, share QR links, and keep an eye on uploads from the dashboard." />
        <View style={{ gap: 10 }}>
          <Link href={user ? "/events" : "/auth"} asChild>
            <Button>{user ? "Open dashboard" : "Sign in or sign up"}</Button>
          </Link>
          <Link href="/upload" asChild>
            <Button tone="secondary">Join with a guest link</Button>
          </Link>
        </View>
      </Card>

      <Card tone="warm">
        <SectionHeader title="Built for the room" subtitle="Classic albums stay simple. Color Hunt and Photo Scavenger Hunt add just enough play when the event wants it." />
        <Body tone="muted">Guests can upload from a browser, while hosts manage the event from mobile or web.</Body>
      </Card>
    </Screen>
  );
}
