require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/prisma");

const DEMO_HOST_EMAIL = process.env.DEMO_HOST_EMAIL || "fernando+eventfilm-demo@example.com";
const DEMO_HOST_PASSWORD = process.env.DEMO_HOST_PASSWORD || "eventfilm-beta-demo";
const DEMO_SLUG_PREFIX = "eventfilm-beta-demo";

function assertDevOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed beta demo data in production.");
  }
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function challengeFor(mode) {
  if (mode === "COLOR_HUNT") {
    return {
      type: "COLOR_HUNT",
      title: "Color Hunt",
      instructions: "Guests join a color team and upload photos that match their color.",
      config: { palette: ["red", "blue", "green", "yellow"] },
      participants: {
        create: [
          { displayName: "Red Team", colorName: "Red", colorHex: "#dc2626", colorSlug: "red" },
          { displayName: "Blue Team", colorName: "Blue", colorHex: "#2563eb", colorSlug: "blue" },
          { displayName: "Green Team", colorName: "Green", colorHex: "#16a34a", colorSlug: "green" },
          { displayName: "Yellow Team", colorName: "Yellow", colorHex: "#facc15", colorSlug: "yellow" },
        ],
      },
    };
  }

  if (mode === "PHOTO_SCAVENGER_HUNT") {
    const prompts = [
      "Best group selfie",
      "Someone on the dance floor",
      "A funny candid moment",
      "Favorite decoration",
      "The host having fun",
    ].map((text, order) => ({ id: `demo-prompt-${order + 1}`, text, order }));
    return {
      type: "PHOTO_SCAVENGER_HUNT",
      title: "Photo Scavenger Hunt",
      instructions: "Pick a prompt, take a photo, and upload it to the event album.",
      config: { prompts },
    };
  }

  if (mode === "EVENT_AWARDS") {
    const categories = ["Funniest Photo", "Best Group Shot", "Best Candid", "Best Outfit"].map((label, order) => ({ id: `demo-award-${order + 1}`, label, order }));
    return {
      type: "EVENT_AWARDS",
      title: "Event Awards",
      instructions: "Choose an award category, then submit the photo that deserves the title.",
      config: { categories },
    };
  }

  return {
    type: "MEMORY_CAPSULE",
    title: "Memory Capsule",
    instructions: "Add photos throughout the event. The full capsule opens at the reveal time.",
    config: {
      revealTitle: "The beta album unlocks after the event",
      revealNote: "Guests can keep adding photos now. Everyone comes back at reveal time to see the full capsule together.",
    },
  };
}

async function upsertStorageSmokeEvent(hostId) {
  const slug = `${DEMO_SLUG_PREFIX}-storage-smoke`;
  const existing = await prisma.event.findUnique({ where: { slug } });
  const base = {
    hostId,
    name: "EventFilm Beta Demo - Storage Smoke",
    description: "Dev-only revealed event for Supabase storage and public route smoke tests.",
    eventDate: hoursAgo(4),
    revealAt: hoursAgo(2),
    photoLimitPerGuest: 10,
  };

  return existing
    ? prisma.event.update({ where: { slug }, data: base })
    : prisma.event.create({ data: { ...base, slug } });
}

async function cleanup() {
  assertDevOnly();
  const host = await prisma.user.findUnique({ where: { email: DEMO_HOST_EMAIL } });
  if (!host) return { deletedEvents: 0, deletedHost: false };
  const deletedEvents = await prisma.event.deleteMany({ where: { hostId: host.id, slug: { startsWith: DEMO_SLUG_PREFIX } } });
  await prisma.user.delete({ where: { id: host.id } });
  return { deletedEvents: deletedEvents.count, deletedHost: true };
}

async function upsertDemoEvent(hostId, mode, index) {
  const slug = `${DEMO_SLUG_PREFIX}-${mode.toLowerCase().replace(/_/g, "-")}`;
  const existing = await prisma.event.findUnique({ where: { slug }, include: { challenges: true } });
  const base = {
    hostId,
    name: `EventFilm Beta Demo - ${mode.replace(/_/g, " ")}`,
    description: "Dev-only beta QA event. Use with test uploads and delete before real demos.",
    eventDate: hoursFromNow(24 + index),
    revealAt: hoursFromNow(30 + index),
    photoLimitPerGuest: 10,
  };

  const event = existing
    ? await prisma.event.update({ where: { slug }, data: base })
    : await prisma.event.create({ data: { ...base, slug } });

  await prisma.eventChallenge.deleteMany({ where: { eventId: event.id } });
  await prisma.eventChallenge.create({
    data: { eventId: event.id, isActive: true, ...challengeFor(mode) },
  });

  return event;
}

async function main() {
  assertDevOnly();

  if (process.argv.includes("--cleanup")) {
    const result = await cleanup();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_HOST_PASSWORD, 10);
  const host = await prisma.user.upsert({
    where: { email: DEMO_HOST_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_HOST_EMAIL, passwordHash },
  });

  const modes = ["COLOR_HUNT", "PHOTO_SCAVENGER_HUNT", "EVENT_AWARDS", "MEMORY_CAPSULE"];
  const events = [];
  for (const [index, mode] of modes.entries()) {
    events.push(await upsertDemoEvent(host.id, mode, index));
  }
  const storageSmokeEvent = await upsertStorageSmokeEvent(host.id);

  console.log(JSON.stringify({
    hostEmail: DEMO_HOST_EMAIL,
    hostPassword: DEMO_HOST_PASSWORD,
    note: "Dev-only demo events contain challenge configs but no fake photos. Upload real test photos through guest links. The storage smoke event is already revealed so album and Recap can be verified.",
    temporaryUploadQa: "For visual QA, run npm run smoke:storage against a safe local/deployed target or upload a tiny throwaway image through a demo guest link, then run cleanup. Do not commit uploaded images or seed fake production photos.",
    events: [...events, storageSmokeEvent].map((event) => ({
      name: event.name,
      slug: event.slug,
      guestUploadPath: `/e/${event.slug}`,
      recapPath: `/recap/${event.slug}`,
    })),
    cleanup: "npm run seed:beta-demo -w server -- --cleanup",
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
