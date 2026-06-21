import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_PACKS,
  CHALLENGE_TYPES,
  ANALYTICS_EVENT_NAMES,
  buildHostLaunchKit,
  buildChallengeProgressSummary,
  buildChallengePayload,
  buildEventRecapMetadata,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createStarterPrompts,
  getChallengePack,
  normalizeReportReason,
  validateUploadFile,
  visiblePhotos,
  validateChallengeDraft,
} from "./index.ts";
import type { EventChallenge, EventSummary, Photo } from "./index.ts";

test("registry exposes every supported mode with unique slugs", () => {
  assert.deepEqual(
    CHALLENGE_PACKS.map((pack) => pack.mode),
    ["NONE", CHALLENGE_TYPES.COLOR_HUNT, CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT, CHALLENGE_TYPES.EVENT_AWARDS, CHALLENGE_TYPES.MEMORY_CAPSULE],
  );
  assert.equal(new Set(CHALLENGE_PACKS.map((pack) => pack.slug)).size, CHALLENGE_PACKS.length);
});

test("default prompts and award categories normalize in stable order", () => {
  assert.deepEqual(createStarterPrompts().map((prompt) => prompt.text), [
    "Best group selfie",
    "Someone on the dance floor",
    "A funny candid moment",
    "Favorite decoration",
    "The host having fun",
  ]);
  assert.deepEqual(createDefaultAwardCategories().map((category) => category.label), [
    "Funniest Photo",
    "Best Group Shot",
    "Best Candid",
    "Best Outfit",
    "Most Wholesome",
    "Main Character Moment",
  ]);
});

test("no challenge builds a null payload", () => {
  assert.equal(buildChallengePayload(createEmptyChallengeDraft()), null);
});

test("duplicate and empty prompt/category validation fails", () => {
  const promptDraft = { ...createEmptyChallengeDraft(), type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT };
  promptDraft.prompts = [
    { id: "one", text: "Same", order: 0 },
    { id: "two", text: "Same", order: 1 },
    { id: "three", text: "", order: 2 },
  ];
  assert.equal(validateChallengeDraft(promptDraft), "Prompts cannot be empty.");

  const categoryDraft = { ...createEmptyChallengeDraft(), type: CHALLENGE_TYPES.EVENT_AWARDS };
  categoryDraft.categories = [
    { id: "one", label: "Funniest Photo", order: 0 },
    { id: "two", label: "Funniest Photo", order: 1 },
  ];
  assert.equal(validateChallengeDraft(categoryDraft), "Remove duplicate award categories before saving.");
});

test("upload metadata requirements are registry-driven", () => {
  assert.equal(getChallengePack("NONE").uploadRequirement, "none");
  assert.equal(getChallengePack(CHALLENGE_TYPES.COLOR_HUNT).uploadRequirement, "participant");
  assert.equal(getChallengePack(CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT).uploadRequirement, "prompt");
  assert.equal(getChallengePack(CHALLENGE_TYPES.EVENT_AWARDS).uploadRequirement, "award");
  assert.equal(getChallengePack(CHALLENGE_TYPES.MEMORY_CAPSULE).uploadRequirement, "none");
});

test("analytics event registry is stable and unique", () => {
  assert.equal(ANALYTICS_EVENT_NAMES.includes("landing_page_viewed"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("host_launch_kit_opened"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("photo_reported"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("album_downloaded"), true);
  assert.equal(new Set(ANALYTICS_EVENT_NAMES).size, ANALYTICS_EVENT_NAMES.length);
});

test("report reasons and upload validation stay beta-safe", () => {
  assert.equal(normalizeReportReason("privacy"), "privacy");
  assert.equal(normalizeReportReason("bad"), null);
  assert.deepEqual(validateUploadFile({ type: "image/jpeg", size: 500 }), { ok: true });
  assert.equal(validateUploadFile(null).reason, "missing");
  assert.equal(validateUploadFile({ type: "application/pdf", size: 500 }).reason, "unsupported_type");
  assert.equal(validateUploadFile({ type: "image/png", size: 11 * 1024 * 1024 }).reason, "too_large");
});

function photo(input: Partial<Photo>): Photo {
  return {
    id: input.id || "photo",
    url: input.url || "https://example.com/photo.jpg",
    originalFilename: input.originalFilename || "photo.jpg",
    mimeType: input.mimeType || "image/jpeg",
    sizeBytes: input.sizeBytes || 100,
    createdAt: input.createdAt || "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

test("challenge progress summary counts color team uploads", () => {
  const challenge: EventChallenge = {
    id: "challenge",
    type: CHALLENGE_TYPES.COLOR_HUNT,
    title: "Color Hunt",
    instructions: "Find your color.",
    participants: [
      { id: "red-team", displayName: "Red Team", colorName: "Red", colorHex: "#dc2626", colorSlug: "red" },
      { id: "blue-team", displayName: "Blue Team", colorName: "Blue", colorHex: "#2563eb", colorSlug: "blue" },
    ],
  };
  const summary = buildChallengeProgressSummary(challenge, [
    photo({ id: "one", challengeParticipantId: "red-team", challengeColorSlug: "red" }),
    photo({ id: "two", challengeColorSlug: "red" }),
  ]);

  assert.equal(summary.modeLabel, "Color Hunt");
  assert.deepEqual(summary.rows.map((row) => [row.label, row.count, row.complete]), [
    ["Red Team", 2, true],
    ["Blue Team", 0, false],
  ]);
});

test("challenge progress summary counts prompts and award categories", () => {
  const promptSummary = buildChallengeProgressSummary(
    {
      id: "challenge",
      type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
      title: "Photo Scavenger Hunt",
      instructions: "Complete prompts.",
      participants: [],
      prompts: [
        { id: "prompt-one", text: "Dance floor", order: 0 },
        { id: "prompt-two", text: "Group selfie", order: 1 },
      ],
    },
    [photo({ challengePromptId: "prompt-one" })],
  );
  assert.deepEqual(promptSummary.rows.map((row) => [row.label, row.count, row.complete]), [
    ["Dance floor", 1, true],
    ["Group selfie", 0, false],
  ]);

  const awardSummary = buildChallengeProgressSummary(
    {
      id: "challenge",
      type: CHALLENGE_TYPES.EVENT_AWARDS,
      title: "Event Awards",
      instructions: "Submit awards.",
      participants: [],
      categories: [
        { id: "award-one", label: "Funniest Photo", order: 0 },
        { id: "award-two", label: "Best Outfit", order: 1 },
      ],
    },
    [photo({ challengeItemId: "award-two" }), photo({ challengeItemId: "award-two" })],
  );
  assert.deepEqual(awardSummary.rows.map((row) => [row.label, row.count, row.complete]), [
    ["Funniest Photo", 0, false],
    ["Best Outfit", 2, true],
  ]);
});

test("challenge progress summary tolerates no challenge and memory capsule", () => {
  assert.deepEqual(buildChallengeProgressSummary(null, [photo({})]).rows, []);
  assert.deepEqual(
    buildChallengeProgressSummary(
      {
        id: "capsule",
        type: CHALLENGE_TYPES.MEMORY_CAPSULE,
        title: "Memory Capsule",
        instructions: "Unlock later.",
        participants: [],
      },
      [photo({})],
    ).rows,
    [],
  );
});

test("recap metadata counts contributors and highlights recent photos", () => {
  const event = {
    id: "event",
    name: "Spring Formal",
    slug: "spring-formal",
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 5,
    eventLink: "https://example.com/e/spring-formal",
    photoCount: 3,
    challenge: null,
  } satisfies EventSummary;
  const metadata = buildEventRecapMetadata(event, [
    photo({ id: "old", guestNickname: "Mia", createdAt: "2026-01-01T00:00:00.000Z" }),
    photo({ id: "new", guestNickname: "Alex", createdAt: "2026-01-01T01:00:00.000Z" }),
    photo({ id: "same", guestNickname: "mia", createdAt: "2026-01-01T00:30:00.000Z" }),
  ]);

  assert.equal(metadata.modeLabel, "No Challenge");
  assert.equal(metadata.totalPhotos, 3);
  assert.equal(metadata.contributorCount, 2);
  assert.deepEqual(metadata.highlightPhotos.map((item) => item.id), ["new", "same", "old"]);
});

test("recap metadata excludes hidden photos and leads with featured photos", () => {
  const event = {
    id: "event",
    name: "Spring Formal",
    slug: "spring-formal",
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 5,
    eventLink: "https://example.com/e/spring-formal",
    photoCount: 3,
    challenge: null,
  } satisfies EventSummary;
  const hidden = photo({ id: "hidden", visibilityStatus: "HIDDEN", guestNickname: "Mia", createdAt: "2026-01-01T03:00:00.000Z" });
  const featured = photo({ id: "featured", isFeatured: true, guestNickname: "Alex", createdAt: "2026-01-01T01:00:00.000Z" });
  const recent = photo({ id: "recent", guestNickname: "Sam", createdAt: "2026-01-01T02:00:00.000Z" });
  const metadata = buildEventRecapMetadata(event, [hidden, featured, recent]);

  assert.deepEqual(visiblePhotos([hidden, featured, recent]).map((item) => item.id), ["featured", "recent"]);
  assert.equal(metadata.totalPhotos, 2);
  assert.deepEqual(metadata.highlightPhotos.map((item) => item.id), ["featured", "recent"]);
});

test("host launch kit separates guest, live wall, and recap jobs", () => {
  const kit = buildHostLaunchKit({
    id: "event",
    name: "Spring Formal",
    slug: "spring-formal",
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 5,
    eventLink: "https://example.com/e/spring-formal",
    liveWallLink: "https://example.com/wall/spring-formal",
    recapLink: "https://example.com/recap/spring-formal",
    photoCount: 0,
    challenge: null,
  });

  assert.deepEqual(kit.links.map((link) => link.key), ["guest", "live-wall", "recap"]);
  assert.match(kit.inviteText, /No app download needed/);
  assert.match(kit.links[1].instruction, /laptop, TV, projector, or iPad/);
  assert.equal(kit.checklist.length, 5);
});
