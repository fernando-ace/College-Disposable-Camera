import type { ChallengeParticipant, ChallengePrompt, ChallengeType, EventChallenge, EventChallengeInput } from "@eventfilm/shared";
import { CHALLENGE_TYPES, COLOR_HUNT_PALETTE, promptsFromChallenge } from "@eventfilm/shared";

export type ChallengeDraft = {
  type: "NONE" | ChallengeType;
  participants: ChallengeParticipant[];
  prompts: ChallengePrompt[];
};

export const STARTER_SCAVENGER_PROMPTS = [
  "Best group selfie",
  "Someone on the dance floor",
  "A funny candid moment",
  "Favorite decoration",
  "The host having fun",
];

export function createPrompt(text = "", order = 0, id?: string): ChallengePrompt {
  return {
    id: id || `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    order,
  };
}

export function createStarterPrompts() {
  return STARTER_SCAVENGER_PROMPTS.map((text, order) => createPrompt(text, order));
}

export function createEmptyChallengeDraft(): ChallengeDraft {
  return {
    type: "NONE",
    participants: [
      { ...COLOR_HUNT_PALETTE[0], displayName: "Red Team" },
      { ...COLOR_HUNT_PALETTE[1], displayName: "Orange Team" },
      { ...COLOR_HUNT_PALETTE[2], displayName: "Yellow Team" },
      { ...COLOR_HUNT_PALETTE[3], displayName: "Green Team" },
      { ...COLOR_HUNT_PALETTE[4], displayName: "Blue Team" },
      { ...COLOR_HUNT_PALETTE[5], displayName: "Purple Team" },
    ],
    prompts: createStarterPrompts(),
  };
}

export function draftFromChallenge(challenge?: EventChallenge | null): ChallengeDraft {
  if (!challenge) return createEmptyChallengeDraft();
  const emptyDraft = createEmptyChallengeDraft();

  return {
    type: Boolean(challenge.isActive ?? true) ? challenge.type : "NONE",
    participants: challenge.participants.length ? challenge.participants.map((participant) => ({ ...participant })) : emptyDraft.participants,
    prompts: challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && promptsFromChallenge(challenge).length
      ? promptsFromChallenge(challenge)
      : emptyDraft.prompts,
  };
}

export function challengeTypeName(type: "NONE" | ChallengeType) {
  if (type === "NONE") return "No challenge";
  return type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT ? "Photo Scavenger Hunt" : "Color Hunt";
}

export function hasDuplicatePrompts(prompts: ChallengePrompt[]) {
  const promptTexts = prompts.map((prompt) => prompt.text.trim().toLowerCase()).filter(Boolean);
  return new Set(promptTexts).size !== promptTexts.length;
}

export function hasDuplicateParticipantNames(participants: ChallengeParticipant[]) {
  const names = participants.map((participant) => participant.displayName.trim().toLowerCase()).filter(Boolean);
  return new Set(names).size !== names.length;
}

export function hasDuplicateParticipantColors(participants: ChallengeParticipant[]) {
  const colors = participants.map((participant) => participant.colorSlug).filter(Boolean);
  return new Set(colors).size !== colors.length;
}

export function colorBySlug(colorSlug: string) {
  return COLOR_HUNT_PALETTE.find((color) => color.colorSlug === colorSlug) || COLOR_HUNT_PALETTE[0];
}

export function buildChallengePayload(draft: ChallengeDraft): EventChallengeInput {
  if (draft.type === "NONE") return null;

  if (draft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    const prompts = draft.prompts.map((prompt, order) => ({
      id: prompt.id,
      text: prompt.text.trim(),
      order,
    }));

    if (prompts.length < 3) throw new Error("Add at least 3 prompts to start Photo Scavenger Hunt.");
    if (prompts.some((prompt) => !prompt.text)) throw new Error("Prompts cannot be empty.");
    if (hasDuplicatePrompts(prompts)) throw new Error("Remove duplicate prompts before saving.");

    return {
      type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
      title: "Photo Scavenger Hunt",
      instructions: "Pick a prompt, take a photo, and upload it to the event album.",
      config: { prompts },
      isActive: true,
      prompts,
      participants: [],
    };
  }

  const participants = draft.participants.map((participant) => ({
    id: participant.id,
    displayName: participant.displayName.trim(),
    colorName: participant.colorName,
    colorHex: participant.colorHex,
    colorSlug: participant.colorSlug,
  }));

  if (participants.length < 2) throw new Error("Add at least 2 color teams to start Color Hunt.");
  if (participants.some((participant) => !participant.displayName)) throw new Error("Color team names cannot be empty.");
  if (participants.some((participant) => !participant.colorName || !participant.colorHex || !participant.colorSlug)) {
    throw new Error("Each participant needs a color.");
  }
  if (hasDuplicateParticipantNames(participants)) throw new Error("Color team names must be unique.");

  return {
    type: CHALLENGE_TYPES.COLOR_HUNT,
    title: "Color Hunt",
    instructions: "Assign each person a color. Guests will upload photos of things they find in their color.",
    config: { palette: COLOR_HUNT_PALETTE.map(({ colorName, colorHex, colorSlug }) => ({ colorName, colorHex, colorSlug })) },
    isActive: true,
    participants,
  };
}
