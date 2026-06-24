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
const { signToken, requireAuth, requireFounderAuth } = require("./auth");
const { port, clientUrl, clientOrigins, serverUrl, maxFileSizeBytes, maxFileSizeMb, jwtSecret, analyticsSalt, isProduction, founderEmails, isFounderEmail } = require("./config");
const { EventSettingsError, updateHostEventSettings, validateEventSettingsInput } = require("./event-settings");
const { buildFounderOverview } = require("./founder");
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
  "event_template_viewed",
  "event_template_selected",
  "prompt_pack_selected",
  "prompts_customized",
  "event_created_from_template",
  "template_skipped",
  "invite_poster_viewed",
  "invite_poster_printed",
  "guest_link_copied",
  "guest_link_shared",
  "live_wall_link_copied",
  "live_wall_link_shared",
  "recap_link_copied",
  "recap_link_shared",
  "recap_share_clicked",
  "recap_hero_viewed",
  "recap_highlights_viewed",
  "recap_challenge_moments_viewed",
  "recap_contributors_viewed",
  "recap_album_filter_used",
  "recap_photo_opened",
  "recap_create_event_cta_clicked",
  "native_share_opened",
  "live_wall_opened",
  "live_wall_viewed",
  "live_wall_mode_viewed",
  "live_wall_mode_switched",
  "live_wall_mode_changed",
  "live_wall_fullscreen_clicked",
  "live_wall_slideshow_paused",
  "live_wall_slideshow_resumed",
  "live_wall_qr_display_opened",
  "live_wall_qr_toggled",
  "live_wall_challenge_display_opened",
  "live_wall_awards_leaders_viewed",
  "live_wall_upload_link_clicked",
  "recap_opened",
  "guest_upload_page_viewed",
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
  "award_votes_opened",
  "award_vote_cast",
  "award_vote_duplicate_blocked",
  "award_winner_section_viewed",
  "award_host_voting_summary_viewed",
  "award_voting_toggled",
  "guest_name_entered",
  "guest_continued_anonymous",
  "upload_success_action_clicked",
  "guest_my_uploads_viewed",
  "guest_prompt_hint_expanded",
  "guest_album_opened",
  "guest_recap_opened",
  "challenge_progress_viewed",
  "guest_share_clicked",
  "guest_returned_to_event",
  "event_lifecycle_viewed",
  "post_event_summary_viewed",
  "duplicate_event_clicked",
  "duplicate_event_created",
  "host_feedback_opened",
  "host_feedback_submitted",
  "host_feedback_skipped",
  "beta_handoff_viewed",
  "first_event_checklist_item_clicked",
  "beta_issue_report_opened",
  "beta_issue_submitted",
  "host_support_link_clicked",
  "qr_poster_viewed_from_beta_handoff",
  "live_wall_opened_from_beta_handoff",
  "recap_opened_from_beta_handoff",
  "repeat_event_cta_clicked",
  "recap_shared_after_event",
  "founder_dashboard_viewed",
  "founder_feedback_inbox_viewed",
  "founder_reported_photo_review_viewed",
  "founder_event_opened_from_dashboard",
  "founder_metrics_exported",
]);
const PHOTO_VISIBILITY_VISIBLE = "VISIBLE";
const PHOTO_VISIBILITY_HIDDEN = "HIDDEN";
const ANONYMOUS_GUEST_DISPLAY_NAME = "Anonymous guest";
const MAX_GUEST_DISPLAY_NAME_LENGTH = 40;
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
  "challengeItemId",
  "categoryId",
  "visibilityStatus",
  "templateSlug",
  "promptPackSlug",
  "method",
  "photoCount",
  "remainingUploads",
  "lifecycleStatus",
  "duplicateSourceEventId",
  "duplicateEventId",
  "repeatIntent",
  "feedbackOutcome",
  "feedbackKind",
  "issueArea",
  "skipped",
  "exportFormat",
]);

function userPayload(user) {
  return {
    id: user.id,
    email: user.email,
    isFounder: Boolean(founderEmails.length && isFounderEmail(user.email, founderEmails)),
  };
}

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
const EVENT_TEMPLATE_SLUGS = new Set([
  "birthday-party",
  "wedding-engagement",
  "greek-life-event",
  "student-org-event",
  "graduation-party",
  "friend-trip",
  "camp-retreat",
  "club-banquet",
  "family-gathering",
  "open-custom-event",
]);
const PROMPT_PACK_SLUGS = new Set([
  "birthday",
  "wedding-engagement",
  "greek-life",
  "student-org",
  "graduation",
  "friend-trip",
  "camp-retreat",
  "club-banquet",
  "custom",
]);

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

function normalizeOptionalSlug(value, allowedSlugs) {
  if (value === null || value === undefined || value === "") return null;
  const slug = String(value).trim();
  return allowedSlugs.has(slug) ? slug : null;
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

function sanitizeGuestDisplayName(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return ANONYMOUS_GUEST_DISPLAY_NAME;
  return normalized.slice(0, MAX_GUEST_DISPLAY_NAME_LENGTH).trim() || ANONYMOUS_GUEST_DISPLAY_NAME;
}

function parseBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    return normalized === "true" ? true : normalized === "false" ? false : null;
  }
  return null;
}

function isAwardVotingEnabled(challenge) {
  if (!challenge || challenge.type !== CHALLENGE_TYPE_EVENT_AWARDS) return false;
  const config = challenge?.config || {};
  if (!config || typeof config !== "object") return true;
  const override = parseBooleanFlag(config.votingEnabled);
  return override === null ? true : override;
}

function buildAwardVotingSummary({ challenge, photos, votes, myVotesByCategory }) {
  const categories = categoriesFromConfig(challenge?.config);
  const votingEnabled = isAwardVotingEnabled(challenge || {});
  if (challenge?.type !== CHALLENGE_TYPE_EVENT_AWARDS) {
    return { votingEnabled: false, categories: [] };
  }

  const votesByCategory = new Map();
  for (const vote of votes || []) {
    if (!vote?.challengeItemId || !vote?.photoId) continue;
    const key = vote.challengeItemId;
    const byPhoto = votesByCategory.get(key) || new Map();
    byPhoto.set(vote.photoId, (byPhoto.get(vote.photoId) || 0) + 1);
    votesByCategory.set(key, byPhoto);
  }

  const photoIdsByCategory = new Map();
  for (const photo of photos || []) {
    if (!photo?.challengeItemId) continue;
    const set = photoIdsByCategory.get(photo.challengeItemId) || new Set();
    set.add(photo.id);
    photoIdsByCategory.set(photo.challengeItemId, set);
  }

  return {
    votingEnabled,
    categories: categories.map((category) => {
      const categoryId = category.id || `award-${category.order}`;
      const categoryPhotoIds = photoIdsByCategory.get(categoryId) || new Set();
      const byPhoto = votesByCategory.get(categoryId) || new Map();
      const entries = Array.from(byPhoto.entries())
        .filter(([photoId]) => categoryPhotoIds.has(photoId))
        .map(([photoId, voteCount]) => ({ photoId, voteCount }))
        .sort((a, b) => b.voteCount - a.voteCount || a.photoId.localeCompare(b.photoId));
      const totalVotes = entries.reduce((total, item) => total + item.voteCount, 0);
      const topVoteCount = entries[0]?.voteCount || 0;
      const leaderPhotoIds = entries.filter((item) => item.voteCount === topVoteCount && topVoteCount > 0).map((item) => item.photoId);
      return {
        categoryId,
        categoryLabel: category.label,
        submissionCount: categoryPhotoIds.size,
        totalVotes,
        voteTotals: entries,
        leaderPhotoIds,
        isTie: leaderPhotoIds.length > 1,
        noSubmissions: categoryPhotoIds.size === 0,
        noVotes: entries.length === 0,
        myVotePhotoId: myVotesByCategory?.[categoryId],
      };
    }),
  };
}

async function loadAwardVotingSummary(event, { clientId = "" } = {}) {
  const challenge = event?.challenges?.[0] || null;
  if (challenge?.type !== CHALLENGE_TYPE_EVENT_AWARDS) return undefined;

  const visiblePhotos = Array.isArray(event.photos) ? event.photos : [];
  const visiblePhotoIds = visiblePhotos.map((photo) => photo.id);
  const votes = visiblePhotoIds.length
    ? await prisma.photoVote.findMany({
        where: {
          eventId: event.id,
          photoId: { in: visiblePhotoIds },
        },
        select: { photoId: true, challengeItemId: true, guestClientId: true },
      })
    : [];

  const myVotesByCategory = {};
  if (clientId) {
    for (const vote of votes) {
      if (vote.guestClientId === clientId) myVotesByCategory[vote.challengeItemId] = vote.photoId;
    }
  }

  return buildAwardVotingSummary({ challenge, photos: visiblePhotos, votes, myVotesByCategory });
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
    const baseConfig = input.config && typeof input.config === "object" ? input.config : {};
    const votingEnabled = parseBooleanFlag(baseConfig.votingEnabled);
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
      config: { ...baseConfig, categories, ...(votingEnabled === null ? {} : { votingEnabled }) },
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

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function duplicateEventDefaults(event, overrides = {}) {
  const isMemoryCapsule = event.challenges?.[0]?.type === CHALLENGE_TYPE_MEMORY_CAPSULE;
  const defaultCapsuleReveal = addDays(new Date(), 1);
  const eventDate = overrides.eventDate ? new Date(overrides.eventDate) : undefined;
  const revealAt = overrides.revealAt ? new Date(overrides.revealAt) : isMemoryCapsule ? defaultCapsuleReveal : undefined;
  return {
    name: String(overrides.name || `${event.name} (Copy)`).trim(),
    description: typeof overrides.description === "string" ? overrides.description.trim() || null : event.description,
    ...(eventDate ? { eventDate } : {}),
    ...(revealAt ? { revealAt } : {}),
    photoLimitPerGuest: Number.isInteger(Number(overrides.photoLimitPerGuest)) ? Number(overrides.photoLimitPerGuest) : event.photoLimitPerGuest,
  };
}

function eventUsesMemoryCapsule(event) {
  return event.challenges?.[0]?.type === CHALLENGE_TYPE_MEMORY_CAPSULE;
}

function publicAlbumIsLocked(event, now = new Date()) {
  return eventUsesMemoryCapsule(event) && event.revealAt > now;
}

function publicEventIsRevealed(event, now = new Date()) {
  return !publicAlbumIsLocked(event, now);
}

function settingsWithInternalTiming(settings, { isMemoryCapsule, now = new Date() }) {
  const eventDate = settings.eventDate ? new Date(settings.eventDate) : now;
  const revealAt = isMemoryCapsule
    ? settings.revealAt
      ? new Date(settings.revealAt)
      : addHours(eventDate, 4)
    : now;
  return { ...settings, eventDate, revealAt };
}

function cleanFeedbackText(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength).trim() : null;
}

function validateHostFeedback(input = {}) {
  const kind = input.kind === "beta_issue" ? "beta_issue" : "post_event";
  const issueArea = ["guest_upload", "live_wall", "recap", "qr_poster", "moderation", "analytics", "other"].includes(input.issueArea) ? input.issueArea : null;
  if (input.skipped) {
    return { skipped: true, kind, issueArea: null, outcome: null, repeatIntent: null, guestConfusion: null, featureRequest: null, note: null };
  }
  if (kind === "beta_issue") {
    const note = cleanFeedbackText(input.note, 1000);
    if (!issueArea) throw new Error("Choose what the issue is about.");
    if (!note) throw new Error("Add a short note so the support team knows what happened.");
    return { skipped: false, kind, issueArea, outcome: null, repeatIntent: null, guestConfusion: null, featureRequest: null, note };
  }
  const outcome = ["great", "okay", "rough"].includes(input.outcome) ? input.outcome : null;
  const repeatIntent = ["yes", "maybe", "no"].includes(input.repeatIntent) ? input.repeatIntent : null;
  if (!outcome) throw new Error("Choose how the event went.");
  if (!repeatIntent) throw new Error("Choose whether you would use EventFilm again.");
  return {
    skipped: false,
    kind,
    issueArea: null,
    outcome,
    repeatIntent,
    guestConfusion: cleanFeedbackText(input.guestConfusion, 500),
    featureRequest: cleanFeedbackText(input.featureRequest, 500),
    note: cleanFeedbackText(input.note, 1000),
  };
}

function hostFeedbackPayload(feedback) {
  if (!feedback) return null;
  return {
    id: feedback.id,
    kind: feedback.kind,
    issueArea: feedback.issueArea,
    outcome: feedback.outcome,
    repeatIntent: feedback.repeatIntent,
    guestConfusion: feedback.guestConfusion,
    featureRequest: feedback.featureRequest,
    note: feedback.note,
    skippedAt: feedback.skippedAt,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
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

function hostEventDetailInclude() {
  return {
    photos: {
      where: activePhotoWhere(),
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      include: { guest: true, challengeParticipant: true, reports: { orderBy: { createdAt: "desc" } }, _count: { select: { reports: true } } },
    },
    challenges: activeChallengeInclude(),
    _count: { select: { photos: { where: visiblePhotoWhere() } } },
  };
}

async function hostEventDetailResponse(event) {
  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  return {
    ...eventPayload(event, { includePhotos: true, includeModeration: true }),
    qrCodeDataUrl,
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
    eventTemplateSlug: event.eventTemplateSlug,
    promptPackSlug: event.promptPackSlug,
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

function databaseTargetLabel() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return "missing";

  try {
    const hostname = new URL(databaseUrl).hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return "local";
    return "deployed";
  } catch {
    return "configured";
  }
}

function logDevAuth(event, details = {}) {
  if (isProduction) return;
  console.info("[auth:dev]", JSON.stringify({ event, databaseTarget: databaseTargetLabel(), ...details }));
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    environment: {
      nodeEnv: process.env.NODE_ENV || "development",
      databaseTarget: databaseTargetLabel(),
    },
  });
});

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
    include: {
      photos: {
        where: visiblePhotoWhere(),
        select: { id: true, challengeItemId: true },
      },
      challenges: activeChallengeInclude(),
    },
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
    latestFeedback,
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
    prisma.hostEventFeedback.findFirst({
      where: { eventId: event.id, hostId: req.user.userId, kind: "post_event" },
      orderBy: { createdAt: "desc" },
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
      eventAwardsVoting: await loadAwardVotingSummary(event),
      hostFeedback: hostFeedbackPayload(latestFeedback),
    },
  });
});

app.get("/api/founder/overview", requireFounderAuth, async (req, res) => {
  try {
    const overview = await buildFounderOverview({
      prisma,
      requesterUserId: req.user.userId,
      clientUrl,
      serverUrl,
      getPhotoPreviewUrl,
    });
    res.json({ overview });
  } catch (error) {
    console.warn(`Founder overview failed: ${error.message}`);
    res.status(500).json({ error: "Could not load founder overview" });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    logDevAuth("signup_validation_failed", { email: String(email || "").toLowerCase().trim() || null });
    return res.status(400).json({ error: "Email and password of at least 8 characters are required" });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
    });
    logDevAuth("signup_success", { email: normalizedEmail });
    res.status(201).json({ token: signToken(user), user: userPayload(user) });
  } catch (error) {
    if (error.code === "P2002") {
      logDevAuth("signup_duplicate", { email: String(email || "").toLowerCase().trim() });
      return res.status(409).json({ error: "Email already registered" });
    }
    logDevAuth("signup_error", { email: String(email || "").toLowerCase().trim(), message: error.message });
    res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) {
    logDevAuth("login_failed", { email: normalizedEmail, reason: user ? "password_mismatch" : "user_missing" });
    return res.status(401).json({ error: "Invalid email or password" });
  }
  logDevAuth("login_success", { email: normalizedEmail });
  res.json({ token: signToken(user), user: userPayload(user) });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: userPayload(user) });
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
  let challengeSetup;
  try {
    challengeSetup = normalizeChallengeSetup(req.body.challenge);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const isMemoryCapsule = challengeSetup?.type === CHALLENGE_TYPE_MEMORY_CAPSULE;
  const validation = validateEventSettingsInput(req.body, { requireRevealAt: isMemoryCapsule });
  if (!validation.ok) return res.status(400).json({ error: validation.error, fieldErrors: validation.fieldErrors });

  const slug = crypto.randomBytes(12).toString("base64url");
  const settings = settingsWithInternalTiming(validation.value, { isMemoryCapsule });
  const event = await prisma.event.create({
    data: {
      hostId: req.user.userId,
      name: settings.name,
      description: settings.description,
      slug,
      eventDate: settings.eventDate,
      revealAt: settings.revealAt,
      photoLimitPerGuest: settings.photoLimitPerGuest,
      eventTemplateSlug: normalizeOptionalSlug(req.body.eventTemplateSlug, EVENT_TEMPLATE_SLUGS),
      promptPackSlug: normalizeOptionalSlug(req.body.promptPackSlug, PROMPT_PACK_SLUGS),
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
    include: hostEventDetailInclude(),
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  res.json({
    event: await hostEventDetailResponse(event),
  });
});

app.patch("/api/host/events/:eventId", requireAuth, async (req, res) => {
  try {
    const event = await updateHostEventSettings(prisma, {
      eventId: req.params.eventId,
      userId: req.user.userId,
      input: req.body || {},
      include: hostEventDetailInclude(),
    });
    res.json({ event: await hostEventDetailResponse(event) });
  } catch (error) {
    if (error instanceof EventSettingsError) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      });
    }
    throw error;
  }
});

app.post("/api/host/events/:eventId/duplicate", requireAuth, async (req, res) => {
  const source = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    include: { challenges: activeChallengeInclude() },
  });
  if (!source) return res.status(404).json({ error: "Event not found" });

  const defaults = duplicateEventDefaults(source, req.body || {});
  const sourceChallenge = source.challenges?.[0] || null;
  const isMemoryCapsule = sourceChallenge?.type === CHALLENGE_TYPE_MEMORY_CAPSULE;
  const validation = validateEventSettingsInput(defaults, { requireRevealAt: isMemoryCapsule });
  if (!validation.ok) return res.status(400).json({ error: validation.error, fieldErrors: validation.fieldErrors });
  const settings = settingsWithInternalTiming(validation.value, { isMemoryCapsule });

  let challengeSetup = null;
  if (sourceChallenge) {
    try {
      challengeSetup = normalizeChallengeSetup(challengePayload(sourceChallenge));
    } catch (error) {
      return res.status(400).json({ error: `Could not copy event mode: ${error.message}` });
    }
  }

  const slug = crypto.randomBytes(12).toString("base64url");
  const event = await prisma.event.create({
    data: {
      hostId: req.user.userId,
      name: settings.name,
      description: settings.description,
      slug,
      eventDate: settings.eventDate,
      revealAt: settings.revealAt,
      photoLimitPerGuest: settings.photoLimitPerGuest,
      eventTemplateSlug: source.eventTemplateSlug,
      promptPackSlug: source.promptPackSlug,
      ...(challengeSetup
        ? {
            challenges: {
              create: challengeCreateData(undefined, challengeSetup),
            },
          }
        : {}),
    },
    include: { challenges: activeChallengeInclude(), _count: { select: { photos: { where: visiblePhotoWhere() } } } },
  });

  trackApiAnalytics("duplicate_event_created", {
    userId: req.user.userId,
    eventId: event.id,
    eventSlug: event.slug,
    metadata: { duplicateSourceEventId: source.id, duplicateEventId: event.id },
  });

  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 320 });
  res.status(201).json({ event: { ...eventPayload(event), qrCodeDataUrl } });
});

app.post("/api/host/events/:eventId/feedback", requireAuth, async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, hostId: req.user.userId },
    select: { id: true, slug: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  let feedbackInput;
  try {
    feedbackInput = validateHostFeedback(req.body || {});
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const feedback = await prisma.hostEventFeedback.create({
    data: {
      eventId: event.id,
      hostId: req.user.userId,
      kind: feedbackInput.kind,
      issueArea: feedbackInput.issueArea,
      outcome: feedbackInput.outcome,
      repeatIntent: feedbackInput.repeatIntent,
      guestConfusion: feedbackInput.guestConfusion,
      featureRequest: feedbackInput.featureRequest,
      note: feedbackInput.note,
      skippedAt: feedbackInput.skipped ? new Date() : null,
    },
  });

  trackApiAnalytics(feedbackInput.kind === "beta_issue" ? "beta_issue_submitted" : feedbackInput.skipped ? "host_feedback_skipped" : "host_feedback_submitted", {
    userId: req.user.userId,
    eventId: event.id,
    eventSlug: event.slug,
    metadata: {
      skipped: feedbackInput.skipped,
      feedbackKind: feedbackInput.kind,
      issueArea: feedbackInput.issueArea,
      feedbackOutcome: feedbackInput.outcome,
      repeatIntent: feedbackInput.repeatIntent,
    },
  });

  res.status(201).json({ feedback: hostFeedbackPayload(feedback) });
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

  const isRevealed = publicEventIsRevealed(event);
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

  const isLocked = publicAlbumIsLocked(event);
  const isRevealed = !isLocked;
  const eventLink = publicEventUrl(event.slug);
  const qrCodeDataUrl = await QRCode.toDataURL(eventLink, { margin: 1, width: 360 });
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId.trim() : "";
  const awardVoting = await loadAwardVotingSummary(event, { clientId });

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
    ...(awardVoting ? { awardVoting } : {}),
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

  const isLocked = publicAlbumIsLocked(event);
  const isRevealed = !isLocked;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId.trim() : "";
  const awardVoting = !isLocked ? await loadAwardVotingSummary(event, { clientId }) : undefined;

  if (event.challenges?.[0]?.type === CHALLENGE_TYPE_EVENT_AWARDS) {
    trackApiAnalytics("award_votes_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap" } });
  }
  if (event.challenges?.[0]?.type === CHALLENGE_TYPE_EVENT_AWARDS) {
    trackApiAnalytics("award_winner_section_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap" } });
  }

  res.json({
    event: {
      ...publicEventBasePayload(event, isRevealed),
      photoCount: isLocked ? null : event._count.photos,
    },
    eventLink: publicEventUrl(event.slug),
    liveWallLink: liveWallUrl(event.slug),
    recapLink: recapUrl(event.slug),
    isLocked,
    photos: isLocked ? [] : event.photos.map(photoPayload),
    ...(awardVoting ? { awardVoting } : {}),
  });
});

app.post("/api/events/:slug/votes", async (req, res) => {
  const photoId = String(req.body?.photoId || "").trim();
  const clientId = String(req.body?.clientId || "").trim();
  const requestedChallengeItemId = String(req.body?.challengeItemId || "").trim();
  if (!photoId || !clientId) return res.status(400).json({ error: "photoId and clientId are required" });

  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { challenges: activeChallengeInclude() },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const challenge = event.challenges?.[0] || null;
  if (challenge?.type !== CHALLENGE_TYPE_EVENT_AWARDS) {
    return res.status(400).json({ error: "Voting is only available for Event Awards events" });
  }
  if (!isAwardVotingEnabled(challenge)) {
    return res.status(403).json({ error: "Voting is not enabled for this event" });
  }

  const photo = await prisma.photo.findFirst({
    where: visiblePhotoWhere({ id: photoId, eventId: event.id }),
    select: { id: true, eventId: true, challengeItemId: true, challengeItemKind: true },
  });
  if (!photo) return res.status(404).json({ error: "Photo is not available for voting" });

  const challengeItemId = requestedChallengeItemId || photo.challengeItemId;
  const category = categoriesFromConfig(challenge.config).find((item) => item.id === challengeItemId);
  if (!category || photo.challengeItemId !== category.id || photo.challengeItemKind !== "award") {
    return res.status(400).json({ error: "Photo is not in that award category" });
  }

  try {
    await prisma.photoVote.create({
      data: {
        eventId: event.id,
        photoId: photo.id,
        challengeItemId: category.id,
        guestClientId: clientId.slice(0, 160),
      },
    });

    trackApiAnalytics("award_vote_cast", {
      eventId: event.id,
      eventSlug: event.slug,
      anonymousId: clientId,
      metadata: { photoId: photo.id, challengeItemId: category.id, categoryId: category.id },
    });

    return res.status(201).json({ ok: true, photoId: photo.id, challengeItemId: category.id, selected: true, duplicate: false });
  } catch (error) {
    if (error.code === "P2002") {
      const existingVote = await prisma.photoVote.findUnique({
        where: {
          eventId_challengeItemId_guestClientId: {
            eventId: event.id,
            challengeItemId: category.id,
            guestClientId: clientId.slice(0, 160),
          },
        },
        select: { photoId: true },
      });
      trackApiAnalytics("award_vote_duplicate_blocked", {
        eventId: event.id,
        eventSlug: event.slug,
        anonymousId: clientId,
        metadata: { photoId: existingVote?.photoId || photo.id, challengeItemId: category.id, categoryId: category.id },
      });
      return res.json({ ok: true, photoId: existingVote?.photoId || photo.id, challengeItemId: category.id, selected: true, duplicate: true });
    }
    return res.status(400).json({ error: error.message || "Could not record vote" });
  }
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

app.get("/api/events/:slug/my-uploads", async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) return res.status(400).json({ error: "clientId is required" });

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const guest = await prisma.guest.findUnique({
    where: { eventId_clientId: { eventId: event.id, clientId: String(clientId) } },
    include: {
      _count: { select: { photos: { where: activePhotoWhere() } } },
      photos: {
        where: visiblePhotoWhere(),
        orderBy: { createdAt: "desc" },
        include: { guest: true, challengeParticipant: true },
      },
    },
  });
  const used = guest?._count.photos || 0;
  res.json({
    uploadedCount: used,
    remainingUploads: Math.max(event.photoLimitPerGuest - used, 0),
    photos: (guest?.photos || []).map(photoPayload),
  });
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
      if (!challengePromptId) {
        return res.status(400).json({ error: "Choose a Photo Scavenger Hunt prompt before uploading" });
      }
      selectedPrompt = promptsFromConfig(activeChallenge.config).find((prompt) => prompt.id === challengePromptId);
      if (!selectedPrompt) {
        return res.status(400).json({ error: "Selected Photo Scavenger Hunt prompt is not valid for this event" });
      }
    } else if (activeChallenge?.type === CHALLENGE_TYPE_EVENT_AWARDS) {
      if (!challengeItemId) {
        return res.status(400).json({ error: "Choose an Event Awards category before uploading" });
      }
      selectedAwardCategory = categoriesFromConfig(activeChallenge.config).find((category) => category.id === challengeItemId);
      if (!selectedAwardCategory) {
        return res.status(400).json({ error: "Selected Event Awards category is not valid for this event" });
      }
    }

    const uploadNickname = selectedParticipant ? selectedParticipant.displayName : sanitizeGuestDisplayName(nickname);

    const guest = await prisma.guest.upsert({
      where: { eventId_clientId: { eventId: event.id, clientId: String(clientId) } },
      update: { nickname: uploadNickname },
      create: { eventId: event.id, clientId: String(clientId), nickname: uploadNickname },
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
    include: {
      photos: { where: visiblePhotoWhere(), orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }], include: { guest: true, challengeParticipant: true } },
      challenges: activeChallengeInclude(),
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  if (publicAlbumIsLocked(event)) {
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
