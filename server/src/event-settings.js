const MAX_EVENT_NAME_LENGTH = 120;
const MAX_EVENT_DESCRIPTION_LENGTH = 1000;
const MIN_PHOTO_LIMIT_PER_GUEST = 1;
const MAX_PHOTO_LIMIT_PER_GUEST = 100;

class EventSettingsError extends Error {
  constructor(message, status = 400, fieldErrors = undefined) {
    super(message);
    this.name = "EventSettingsError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function parseEventDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateEventSettingsInput(input = {}) {
  const fieldErrors = {};
  const name = String(input.name ?? "").trim();
  const description = typeof input.description === "string" ? input.description.trim() : input.description == null ? "" : String(input.description).trim();
  const eventDate = parseEventDate(input.eventDate);
  const revealAt = parseEventDate(input.revealAt);
  const photoLimitPerGuest = Number(input.photoLimitPerGuest);

  if (!name) {
    fieldErrors.name = "Event name is required.";
  } else if (name.length > MAX_EVENT_NAME_LENGTH) {
    fieldErrors.name = `Event name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer.`;
  }

  if (description.length > MAX_EVENT_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Description must be ${MAX_EVENT_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (!eventDate) {
    fieldErrors.eventDate = "Enter a valid event date.";
  }

  if (!revealAt) {
    fieldErrors.revealAt = "Enter a valid reveal time.";
  }

  if (!Number.isInteger(photoLimitPerGuest)) {
    fieldErrors.photoLimitPerGuest = "Photo limit must be a whole number.";
  } else if (photoLimitPerGuest < MIN_PHOTO_LIMIT_PER_GUEST || photoLimitPerGuest > MAX_PHOTO_LIMIT_PER_GUEST) {
    fieldErrors.photoLimitPerGuest = `Photo limit must be between ${MIN_PHOTO_LIMIT_PER_GUEST} and ${MAX_PHOTO_LIMIT_PER_GUEST}.`;
  }

  if (Object.keys(fieldErrors).length) {
    return {
      ok: false,
      error: "Check the highlighted event settings.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    value: {
      name,
      description: description || null,
      eventDate,
      revealAt,
      photoLimitPerGuest,
    },
  };
}

async function updateHostEventSettings(prisma, { eventId, userId, input, include }) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, hostId: true },
  });

  if (!existing) {
    throw new EventSettingsError("Event not found", 404);
  }
  if (existing.hostId !== userId) {
    throw new EventSettingsError("You do not have access to edit this event.", 403);
  }

  const validation = validateEventSettingsInput(input);
  if (!validation.ok) {
    throw new EventSettingsError(validation.error, 400, validation.fieldErrors);
  }

  return prisma.event.update({
    where: { id: eventId },
    data: validation.value,
    include,
  });
}

module.exports = {
  EventSettingsError,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_NAME_LENGTH,
  MAX_PHOTO_LIMIT_PER_GUEST,
  MIN_PHOTO_LIMIT_PER_GUEST,
  updateHostEventSettings,
  validateEventSettingsInput,
};
