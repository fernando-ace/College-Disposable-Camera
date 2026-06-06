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

const CHALLENGE_TYPE_COLOR_HUNT = "COLOR_HUNT";
const COLOR_HUNT_TITLE = "Color Hunt";
const COLOR_HUNT_INSTRUCTIONS = "Assign each person a color. Guests will upload photos of things they find in their color.";

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

function activeColorHuntInclude() {
  return {
    where: { type: CHALLENGE_TYPE_COLOR_HUNT, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: challengeInclude,
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
    participants: payload.participants.map(({ id, displayName, colorName, colorHex, colorSlug }) => ({
      id,
      displayName,
      colorName,
      colorHex,
      colorSlug,
    })),
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
  if (input.type && input.type !== CHALLENGE_TYPE_COLOR_HUNT) {
    throw new Error("Unsupported challenge type");
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

function eventPayload(event, { includePhotos = false } = {}) {
  const challenge = event.challenges?.[0] || null;
  return {
    ...event,
    eventLink: publicEventUrl(event.slug),
    photoCount: event._count?.photos ?? event.photoCount ?? 0,
    challenge: challengePayload(challenge),
    previewPhotos: event.photos && !includePhotos ? event.photos.map(photoPayload) : event.previewPhotos,
    photos: includePhotos && event.photos ? event.photos.map(photoPayload) : undefined,
    challenges: undefined,
    _count: undefined,
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
      challenges: activeColorHuntInclude(),
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
              create: {
                type: challengeSetup.type,
                title: challengeSetup.title,
                instructions: challengeSetup.instructions,
                config: challengeSetup.config,
                isActive: challengeSetup.isActive,
                participants: {
                  create: challengeSetup.participants.map(({ id: _id, ...participant }) => participant),
                },
              },
            },
          }
        : {}),
    },
    include: { challenges: activeColorHuntInclude() },
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
      challenges: activeColorHuntInclude(),
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
    include: { challenges: activeColorHuntInclude() },
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
    if (existingChallenge) {
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

    return tx.eventChallenge.create({
      data: {
        eventId: event.id,
        type: challengeSetup.type,
        title: challengeSetup.title,
        instructions: challengeSetup.instructions,
        config: challengeSetup.config,
        isActive: true,
        participants: {
          create: challengeSetup.participants.map(({ id: _id, ...participant }) => participant),
        },
      },
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
      challenges: activeColorHuntInclude(),
      _count: { select: { photos: { where: { deletedAt: null } } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const isRevealed = event.revealAt <= new Date();
  res.json({
    event: {
      id: event.id,
      name: event.name,
      description: event.description,
      slug: event.slug,
      eventDate: event.eventDate,
      revealAt: event.revealAt,
      photoLimitPerGuest: event.photoLimitPerGuest,
      isRevealed,
      photoCount: isRevealed ? event._count.photos : null,
      challenge: publicChallengePayload(event.challenges[0]),
    },
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
    const { nickname, clientId, challengeParticipantId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }
    if (!req.file) return res.status(400).json({ error: "Photo file is required" });

    const event = await prisma.event.findUnique({
      where: { slug: req.params.slug },
      include: { challenges: activeColorHuntInclude() },
    });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const activeChallenge = event.challenges[0];
    let selectedParticipant = null;
    if (activeChallenge) {
      if (!challengeParticipantId) {
        return res.status(400).json({ error: "Select your Color Hunt participant before uploading" });
      }
      selectedParticipant = activeChallenge.participants.find((participant) => participant.id === challengeParticipantId);
      if (!selectedParticipant) {
        return res.status(400).json({ error: "Selected Color Hunt participant is not valid for this event" });
      }
    } else if (!nickname) {
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
        challengeId: selectedParticipant ? activeChallenge.id : null,
        challengeParticipantId: selectedParticipant?.id || null,
        challengeColorName: selectedParticipant?.colorName || null,
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
