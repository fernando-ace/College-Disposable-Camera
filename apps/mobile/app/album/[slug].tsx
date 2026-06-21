import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import type { Photo, PublicEvent } from "@eventfilm/shared";
import { CHALLENGE_TYPES, memoryCapsuleFromChallenge } from "@eventfilm/shared";
import { Badge, EmptyState, ErrorState, HeroHeader, LoadingState, PhotoCard, Screen, SectionHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";

export default function AlbumScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<PublicEvent | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [error, setError] = React.useState("");
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
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [api, slug]);

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

      {event && !event.isRevealed ? (
        <EmptyState
          title="Album reveal is locked"
          body={capsuleCopy?.revealNote || `Photos unlock at ${new Date(event.revealAt).toLocaleString()}. Guests can still upload before then.`}
        />
      ) : null}

      {event?.isRevealed ? (
        <>
          <SectionHeader title="Shared photos" subtitle={`${photos.length} photos in this album.`} />
          {photos.length ? photos.map((photo) => <PhotoCard key={photo.id} photo={photo} />) : (
            <EmptyState title="No photos have been shared yet" body="Once guests upload, their photos will appear here after the reveal." />
          )}
        </>
      ) : null}
    </Screen>
  );
}
