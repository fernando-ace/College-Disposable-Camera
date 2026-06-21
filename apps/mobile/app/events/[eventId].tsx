import * as React from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Alert, Linking, View } from "react-native";
import type { EventSummary, Photo, PhotoVisibilityStatus } from "@eventfilm/shared";
import { buildHostLaunchKit, challengeLabel } from "@eventfilm/shared";
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

  async function updateVisibility(photo: Photo, visibilityStatus: PhotoVisibilityStatus) {
    if (!eventId) return;
    try {
      const data = await api.updatePhotoVisibility(eventId, photo.id, visibilityStatus, visibilityStatus === "HIDDEN" ? "Hidden by host" : undefined);
      setEvent((current) => current ? { ...current, photos: current.photos.map((item) => item.id === photo.id ? data.photo : item) } : current);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateFeatured(photo: Photo, isFeatured: boolean) {
    if (!eventId) return;
    try {
      const data = await api.updatePhotoFeatured(eventId, photo.id, isFeatured);
      setEvent((current) => current ? { ...current, photos: current.photos.map((item) => item.id === photo.id ? data.photo : item) } : current);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function confirmDelete(photo: Photo) {
    Alert.alert("Delete photo?", "Hidden photos can be restored. Deleted photos are removed from storage.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!eventId) return;
          try {
            await api.deletePhoto(eventId, photo.id);
            setEvent((current) => current ? { ...current, photos: current.photos.filter((item) => item.id !== photo.id) } : current);
          } catch (err) {
            setError((err as Error).message);
          }
        },
      },
    ]);
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

  React.useEffect(() => {
    if (!event) return;
    api.trackAnalyticsEvent({
      name: "host_launch_kit_opened",
      source: "mobile",
      path: `/events/${event.id}`,
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail" },
    }).catch(() => {});
  }, [api, event]);

  const launchKit = event ? buildHostLaunchKit(event) : null;

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
            {launchKit ? (
              <Card>
                <SectionHeader title="Host checklist" subtitle="A quick run-of-show for the first event." />
                <View style={{ gap: 10 }}>
                  {launchKit.checklist.map((item, index) => (
                    <View key={item.key} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Badge tone={item.complete ? "green" : "stone"}>{index + 1}</Badge>
                      <Body tone={item.complete ? "success" : "muted"}>{item.label}</Body>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
            <Button tone="secondary" loading={loading} onPress={loadEvent}>Refresh photos</Button>
          </View>

          <View style={{ gap: 12 }}>
            <SectionHeader title="Album activity" subtitle="Recent uploads from guests appear first." />
            {event.photos.length ? (
              <View style={{ gap: 14 }}>
                {event.photos.map((photo) => (
                  <View key={photo.id} style={{ gap: 10 }}>
                    <PhotoCard photo={photo} compact />
                    <Card>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {photo.isFeatured ? <Badge>Featured</Badge> : null}
                        {photo.visibilityStatus === "HIDDEN" ? <Badge tone="red">Hidden</Badge> : null}
                        {photo.reportCount ? <Badge tone="red">{photo.reportCount} reported</Badge> : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          {photo.visibilityStatus === "HIDDEN" ? (
                            <Button tone="secondary" onPress={() => updateVisibility(photo, "VISIBLE")}>Restore</Button>
                          ) : (
                            <Button tone="secondary" onPress={() => updateVisibility(photo, "HIDDEN")}>Hide</Button>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button tone="secondary" disabled={photo.visibilityStatus === "HIDDEN"} onPress={() => updateFeatured(photo, !photo.isFeatured)}>{photo.isFeatured ? "Unfeature" : "Feature"}</Button>
                        </View>
                      </View>
                      <Button tone="danger" onPress={() => confirmDelete(photo)}>Delete</Button>
                    </Card>
                  </View>
                ))}
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
