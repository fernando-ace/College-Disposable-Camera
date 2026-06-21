import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_PACKS,
  CHALLENGE_TYPES,
  buildChallengePayload,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createStarterPrompts,
  getChallengePack,
  validateChallengeDraft,
} from "./index.ts";

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
