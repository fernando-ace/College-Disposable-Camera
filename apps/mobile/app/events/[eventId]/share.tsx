import * as React from "react";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { Image, Share, View } from "react-native";
import type { EventSummary, Photo } from "@eventfilm/shared";
import { Badge, Body, Button, Card, ErrorState, HeroHeader, LoadingState, Screen, SectionHeader, SuccessState, colors } from "../../../src/components/ui";
import { useAuth } from "../../../src/auth";

export default function ShareEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!eventId) return;
    api.getHostEvent(eventId).then((data) => setEvent(data.event)).catch((err) => setError((err as Error).message));
  }, [api, eventId]);

  async function copyLink() {
    if (!event?.eventLink) return;
    await Clipboard.setStringAsync(event.eventLink);
    setMessage("Copied event link.");
  }

  async function shareLink() {
    if (!event?.eventLink) return;
    await Share.share({ message: `Upload photos to ${event.name}: ${event.eventLink}`, url: event.eventLink });
  }

  return (
    <Screen>
      <HeroHeader
        eyebrow="Share event"
        title={event ? `Invite guests to ${event.name}` : "Preparing share link"}
        body="Guests can scan the QR code or open the link from any browser. No account needed."
      />
      {error ? <ErrorState message={error} /> : null}
      {!event ? <LoadingState label="Loading sharing details..." /> : null}
      {event ? (
        <>
          <Card>
            <SectionHeader title="Guest link" subtitle="Send this anywhere your guests already are." />
            <Card tone="warm" padding={12}>
              <Body>{event.eventLink}</Body>
            </Card>
            {message ? <SuccessState message={message} /> : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button onPress={shareLink}>Share</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" onPress={copyLink}>Copy link</Button>
              </View>
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <SectionHeader title="QR code" subtitle="Place this near the entrance, bar, or table." />
              <Badge>{event.photoCount} photos</Badge>
            </View>
            {event.qrCodeDataUrl ? (
              <View style={{ borderRadius: 28, borderCurve: "continuous", backgroundColor: "#fff", padding: 18, borderWidth: 1, borderColor: colors.border }}>
                <Image source={{ uri: event.qrCodeDataUrl }} style={{ width: "100%", aspectRatio: 1, borderRadius: 18 }} />
              </View>
            ) : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
