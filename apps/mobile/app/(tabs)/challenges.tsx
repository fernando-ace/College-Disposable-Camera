import * as React from "react";
import { Link } from "expo-router";
import { View } from "react-native";
import { COLOR_HUNT_PALETTE } from "@eventfilm/shared";
import { Badge, Body, Button, Card, Chip, HeroHeader, Screen, SectionHeader } from "../../src/components/ui";
import { STARTER_SCAVENGER_PROMPTS } from "../../src/challenges";

export default function ChallengesScreen() {
  return (
    <Screen>
      <HeroHeader
        eyebrow="Photo modes"
        title="Give guests a tiny mission."
        body="Challenges turn uploads into something more playful without making the event complicated."
      />

      <Card tone="accent">
        <Badge tone="dark">Color Hunt</Badge>
        <SectionHeader title="Find your color" subtitle="Guests pick a color team, then upload photos of matching moments around the event." />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {COLOR_HUNT_PALETTE.map((color) => (
            <Chip key={color.colorSlug} swatch={color.colorHex}>{color.colorName}</Chip>
          ))}
        </View>
      </Card>

      <Card>
        <Badge>Photo Scavenger Hunt</Badge>
        <SectionHeader title="Complete the prompts" subtitle="Guests choose a prompt before uploading so the album becomes a shared game." />
        <View style={{ gap: 8 }}>
          {STARTER_SCAVENGER_PROMPTS.slice(0, 4).map((prompt, index) => (
            <Card key={prompt} tone="warm" padding={12}>
              <Body>{index + 1}. {prompt}</Body>
            </Card>
          ))}
        </View>
      </Card>

      <Card tone="warm">
        <Body tone="muted">You can choose a mode during event creation. Classic album remains available for the fastest setup.</Body>
        <Link href="/create-event" asChild>
          <Button>Create challenge event</Button>
        </Link>
      </Card>
    </Screen>
  );
}
