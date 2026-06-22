import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_PACKS,
  CHALLENGE_TYPES,
  ANALYTICS_EVENT_NAMES,
  EVENT_TEMPLATES,
  PROMPT_PACKS,
  applyEventTemplateToDraft,
  buildContributorSummary,
  buildGuestChallengeProgress,
  buildGuestUploadSuccessSummary,
  buildHostLaunchKit,
  buildHostShareAssets,
  buildChallengeProgressSummary,
  buildAwardVotingSummary,
  isAwardVotingEnabled,
  buildChallengePayload,
  buildEventRecapMetadata,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createStarterPrompts,
  getChallengePack,
  getEventTemplate,
  getPromptPack,
  isAnonymousGuestDisplayName,
  normalizeReportReason,
  sanitizeGuestDisplayName,
  validateUploadFile,
  visiblePhotos,
  validateChallengeDraft,
} from "./index.ts";
import type { EventChallenge, EventSummary, GuestUploadLocalMetadata, Photo, PublicEvent } from "./index.ts";

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
  assert.equal(ANALYTICS_EVENT_NAMES.includes("event_template_viewed"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("event_template_selected"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("prompt_pack_selected"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("prompts_customized"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("event_created_from_template"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("template_skipped"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("invite_poster_viewed"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("invite_poster_printed"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_link_shared"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("live_wall_link_copied"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("live_wall_link_shared"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("recap_link_copied"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("recap_link_shared"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("recap_share_clicked"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("native_share_opened"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_name_entered"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_continued_anonymous"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("upload_success_action_clicked"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_my_uploads_viewed"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_album_opened"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_recap_opened"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("challenge_progress_viewed"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_share_clicked"), true);
  assert.equal(ANALYTICS_EVENT_NAMES.includes("guest_returned_to_event"), true);
  assert.equal(new Set(ANALYTICS_EVENT_NAMES).size, ANALYTICS_EVENT_NAMES.length);
});

test("template and prompt pack registries expose requested presets", () => {
  assert.equal(EVENT_TEMPLATES.length, 10);
  assert.equal(PROMPT_PACKS.length, 9);
  assert.equal(new Set(EVENT_TEMPLATES.map((template) => template.slug)).size, EVENT_TEMPLATES.length);
  assert.equal(new Set(PROMPT_PACKS.map((pack) => pack.slug)).size, PROMPT_PACKS.length);
  assert.equal(getEventTemplate("birthday-party")?.name, "Birthday Party");
  assert.deepEqual(getPromptPack("birthday").items.slice(0, 3), ["Best group selfie", "Funniest moment", "Best outfit"]);
  assert.deepEqual(
    EVENT_TEMPLATES.map((template) => template.name),
    [
      "Birthday Party",
      "Wedding / Engagement",
      "Greek Life Event",
      "Student Org Event",
      "Graduation Party",
      "Friend Trip",
      "Camp / Retreat",
      "Club Banquet",
      "Family Gathering",
      "Open Custom Event",
    ],
  );
  assert.deepEqual(
    PROMPT_PACKS.map((pack) => pack.slug),
    ["birthday", "wedding-engagement", "greek-life", "student-org", "graduation", "friend-trip", "camp-retreat", "club-banquet", "custom"],
  );
});

test("prompt packs contain the requested default items", () => {
  const expectedPacks: Record<string, string[]> = {
    birthday: ["Best group selfie", "Funniest moment", "Best outfit", "Photo with the birthday person", "Most chaotic photo", "Best candid", "Main character moment", "Final group photo"],
    "wedding-engagement": ["Best candid", "Best couple photo", "Best dance floor moment", "Funniest guest photo", "Most wholesome moment", "Best family photo", "Best detail shot", "Final celebration photo"],
    "greek-life": ["Best group photo", "Best fit", "Funniest candid", "Big/little moment", "Best chant or dance moment", "Most school spirit", "Best table photo", "Main character moment"],
    "student-org": ["Best team photo", "Best speaker moment", "Funniest candid", "Best behind-the-scenes photo", "Most wholesome moment", "Best group activity", "Best food photo", "Final group photo"],
    graduation: ["Best cap and gown photo", "Family photo", "Friend group photo", "Best candid", "Most emotional moment", "Best campus photo", "Funniest photo", "Final group photo"],
    "friend-trip": ["Best view", "Best food photo", "Funniest moment", "Best candid", "Best group selfie", "Most chaotic photo", "Main character moment", "Photo that sums up the trip"],
    "camp-retreat": ["Best team photo", "Best activity photo", "Funniest moment", "Best nature photo", "Most wholesome moment", "Best cabin/group photo", "Best challenge photo", "Final group photo"],
    "club-banquet": ["Best table photo", "Best outfit", "Best award moment", "Funniest candid", "Best speaker photo", "Most wholesome moment", "Best group photo", "Final celebration photo"],
  };

  for (const [slug, items] of Object.entries(expectedPacks)) {
    assert.deepEqual(getPromptPack(slug).items, items);
  }
});

test("event templates apply mode and prompt pack defaults", () => {
  const birthdayDraft = applyEventTemplateToDraft("birthday-party");
  assert.equal(birthdayDraft.type, CHALLENGE_TYPES.EVENT_AWARDS);
  assert.equal(birthdayDraft.eventTemplateSlug, "birthday-party");
  assert.equal(birthdayDraft.promptPackSlug, "birthday");
  assert.deepEqual(birthdayDraft.categories.map((category) => category.label), getPromptPack("birthday").items);

  const weddingDraft = applyEventTemplateToDraft("wedding-engagement");
  assert.equal(weddingDraft.type, CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT);
  assert.deepEqual(weddingDraft.prompts.map((prompt) => prompt.text), getPromptPack("wedding-engagement").items);
});

test("every event template resolves to a valid prompt pack and editable copy", () => {
  for (const template of EVENT_TEMPLATES) {
    assert.equal(getPromptPack(template.promptPackSlug).slug, template.promptPackSlug);
    assert.ok(template.shortDescription);
    assert.ok(template.bestFor);
    assert.ok(template.revealTiming);
    assert.ok(template.inviteCopy);
    assert.ok(template.liveWallCopy);
    assert.ok(template.recapFraming);
    assert.ok(template.icon);
    assert.ok(template.badge);
  }
});

test("unknown templates and old events use safe fallbacks", () => {
  const unknownTemplateDraft = applyEventTemplateToDraft("missing-template");
  assert.equal(unknownTemplateDraft.eventTemplateSlug, null);
  assert.equal(unknownTemplateDraft.promptPackSlug, null);
  assert.equal(getPromptPack("missing-pack").slug, "custom");

  const metadata = buildEventRecapMetadata(
    {
      id: "event",
      name: "Old Event",
      slug: "old-event",
      eventDate: "2026-01-01T00:00:00.000Z",
      revealAt: "2026-01-02T00:00:00.000Z",
      photoLimitPerGuest: 5,
      eventLink: "https://example.com/e/old-event",
      photoCount: 0,
      eventTemplateSlug: null,
      promptPackSlug: null,
      challenge: null,
    },
    [],
  );
  assert.equal(metadata.templateName, undefined);
  assert.equal(metadata.recapTitle, "Event recap");
  assert.equal(metadata.recapSubtitle, "A shared album from the people who were there.");
});

test("report reasons and upload validation stay beta-safe", () => {
  assert.equal(normalizeReportReason("privacy"), "privacy");
  assert.equal(normalizeReportReason("bad"), null);
  assert.deepEqual(validateUploadFile({ type: "image/jpeg", size: 500 }), { ok: true });
  assert.equal(validateUploadFile(null).reason, "missing");
  assert.equal(validateUploadFile({ type: "application/pdf", size: 500 }).reason, "unsupported_type");
  assert.equal(validateUploadFile({ type: "image/png", size: 11 * 1024 * 1024 }).reason, "too_large");
});

test("guest display names are optional, sanitized, and length limited", () => {
  assert.equal(sanitizeGuestDisplayName("  Mia   Chen  "), "Mia Chen");
  assert.equal(sanitizeGuestDisplayName(""), "Anonymous guest");
  assert.equal(sanitizeGuestDisplayName(null), "Anonymous guest");
  assert.equal(sanitizeGuestDisplayName("a".repeat(80)), "a".repeat(40));
  assert.equal(isAnonymousGuestDisplayName("anonymous guest"), true);
  assert.equal(isAnonymousGuestDisplayName("Mia"), false);
});

test("guest upload success summary describes identity and challenge context", () => {
  const event = {
    id: "event",
    name: "Spring Formal",
    slug: "spring-formal",
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 5,
    isRevealed: false,
    photoCount: null,
    eventTemplateSlug: null,
    promptPackSlug: null,
    challenge: { id: "challenge", type: CHALLENGE_TYPES.MEMORY_CAPSULE, title: "Capsule", instructions: "Upload now.", participants: [], config: { revealNote: "Come back after reveal.", revealTitle: "Unlock soon" } },
  } satisfies PublicEvent;
  const summary = buildGuestUploadSuccessSummary({
    event,
    photo: photo({ guestNickname: "", challengeItemLabel: "Best candid" }),
    remainingUploads: 2,
  });

  assert.equal(summary.title, "Upload succeeded");
  assert.equal(summary.guestDisplayName, "Anonymous guest");
  assert.equal(summary.challengeLabel, "Memory Capsule");
  assert.equal(summary.detail, "Best candid");
  assert.equal(summary.remainingUploads, 2);
  assert.equal(summary.revealNote, "Come back after reveal.");
});

test("contributor summary stays positive and ignores anonymous labels", () => {
  const summary = buildContributorSummary([
    photo({ id: "one", guestNickname: "Mia" }),
    photo({ id: "two", guestNickname: "Mia" }),
    photo({ id: "three", guestNickname: "Anonymous guest" }),
    photo({ id: "four", guestNickname: "Alex" }),
    photo({ id: "hidden", guestNickname: "Sam", visibilityStatus: "HIDDEN" }),
  ]);

  assert.equal(summary.totalPhotos, 4);
  assert.equal(summary.contributorCount, 2);
  assert.deepEqual(summary.topContributors, [
    { displayName: "Mia", photoCount: 2 },
    { displayName: "Alex", photoCount: 1 },
  ]);
});

test("guest challenge progress includes selected guest context", () => {
  const challenge = {
    id: "challenge",
    type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    title: "Scavenger",
    instructions: "Pick a prompt.",
    participants: [],
    prompts: [
      { id: "one", text: "Best dance move", order: 0 },
      { id: "two", text: "Final group photo", order: 1 },
    ],
  } satisfies EventChallenge;

  const progress = buildGuestChallengeProgress(challenge, [photo({ challengePromptId: "one", challengeItemId: "one" })], { promptId: "two" });

  assert.equal(progress.mode, CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT);
  assert.equal(progress.selectedLabel, "Final group photo");
  assert.match(progress.headline, /1 of 2 prompts/);
  assert.match(progress.note, /Current prompt/);
});

test("guest upload local metadata records only local-safe upload details", () => {
  const metadata = {
    photoId: "photo-1",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    guestDisplayName: sanitizeGuestDisplayName("Jordan"),
    challengeLabel: "Best candid",
  } satisfies GuestUploadLocalMetadata;

  assert.deepEqual(metadata, {
    photoId: "photo-1",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    guestDisplayName: "Jordan",
    challengeLabel: "Best candid",
  });
});

test("award voting defaults to enabled for Event Awards and respects config override", () => {
  const enabled = isAwardVotingEnabled({
    type: CHALLENGE_TYPES.EVENT_AWARDS,
    config: {},
  } as EventChallenge);
  const disabled = isAwardVotingEnabled({
    type: CHALLENGE_TYPES.EVENT_AWARDS,
    config: { votingEnabled: false },
  } as EventChallenge);
  const disabledByString = isAwardVotingEnabled({
    type: CHALLENGE_TYPES.EVENT_AWARDS,
    config: { votingEnabled: "false" },
  } as EventChallenge);
  const nonAward = isAwardVotingEnabled({
    type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    config: {},
  } as EventChallenge);

  assert.equal(enabled, true);
  assert.equal(disabled, false);
  assert.equal(disabledByString, false);
  assert.equal(nonAward, false);
});

test("award voting summary marks ties, no-submissions, no-votes, and old config categories correctly", () => {
  const challenge = {
    type: CHALLENGE_TYPES.EVENT_AWARDS,
    config: {
      categories: [
        { id: "award-one", label: "Funniest Photo", order: 0 },
        { id: "award-two", label: "Best Outfit", order: 1 },
        { id: "award-three", label: "Most Wholesome", order: 2 },
      ],
    },
  };

  const photos = [
    photo({ id: "a", challengeItemId: "award-one" }),
    photo({ id: "b", challengeItemId: "award-one" }),
    photo({ id: "c", challengeItemId: "award-two" }),
    photo({ id: "d", challengeItemId: "award-two" }),
  ];
  const votes = [
    { photoId: "a", challengeItemId: "award-one" },
    { photoId: "a", challengeItemId: "award-one" },
    { photoId: "b", challengeItemId: "award-one" },
    { photoId: "c", challengeItemId: "award-two" },
    { photoId: "d", challengeItemId: "award-two" },
  ];
  const summary = buildAwardVotingSummary({
    challenge,
    photos,
    votes,
    myVotesByCategory: {
      "award-one": "a",
      "award-two": "c",
    },
  });

  const funniest = summary.categories.find((category) => category.categoryId === "award-one");
  const bestOutfit = summary.categories.find((category) => category.categoryId === "award-two");
  const wholesome = summary.categories.find((category) => category.categoryId === "award-three");

  assert.equal(summary.votingEnabled, true);
  assert.equal(funniest?.submissionCount, 2);
  assert.equal(funniest?.totalVotes, 3);
  assert.equal(funniest?.isTie, false);
  assert.equal(funniest?.leaderPhotoIds.join(","), "a");
  assert.equal(funniest?.myVotePhotoId, "a");

  assert.equal(bestOutfit?.submissionCount, 2);
  assert.equal(bestOutfit?.totalVotes, 2);
  assert.equal(bestOutfit?.isTie, true);
  assert.equal(bestOutfit?.leaderPhotoIds.join(","), "c,d");

  assert.equal(wholesome?.submissionCount, 0);
  assert.equal(wholesome?.noSubmissions, true);
  assert.equal(wholesome?.noVotes, true);
});

test("award voting summary ignores votes for photos not in the visible photo set", () => {
  const summary = buildAwardVotingSummary({
    challenge: {
      type: CHALLENGE_TYPES.EVENT_AWARDS,
      config: {
        categories: [{ id: "award-one", label: "Funniest Photo", order: 0 }],
      },
    },
    photos: [photo({ id: "visible-photo", challengeItemId: "award-one" })],
    votes: [
      { photoId: "visible-photo", challengeItemId: "award-one" },
      { photoId: "hidden-photo", challengeItemId: "award-one" },
      { photoId: "deleted-photo", challengeItemId: "award-one" },
    ],
  });

  const funniest = summary.categories[0];
  assert.equal(funniest.totalVotes, 1);
  assert.equal(funniest.leaderPhotoIds.join(","), "visible-photo");
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
    eventTemplateSlug: "birthday-party",
    promptPackSlug: "birthday",
    challenge: null,
  });

  assert.deepEqual(kit.links.map((link) => link.key), ["guest", "live-wall", "recap"]);
  assert.match(kit.inviteText, /birthday/i);
  assert.match(kit.links[1].instruction, /birthday energy/);
  assert.equal(kit.checklist.length, 5);
});

test("host share assets generate poster and share card metadata", () => {
  const assets = buildHostShareAssets({
    id: "event 1",
    name: "Spring Formal",
    slug: "spring-formal",
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 5,
    eventLink: "https://example.com/e/spring-formal",
    liveWallLink: "https://example.com/wall/spring-formal",
    recapLink: "https://example.com/recap/spring-formal",
    photoCount: 0,
    eventTemplateSlug: "birthday-party",
    promptPackSlug: "birthday",
    challenge: { id: "challenge", type: CHALLENGE_TYPES.EVENT_AWARDS, title: "Awards", instructions: "Choose an award category.", participants: [] },
  });

  assert.equal(assets.poster.posterPath, "/dashboard/events/event%201/poster");
  assert.equal(assets.poster.noDownloadCopy, "No app download needed");
  assert.match(assets.inviteText, /birthday/i);
  assert.match(assets.socialPostCopy, /birthday recap/i);
  assert.match(assets.winnerShareText, /Event Awards winners/i);
  assert.deepEqual(assets.links.map((link) => [link.key, link.audience, link.timing]), [
    ["guest", "Guests", "Before event"],
    ["live-wall", "Host display", "During event"],
    ["recap", "Everyone", "After reveal"],
  ]);
});

test("host share assets keep fallback copy useful for old events", () => {
  const assets = buildHostShareAssets({
    id: "legacy",
    name: "Legacy Night",
    slug: "legacy-night",
    eventDate: "2026-01-01T00:00:00.000Z",
    revealAt: "2026-01-02T00:00:00.000Z",
    photoLimitPerGuest: 5,
    eventLink: "https://example.com/e/legacy-night",
    liveWallLink: "",
    recapLink: "https://example.com/recap/legacy-night",
    photoCount: 0,
    eventTemplateSlug: null,
    promptPackSlug: null,
    challenge: null,
  });

  assert.match(assets.inviteText, /Legacy Night/);
  assert.match(assets.inviteText, /No app download needed/);
  assert.match(assets.liveWallDisplayPrompt, /Live Wall/);
  assert.match(assets.emptyRecapCopy, /No photos yet/);
});

test("host share assets use template-aware copy for common event presets", () => {
  const cases = [
    ["birthday-party", /birthday/i],
    ["wedding-engagement", /celebration/i],
    ["greek-life-event", /chapter/i],
    ["graduation-party", /graduation/i],
    ["friend-trip", /trip/i],
  ] as const;

  for (const [eventTemplateSlug, expected] of cases) {
    const assets = buildHostShareAssets({
      id: eventTemplateSlug,
      name: "Event",
      slug: eventTemplateSlug,
      eventDate: "2026-01-01T00:00:00.000Z",
      revealAt: "2026-01-02T00:00:00.000Z",
      photoLimitPerGuest: 5,
      eventLink: `https://example.com/e/${eventTemplateSlug}`,
      liveWallLink: `https://example.com/wall/${eventTemplateSlug}`,
      recapLink: `https://example.com/recap/${eventTemplateSlug}`,
      photoCount: 0,
      eventTemplateSlug,
      promptPackSlug: null,
      challenge: null,
    });
    assert.match(assets.inviteText, expected);
  }
});
