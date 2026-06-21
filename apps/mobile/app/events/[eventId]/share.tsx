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

  async function copyLink(label: string, url?: string) {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setMessage(`${label} copied.`);
  }

  async function shareLink(label: string, url?: string) {
    if (!event || !url) return;
    await Share.share({ message: `${label} for ${event.name}: ${url}`, url });
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
            <View style={{ borderRadius: 18, borderCurve: "continuous", backgroundColor: colors.surfaceWarm, padding: 12, borderWidth: 1, borderColor: "#f1ddc4" }}>
              <Body>{event.eventLink}</Body>
            </View>
            {message ? <SuccessState message={message} /> : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => shareLink("Guest upload link", event.eventLink)}>Share</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" onPress={() => copyLink("Guest link", event.eventLink)}>Copy link</Button>
              </View>
            </View>
          </Card>

          <ShareLinkCard
            title="Live Wall"
            subtitle="Open this on a laptop, TV, projector, or iPad while guests upload during the event."
            url={event.liveWallLink}
            onShare={() => shareLink("Live Wall link", event.liveWallLink)}
            onCopy={() => copyLink("Live Wall link", event.liveWallLink)}
          />

          <ShareLinkCard
            title="Recap"
            subtitle="Share this polished album story after the reveal time."
            url={event.recapLink}
            onShare={() => shareLink("Recap link", event.recapLink)}
            onCopy={() => copyLink("Recap link", event.recapLink)}
          />

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

function ShareLinkCard({
  title,
  subtitle,
  url,
  onShare,
  onCopy,
}: {
  title: string;
  subtitle: string;
  url?: string;
  onShare: () => void;
  onCopy: () => void;
}) {
  return (
    <Card>
      <SectionHeader title={title} subtitle={subtitle} />
      <View style={{ borderRadius: 18, borderCurve: "continuous", backgroundColor: colors.surfaceWarm, padding: 12, borderWidth: 1, borderColor: "#f1ddc4" }}>
        <Body>{url || "Link unavailable until the event reloads."}</Body>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button disabled={!url} onPress={onShare}>Share</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button tone="secondary" disabled={!url} onPress={onCopy}>Copy link</Button>
        </View>
      </View>
    </Card>
  );
}
