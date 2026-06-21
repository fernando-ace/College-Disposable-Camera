export type ISODateString = string;

export const CHALLENGE_TYPES = {
  COLOR_HUNT: "COLOR_HUNT",
  PHOTO_SCAVENGER_HUNT: "PHOTO_SCAVENGER_HUNT",
  EVENT_AWARDS: "EVENT_AWARDS",
  MEMORY_CAPSULE: "MEMORY_CAPSULE",
} as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[keyof typeof CHALLENGE_TYPES];
export type ChallengeMode = "NONE" | ChallengeType;
export type ChallengeItemKind = "color" | "prompt" | "award" | "capsule";
export type UploadMetadataRequirement = "none" | "participant" | "prompt" | "award";
export type SetupComplexity = "None" | "Easy" | "Medium";

export type User = {
  id: string;
  email: string;
};

export type ColorHuntColor = {
  colorName: string;
  colorHex: string;
  colorSlug: string;
};

export type ChallengeParticipant = ColorHuntColor & {
  id?: string;
  displayName: string;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
};

export type ChallengePrompt = {
  id?: string;
  text: string;
  order: number;
};

export type ChallengeCategory = {
  id?: string;
  label: string;
  order: number;
};

export type ChallengeItem = {
  id?: string;
  label: string;
  order: number;
  kind: ChallengeItemKind;
};

export type MemoryCapsuleConfig = {
  revealTitle: string;
  revealNote: string;
};

export type EventChallenge = {
  id: string;
  eventId?: string;
  type: ChallengeType;
  title: string;
  instructions: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
  participants: ChallengeParticipant[];
  prompts?: ChallengePrompt[];
  categories?: ChallengeCategory[];
};

export type EventChallengeInput = {
  type: ChallengeType;
  title: string;
  instructions: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  participants?: ChallengeParticipant[];
  prompts?: ChallengePrompt[];
  categories?: ChallengeCategory[];
} | null;

export type Photo = {
  id: string;
  url: string;
  previewUrl?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: ISODateString;
  guestNickname?: string;
  challengeId?: string | null;
  challengeParticipantId?: string | null;
  challengeColorName?: string | null;
  challengePromptId?: string | null;
  challengePromptText?: string | null;
  challengeItemId?: string | null;
  challengeItemLabel?: string | null;
  challengeItemKind?: ChallengeItemKind | string | null;
  challengeParticipantName?: string | null;
  challengeColorHex?: string | null;
  challengeColorSlug?: string | null;
};

export type EventSummary = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  eventDate: ISODateString;
  revealAt: ISODateString;
  photoLimitPerGuest: number;
  eventLink: string;
  qrCodeDataUrl?: string;
  photoCount: number;
  previewPhotos?: Photo[];
  photos?: Photo[];
  challenge?: EventChallenge | null;
};

export type PublicEvent = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  eventDate: ISODateString;
  revealAt: ISODateString;
  photoLimitPerGuest: number;
  isRevealed: boolean;
  photoCount: number | null;
  challenge?: EventChallenge | null;
};

export type GuestStatus = {
  uploadedCount?: number;
  remainingUploads: number;
  nickname: string | null;
};

export type ChallengeSubmission = {
  challengeId?: string | null;
  challengeParticipantId?: string | null;
  challengePromptId?: string | null;
  challengeItemId?: string | null;
  nickname?: string;
};

export type CreateEventInput = {
  name: string;
  description?: string | null;
  eventDate: ISODateString;
  revealAt: ISODateString;
  photoLimitPerGuest: number;
  challenge?: EventChallengeInput;
};

export type UploadPhotoMetadata = {
  nickname: string;
  clientId: string;
  challengeParticipantId?: string;
  challengePromptId?: string;
  challengeItemId?: string;
};

export type ChallengePackDefinition = {
  mode: ChallengeMode;
  type: ChallengeType | null;
  slug: string;
  name: string;
  shortDescription: string;
  bestFor: string;
  badge: string;
  icon: string;
  setupComplexity: SetupComplexity;
  hostSetupFields: string[];
  guestInstructions: string;
  uploadRequirement: UploadMetadataRequirement;
  albumItemKind: ChallengeItemKind | null;
};

export type ChallengeDraft = {
  type: ChallengeMode;
  participants: ChallengeParticipant[];
  prompts: ChallengePrompt[];
  categories: ChallengeCategory[];
  memoryCapsule: MemoryCapsuleConfig;
};

export const COLOR_HUNT_PALETTE: ColorHuntColor[] = [
  { colorName: "Red", colorHex: "#dc2626", colorSlug: "red" },
  { colorName: "Orange", colorHex: "#ea580c", colorSlug: "orange" },
  { colorName: "Yellow", colorHex: "#facc15", colorSlug: "yellow" },
  { colorName: "Green", colorHex: "#16a34a", colorSlug: "green" },
  { colorName: "Blue", colorHex: "#2563eb", colorSlug: "blue" },
  { colorName: "Purple", colorHex: "#9333ea", colorSlug: "purple" },
  { colorName: "Pink", colorHex: "#db2777", colorSlug: "pink" },
  { colorName: "White", colorHex: "#f8fafc", colorSlug: "white" },
  { colorName: "Black", colorHex: "#111827", colorSlug: "black" },
  { colorName: "Brown", colorHex: "#92400e", colorSlug: "brown" },
];

export const STARTER_SCAVENGER_PROMPTS = [
  "Best group selfie",
  "Someone on the dance floor",
  "A funny candid moment",
  "Favorite decoration",
  "The host having fun",
];

export const DEFAULT_AWARD_CATEGORIES = [
  "Funniest Photo",
  "Best Group Shot",
  "Best Candid",
  "Best Outfit",
  "Most Wholesome",
  "Main Character Moment",
];

export const DEFAULT_MEMORY_CAPSULE: MemoryCapsuleConfig = {
  revealTitle: "The album unlocks after the event",
  revealNote: "Guests can keep adding photos now. Everyone comes back at reveal time to see the full capsule together.",
};

export const CHALLENGE_PACKS: ChallengePackDefinition[] = [
  {
    mode: "NONE",
    type: null,
    slug: "no-challenge",
    name: "No Challenge",
    shortDescription: "A simple shared event album with the fewest decisions for guests.",
    bestFor: "Weddings, parties, and any event where speed matters most.",
    badge: "Classic album",
    icon: "images",
    setupComplexity: "None",
    hostSetupFields: [],
    guestInstructions: "Add your name, choose a photo, and send it to the private event album.",
    uploadRequirement: "none",
    albumItemKind: null,
  },
  {
    mode: CHALLENGE_TYPES.COLOR_HUNT,
    type: CHALLENGE_TYPES.COLOR_HUNT,
    slug: "color-hunt",
    name: "Color Hunt",
    shortDescription: "Guests join a color team and upload photos that match their color.",
    bestFor: "School events, mixers, brand parties, and playful groups.",
    badge: "Team game",
    icon: "color-palette",
    setupComplexity: "Easy",
    hostSetupFields: ["Color teams"],
    guestInstructions: "Choose your color team, then upload real moments that match your assigned color.",
    uploadRequirement: "participant",
    albumItemKind: "color",
  },
  {
    mode: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    slug: "photo-scavenger-hunt",
    name: "Photo Scavenger Hunt",
    shortDescription: "Guests complete a list of photo prompts throughout the event.",
    bestFor: "Reunions, retreats, campus events, and long receptions.",
    badge: "Prompt list",
    icon: "list-check",
    setupComplexity: "Medium",
    hostSetupFields: ["Photo prompts"],
    guestInstructions: "Pick a prompt, take a photo that completes it, and upload it to the event album.",
    uploadRequirement: "prompt",
    albumItemKind: "prompt",
  },
  {
    mode: CHALLENGE_TYPES.EVENT_AWARDS,
    type: CHALLENGE_TYPES.EVENT_AWARDS,
    slug: "event-awards",
    name: "Event Awards",
    shortDescription: "Guests submit photos into award categories like funniest or best group shot.",
    bestFor: "Parties, banquets, Greek life events, and teams that love superlatives.",
    badge: "Awards",
    icon: "trophy",
    setupComplexity: "Easy",
    hostSetupFields: ["Award categories"],
    guestInstructions: "Choose an award category, then submit the photo that deserves the title.",
    uploadRequirement: "award",
    albumItemKind: "award",
  },
  {
    mode: CHALLENGE_TYPES.MEMORY_CAPSULE,
    type: CHALLENGE_TYPES.MEMORY_CAPSULE,
    slug: "memory-capsule",
    name: "Memory Capsule",
    shortDescription: "Guests upload during the event while the full album is framed around a reveal time.",
    bestFor: "Graduations, weddings, retreats, and surprise reveals.",
    badge: "Reveal moment",
    icon: "lock",
    setupComplexity: "Easy",
    hostSetupFields: ["Reveal framing"],
    guestInstructions: "Add photos throughout the event. The full capsule opens at the reveal time.",
    uploadRequirement: "none",
    albumItemKind: "capsule",
  },
];

export function getChallengePack(type?: ChallengeMode | ChallengeType | null) {
  return CHALLENGE_PACKS.find((pack) => pack.mode === (type || "NONE")) || CHALLENGE_PACKS[0];
}

export function createChallengeItemId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPrompt(text = "", order = 0, id?: string): ChallengePrompt {
  return { id: id || createChallengeItemId("prompt"), text, order };
}

export function createCategory(label = "", order = 0, id?: string): ChallengeCategory {
  return { id: id || createChallengeItemId("award"), label, order };
}

export function createStarterPrompts() {
  return STARTER_SCAVENGER_PROMPTS.map((text, order) => createPrompt(text, order, `prompt-${order + 1}`));
}

export function createDefaultAwardCategories() {
  return DEFAULT_AWARD_CATEGORIES.map((label, order) => createCategory(label, order, `award-${order + 1}`));
}

export function createDefaultParticipants() {
  return COLOR_HUNT_PALETTE.slice(0, 6).map((color) => ({ ...color, displayName: `${color.colorName} Team` }));
}

export function createEmptyChallengeDraft(): ChallengeDraft {
  return {
    type: "NONE",
    participants: createDefaultParticipants(),
    prompts: createStarterPrompts(),
    categories: createDefaultAwardCategories(),
    memoryCapsule: { ...DEFAULT_MEMORY_CAPSULE },
  };
}

function normalizeOrderedItems<T extends { id?: string; order: number }>(items: T[], fallbackPrefix: string, labelKey: keyof T): T[] {
  return items
    .map((item, index) => ({
      ...item,
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `${fallbackPrefix}-${index + 1}`,
      [labelKey]: String(item[labelKey] || "").trim(),
      order: Number.isInteger(Number(item.order)) ? Number(item.order) : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({ ...item, order }));
}

export function promptsFromChallenge(challenge?: Pick<EventChallenge, "prompts" | "config"> | null): ChallengePrompt[] {
  const prompts = Array.isArray(challenge?.prompts)
    ? challenge.prompts
    : Array.isArray(challenge?.config?.prompts)
      ? (challenge.config.prompts as ChallengePrompt[])
      : [];

  return normalizeOrderedItems(
    prompts.map((prompt, index) => ({
      id: prompt.id,
      text: String(prompt.text || ""),
      order: Number.isInteger(Number(prompt.order)) ? Number(prompt.order) : index,
    })),
    "prompt",
    "text",
  );
}

export function categoriesFromChallenge(challenge?: Pick<EventChallenge, "categories" | "config"> | null): ChallengeCategory[] {
  const categories = Array.isArray(challenge?.categories)
    ? challenge.categories
    : Array.isArray(challenge?.config?.categories)
      ? (challenge.config.categories as ChallengeCategory[])
      : [];

  return normalizeOrderedItems(
    categories.map((category, index) => ({
      id: category.id,
      label: String(category.label || ""),
      order: Number.isInteger(Number(category.order)) ? Number(category.order) : index,
    })),
    "award",
    "label",
  );
}

export function memoryCapsuleFromChallenge(challenge?: Pick<EventChallenge, "config"> | null): MemoryCapsuleConfig {
  const config = challenge?.config && typeof challenge.config === "object" ? challenge.config : {};
  return {
    revealTitle: String(config.revealTitle || DEFAULT_MEMORY_CAPSULE.revealTitle).trim() || DEFAULT_MEMORY_CAPSULE.revealTitle,
    revealNote: String(config.revealNote || DEFAULT_MEMORY_CAPSULE.revealNote).trim() || DEFAULT_MEMORY_CAPSULE.revealNote,
  };
}

export function itemsFromChallenge(challenge?: EventChallenge | null): ChallengeItem[] {
  if (!challenge) return [];
  if (challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    return promptsFromChallenge(challenge).map((prompt) => ({ id: prompt.id, label: prompt.text, order: prompt.order, kind: "prompt" }));
  }
  if (challenge.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    return categoriesFromChallenge(challenge).map((category) => ({ id: category.id, label: category.label, order: category.order, kind: "award" }));
  }
  if (challenge.type === CHALLENGE_TYPES.COLOR_HUNT) {
    return challenge.participants.map((participant, order) => ({
      id: participant.id,
      label: participant.colorName,
      order,
      kind: "color",
    }));
  }
  return [];
}

export function draftFromChallenge(challenge?: EventChallenge | null): ChallengeDraft {
  if (!challenge || challenge.isActive === false) return createEmptyChallengeDraft();
  const emptyDraft = createEmptyChallengeDraft();
  return {
    type: challenge.type,
    participants: challenge.participants.length ? challenge.participants.map((participant) => ({ ...participant })) : emptyDraft.participants,
    prompts: promptsFromChallenge(challenge).length ? promptsFromChallenge(challenge) : emptyDraft.prompts,
    categories: categoriesFromChallenge(challenge).length ? categoriesFromChallenge(challenge) : emptyDraft.categories,
    memoryCapsule: challenge.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(challenge) : emptyDraft.memoryCapsule,
  };
}

export function hasDuplicateLabels(values: string[]) {
  const labels = values.map((value) => value.trim().toLowerCase()).filter(Boolean);
  return new Set(labels).size !== labels.length;
}

export function hasDuplicatePrompts(prompts: ChallengePrompt[]) {
  return hasDuplicateLabels(prompts.map((prompt) => prompt.text));
}

export function hasDuplicateCategories(categories: ChallengeCategory[]) {
  return hasDuplicateLabels(categories.map((category) => category.label));
}

export function hasDuplicateParticipantNames(participants: ChallengeParticipant[]) {
  return hasDuplicateLabels(participants.map((participant) => participant.displayName));
}

export function hasDuplicateParticipantColors(participants: ChallengeParticipant[]) {
  const colors = participants.map((participant) => participant.colorSlug).filter(Boolean);
  return new Set(colors).size !== colors.length;
}

export function colorBySlug(colorSlug: string) {
  return COLOR_HUNT_PALETTE.find((color) => color.colorSlug === colorSlug) || COLOR_HUNT_PALETTE[0];
}

export function validateChallengeDraft(draft: ChallengeDraft) {
  if (draft.type === "NONE") return "";

  if (draft.type === CHALLENGE_TYPES.COLOR_HUNT) {
    if (draft.participants.length < 2) return "Add at least 2 color teams to start Color Hunt.";
    if (draft.participants.some((participant) => !participant.displayName.trim())) return "Color team names cannot be empty.";
    if (draft.participants.some((participant) => !participant.colorName || !participant.colorHex || !participant.colorSlug)) return "Each participant needs a color.";
    if (hasDuplicateParticipantNames(draft.participants)) return "Color team names must be unique.";
    return "";
  }

  if (draft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    if (draft.prompts.length < 3) return "Add at least 3 prompts to start Photo Scavenger Hunt.";
    if (draft.prompts.some((prompt) => !prompt.text.trim())) return "Prompts cannot be empty.";
    if (hasDuplicatePrompts(draft.prompts)) return "Remove duplicate prompts before saving.";
    return "";
  }

  if (draft.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    if (draft.categories.length < 2) return "Add at least 2 award categories.";
    if (draft.categories.some((category) => !category.label.trim())) return "Award categories cannot be empty.";
    if (hasDuplicateCategories(draft.categories)) return "Remove duplicate award categories before saving.";
    return "";
  }

  if (draft.type === CHALLENGE_TYPES.MEMORY_CAPSULE) {
    if (!draft.memoryCapsule.revealTitle.trim()) return "Add a reveal title for Memory Capsule.";
    if (!draft.memoryCapsule.revealNote.trim()) return "Add a reveal note for Memory Capsule.";
  }

  return "";
}

export function buildChallengePayload(draft: ChallengeDraft): EventChallengeInput {
  const validationError = validateChallengeDraft(draft);
  if (validationError) throw new Error(validationError);
  if (draft.type === "NONE") return null;
  const pack = getChallengePack(draft.type);

  if (draft.type === CHALLENGE_TYPES.COLOR_HUNT) {
    const participants = draft.participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName.trim(),
      colorName: participant.colorName,
      colorHex: participant.colorHex,
      colorSlug: participant.colorSlug,
    }));

    return {
      type: CHALLENGE_TYPES.COLOR_HUNT,
      title: pack.name,
      instructions: pack.guestInstructions,
      config: { palette: COLOR_HUNT_PALETTE.map(({ colorName, colorHex, colorSlug }) => ({ colorName, colorHex, colorSlug })) },
      isActive: true,
      participants,
    };
  }

  if (draft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    const prompts = draft.prompts.map((prompt, order) => ({ id: prompt.id, text: prompt.text.trim(), order }));
    return {
      type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
      title: pack.name,
      instructions: pack.guestInstructions,
      config: { prompts },
      isActive: true,
      prompts,
      participants: [],
    };
  }

  if (draft.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    const categories = draft.categories.map((category, order) => ({ id: category.id, label: category.label.trim(), order }));
    return {
      type: CHALLENGE_TYPES.EVENT_AWARDS,
      title: pack.name,
      instructions: pack.guestInstructions,
      config: { categories },
      isActive: true,
      categories,
      participants: [],
    };
  }

  return {
    type: CHALLENGE_TYPES.MEMORY_CAPSULE,
    title: pack.name,
    instructions: pack.guestInstructions,
    config: {
      revealTitle: draft.memoryCapsule.revealTitle.trim(),
      revealNote: draft.memoryCapsule.revealNote.trim(),
    },
    isActive: true,
    participants: [],
  };
}

export function challengeLabel(challenge?: Pick<EventChallenge, "type"> | null): string {
  return getChallengePack(challenge?.type || "NONE").name;
}

export function challengeTypeName(type: ChallengeMode) {
  return getChallengePack(type).name;
}

export function photoChallengeLabel(photo: Pick<Photo, "challengeItemLabel" | "challengePromptText" | "challengeColorName">) {
  return photo.challengeItemLabel || photo.challengePromptText || photo.challengeColorName || "";
}
