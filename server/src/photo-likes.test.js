const assert = require("node:assert/strict");
const test = require("node:test");
const { PhotoLikeError, setPhotoLike } = require("./photo-likes");

function createPrismaMock({ locked = false } = {}) {
  const event = {
    id: "event-1",
    slug: "spring-formal",
    revealAt: new Date("2026-07-01T00:00:00.000Z"),
    locked,
  };
  const photos = [
    { id: "active-photo", eventId: event.id, deletedAt: null },
    { id: "deleted-photo", eventId: event.id, deletedAt: "2026-06-02T00:00:00.000Z" },
  ];
  const likes = [];
  return {
    event,
    likes,
    prisma: {
      event: {
        findUnique: async ({ where }) => (where.slug === event.slug ? event : null),
      },
      photo: {
        findFirst: async ({ where }) => photos.find((photo) => {
          if (photo.id !== where.id || photo.eventId !== where.eventId) return false;
          if (where.deletedAt !== undefined && photo.deletedAt !== where.deletedAt) return false;
          return true;
        }) || null,
      },
      photoLike: {
        upsert: async ({ where, create }) => {
          const key = where.eventId_photoId_guestClientId;
          const existing = likes.find((like) => like.eventId === key.eventId && like.photoId === key.photoId && like.guestClientId === key.guestClientId);
          if (existing) return existing;
          const row = { id: `like-${likes.length + 1}`, ...create };
          likes.push(row);
          return row;
        },
        deleteMany: async ({ where }) => {
          const before = likes.length;
          for (let index = likes.length - 1; index >= 0; index -= 1) {
            const like = likes[index];
            if (like.eventId === where.eventId && like.photoId === where.photoId && like.guestClientId === where.guestClientId) likes.splice(index, 1);
          }
          return { count: before - likes.length };
        },
        count: async ({ where }) => likes.filter((like) => like.eventId === where.eventId && like.photoId === where.photoId).length,
      },
    },
  };
}

const activePhotoWhere = (extra = {}) => ({ deletedAt: null, ...extra });

test("setPhotoLike creates one like per browser and returns the count", async () => {
  const { prisma, likes } = createPrismaMock();

  const first = await setPhotoLike(prisma, {
    eventSlug: "spring-formal",
    photoId: "active-photo",
    clientId: " client-1 ",
    liked: true,
    activePhotoWhere,
  });
  const duplicate = await setPhotoLike(prisma, {
    eventSlug: "spring-formal",
    photoId: "active-photo",
    clientId: "client-1",
    liked: true,
    activePhotoWhere,
  });

  assert.equal(first.likeCount, 1);
  assert.equal(duplicate.likeCount, 1);
  assert.equal(likes.length, 1);
  assert.equal(likes[0].guestClientId, "client-1");
});

test("setPhotoLike unlikes idempotently", async () => {
  const { prisma, likes } = createPrismaMock();
  await setPhotoLike(prisma, { eventSlug: "spring-formal", photoId: "active-photo", clientId: "client-1", liked: true, activePhotoWhere });
  await setPhotoLike(prisma, { eventSlug: "spring-formal", photoId: "active-photo", clientId: "client-2", liked: true, activePhotoWhere });

  const result = await setPhotoLike(prisma, {
    eventSlug: "spring-formal",
    photoId: "active-photo",
    clientId: "client-1",
    liked: false,
    activePhotoWhere,
  });
  const secondUnlike = await setPhotoLike(prisma, {
    eventSlug: "spring-formal",
    photoId: "active-photo",
    clientId: "client-1",
    liked: false,
    activePhotoWhere,
  });

  assert.equal(result.likeCount, 1);
  assert.equal(secondUnlike.likeCount, 1);
  assert.equal(likes.length, 1);
  assert.equal(likes[0].guestClientId, "client-2");
});

test("setPhotoLike rejects deleted photos", async () => {
  const { prisma } = createPrismaMock();

  await assert.rejects(
    () => setPhotoLike(prisma, { eventSlug: "spring-formal", photoId: "deleted-photo", clientId: "client-1", liked: true, activePhotoWhere }),
    (error) => error instanceof PhotoLikeError && error.status === 404 && /not available/i.test(error.message),
  );
});

test("setPhotoLike rejects locked events", async () => {
  const { prisma } = createPrismaMock({ locked: true });

  await assert.rejects(
    () => setPhotoLike(prisma, {
      eventSlug: "spring-formal",
      photoId: "active-photo",
      clientId: "client-1",
      liked: true,
      activePhotoWhere,
      isEventLocked: (event) => event.locked,
    }),
    (error) => error instanceof PhotoLikeError && error.status === 403 && error.revealAt instanceof Date,
  );
});
