const assert = require("node:assert/strict");
const test = require("node:test");
const { EventSettingsError, updateHostEventSettings, validateEventSettingsInput } = require("./event-settings");

const validInput = {
  name: "  Updated Formal  ",
  description: "  New host note  ",
  eventDate: "2026-06-22T12:00:00.000Z",
  revealAt: "2026-06-22T16:00:00.000Z",
  photoLimitPerGuest: 8,
  slug: "should-not-write",
  eventLink: "https://example.com/e/should-not-write",
};

test("event settings validation trims safe input", () => {
  const validation = validateEventSettingsInput(validInput);
  assert.equal(validation.ok, true);
  assert.equal(validation.value.name, "Updated Formal");
  assert.equal(validation.value.description, "New host note");
  assert.equal(validation.value.photoLimitPerGuest, 8);
});

test("event settings validation reports invalid basics", () => {
  const validation = validateEventSettingsInput({
    name: "",
    eventDate: "bad",
    revealAt: "also bad",
    photoLimitPerGuest: 0,
  });

  assert.equal(validation.ok, false);
  assert.match(validation.fieldErrors.name, /required/);
  assert.match(validation.fieldErrors.eventDate, /valid event date/);
  assert.match(validation.fieldErrors.revealAt, /valid reveal time/);
  assert.match(validation.fieldErrors.photoLimitPerGuest, /between 1 and 100/);
});

test("host-owned event settings update writes only safe fields", async () => {
  let updateArgs;
  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", hostId: "host-1" }),
      update: async (args) => {
        updateArgs = args;
        return { id: "event-1", ...args.data };
      },
    },
  };

  const event = await updateHostEventSettings(prisma, {
    eventId: "event-1",
    userId: "host-1",
    input: validInput,
    include: { photos: true },
  });

  assert.equal(event.name, "Updated Formal");
  assert.deepEqual(Object.keys(updateArgs.data).sort(), ["description", "eventDate", "name", "photoLimitPerGuest", "revealAt"].sort());
  assert.equal(updateArgs.data.slug, undefined);
  assert.equal(updateArgs.data.eventLink, undefined);
  assert.deepEqual(updateArgs.include, { photos: true });
});

test("event settings update rejects another host", async () => {
  const prisma = {
    event: {
      findUnique: async () => ({ id: "event-1", hostId: "other-host" }),
      update: async () => {
        throw new Error("should not update");
      },
    },
  };

  await assert.rejects(
    () => updateHostEventSettings(prisma, { eventId: "event-1", userId: "host-1", input: validInput }),
    (error) => error instanceof EventSettingsError && error.status === 403,
  );
});

test("event settings update reports missing events", async () => {
  const prisma = {
    event: {
      findUnique: async () => null,
      update: async () => {
        throw new Error("should not update");
      },
    },
  };

  await assert.rejects(
    () => updateHostEventSettings(prisma, { eventId: "missing", userId: "host-1", input: validInput }),
    (error) => error instanceof EventSettingsError && error.status === 404,
  );
});
