const assert = require("node:assert/strict");
const test = require("node:test");
const { getEventLastActivityAt, sortEventsByRecentActivity } = require("./event-activity");

function event(input) {
  return {
    id: input.id,
    name: input.name || input.id,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt || input.createdAt,
    photos: input.photos || [],
  };
}

function photo(input) {
  return {
    id: input.id,
    createdAt: input.createdAt,
    deletedAt: input.deletedAt || null,
    visibilityStatus: input.visibilityStatus || "VISIBLE",
  };
}

test("newest created event wins when no uploads exist", () => {
  const sorted = sortEventsByRecentActivity([
    event({ id: "older", createdAt: "2026-01-01T00:00:00.000Z" }),
    event({ id: "newer", createdAt: "2026-02-01T00:00:00.000Z" }),
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ["newer", "older"]);
});

test("older event with newer visible upload sorts above newer created event", () => {
  const sorted = sortEventsByRecentActivity([
    event({
      id: "older-active",
      createdAt: "2026-01-01T00:00:00.000Z",
      photos: [photo({ id: "upload", createdAt: "2026-03-01T00:00:00.000Z" })],
    }),
    event({ id: "newer-empty", createdAt: "2026-02-01T00:00:00.000Z" }),
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ["older-active", "newer-empty"]);
});

test("host settings update counts as event activity", () => {
  const sorted = sortEventsByRecentActivity([
    event({
      id: "settings-updated",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    }),
    event({ id: "newer-inactive", createdAt: "2026-03-01T00:00:00.000Z" }),
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ["settings-updated", "newer-inactive"]);
});

test("hidden and deleted photos do not drive event activity", () => {
  const inactive = event({
    id: "inactive",
    createdAt: "2026-01-01T00:00:00.000Z",
    photos: [
      photo({ id: "hidden", createdAt: "2026-05-01T00:00:00.000Z", visibilityStatus: "HIDDEN" }),
      photo({ id: "deleted", createdAt: "2026-06-01T00:00:00.000Z", deletedAt: "2026-06-02T00:00:00.000Z" }),
    ],
  });
  const sorted = sortEventsByRecentActivity([
    inactive,
    event({ id: "visible-active", createdAt: "2026-02-01T00:00:00.000Z" }),
  ]);

  assert.equal(getEventLastActivityAt(inactive).toISOString(), "2026-01-01T00:00:00.000Z");
  assert.deepEqual(sorted.map((item) => item.id), ["visible-active", "inactive"]);
});
