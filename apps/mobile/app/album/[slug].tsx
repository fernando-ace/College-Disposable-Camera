import * as React from "react";
import { Link, useLocalSearchParams } from "expo-router";
import type { Photo, PublicEvent } from "@eventfilm/shared";
import { CHALLENGE_TYPES, memoryCapsuleFromChallenge } from "@eventfilm/shared";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PhotoCard, PhotoViewer, Screen, SectionHeader, TaskHeader } from "../../src/components/ui";
import { useAuth } from "../../src/auth";
import { getGuestClientId } from "../../src/guest-session";

export default function AlbumScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { api } = useAuth();
  const [event, setEvent] = React.useState<PublicEvent | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = React.useState<Photo | null>(null);
  const [clientId, setClientId] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const isAlbumLocked = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && !event.isRevealed;

  React.useEffect(() => {
    if (!slug) return;
    let isMounted = true;
    setLoading(true);
    setError("");

    async function loadAlbum() {
      try {
        const nextClientId = await getGuestClientId(slug);
        const data = await api.getPublicEventBySlug(slug);
        if (!isMounted) return;
        setClientId(nextClientId);
        setEvent(data.event);
        if (data.event.challenge?.type !== CHALLENGE_TYPES.MEMORY_CAPSULE || data.event.isRevealed) {
          const photoData = await api.getAlbumPhotos(slug, nextClientId);
          if (!isMounted) return;
          setPhotos(photoData.photos);
        }
      } catch (err) {
        if (isMounted) setError(`${(err as Error).message}. Check the album link or try again when your connection is stable.`);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAlbum();

    return () => {
      isMounted = false;
    };
  }, [api, slug]);

  function updatePhoto(photo: Photo) {
    setPhotos((current) => current.map((item) => item.id === photo.id ? photo : item));
    setSelectedPhoto((current) => current?.id === photo.id ? photo : current);
  }

  async function handlePhotoLike(photo: Photo, liked: boolean) {
    if (!event || !clientId) return;
    const previousPhoto = photo;
    const optimisticPhoto = {
      ...photo,
      likedByMe: liked,
      likeCount: Math.max(0, Number(photo.likeCount || 0) + (liked ? 1 : -1)),
    };
    updatePhoto(optimisticPhoto);
    try {
      const response = await api.setPhotoLike(event.slug, photo.id, { clientId, liked });
      updatePhoto({ ...photo, likedByMe: response.liked, likeCount: response.likeCount });
    } catch (err) {
      updatePhoto(previousPhoto);
      setError(`${(err as Error).message}. Try again when your connection is stable.`);
    }
  }

  return (
    <Screen bottomPadding={96} wide>
      <TaskHeader
        eyebrow="Guest album"
        title={event?.name || "Album"}
        body={isAlbumLocked ? capsuleCopy?.revealNote || "The Memory Capsule is tucked away until reveal time." : "Browse the moments people shared."}
        action={event ? <Badge tone={isAlbumLocked ? "amber" : "green"}>{isAlbumLocked ? "Locked" : "Live"}</Badge> : undefined}
      />

      {loading ? <LoadingState label="Loading album..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {event && isAlbumLocked ? (
        <EmptyState
          title="Album reveal is locked"
          body={capsuleCopy?.revealNote || `Photos unlock at ${new Date(event.revealAt).toLocaleString()}. Guests can still upload before then.`}
        />
      ) : null}
      {event ? (
        <Link href={{ pathname: "/(tabs)/upload", params: { eventLink: event.slug } }} asChild>
          <Button tone="secondary">Upload photos</Button>
        </Link>
      ) : null}

      {event && !isAlbumLocked ? (
        <>
          <SectionHeader title="Shared photos" subtitle={`${photos.length} ${photos.length === 1 ? "photo" : "photos"}.`} />
          {photos.length ? photos.map((photo) => (
            <PhotoCard key={photo.id} photo={photo} onPress={() => setSelectedPhoto(photo)} />
          )) : (
            <EmptyState title="No photos have been shared yet" body="Use the upload button to add the first memory from this device." />
          )}
          <PhotoViewer photo={selectedPhoto} photos={photos} mode="public" onClose={() => setSelectedPhoto(null)} onSelectPhoto={setSelectedPhoto} onPhotoLike={clientId && event ? handlePhotoLike : undefined} />
        </>
      ) : null}
    </Screen>
  );
}
