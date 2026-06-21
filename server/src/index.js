const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const { ZipArchive } = require("archiver");
const QRCode = require("qrcode");
const rateLimit = require("express-rate-limit");
const prisma = require("./prisma");
const { signToken, requireAuth } = require("./auth");
const { port, clientUrl, clientOrigins, serverUrl, maxFileSizeBytes, maxFileSizeMb, jwtSecret, analyticsSalt, isProduction } = require("./config");
const {
  createPhotoObjectKey,
  getPhotoPreviewUrl,
  getPhotoUrl,
  uploadPhotoObject,
  removePhotoObject,
  downloadPhotoObject,
  createPhotoReadStream,
} = require("./storage");

const app = express();

function normalizeOrigin(value) {
  return value.replace(/\/+$/, "");
}

const allowedOrigins = new Set(clientOrigins.map(normalizeOrigin));
if (!isProduction) {
  allowedOrigins.add(normalizeOrigin(clientUrl.replace("localhost", "127.0.0.1")));
  allowedOrigins.add(normalizeOrigin(clientUrl.replace("127.0.0.1", "localhost")));
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const ANALYTICS_EVENT_NAMES = new Set([
  "landing_page_viewed",
  "cta_clicked",
  "host_dashboard_opened",
  "event_created",
  "event_mode_selected",
  "guest_link_copied",
  "live_wall_opened",
  "recap_opened",
  "guest_joined_event",
  "photo_upload_started",
  "photo_upload_succeeded",
  "photo_upload_failed",
  "photo_upload_retry_clicked",
  "challenge_item_selected",
  "host_launch_kit_opened",
  "photo_hidden",
  "photo_restored",
  "photo_featured",
  "photo_unfeatured",
  "photo_reported",
  "album_downloaded",
  "photo_lightbox_opened",
]);
const PHOTO_VISIBILITY_VISIBLE = "VISIBLE";
const PHOTO_VISIBILITY_HIDDEN = "HIDDEN";
const PHOTO_REPORT_REASON_MAP = new Map([
  ["inappropriate", "INAPPROPRIATE"],
  ["privacy", "PRIVACY"],
  ["spam", "SPAM"],
  ["other", "OTHER"],
]);
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ANALYTICS_SOURCES = new Set(["web", "mobile", "api"]);
const ANALYTICS_METADATA_KEYS = new Set([
  "label",
  "mode",
  "challengeType",
  "itemKind",
  "outcome",
  "reason",
  "route",
  "scope",
  "surface",
  "hasChallenge",
  "photoCount",
  "photoId",
  "visibilityStatus",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
      return cb(new Error("Upload a JPG, PNG, WebP, HEIC, or HEIF image."));
    }
    cb(null, true);
  },
});

function publicEventUrl(slug) {
  return `${clientUrl}/e/${slug}`;
}

function liveWallUrl(slug) {
  return `${clientUrl}/wall/${slug}`;
}

function recapUrl(slug) {
  return `${clientUrl}/recap/${slug}`;
}

function linkWarning(url) {
  try {
    const parsed = new URL(url);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      return "Uses localhost and will not work for guests outside this computer.";
    }
    if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      return "Use HTTPS before sharing this outside local development.";
    }
    return undefined;
  } catch {
    return "Link is not a valid URL.";
  }
}

function launchLinkVerification(event) {
  const links = [
    { key: "guest", label: "Guest upload link", url: publicEventUrl(event.slug) },
    { key: "live-wall", label: "Live Wall link", url: liveWallUrl(event.slug) },
    { key: "recap", label: "Recap link", url: recapUrl(event.slug) },
  ];

  return links.map((link) => {
    const warning = linkWarning(link.url);
    return { ...link, ok: !warning, warning };
  });
}

const CHALLENGE_TYPE_COLOR_HUNT = "COLOR_HUNT";
const CHALLENGE_TYPE_PHOTO_SCAVENGER_HUNT = "PHOTO_SCAVENGER_HUNT";
const CHALLENGE_TYPE_EVENT_AWARDS = "EVENT_AWARDS";
const CHALLENGE_TYPE_MEMORY_CAPSULE = "MEMORY_CAPSULE";
const SUPPORTED_CHALLENGE_TYPES = [
  CHALLENGE_TYPE_COLOR_HUNT,
  CHALLENGE_TYPE_PHOTO_SCAVENGER_HUNT,
  CHALLENGE_TYPE_EVENT_AWARDS,
  CHALLENGE_TYPE_MEMORY_CAPSULE,
];
const COLOR_HUNT_TITLE = "Color Hunt";
const COLOR_HUNT_INSTRUCTIONS = "Assign each person a color. Guests will upload photos of things they find in their color.";
const PHOTO_SCAVENGER_HUNT_TITLE = "Photo Scavenger Hunt";
const PHOTO_SCAVENGER_HUNT_INSTRUCTIONS = "Pick a prompt, take a photo, and upload it to the event album.";
const EVENT_AWARDS_TITLE = "Event Awards";
const EVENT_AWARDS_INSTRUCTIONS = "Choose an award category, then submit the photo that deserves the title.";
const MEMORY_CAPSULE_TITLE = "Memory Capsule";
const MEMORY_CAPSULE_INSTRUCTIONS = "Add photos throughout the event. The full capsule opens at the reveal time.";
const DEFAULT_MEMORY_CAPSULE = {
  revealTitle: "The album unlocks after the event",
  revealNote: "Guests can keep adding photos now. Everyone comes back at reveal time to see the full capsule together.",
};

const challengeInclude = {
  participants: { orderBy: { createdAt: "asc" } },
};

function slugifyColor(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function activeChallengeInclude() {
  return {
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: challengeInclude,
  };
}

function normalizePrompts(prompts) {
  return (Array.isArray(prompts) ? prompts : [])
    .map((prompt, index) => ({
      id: typeof prompt.id === "string" && prompt.id.trim() ? prompt.id.trim() : crypto.randomUUID(),
      text: String(prompt.text || "").trim(),
      order: Number.isInteger(Number(prompt.order)) ? Number(prompt.order) : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((prompt, index) => ({ ...prompt, order: index }));
}

function promptsFromConfig(config) {
  return normalizePrompts(config && typeof config === "object" ? config.prompts : []);
}

function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : [])
    .map((category, index) => ({
      id: typeof category.id === "string" && category.id.trim() ? category.id.trim() : crypto.randomUUID(),
      label: String(category.label || "").trim(),
      order: Number.isInteger(Number(category.order)) ? Number(category.order) : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((category, index) => ({ ...category, order: index }));
}

function categoriesFromConfig(config) {
  return normalizeCategories(config && typeof config === "object" ? config.categories : []);
}

function normalizeMemoryCapsuleConfig(config) {
  const source = config && typeof config === "object" ? config : {};
  return {
    revealTitle: String(source.revealTitle || DEFAULT_MEMORY_CAPSULE.revealTitle).trim() || DEFAULT_MEMORY_CAPSULE.revealTitle,
    revealNote: String(source.revealNote || DEFAULT_MEMORY_CAPSULE.revealNote).trim() || DEFAULT_MEMORY_CAPSULE.revealNote,
  };
}

function challengePayload(challenge) {
  if (!challenge) return null;
  return {
    id: challenge.id,
    eventId: challenge.eventId,
    type: challenge.type,
    title: challenge.title,
    instructions: challenge.instructions,
    config: challenge.config,
    isActive: challenge.isActive,
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
    participants: challenge.participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      colorName: participant.colorName,
      colorHex: participant.colorHex,
      colorSlug: participant.colorSlug,
      createdAt: participant.createdAt,
      updatedAt: participant.updatedAt,
    })),
    prompts: promptsFromConfig(challenge.config),
    categories: categoriesFromConfig(challenge.config),
  };
}

function publicChallengePayload(challenge) {
  const payload = challengePayload(challenge);
  if (!payload) return null;
  return {
    id: payload.id,
    type: payload.type,
    title: payload.title,
    instructions: payload.instructions,
    config: payload.config,
    participants: payload.participants.map(({ id, displayName, colorName, colorHex, colorSlug }) => ({
      id,
      displayName,
      colorName,
      colorHex,
      colorSlug,
    })),
    prompts: payload.prompts,
    categories: payload.categories,
  };
}

function visiblePhotoWhere(extra = {}) {
  return { deletedAt: null, visibilityStatus: PHOTO_VISIBILITY_VISIBLE, ...extra };
}

function activePhotoWhere(extra = {}) {
  return { deletedAt: null, ...extra };
}

function photoReportPayload(report) {
  return {
    id: report.id,
    reason: String(report.reason || "").toLowerCase(),
    note: report.note,
    createdAt: report.createdAt,
  };
}

function photoPayload(photo, { includeModeration = false } = {}) {
  const reportCount = photo._count?.reports ?? photo.reportCount ?? (Array.isArray(photo.reports) ? photo.reports.length : 0);
  return {
    id: photo.id,
    url: `${serverUrl}${getPhotoUrl(photo.id)}`,
    previewUrl: `${serverUrl}${getPhotoPreviewUrl(photo.id)}`,
    originalFilename: photo.originalFilename,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    createdAt: photo.createdAt,
    guestNickname: photo.guest?.nickname,
    challengeId: photo.challengeId,
    challengeParticipantId: photo.challengeParticipantId,
    challengeColorName: photo.challengeColorName,
    challengePromptId: photo.challengePromptId,
    challengePromptText: photo.challengePromptText,
    challengeItemId: photo.challengeItemId,
    challengeItemLabel: photo.challengeItemLabel,
    challengeItemKind: photo.challengeItemKind,
    challengeParticipantName: photo.challengeParticipant?.displayName,
    challengeColorHex: photo.challengeParticipant?.colorHex,
    challengeColorSlug: photo.challengeParticipant?.colorSlug || slugifyColor(photo.challengeColorName),
    visibilityStatus: includeModeration ? photo.visibilityStatus || PHOTO_VISIBILITY_VISIBLE : undefined,
    hiddenAt: includeModeration ? photo.hiddenAt : undefined,
    hiddenReason: includeModeration ? photo.hiddenReason : undefined,
    isFeatured: Boolean(photo.isFeatured),
    featuredAt: photo.featuredAt,
    reportCount: includeModeration ? reportCount : undefined,
    reports: includeModeration && Array.isArray(photo.reports) ? photo.reports.map(photoReportPayload) : undefined,
  };
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !body[field]);
  return missing.length ? `Missing required fields: ${missing.join(", ")}` : null;
}

function normalizeChallengeSetup(input) {
  if (!input || input.isActive === false) return null;
  if (input.type && !SUPPORTED_CHALLENGE_TYPES.includes(input.type)) {
    throw new Error("Unsupported challenge type");
  }
  const challengeType = input.type || CHALLENGE_TYPE_COLOR_HUNT;

  if (challengeType === CHALLENGE_TYPE_PHOTO_SCAVENGER_HUNT) {
    const prompts = normalizePrompts(input.prompts || input.config?.prompts);
    if (prompts.length < 3) {
      throw new Error("Add at least 3 prompts to start Photo Scavenger Hunt.");
    }
    if (prompts.some((prompt) => !prompt.text)) {
      throw new Error("Prompts cannot be empty.");
    }

    const promptTexts = prompts.map((prompt) => prompt.text.toLowerCase());
    if (new Set(promptTexts).size !== promptTexts.length) {
      throw new Error("Remove duplicate prompts before saving.");
    }

    return {
      type: CHALLENGE_TYPE_PHOTO_SCAVENGER_HUNT,
      title: String(input.title || PHOTO_SCAVENGER_HUNT_TITLE).trim() || PHOTO_SCAVENGER_HUNT_TITLE,
      instructions: String(input.instructions || PHOTO_SCAVENGER_HUNT_INSTRUCTIONS).trim() || PHOTO_SCAVENGER_HUNT_INSTRUCTIONS,
      config: { prompts },
      isActive: true,
      participants: [],
    };
  }

  if (challengeType === CHALLENGE_TYPE_EVENT_AWARDS) {
    const categories = normalizeCategories(input.categories || input.config?.categories);
    if (categories.length < 2) {
      throw new Error("Add at least 2 award categories.");
    }
    if (categories.some((category) => !category.label)) {
      throw new Error("Award categories cannot be empty.");
    }

    const categoryLabels = categories.map((category) => category.label.toLowerCase());
    if (new Set(categoryLabels).size !== categoryLabels.length) {
      throw new Error("Remove duplicate award categories before saving.");
    }

    return {
      type: CHALLENGE_TYPE_EVENT_AWARDS,
      title: String(input.title || EVENT_AWARDS_TITLE).trim() || EVENT_AWARDS_TITLE,
      instructions: String(input.instructions || EVENT_AWARDS_INSTRUCTIONS).trim() || EVENT_AWARDS_INSTRUCTIONS,
      config: { categories },
      isActive: true,
      participants: [],
    };
  }

  if (challengeType === CHALLENGE_TYPE_MEMORY_CAPSULE) {
    const config = normalizeMemoryCapsuleConfig(input.config);
    if (!config.revealTitle) {
      throw new Error("Add a reveal title for Memory Capsule.");
    }
    if (!config.revealNote) {
      throw new Error("Add a reveal note for Memory Capsule.");
    }

    return {
      type: CHALLENGE_TYPE_MEMORY_CAPSULE,
      title: String(input.title || MEMORY_CAPSULE_TITLE).trim() || MEMORY_CAPSULE_TITLE,
      instructions: String(input.instructions || MEMORY_CAPSULE_INSTRUCTIONS).trim() || MEMORY_CAPSULE_INSTRUCTIONS,
      config,
      isActive: true,
      participants: [],
    };
  }

  const participants = Array.isArray(input.participants)
    ? input.participants.map((participant) => ({
        id: typeof participant.id === "string" ? participant.id : undefined,
        displayName: String(participant.displayName || "").trim(),
        colorName: String(participant.colorName || "").trim(),
        colorHex: String(participant.colorHex || "").trim(),
        colorSlug: slugifyColor(participant.colorSlug || participant.colorName),
      }))
    : [];

  if (participants.length < 2) {
    throw new Error("Add at least 2 participants to start Color Hunt.");
  }
  if (participants.some((participant) => !participant.displayName)) {
    throw new Error("Participant names cannot be empty.");
  }
  if (participants.some((participant) => !participant.colorName || !participant.colorHex || !participant.colorSlug)) {
    throw new Error("Each participant needs a color.");
  }

  const participantNames = participants.map((participant) => participant.displayName.toLowerCase());
  if (new Set(participantNames).size !== participantNames.length) {
    throw new Error("Participant names must be unique.");
  }

  return {
    type: CHALLENGE_TYPE_COLOR_HUNT,
    title: String(input.title || COLOR_HUNT_TITLE).trim() || COLOR_HUNT_TITLE,
    instructions: String(input.instructions || COLOR_HUNT_INSTRUCTIONS).trim() || COLOR_HUNT_INSTRUCTIONS,
    config: input.config && typeof input.config === "object" ? input.config : {},
    isActive: true,
    participants: participants.map((participant) => ({
      ...participant,
      id: participant.id || undefined,
    })),
  };
}

function challengeCreateData(eventId, challengeSetup) {
  return {
    ...(eventId ? { eventId } : {}),
    type: challengeSetup.type,
    title: challengeSetup.title,
    instructions: challengeSetup.instructions,
    config: challengeSetup.config,
    isActive: true,
    ...(challengeSetup.type === CHALLENGE_TYPE_COLOR_HUNT
      ? {
          participants: {
            create: challengeSetup.participants.map(({ id: _id, ...participant }) => participant),
          },
        }
      : {}),
  };
}

function eventPayload(event, { includePhotos = false, includeModeration = false } = {}) {
  const challenge = event.challenges?.[0] || null;
  return {
    ...event,
    eventLink: publicEventUrl(event.slug),
    liveWallLink: liveWallUrl(event.slug),
    recapLink: recapUrl(event.slug),
    photoCount: event._count?.photos ?? event.photoCount ?? 0,
    challenge: challengePayload(challenge),
    previewPhotos: event.photos && !includePhotos ? event.photos.map((photo) => photoPayload(photo, { includeModeration })) : event.previewPhotos,
    photos: includePhotos && event.photos ? event.photos.map((photo) => photoPayload(photo, { includeModeration })) : undefined,
    challenges: undefined,
    _count: undefined,
  };
}

function publicEventBasePayload(event, isRevealed) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    slug: event.slug,
    eventDate: event.eventDate,
    revealAt: event.revealAt,
    photoLimitPerGuest: event.photoLimitPerGuest,
    isRevealed,
    eventLink: publicEventUrl(event.slug),
    liveWallLink: liveWallUrl(event.slug),
    recapLink: recapUrl(event.slug),
    challenge: publicChallengePayload(event.challenges?.[0]),
  };
}

function hashAnonymousId(value) {
  if (!value || typeof value !== "string") return null;
  return crypto.createHmac("sha256", analyticsSalt).update(value.slice(0, 200)).digest("hex");
}

function optionalUserId(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    return jwt.verify(token, jwtSecret).userId || null;
  } catch {
    return null;
  }
}

function sanitizeAnalyticsMetadata(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => ANALYTICS_METADATA_KEYS.has(key) && (["string", "number", "boolean"].includes(typeof value) || value === null))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value]),
  );
}

async function countAnalytics(name, where = {}) {
  return prisma.analyticsEvent.count({ where: { name, ...where } });
}

function trackApiAnalytics(name, input = {}) {
  if (!ANALYTICS_EVENT_NAMES.has(name)) return;
  prisma.analyticsEvent.create({
    data: {
      name,
      source: "api",
      path: input.path || null,
      userId: input.userId || null,
      eventId: input.eventId || null,
      eventSlug: input.eventSlug || null,
      anonymousIdHash: hashAnonymousId(input.anonymousId),
      metadata: sanitizeAnalyticsMetadata(input.metadata),
    },
  }).catch((error) => {
    console.warn(`Analytics write skipped for ${name}: ${error.message}`);
  });
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/analytics/events", analyticsLimiter, async (req, res) => {
  const { name, source, path: eventPath, eventId, eventSlug, anonymousId, metadata } = req.body || {};
  if (!ANALYTICS_EVENT_NAMES.has(name)) return res.status(400).json({ error: "Unsupported analytics event" });
  if (!ANALYTICS_SOURCES.has(source)) return res.status(400).json({ error: "Unsupported analytics source" });

  try {
    await prisma.analyticsEvent.create({
      data: {
        name,
        source,
        path: typeof eventPath === "string" ? eventPath.slice(0, 240) : null,
        userId: optionalUserId(req),
        eventId: typeof eventId === "string" ? eventId.slice(0, 100) : null,
        eventSlug: typeof eventSlug === "string" ? eventSlug.slice(0, 120) : null,
        anonymousIdHash: hashAnonymousId(anonymousId),
        metadata: sanitizeAnalyticsMetadata(metadata),
      },
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.warn(`Analytics write failed: ${error.message}`);
    res.status(202).json({ ok: false });
  }
});

app.get("/api/host/analytics/summary", requireAuth, async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hostEvents = await prisma.event.findMany({
    where: { hostId: req.user.userId },
    select: { id: true, slug: true },
  });
  const eventIds = hostEvents.map((event) => event.id);
  const eventSlugs = hostEvents.map((event) => event.slug);
  const eventScope = eventIds.length
    ? { OR: [{ eventId: { in: eventIds } }, { eventSlug: { in: eventSlugs } }] }
    : { eventId: "__none__" };

  const [eventsCreated, uploads, guestJoins, liveWallOpens, recapOpens, activeHosts, activeGuestRows] = await Promise.all([
    prisma.event.count({ where: { hostId: req.user.userId } }),
    prisma.photo.count({ where: { eventId: { in: eventIds }, deletedAt: null } }),
    countAnalytics("guest_joined_event", eventScope),
    countAnalytics("live_wall_opened", eventScope),
    countAnalytics("recap_opened", eventScope),
    prisma.analyticsEvent.findMany({
      where: { name: "host_dashboard_opened", createdAt: { gte: since }, userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        name: { in: ["guest_joined_event", "photo_upload_succeeded"] },
        createdAt: { gte: since },
        anonymousIdHash: { not: null },
        ...eventScope,
      },
      distinct: ["anonymousIdHash"],
      select: { anonymousIdHash: true },
    }),
  ]);

  res.json({
    summary: {
      eventsCreated,
      guestJoins,
      uploads,
      liveWallOpens,
      recapOpens,
      activeHosts: activeHosts.length,
      activeGuests: activeGuestRows.length,
    },
  });
});

app.get("/api/host/events/:eventId/analytics/summary", requireAuth, async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    select: { id: true, slug: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const eventScope = { OR: [{ eventId: event.id }, { eventSlug: event.slug }] };
  const [
    photoCount,
    visiblePhotos,
    hiddenPhotos,
    reportedPhotos,
    featuredPhotos,
    guestJoins,
    liveWallOpens,
    recapOpens,
    activeGuestRows,
  ] = await Promise.all([
    prisma.photo.count({ where: activePhotoWhere({ eventId: event.id }) }),
    prisma.photo.count({ where: visiblePhotoWhere({ eventId: event.id }) }),
    prisma.photo.count({ where: activePhotoWhere({ eventId: event.id, visibilityStatus: PHOTO_VISIBILITY_HIDDEN }) }),
    prisma.photo.count({ where: activePhotoWhere({ eventId: event.id, reports: { some: {} } }) }),
    prisma.photo.count({ where: activePhotoWhere({ eventId: event.id, isFeatured: true }) }),
    countAnalytics("guest_joined_event", eventScope),
    countAnalytics("live_wall_opened", eventScope),
    countAnalytics("recap_opened", eventScope),
    prisma.analyticsEvent.findMany({
      where: {
        name: { in: ["guest_joined_event", "photo_upload_succeeded"] },
        createdAt: { gte: since },
        anonymousIdHash: { not: null },
        ...eventScope,
      },
      distinct: ["anonymousIdHash"],
      select: { anonymousIdHash: true },
    }),
  ]);

  res.json({
    summary: {
      eventId: event.id,
      eventSlug: event.slug,
      photoCount,
      visiblePhotos,
      hiddenPhotos,
      reportedPhotos,
      featuredPhotos,
      guestJoins,
      uploads: photoCount,
      liveWallOpens,
      recapOpens,
      activeGuests: activeGuestRows.length,
    },
  });
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Email and password of at least 8 characters are required" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), passwordHash },
    });
    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: String(email || "").toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, email: user.email } });
});

app.get("/api/host/events", requireAuth, async (req, res) => {
  const events = await prisma.event.findMany({
    where: { hostId: req.user.userId },
    orderBy: { createdAt: "desc" },
    include: {
      photos: {
        where: visiblePhotoWhere(),
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: visiblePhotoWhere() } } },
    },
  });
  res.json({
    events: events.map((event) => eventPayload(event)),
  });
});

app.post("/api/host/events", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["name", "eventDate", "revealAt", "photoLimitPerGuest"]);
  if (missing) return res.status(400).json({ error: missing });

  const photoLimitPerGuest = Number(req.body.photoLimitPerGuest);
  if (!Number.isInteger(photoLimitPerGuest) || photoLimitPerGuest < 1) {
    return res.status(400).json({ error: "Photo limit must be at least 1" });
  }

  let challengeSetup;
  try {
    challengeSetup = normalizeChallengeSetup(req.body.challenge);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const slug = crypto.randomBytes(12).toString("base64url");
  const event = await prisma.event.create({
    data: {
      hostId: req.user.userId,
      name: req.body.name.trim(),
      description: req.body.description?.trim() || null,
      slug,
      eventDate: new Date(req.body.eventDate),
      revealAt: new Date(req.body.revealAt),
      photoLimitPerGuest,
      ...(challengeSetup
        ? {
            challenges: {
              create: challengeCreateData(undefined, challengeSetup),
            },
          }
        : {}),
    },
    include: { challenges: activeChallengeInclude() },
  });

  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  res.status(201).json({ event: { ...eventPayload({ ...event, _count: { photos: 0 } }), qrCodeDataUrl } });
});

app.get("/api/host/events/:eventId", requireAuth, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    include: {
      photos: {
        where: activePhotoWhere(),
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        include: { guest: true, challengeParticipant: true, reports: { orderBy: { createdAt: "desc" } }, _count: { select: { reports: true } } },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: visiblePhotoWhere() } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  res.json({
    event: {
      ...eventPayload(event, { includePhotos: true, includeModeration: true }),
      qrCodeDataUrl,
    },
  });
});

app.get("/api/host/events/:eventId/links/verify", requireAuth, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    select: { id: true, slug: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  res.json({
    eventId: event.id,
    eventSlug: event.slug,
    links: launchLinkVerification(event),
  });
});

app.put("/api/host/events/:eventId/challenge", requireAuth, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    include: { challenges: activeChallengeInclude() },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  let challengeSetup;
  try {
    challengeSetup = normalizeChallengeSetup(req.body.challenge);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const existingChallenge = event.challenges[0];
  if (!challengeSetup) {
    if (existingChallenge) {
      await prisma.eventChallenge.update({ where: { id: existingChallenge.id }, data: { isActive: false } });
    }
    return res.json({ challenge: null });
  }

  const challenge = await prisma.$transaction(async (tx) => {
    if (existingChallenge && existingChallenge.type !== challengeSetup.type) {
      await tx.eventChallenge.update({ where: { id: existingChallenge.id }, data: { isActive: false } });
      return tx.eventChallenge.create({
        data: challengeCreateData(event.id, challengeSetup),
        include: challengeInclude,
      });
    }

    if (existingChallenge && challengeSetup.type === CHALLENGE_TYPE_COLOR_HUNT) {
      const existingParticipantsById = new Map(existingChallenge.participants.map((participant) => [participant.id, participant]));
      const retainedIds = [];

      for (const participant of challengeSetup.participants) {
        const data = {
          displayName: participant.displayName,
          colorName: participant.colorName,
          colorHex: participant.colorHex,
          colorSlug: participant.colorSlug,
        };

        if (participant.id && existingParticipantsById.has(participant.id)) {
          await tx.challengeParticipant.update({ where: { id: participant.id }, data });
          retainedIds.push(participant.id);
        } else {
          const createdParticipant = await tx.challengeParticipant.create({ data: { ...data, eventChallengeId: existingChallenge.id } });
          retainedIds.push(createdParticipant.id);
        }
      }

      await tx.challengeParticipant.deleteMany({
        where: { eventChallengeId: existingChallenge.id, id: { notIn: retainedIds } },
      });

      await tx.eventChallenge.update({
        where: { id: existingChallenge.id },
        data: {
          title: challengeSetup.title,
          instructions: challengeSetup.instructions,
          config: challengeSetup.config,
          isActive: true,
        },
      });

      return tx.eventChallenge.findUnique({ where: { id: existingChallenge.id }, include: challengeInclude });
    }

    if (existingChallenge) {
      await tx.challengeParticipant.deleteMany({ where: { eventChallengeId: existingChallenge.id } });
      await tx.eventChallenge.update({
        where: { id: existingChallenge.id },
        data: {
          title: challengeSetup.title,
          instructions: challengeSetup.instructions,
          config: challengeSetup.config,
          isActive: true,
        },
      });

      return tx.eventChallenge.findUnique({ where: { id: existingChallenge.id }, include: challengeInclude });
    }

    return tx.eventChallenge.create({
      data: challengeCreateData(event.id, challengeSetup),
      include: challengeInclude,
    });
  });

  res.json({ challenge: challengePayload(challenge) });
});

app.get("/api/host/events/:eventId/photos", requireAuth, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    select: { id: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const where = activePhotoWhere({ eventId: event.id });
  if ([PHOTO_VISIBILITY_VISIBLE, PHOTO_VISIBILITY_HIDDEN].includes(req.query.visibility)) {
    where.visibilityStatus = req.query.visibility;
  }
  if (req.query.featured === "true") where.isFeatured = true;
  if (req.query.featured === "false") where.isFeatured = false;
  if (typeof req.query.challengeItemId === "string" && req.query.challengeItemId.trim()) {
    where.OR = [
      { challengeItemId: req.query.challengeItemId },
      { challengePromptId: req.query.challengeItemId },
      { challengeParticipantId: req.query.challengeItemId },
    ];
  }
  if (req.query.reported === "true") {
    where.reports = { some: {} };
  }

  const photos = await prisma.photo.findMany({
    where,
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    include: {
      guest: true,
      challengeParticipant: true,
      reports: { orderBy: { createdAt: "desc" } },
      _count: { select: { reports: true } },
    },
  });

  res.json({ photos: photos.map((photo) => photoPayload(photo, { includeModeration: true })) });
});

app.patch("/api/host/events/:eventId/photos/:photoId/visibility", requireAuth, async (req, res) => {
  const nextStatus = req.body?.visibilityStatus;
  if (![PHOTO_VISIBILITY_VISIBLE, PHOTO_VISIBILITY_HIDDEN].includes(nextStatus)) {
    return res.status(400).json({ error: "Unsupported photo visibility" });
  }

  const photo = await prisma.photo.findFirst({
    where: { id: req.params.photoId, eventId: req.params.eventId, event: { hostId: req.user.userId }, deletedAt: null },
    include: { event: { select: { slug: true } } },
  });
  if (!photo) return res.status(404).json({ error: "Photo not found" });

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: {
      visibilityStatus: nextStatus,
      hiddenAt: nextStatus === PHOTO_VISIBILITY_HIDDEN ? new Date() : null,
      hiddenReason: nextStatus === PHOTO_VISIBILITY_HIDDEN ? String(req.body?.hiddenReason || "").slice(0, 160) || "Hidden by host" : null,
    },
    include: { guest: true, challengeParticipant: true, reports: { orderBy: { createdAt: "desc" } }, _count: { select: { reports: true } } },
  });

  trackApiAnalytics(nextStatus === PHOTO_VISIBILITY_HIDDEN ? "photo_hidden" : "photo_restored", {
    userId: req.user.userId,
    eventId: req.params.eventId,
    eventSlug: photo.event.slug,
    metadata: { photoId: photo.id, visibilityStatus: nextStatus },
  });

  res.json({ photo: photoPayload(updated, { includeModeration: true }) });
});

app.patch("/api/host/events/:eventId/photos/:photoId/featured", requireAuth, async (req, res) => {
  const isFeatured = Boolean(req.body?.isFeatured);
  const photo = await prisma.photo.findFirst({
    where: { id: req.params.photoId, eventId: req.params.eventId, event: { hostId: req.user.userId }, deletedAt: null },
    include: { event: { select: { slug: true } } },
  });
  if (!photo) return res.status(404).json({ error: "Photo not found" });

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: { isFeatured, featuredAt: isFeatured ? new Date() : null },
    include: { guest: true, challengeParticipant: true, reports: { orderBy: { createdAt: "desc" } }, _count: { select: { reports: true } } },
  });

  trackApiAnalytics(isFeatured ? "photo_featured" : "photo_unfeatured", {
    userId: req.user.userId,
    eventId: req.params.eventId,
    eventSlug: photo.event.slug,
    metadata: { photoId: photo.id },
  });

  res.json({ photo: photoPayload(updated, { includeModeration: true }) });
});

app.delete("/api/host/events/:eventId/photos/:photoId", requireAuth, async (req, res) => {
  const photo = await prisma.photo.findFirst({
    where: { id: req.params.photoId, eventId: req.params.eventId, event: { hostId: req.user.userId }, deletedAt: null },
  });
  if (!photo) return res.status(404).json({ error: "Photo not found" });

  await removePhotoObject(photo.filePath);
  await prisma.photo.update({ where: { id: photo.id }, data: { deletedAt: new Date() } });
  res.json({ ok: true });
});

app.get("/api/host/events/:eventId/download", requireAuth, async (req, res) => {
  const includeAll = req.query.scope === "all";
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    include: { photos: { where: includeAll ? activePhotoWhere() : visiblePhotoWhere(), include: { guest: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const safeName = event.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event";
  res.attachment(`${safeName}-${includeAll ? "all" : "visible"}-photos.zip`);
  trackApiAnalytics("album_downloaded", {
    userId: req.user.userId,
    eventId: event.id,
    eventSlug: event.slug,
    metadata: { scope: includeAll ? "all" : "visible", photoCount: event.photos.length },
  });

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("error", () => res.status(500).end());
  archive.pipe(res);

  for (const [index, photo] of event.photos.entries()) {
    const ext = path.extname(photo.originalFilename) || path.extname(photo.filePath);
    const nickname = (photo.guest?.nickname || "guest").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const stream = await createPhotoReadStream(photo.filePath);
    archive.append(stream, { name: `${String(index + 1).padStart(3, "0")}-${nickname}${ext}` });
  }
  archive.finalize();
});

app.get("/api/events/:slug", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: {
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: visiblePhotoWhere() } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const isRevealed = event.revealAt <= new Date();
  res.json({
    event: {
      ...publicEventBasePayload(event, isRevealed),
      photoCount: isRevealed ? event._count.photos : null,
    },
  });
});

app.get("/api/events/:slug/live-wall", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: {
      photos: {
        where: visiblePhotoWhere(),
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: visiblePhotoWhere() } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const isRevealed = event.revealAt <= new Date();
  const isLocked = event.challenges?.[0]?.type === CHALLENGE_TYPE_MEMORY_CAPSULE && !isRevealed;
  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 360 });

  res.json({
    event: {
      ...publicEventBasePayload(event, isRevealed),
      photoCount: isLocked ? null : event._count.photos,
      qrCodeDataUrl,
    },
    eventLink,
    liveWallLink: liveWallUrl(event.slug),
    recapLink: recapUrl(event.slug),
    qrCodeDataUrl,
    isLocked,
    photos: isLocked ? [] : event.photos.map(photoPayload),
  });
});

app.get("/api/events/:slug/recap", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: {
      photos: {
        where: visiblePhotoWhere(),
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: visiblePhotoWhere() } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const isRevealed = event.revealAt <= new Date();

  res.json({
    event: {
      ...publicEventBasePayload(event, isRevealed),
      photoCount: isRevealed ? event._count.photos : null,
    },
    eventLink: publicEventUrl(event.slug),
    liveWallLink: liveWallUrl(event.slug),
    recapLink: recapUrl(event.slug),
    isLocked: !isRevealed,
    photos: isRevealed ? event.photos.map(photoPayload) : [],
  });
});

app.get("/api/events/:slug/guest-status", async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: "clientId is required" });

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const guest = await prisma.guest.findUnique({
    where: { eventId_clientId: { eventId: event.id, clientId: String(clientId) } },
    include: { _count: { select: { photos: { where: activePhotoWhere() } } } },
  });
  const used = guest?._count.photos || 0;
  res.json({ uploadedCount: used, remainingUploads: Math.max(event.photoLimitPerGuest - used, 0), nickname: guest?.nickname || null });
});

app.post("/api/events/:slug/photos", uploadLimiter, upload.single("photo"), async (req, res) => {
  let uploadedObjectKey;

  try {
    const { nickname, clientId, challengeParticipantId, challengePromptId, challengeItemId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }
    if (!req.file) return res.status(400).json({ error: "Photo file is required" });

    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: { challenges: activeChallengeInclude() },
    });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const activeChallenge = event.challenges[0];
    let selectedParticipant = null;
    let selectedPrompt = null;
    let selectedAwardCategory = null;
    if (activeChallenge?.type === CHALLENGE_TYPE_COLOR_HUNT) {
      if (!challengeParticipantId) {
        return res.status(400).json({ error: "Select your Color Hunt participant before uploading" });
      }
      selectedParticipant = activeChallenge.participants.find((participant) => participant.id === challengeParticipantId);
      if (!selectedParticipant) {
        return res.status(400).json({ error: "Selected Color Hunt participant is not valid for this event" });
      }
    } else if (activeChallenge?.type === CHALLENGE_TYPE_PHOTO_SCAVENGER_HUNT) {
      if (!nickname?.trim()) {
        return res.status(400).json({ error: "Enter your name or nickname first" });
      }
      if (!challengePromptId) {
        return res.status(400).json({ error: "Choose a Photo Scavenger Hunt prompt before uploading" });
      }
      selectedPrompt = promptsFromConfig(activeChallenge.config).find((prompt) => prompt.id === challengePromptId);
      if (!selectedPrompt) {
        return res.status(400).json({ error: "Selected Photo Scavenger Hunt prompt is not valid for this event" });
      }
    } else if (activeChallenge?.type === CHALLENGE_TYPE_EVENT_AWARDS) {
      if (!nickname?.trim()) {
        return res.status(400).json({ error: "Enter your name or nickname first" });
      }
      if (!challengeItemId) {
        return res.status(400).json({ error: "Choose an Event Awards category before uploading" });
      }
      selectedAwardCategory = categoriesFromConfig(activeChallenge.config).find((category) => category.id === challengeItemId);
      if (!selectedAwardCategory) {
        return res.status(400).json({ error: "Selected Event Awards category is not valid for this event" });
      }
    } else if (!nickname?.trim()) {
      return res.status(400).json({ error: "Nickname and clientId are required" });
    }

    const uploadNickname = selectedParticipant ? selectedParticipant.displayName : nickname.trim();

    const guest = await prisma.guest.upsert({
      where: { eventId_clientId: { eventId: event.id, clientId } },
      update: { nickname: uploadNickname },
      create: { eventId: event.id, clientId, nickname: uploadNickname },
    });

    const used = await prisma.photo.count({ where: activePhotoWhere({ eventId: event.id, guestId: guest.id }) });
    if (used >= event.photoLimitPerGuest) {
      return res.status(403).json({ error: "You have used all uploads for this event" });
    }

    const objectKey = createPhotoObjectKey(event.id, req.file.originalname);
    await uploadPhotoObject({
      objectKey,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });
    uploadedObjectKey = objectKey;

    const photo = await prisma.photo.create({
      data: {
        eventId: event.id,
        guestId: guest.id,
        filePath: objectKey,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        challengeId: selectedParticipant || selectedPrompt || selectedAwardCategory ? activeChallenge.id : null,
        challengeParticipantId: selectedParticipant?.id || null,
        challengeColorName: selectedParticipant?.colorName || null,
        challengePromptId: selectedPrompt?.id || null,
        challengePromptText: selectedPrompt?.text || null,
        challengeItemId: selectedParticipant?.id || selectedPrompt?.id || selectedAwardCategory?.id || null,
        challengeItemLabel: selectedParticipant?.colorName || selectedPrompt?.text || selectedAwardCategory?.label || null,
        challengeItemKind: selectedParticipant ? "color" : selectedPrompt ? "prompt" : selectedAwardCategory ? "award" : null,
      },
      include: { guest: true, challengeParticipant: true },
    });
    uploadedObjectKey = null;

    res.status(201).json({
      photo: photoPayload(photo),
      uploadedCount: used + 1,
      remainingUploads: Math.max(event.photoLimitPerGuest - used - 1, 0),
    });
  } catch (error) {
    if (uploadedObjectKey) {
      await removePhotoObject(uploadedObjectKey).catch(() => {});
    }
    res.status(400).json({ error: error.message || "Upload failed" });
  }
});

app.get("/api/events/:slug/photos", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { photos: { where: visiblePhotoWhere(), orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }], include: { guest: true, challengeParticipant: true } } },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.revealAt > new Date()) {
    return res.status(403).json({ error: `Photos are locked until ${event.revealAt.toISOString()}`, revealAt: event.revealAt });
  }
  res.json({ photos: event.photos.map(photoPayload) });
});

app.post("/api/photos/:photoId/reports", async (req, res) => {
  const reason = PHOTO_REPORT_REASON_MAP.get(String(req.body?.reason || "").toLowerCase());
  if (!reason) return res.status(400).json({ error: "Choose a report reason" });

  const photo = await prisma.photo.findFirst({
    where: visiblePhotoWhere({ id: req.params.photoId }),
    include: { event: { select: { id: true, slug: true } } },
  });
  if (!photo) return res.status(404).json({ error: "Photo not found" });

  await prisma.photoReport.create({
    data: {
      photoId: photo.id,
      eventId: photo.eventId,
      reason,
      note: typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim().slice(0, 500) : null,
      reporterHash: hashAnonymousId(req.body?.reporterId),
    },
  });

  trackApiAnalytics("photo_reported", {
    eventId: photo.eventId,
    eventSlug: photo.event.slug,
    anonymousId: req.body?.reporterId,
    metadata: { photoId: photo.id, reason: String(req.body?.reason || "").toLowerCase() },
  });

  res.status(201).json({ ok: true });
});

app.get("/api/photos/:photoId/file", async (req, res) => {
  const photo = await prisma.photo.findFirst({ where: visiblePhotoWhere({ id: req.params.photoId }) });
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  res.type(photo.mimeType);
  const stream = await createPhotoReadStream(photo.filePath);
  stream.on("error", () => res.status(404).end());
  stream.pipe(res);
});

app.get("/api/photos/:photoId/preview", async (req, res) => {
  const photo = await prisma.photo.findFirst({ where: visiblePhotoWhere({ id: req.params.photoId }) });
  if (!photo) return res.status(404).json({ error: "Photo not found" });

  try {
    const file = await downloadPhotoObject(photo.filePath);
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 360, height: 480, fit: "cover", position: "attention" })
      .webp({ quality: 68, effort: 4 })
      .toBuffer();

    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.type("image/webp");
    res.send(preview);
  } catch {
    res.type(photo.mimeType);
    res.set("Cache-Control", "public, max-age=86400");
    const stream = await createPhotoReadStream(photo.filePath);
    stream.on("error", () => res.status(404).end());
    stream.pipe(res);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `Photo must be ${maxFileSizeMb}MB or smaller` });
  }
  res.status(400).json({ error: error.message || "Request failed" });
});

app.listen(port, () => {
  console.log(`EventFilm API running on http://localhost:${port}`);
});
