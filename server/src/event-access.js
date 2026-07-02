const { compareEventsByRecentActivity } = require("./event-activity");

class EventAccessError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "EventAccessError";
    this.status = status;
  }
}

async function saveEventAccess(prisma, { slug, userId }) {
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) throw new EventAccessError("Event not found", 404);

  const event = await prisma.event.findUnique({
    where: { slug: normalizedSlug },
    select: { id: true, hostId: true },
  });
  if (!event) throw new EventAccessError("Event not found", 404);

  if (event.hostId === userId) {
    return { event, role: "host" };
  }

  await prisma.eventAccess.upsert({
    where: {
      userId_eventId: {
        userId,
        eventId: event.id,
      },
    },
    update: {},
    create: {
      userId,
      eventId: event.id,
    },
  });

  return { event, role: "viewer" };
}

async function loadDashboardEventEntries(prisma, { userId, include }) {
  const hostedArgs = include ? { where: { hostId: userId }, include } : { where: { hostId: userId } };
  const accessArgs = include
    ? { where: { userId }, include: { event: { include } } }
    : { where: { userId }, include: { event: true } };

  const [hostedEvents, accessRows] = await Promise.all([
    prisma.event.findMany(hostedArgs),
    prisma.eventAccess.findMany(accessArgs),
  ]);

  const entriesByEventId = new Map();
  for (const event of hostedEvents) {
    entriesByEventId.set(event.id, { event, role: "host" });
  }

  for (const row of accessRows) {
    if (!row.event || entriesByEventId.has(row.event.id)) continue;
    entriesByEventId.set(row.event.id, { event: row.event, role: "viewer" });
  }

  return Array.from(entriesByEventId.values()).sort((first, second) =>
    compareEventsByRecentActivity(first.event, second.event),
  );
}

module.exports = {
  EventAccessError,
  loadDashboardEventEntries,
  saveEventAccess,
};
