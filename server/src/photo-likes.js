const MAX_GUEST_CLIENT_ID_LENGTH = 160;

class PhotoLikeError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.name = "PhotoLikeError";
    this.status = status;
    Object.assign(this, extra);
  }
}

function normalizeGuestClientId(value) {
  return String(value || "").trim().slice(0, MAX_GUEST_CLIENT_ID_LENGTH);
}

async function markPhotosLikedByClient(prisma, eventId, photos, clientId) {
  const normalizedClientId = normalizeGuestClientId(clientId);
  if (!normalizedClientId || !Array.isArray(photos) || !photos.length) return photos;

  const photoIds = photos.map((photo) => photo.id).filter(Boolean);
  if (!photoIds.length) return photos;

  const likes = await prisma.photoLike.findMany({
    where: {
      eventId,
      photoId: { in: photoIds },
      guestClientId: normalizedClientId,
    },
    select: { photoId: true },
  });
  const likedIds = new Set(likes.map((like) => like.photoId));
  return photos.map((photo) => Object.assign(photo, { likedByMe: likedIds.has(photo.id) }));
}

async function setPhotoLike(prisma, {
  eventSlug,
  photoId,
  clientId,
  liked,
  eventInclude = {},
  isEventLocked = () => false,
  visiblePhotoWhere = (extra) => ({ deletedAt: null, visibilityStatus: "VISIBLE", ...extra }),
}) {
  const normalizedPhotoId = String(photoId || "").trim();
  const normalizedClientId = normalizeGuestClientId(clientId);
  if (!eventSlug || !normalizedPhotoId || !normalizedClientId || typeof liked !== "boolean") {
    throw new PhotoLikeError("photoId, clientId, and liked are required", 400);
  }

  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
    include: eventInclude,
  });
  if (!event) throw new PhotoLikeError("Event not found", 404);
  if (isEventLocked(event)) {
    const revealLabel = event.revealAt instanceof Date ? event.revealAt.toISOString() : "the reveal time";
    throw new PhotoLikeError(`Photos are locked until ${revealLabel}`, 403, { revealAt: event.revealAt });
  }

  const photo = await prisma.photo.findFirst({
    where: visiblePhotoWhere({ id: normalizedPhotoId, eventId: event.id }),
    select: { id: true, eventId: true },
  });
  if (!photo) throw new PhotoLikeError("Photo is not available for liking", 404);

  if (liked) {
    await prisma.photoLike.upsert({
      where: {
        eventId_photoId_guestClientId: {
          eventId: event.id,
          photoId: photo.id,
          guestClientId: normalizedClientId,
        },
      },
      update: {},
      create: {
        eventId: event.id,
        photoId: photo.id,
        guestClientId: normalizedClientId,
      },
    });
  } else {
    await prisma.photoLike.deleteMany({
      where: {
        eventId: event.id,
        photoId: photo.id,
        guestClientId: normalizedClientId,
      },
    });
  }

  const likeCount = await prisma.photoLike.count({ where: { eventId: event.id, photoId: photo.id } });
  return {
    ok: true,
    event,
    photoId: photo.id,
    liked,
    likeCount,
    clientId: normalizedClientId,
  };
}

module.exports = {
  PhotoLikeError,
  markPhotosLikedByClient,
  normalizeGuestClientId,
  setPhotoLike,
};
