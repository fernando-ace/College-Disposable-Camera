import * as React from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import type { EventSummary, Photo } from "@eventfilm/shared";
import { challengeLabel } from "@eventfilm/shared";
import { Badge, Body, Button, Card, EmptyState, ErrorState, HeroHeader, LoadingState, PhotoCard, Screen, SectionHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function loadEvent() {
    if (!eventId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getHostEvent(eventId);
      setEvent(data.event);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let isMounted = true;

    if (eventId) {
      api.getHostEvent(eventId)
        .then((data) => {
          if (isMounted) setEvent(data.event);
        })
        .catch((err) => {
          if (isMounted) setError((err as Error).message);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [api, eventId]);

  return (
    <Screen bottomPadding={96} wide>
      {event ? (
        <HeroHeader eyebrow="Event hub" title={event.name} body={event.description || "Share the guest link, monitor uploads, and keep the album moving."}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Badge>{event.photoCount} photos</Badge>
            <Badge tone="stone">{challengeLabel(event.challenge)}</Badge>
          </View>
        </HeroHeader>
      ) : (
        <HeroHeader eyebrow="Event hub" title="Loading event" body="Gathering the latest photos and sharing details." />
      )}

      {error ? <ErrorState message={error} /> : null}
      {!event ? <LoadingState label="Loading event details..." /> : null}

      {event ? (
        <>
          <View style={{ gap: 12 }}>
            <SectionHeader title="Host actions" subtitle={`Event: ${formatDate(event.eventDate)}. Reveal: ${formatDate(event.revealAt)}.`} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Link href={`/events/${event.id}/share`} asChild>
                  <Button>Share links</Button>
                </Link>
              </View>
              <View style={{ flex: 1 }}>
                <Link href={`/upload?eventLink=${encodeURIComponent(event.eventLink)}`} asChild>
                  <Button tone="secondary">Guest view</Button>
                </Link>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" disabled={!event.liveWallLink} onPress={() => event.liveWallLink && Linking.openURL(event.liveWallLink)}>Open Live Wall</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button tone="secondary" disabled={!event.recapLink} onPress={() => event.recapLink && Linking.openURL(event.recapLink)}>Open Recap</Button>
              </View>
            </View>
            <Card tone="warm">
              <SectionHeader title="Three links, three jobs" subtitle="Guest link is for uploads. Live Wall is for the room during the event. Recap is the polished album story to share after reveal." />
              <Body tone="muted">Open the Live Wall on a laptop, TV, projector, or iPad while guests are uploading.</Body>
            </Card>
            <Button tone="secondary" loading={loading} onPress={loadEvent}>Refresh photos</Button>
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Album activity" subtitle="Recent uploads from guests appear first." />
            {event.photos.length ? (
              <View style={{ gap: 14 }}>
                {event.photos.map((photo) => <PhotoCard key={photo.id} photo={photo} />)}
              </View>
            ) : (
              <EmptyState
                title="No guest photos yet"
                body="Share the QR link or open guest view to test the upload flow before the event starts."
                action={(
                  <Link href={`/events/${event.id}/share`} asChild>
                    <Button>Share event</Button>
                  </Link>
                )}
              />
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
