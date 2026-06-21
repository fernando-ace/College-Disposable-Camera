import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import type { Photo, PublicEvent } from "@eventfilm/shared";
import { CHALLENGE_TYPES, memoryCapsuleFromChallenge } from "@eventfilm/shared";
import { Badge, Button, EmptyState, ErrorState, HeroHeader, LoadingState, PhotoCard, Screen, SectionHeader, SuccessState } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

export default function AlbumScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<PublicEvent | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [error, setError] = React.useState("");
  const [reportStatus, setReportStatus] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;

  React.useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.getPublicEventBySlug(slug)
      .then(async (data) => {
        setEvent(data.event);
        if (data.event.isRevealed) {
          const photoData = await api.getAlbumPhotos(slug);
          setPhotos(photoData.photos);
        }
      })
      .catch((err) => setError(`${(err as Error).message}. Check the album link or try again when your connection is stable.`))
      .finally(() => setLoading(false));
  }, [api, slug]);

  function reportPhoto(photo: Photo) {
    const submit = async (reason: "inappropriate" | "privacy" | "spam" | "other") => {
      try {
        await api.reportPhoto(photo.id, { reason });
        setReportStatus("Thanks. The host can review this report.");
      } catch (err) {
        setError(`${(err as Error).message}. Try again when your connection is stable.`);
      }
    };

    Alert.alert("Report photo", "Choose a reason.", [
      { text: "Inappropriate", onPress: () => submit("inappropriate") },
      { text: "Privacy concern", onPress: () => submit("privacy") },
      { text: "Spam", onPress: () => submit("spam") },
      { text: "Other", onPress: () => submit("other") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <Screen bottomPadding={96} wide>
      <HeroHeader
        eyebrow="Guest album"
        title={event?.name || "Album"}
        body={event?.isRevealed ? "The reveal is live. Browse the moments guests shared." : capsuleCopy?.revealNote || "The album is safely tucked away until the host reveal time."}
      >
        {event ? <Badge tone={event.isRevealed ? "green" : "amber"}>{event.isRevealed ? "Revealed" : "Locked"}</Badge> : null}
      </HeroHeader>

      {loading ? <LoadingState label="Loading album..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {reportStatus ? <SuccessState message={reportStatus} /> : null}

      {event && !event.isRevealed ? (
        <EmptyState
          title="Album reveal is locked"
          body={capsuleCopy?.revealNote || `Photos unlock at ${new Date(event.revealAt).toLocaleString()}. Guests can still upload before then.`}
        />
      ) : null}

      {event?.isRevealed ? (
        <>
          <SectionHeader title="Shared photos" subtitle={`${photos.length} photos in this album.`} />
          {photos.length ? photos.map((photo) => (
            <View key={photo.id} style={{ gap: 10 }}>
              <PhotoCard photo={photo} />
              <Button tone="secondary" onPress={() => reportPhoto(photo)}>Report photo</Button>
            </View>
          )) : (
            <EmptyState title="No photos have been shared yet" body="Once guests upload, their photos will appear here after the reveal." />
          )}
        </>
      ) : null}
    </Screen>
  );
}
