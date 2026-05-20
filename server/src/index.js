const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const { ZipArchive } = require("archiver");
const QRCode = require("qrcode");
const rateLimit = require("express-rate-limit");
const prisma = require("./prisma");
const { signToken, requireAuth } = require("./auth");
const { port, clientUrl, serverUrl, maxFileSizeBytes, maxFileSizeMb } = require("./config");
const {
  createPhotoObjectKey,
  getPhotoUrl,
  uploadPhotoObject,
  removePhotoObject,
  createPhotoReadStream,
} = require("./storage");

const app = express();

const allowedOrigins = new Set([
  clientUrl,
  clientUrl.replace("localhost", "127.0.0.1"),
  clientUrl.replace("127.0.0.1", "localhost"),
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
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

function photoPayload(photo) {
  return {
    id: photo.id,
    url: `${serverUrl}${getPhotoUrl(photo.id)}`,
    originalFilename: photo.originalFilename,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    createdAt: photo.createdAt,
    guestNickname: photo.guest?.nickname,
  };
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !body[field]);
  return missing.length ? `Missing required fields: ${missing.join(", ")}` : null;
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
    include: { _count: { select: { photos: { where: { deletedAt: null } } } } },
  });
  res.json({
    events: events.map((event) => ({
      ...event,
      eventLink: publicEventUrl(event.slug),
      photoCount: event._count.photos,
      _count: undefined,
    })),
  });
});

app.post("/api/host/events", requireAuth, async (req, res) => {
  const missing = requireFields(req.body, ["name", "eventDate", "revealAt", "photoLimitPerGuest"]);
  if (missing) return res.status(400).json({ error: missing });

  const photoLimitPerGuest = Number(req.body.photoLimitPerGuest);
  if (!Number.isInteger(photoLimitPerGuest) || photoLimitPerGuest < 1) {
    return res.status(400).json({ error: "Photo limit must be at least 1" });
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
    },
  });

  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  res.status(201).json({ event: { ...event, eventLink, qrCodeDataUrl, photoCount: 0 } });
});

app.get("/api/host/events/:eventId", requireAuth, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    include: {
      photos: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { guest: true },
      },
      _count: { select: { photos: { where: { deletedAt: null } } } },
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  res.json({
    event: {
      ...event,
      eventLink,
      qrCodeDataUrl,
      photoCount: event._count.photos,
      photos: event.photos.map(photoPayload),
      _count: undefined,
    },
  });
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
    include: { _count: { select: { photos: { where: { deletedAt: null } } } } },
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
    const { nickname, clientId } = req.body;
    if (!nickname || !clientId) {
      return res.status(400).json({ error: "Nickname and clientId are required" });
    }
    if (!req.file) return res.status(400).json({ error: "Photo file is required" });

    const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const guest = await prisma.guest.upsert({
      where: { eventId_clientId: { eventId: event.id, clientId } },
      update: { nickname: nickname.trim() },
      create: { eventId: event.id, clientId, nickname: nickname.trim() },
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
      },
      include: { guest: true },
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
    include: { photos: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { guest: true } } },
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

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: `Photo must be ${maxFileSizeMb}MB or smaller` });
  }
  res.status(400).json({ error: error.message || "Request failed" });
});

app.listen(port, () => {
  console.log(`EventFilm API running on http://localhost:${port}`);
});
