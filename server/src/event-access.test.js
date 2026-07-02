const assert = require("node:assert/strict");
const test = require("node:test");
const { updateHostEventSettings } = require("./event-settings");
const { EventAccessError, loadDashboardEventEntries, saveEventAccess } = require("./event-access");

test("saving event access creates one viewer row and is idempotent", async () => {
  const upserts = [];
  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", hostId: "host-1" }),
    },
    eventAccess: {
      upsert: async (args) => {
        upserts.push(args);
        return { id: "access-1", eventId: args.create.eventId, userId: args.create.userId };
      },
    },
  };

  const first = await saveEventAccess(prisma, { slug: "event-slug", userId: "viewer-1" });
  const second = await saveEventAccess(prisma, { slug: "event-slug", userId: "viewer-1" });

  assert.equal(first.role, "viewer");
  assert.equal(second.role, "viewer");
  assert.equal(upserts.length, 2);
  assert.deepEqual(upserts[0].where, { userId_eventId: { userId: "viewer-1", eventId: "event-1" } });
  assert.deepEqual(upserts[0].create, { userId: "viewer-1", eventId: "event-1" });
});

test("host saving their own invite is a no-op", async () => {
  let upsertCalled = false;
  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", hostId: "host-1" }),
    },
    eventAccess: {
      upsert: async () => {
        upsertCalled = true;
      },
    },
  };

  const result = await saveEventAccess(prisma, { slug: "event-slug", userId: "host-1" });

  assert.equal(result.role, "host");
  assert.equal(upsertCalled, false);
});

test("saving access reports missing event slugs", async () => {
  const prisma = {
    event: {
      findUnique: async () => null,
    },
  };

  await assert.rejects(
    () => saveEventAccess(prisma, { slug: "missing", userId: "viewer-1" }),
    (error) => error instanceof EventAccessError && error.status === 404,
  );
});

test("dashboard events include hosted and invited events with host role winning duplicates", async () => {
  const hosted = {
    id: "hosted",
    name: "Hosted",
    hostId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    photos: [],
  };
  const invited = {
    id: "invited",
    name: "Invited",
    hostId: "host-2",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    photos: [],
  };
  const activeHostedDuplicate = {
    ...hosted,
    photos: [{ id: "photo-1", createdAt: "2026-01-03T00:00:00.000Z" }],
  };
  const prisma = {
    event: {
      findMany: async () => [activeHostedDuplicate],
    },
    eventAccess: {
      findMany: async () => [
        { event: hosted },
        { event: invited },
      ],
    },
  };

  const entries = await loadDashboardEventEntries(prisma, { userId: "user-1" });

  assert.deepEqual(entries.map((entry) => [entry.event.id, entry.role]), [
    ["hosted", "host"],
    ["invited", "viewer"],
  ]);
});

test("saved viewer access does not grant host settings permissions", async () => {
  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", hostId: "host-1" }),
      update: async () => {
        throw new Error("should not update");
      },
    },
    eventAccess: {
      findUnique: async () => ({ id: "access-1", eventId: "event-1", userId: "viewer-1" }),
    },
  };

  await assert.rejects(
    () => updateHostEventSettings(prisma, { eventId: "event-1", userId: "viewer-1", input: { name: "Viewer edit" } }),
    { status: 403 },
  );
});
