export type ISODateString = string;

export const CHALLENGE_TYPES = {
  COLOR_HUNT: "COLOR_HUNT",
  PHOTO_SCAVENGER_HUNT: "PHOTO_SCAVENGER_HUNT",
} as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[keyof typeof CHALLENGE_TYPES];

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
};

export type EventChallengeInput = {
  type: ChallengeType;
  title: string;
  instructions: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  participants?: ChallengeParticipant[];
  prompts?: ChallengePrompt[];
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

export function promptsFromChallenge(challenge?: Pick<EventChallenge, "prompts" | "config"> | null): ChallengePrompt[] {
  const prompts = Array.isArray(challenge?.prompts)
    ? challenge.prompts
    : Array.isArray(challenge?.config?.prompts)
      ? (challenge.config.prompts as ChallengePrompt[])
      : [];

  return prompts
    .map((prompt, index) => ({
      id: prompt.id,
      text: String(prompt.text || ""),
      order: Number.isInteger(prompt.order) ? prompt.order : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((prompt, order) => ({ ...prompt, order }));
}

export function challengeLabel(challenge?: Pick<EventChallenge, "type"> | null): string {
  if (!challenge) return "No challenge";
  return challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT ? "Photo Scavenger Hunt" : "Color Hunt";
}
