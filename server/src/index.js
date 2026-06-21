const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const { ZipArchive } = require("archiver");
const QRCode = require("qrcode");
const rateLimit = require("express-rate-limit");
const prisma = require("./prisma");
const { signToken, requireAuth } = require("./auth");
const { port, clientUrl, serverUrl, maxFileSizeBytes, maxFileSizeMb } = require("./config");
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

const allowedOrigins = new Set([
  normalizeOrigin(clientUrl),
  normalizeOrigin(clientUrl.replace("localhost", "127.0.0.1")),
  normalizeOrigin(clientUrl.replace("127.0.0.1", "localhost")),
]);

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
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

function photoPayload(photo) {
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

function eventPayload(event, { includePhotos = false } = {}) {
  const challenge = event.challenges?.[0] || null;
  return {
    ...event,
    eventLink: publicEventUrl(event.slug),
    liveWallLink: liveWallUrl(event.slug),
    recapLink: recapUrl(event.slug),
    photoCount: event._count?.photos ?? event.photoCount ?? 0,
    challenge: challengePayload(challenge),
    previewPhotos: event.photos && !includePhotos ? event.photos.map(photoPayload) : event.previewPhotos,
    photos: includePhotos && event.photos ? event.photos.map(photoPayload) : undefined,
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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: { deletedAt: null } } } },
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
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: { deletedAt: null } } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  res.json({
    event: {
      ...eventPayload(event, { includePhotos: true }),
      qrCodeDataUrl,
    },
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
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    include: { photos: { where: { deletedAt: null }, include: { guest: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const safeName = event.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event";
  res.attachment(`${safeName}-photos.zip`);

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
      _count: { select: { photos: { where: { deletedAt: null } } } },
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
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: { deletedAt: null } } } },
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
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { guest: true, challengeParticipant: true },
      },
      challenges: activeChallengeInclude(),
      _count: { select: { photos: { where: { deletedAt: null } } } },
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
    include: { _count: { select: { photos: { where: { deletedAt: null } } } } },
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

    const used = await prisma.photo.count({ where: { eventId: event.id, guestId: guest.id, deletedAt: null } });
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
    include: { photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { guest: true, challengeParticipant: true } } },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (event.revealAt > new Date()) {
    return res.status(403).json({ error: `Photos are locked until ${event.revealAt.toISOString()}`, revealAt: event.revealAt });
  }
  res.json({ photos: event.photos.map(photoPayload) });
});

app.get("/api/photos/:photoId/file", async (req, res) => {
  const photo = await prisma.photo.findFirst({ where: { id: req.params.photoId, deletedAt: null } });
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  res.type(photo.mimeType);
  const stream = await createPhotoReadStream(photo.filePath);
  stream.on("error", () => res.status(404).end());
  stream.pipe(res);
});

app.get("/api/photos/:photoId/preview", async (req, res) => {
  const photo = await prisma.photo.findFirst({ where: { id: req.params.photoId, deletedAt: null } });
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
