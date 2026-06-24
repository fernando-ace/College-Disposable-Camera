const MAX_EVENT_NAME_LENGTH = 120;
const MAX_EVENT_DESCRIPTION_LENGTH = 1000;

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

function validateEventSettingsInput(input = {}, options = {}) {
  const fieldErrors = {};
  const name = String(input.name ?? "").trim();
  const description = typeof input.description === "string" ? input.description.trim() : input.description == null ? "" : String(input.description).trim();
  const hasRevealAt = input.revealAt !== undefined && input.revealAt !== null && input.revealAt !== "";
  const revealAt = parseEventDate(input.revealAt);

  if (!name) {
    fieldErrors.name = "Event name is required.";
  } else if (name.length > MAX_EVENT_NAME_LENGTH) {
    fieldErrors.name = `Event name must be ${MAX_EVENT_NAME_LENGTH} characters or fewer.`;
  }

  if (description.length > MAX_EVENT_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Description must be ${MAX_EVENT_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  if (options.requireRevealAt && !revealAt) {
    fieldErrors.revealAt = "Enter a valid reveal time.";
  } else if (hasRevealAt && !revealAt) {
    fieldErrors.revealAt = "Enter a valid reveal time.";
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
      ...(revealAt ? { revealAt } : {}),
    },
  };
}

async function updateHostEventSettings(prisma, { eventId, userId, input, include }) {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      hostId: true,
      challenges: { where: { isActive: true }, take: 1, select: { type: true } },
    },
  });

  if (!existing) {
    throw new EventSettingsError("Event not found", 404);
  }
  if (existing.hostId !== userId) {
    throw new EventSettingsError("You do not have access to edit this event.", 403);
  }

  const validation = validateEventSettingsInput(input, { requireRevealAt: existing.challenges?.[0]?.type === "MEMORY_CAPSULE" });
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
  updateHostEventSettings,
  validateEventSettingsInput,
};
