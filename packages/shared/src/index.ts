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
export type PhotoVisibilityStatus = "VISIBLE" | "HIDDEN";
export type PhotoReportReason = "inappropriate" | "privacy" | "spam" | "other";
export type PromptPackKind = "prompt" | "award" | "custom";
export type PromptPackSlug =
  | "birthday"
  | "wedding-engagement"
  | "greek-life"
  | "student-org"
  | "graduation"
  | "friend-trip"
  | "camp-retreat"
  | "club-banquet"
  | "custom";
export type EventTemplateSlug =
  | "birthday-party"
  | "wedding-engagement"
  | "greek-life-event"
  | "student-org-event"
  | "graduation-party"
  | "friend-trip"
  | "camp-retreat"
  | "club-banquet"
  | "family-gathering"
  | "open-custom-event";

export const PHOTO_REPORT_REASONS: PhotoReportReason[] = ["inappropriate", "privacy", "spam", "other"];
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const DEFAULT_MAX_UPLOAD_SIZE_MB = 10;
export const DEFAULT_MAX_UPLOAD_SIZE_BYTES = DEFAULT_MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "unsupported_type" | "too_large"; message: string };

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
  visibilityStatus?: PhotoVisibilityStatus;
  hiddenAt?: ISODateString | null;
  hiddenReason?: string | null;
  isFeatured?: boolean;
  featuredAt?: ISODateString | null;
  reportCount?: number;
  reports?: PhotoReport[];
};

export type PhotoReport = {
  id: string;
  reason: PhotoReportReason;
  note?: string | null;
  createdAt: ISODateString;
};

export type ChallengeProgressRow = {
  id: string;
  label: string;
  count: number;
  total?: number;
  kind: ChallengeItemKind | "album";
  colorName?: string;
  colorHex?: string;
  colorSlug?: string;
  complete?: boolean;
};

export type ChallengeProgressSummary = {
  mode: ChallengeMode;
  modeLabel: string;
  instructions: string;
  totalPhotos: number;
  rows: ChallengeProgressRow[];
};

export type EventRecapMetadata = {
  modeLabel: string;
  templateName?: string;
  recapTitle: string;
  recapSubtitle: string;
  totalPhotos: number;
  contributorCount: number;
  highlightPhotos: Photo[];
  recentPhotos: Photo[];
};

export type HostLaunchKitLink = {
  key: "guest" | "live-wall" | "recap";
  label: string;
  url: string;
  purpose: string;
  instruction: string;
};

export type HostLaunchKitChecklistItem = {
  key: "create-event" | "choose-mode" | "copy-guest-link" | "open-live-wall" | "share-recap";
  label: string;
  complete: boolean;
};

export type HostLaunchKit = {
  eventName: string;
  modeLabel: string;
  links: HostLaunchKitLink[];
  inviteText: string;
  hostInstructions: string;
  socialCaption: string;
  modeInstructions: string;
  checklist: HostLaunchKitChecklistItem[];
};

export const ANALYTICS_EVENT_NAMES = [
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
  "guest_link_copied",
  "live_wall_opened",
  "recap_opened",
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
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsSource = "web" | "mobile" | "api";

export type AnalyticsEventInput = {
  name: AnalyticsEventName;
  source: AnalyticsSource;
  path?: string;
  eventId?: string;
  eventSlug?: string;
  anonymousId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export const BETA_METRIC_DEFINITIONS = {
  activeHost: "A signed-in host who opens the host dashboard in the last 30 days.",
  guestJoin: "A guest upload route visit that records guest_joined_event for an event.",
  photoUpload: "A successfully stored event photo that has not been deleted.",
  liveWallOpen: "A Live Wall route visit that records live_wall_opened for an event.",
  recapOpen: "A Recap route visit that records recap_opened for an event.",
} as const;

export type BetaMetricKey = keyof typeof BETA_METRIC_DEFINITIONS;

export type EventSummary = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  eventDate: ISODateString;
  revealAt: ISODateString;
  photoLimitPerGuest: number;
  eventTemplateSlug?: EventTemplateSlug | string | null;
  promptPackSlug?: PromptPackSlug | string | null;
  eventLink: string;
  liveWallLink?: string;
  recapLink?: string;
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
  eventTemplateSlug?: EventTemplateSlug | string | null;
  promptPackSlug?: PromptPackSlug | string | null;
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
  eventTemplateSlug?: EventTemplateSlug | string | null;
  promptPackSlug?: PromptPackSlug | string | null;
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
  eventTemplateSlug: EventTemplateSlug | null;
  promptPackSlug: PromptPackSlug | null;
  participants: ChallengeParticipant[];
  prompts: ChallengePrompt[];
  categories: ChallengeCategory[];
  memoryCapsule: MemoryCapsuleConfig;
};

export type PromptPackDefinition = {
  slug: PromptPackSlug;
  name: string;
  kind: PromptPackKind;
  description: string;
  items: string[];
};

export type EventTemplateDefinition = {
  slug: EventTemplateSlug;
  name: string;
  shortDescription: string;
  bestFor: string;
  recommendedMode: ChallengeMode;
  promptPackSlug: PromptPackSlug;
  revealTiming: string;
  suggestedUploadLimit?: number;
  inviteCopy: string;
  liveWallCopy: string;
  recapFraming: string;
  icon: string;
  badge: string;
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

export const PROMPT_PACKS: PromptPackDefinition[] = [
  {
    slug: "birthday",
    name: "Birthday",
    kind: "award",
    description: "Warm, funny, high-energy categories for celebrating one person and the whole room.",
    items: ["Best group selfie", "Funniest moment", "Best outfit", "Photo with the birthday person", "Most chaotic photo", "Best candid", "Main character moment", "Final group photo"],
  },
  {
    slug: "wedding-engagement",
    name: "Wedding / Engagement",
    kind: "prompt",
    description: "A polished mix of couple, family, dance floor, and detail moments.",
    items: ["Best candid", "Best couple photo", "Best dance floor moment", "Funniest guest photo", "Most wholesome moment", "Best family photo", "Best detail shot", "Final celebration photo"],
  },
  {
    slug: "greek-life",
    name: "Greek Life",
    kind: "award",
    description: "Social, school-spirit-friendly prompts for chapter events and mixers.",
    items: ["Best group photo", "Best fit", "Funniest candid", "Big/little moment", "Best chant or dance moment", "Most school spirit", "Best table photo", "Main character moment"],
  },
  {
    slug: "student-org",
    name: "Student Org",
    kind: "prompt",
    description: "Balanced prompts for campus org meetings, retreats, and showcases.",
    items: ["Best team photo", "Best speaker moment", "Funniest candid", "Best behind-the-scenes photo", "Most wholesome moment", "Best group activity", "Best food photo", "Final group photo"],
  },
  {
    slug: "graduation",
    name: "Graduation",
    kind: "prompt",
    description: "Milestone prompts for family, campus, cap-and-gown, and emotional photos.",
    items: ["Best cap and gown photo", "Family photo", "Friend group photo", "Best candid", "Most emotional moment", "Best campus photo", "Funniest photo", "Final group photo"],
  },
  {
    slug: "friend-trip",
    name: "Friend Trip",
    kind: "prompt",
    description: "Casual prompts for trips, meals, views, and the moment that sums it all up.",
    items: ["Best view", "Best food photo", "Funniest moment", "Best candid", "Best group selfie", "Most chaotic photo", "Main character moment", "Photo that sums up the trip"],
  },
  {
    slug: "camp-retreat",
    name: "Camp / Retreat",
    kind: "prompt",
    description: "Team, nature, cabin, and activity prompts for a longer shared experience.",
    items: ["Best team photo", "Best activity photo", "Funniest moment", "Best nature photo", "Most wholesome moment", "Best cabin/group photo", "Best challenge photo", "Final group photo"],
  },
  {
    slug: "club-banquet",
    name: "Club Banquet",
    kind: "award",
    description: "Recognition-night categories for tables, outfits, awards, and celebration photos.",
    items: ["Best table photo", "Best outfit", "Best award moment", "Funniest candid", "Best speaker photo", "Most wholesome moment", "Best group photo", "Final celebration photo"],
  },
  {
    slug: "custom",
    name: "Custom Pack",
    kind: "custom",
    description: "A flexible starter set hosts can fully rewrite.",
    items: ["Best group photo", "Funniest moment", "Best candid", "Most wholesome moment", "Main character moment", "Final group photo"],
  },
];

export const EVENT_TEMPLATES: EventTemplateDefinition[] = [
  {
    slug: "birthday-party",
    name: "Birthday Party",
    shortDescription: "A lively setup for the birthday person, friend groups, outfits, and funny moments.",
    bestFor: "House parties, dinners, surprise parties, and milestone birthdays.",
    recommendedMode: CHALLENGE_TYPES.EVENT_AWARDS,
    promptPackSlug: "birthday",
    revealTiming: "Reveal later that night or the next morning.",
    suggestedUploadLimit: 12,
    inviteCopy: "Help capture the birthday from every angle. Upload your funniest, sweetest, and most main-character photos here:",
    liveWallCopy: "Keep the birthday energy on screen while guests add their favorite moments.",
    recapFraming: "A birthday recap full of the people, outfits, candids, and chaos that made it feel like the night.",
    icon: "celebration",
    badge: "Most social",
  },
  {
    slug: "wedding-engagement",
    name: "Wedding / Engagement",
    shortDescription: "A polished guest-photo setup for candids, couple moments, families, and the dance floor.",
    bestFor: "Weddings, engagements, showers, welcome parties, and rehearsal dinners.",
    recommendedMode: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    promptPackSlug: "wedding-engagement",
    revealTiming: "Reveal after the reception or the next day.",
    suggestedUploadLimit: 15,
    inviteCopy: "Share your favorite candid photos from the celebration. No app download needed:",
    liveWallCopy: "Open the Live Wall during the reception so guests can watch the celebration build.",
    recapFraming: "A guest-made celebration story with candids, dance-floor moments, family photos, and details.",
    icon: "favorite",
    badge: "Polished",
  },
  {
    slug: "greek-life-event",
    name: "Greek Life Event",
    shortDescription: "A chapter-ready setup for group photos, fits, school spirit, and big/little moments.",
    bestFor: "Mixers, formals, philanthropy events, bid day, and chapter retreats.",
    recommendedMode: CHALLENGE_TYPES.EVENT_AWARDS,
    promptPackSlug: "greek-life",
    revealTiming: "Reveal after the event or at the next chapter moment.",
    suggestedUploadLimit: 10,
    inviteCopy: "Drop your best photos from the event here so the chapter recap is ready:",
    liveWallCopy: "Show the best group shots, fits, and candid moments as they come in.",
    recapFraming: "A chapter recap built from group shots, spirit moments, candids, and favorite fits.",
    icon: "groups",
    badge: "Chapter ready",
  },
  {
    slug: "student-org-event",
    name: "Student Org Event",
    shortDescription: "A clean setup for campus teams, speakers, activities, food, and behind-the-scenes photos.",
    bestFor: "Club meetings, retreats, showcases, conferences, and campus programs.",
    recommendedMode: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    promptPackSlug: "student-org",
    revealTiming: "Reveal after the event wrap-up.",
    suggestedUploadLimit: 8,
    inviteCopy: "Help document the event. Upload team photos, speaker moments, and behind-the-scenes shots here:",
    liveWallCopy: "Use the Live Wall to make the event feel active and shared.",
    recapFraming: "A campus-event recap with the people, activities, and behind-the-scenes details that mattered.",
    icon: "school",
    badge: "Campus",
  },
  {
    slug: "graduation-party",
    name: "Graduation Party",
    shortDescription: "A memory-forward setup for family, friends, campus, and cap-and-gown moments.",
    bestFor: "Graduation parties, cookouts, senior celebrations, and family gatherings after commencement.",
    recommendedMode: CHALLENGE_TYPES.MEMORY_CAPSULE,
    promptPackSlug: "graduation",
    revealTiming: "Reveal after the party when everyone can relive the day.",
    suggestedUploadLimit: 12,
    inviteCopy: "Add your favorite graduation photos here so everyone can see the full album after the reveal:",
    liveWallCopy: "Let family and friends watch graduation memories appear during the party.",
    recapFraming: "A graduation story with family, friends, campus photos, candids, and final group moments.",
    icon: "workspace_premium",
    badge: "Milestone",
  },
  {
    slug: "friend-trip",
    name: "Friend Trip",
    shortDescription: "A relaxed trip setup for views, meals, funny moments, and the photo that sums it all up.",
    bestFor: "Weekend trips, spring break, road trips, beach houses, and friend vacations.",
    recommendedMode: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    promptPackSlug: "friend-trip",
    revealTiming: "Reveal on the last night or after everyone gets home.",
    suggestedUploadLimit: 20,
    inviteCopy: "Drop the trip photos here so nobody has to chase the group chat afterward:",
    liveWallCopy: "Keep the trip album alive with food, views, candids, and chaotic moments.",
    recapFraming: "A trip recap that feels like the group chat turned into a polished album.",
    icon: "travel_explore",
    badge: "Trip mode",
  },
  {
    slug: "camp-retreat",
    name: "Camp / Retreat",
    shortDescription: "A team-centered setup for activities, nature, cabin groups, and retreat memories.",
    bestFor: "Camps, church retreats, leadership retreats, orientations, and team weekends.",
    recommendedMode: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT,
    promptPackSlug: "camp-retreat",
    revealTiming: "Reveal at the closing session or after checkout.",
    suggestedUploadLimit: 15,
    inviteCopy: "Capture retreat moments as they happen. Upload photos for the final recap here:",
    liveWallCopy: "Use the Live Wall between sessions to show the retreat taking shape.",
    recapFraming: "A retreat recap with teams, activities, nature moments, and the final group story.",
    icon: "forest",
    badge: "Group weekend",
  },
  {
    slug: "club-banquet",
    name: "Club Banquet",
    shortDescription: "A banquet setup for tables, outfits, awards, speakers, and celebration photos.",
    bestFor: "End-of-year banquets, team dinners, award nights, and formal club celebrations.",
    recommendedMode: CHALLENGE_TYPES.EVENT_AWARDS,
    promptPackSlug: "club-banquet",
    revealTiming: "Reveal after awards or the morning after.",
    suggestedUploadLimit: 10,
    inviteCopy: "Upload your banquet photos here so the full recap is ready after the event:",
    liveWallCopy: "Show table photos, award moments, and celebration shots during the banquet.",
    recapFraming: "A banquet recap with outfits, tables, award moments, speakers, and final celebration photos.",
    icon: "emoji_events",
    badge: "Awards night",
  },
  {
    slug: "family-gathering",
    name: "Family Gathering",
    shortDescription: "A simple, warm setup for candid family moments without making guests think too hard.",
    bestFor: "Reunions, holidays, cookouts, birthdays, and multi-generation gatherings.",
    recommendedMode: "NONE",
    promptPackSlug: "custom",
    revealTiming: "Reveal during or after the gathering.",
    suggestedUploadLimit: 12,
    inviteCopy: "Add your favorite family photos here so everyone can enjoy the shared album:",
    liveWallCopy: "Keep the shared family album visible while people add photos.",
    recapFraming: "A warm family album from everyone who was there.",
    icon: "diversity_1",
    badge: "Warm and easy",
  },
  {
    slug: "open-custom-event",
    name: "Open Custom Event",
    shortDescription: "Start from a flexible setup and customize the mode, prompts, and copy yourself.",
    bestFor: "Anything that does not fit a preset or needs a host-specific vibe.",
    recommendedMode: "NONE",
    promptPackSlug: "custom",
    revealTiming: "Choose the reveal timing that fits the event.",
    suggestedUploadLimit: 10,
    inviteCopy: "Upload your favorite photos from the event here:",
    liveWallCopy: "Open the Live Wall while guests upload photos.",
    recapFraming: "A shared recap from the people who were there.",
    icon: "auto_awesome",
    badge: "Fully editable",
  },
];

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

export function getPromptPack(slug?: PromptPackSlug | string | null) {
  return PROMPT_PACKS.find((pack) => pack.slug === slug) || PROMPT_PACKS[PROMPT_PACKS.length - 1];
}

export function getEventTemplate(slug?: EventTemplateSlug | string | null) {
  return EVENT_TEMPLATES.find((template) => template.slug === slug) || null;
}

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function normalizeReportReason(value: string): PhotoReportReason | null {
  return PHOTO_REPORT_REASONS.includes(value as PhotoReportReason) ? (value as PhotoReportReason) : null;
}

export function validateUploadFile(input: { type?: string | null; size?: number | null } | null | undefined, maxBytes = DEFAULT_MAX_UPLOAD_SIZE_BYTES): UploadValidationResult {
  if (!input) return { ok: false, reason: "missing", message: "Choose a photo first." };
  const type = String(input.type || "").toLowerCase();
  if (!type || !ALLOWED_IMAGE_MIME_TYPES.includes(type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return { ok: false, reason: "unsupported_type", message: "Upload a JPG, PNG, WebP, HEIC, or HEIF image." };
  }
  const size = Number(input.size || 0);
  if (size > maxBytes) {
    return { ok: false, reason: "too_large", message: `Photo must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.` };
  }
  return { ok: true };
}

export function isPhotoVisible(photo: Pick<Photo, "visibilityStatus">) {
  return (photo.visibilityStatus || "VISIBLE") === "VISIBLE";
}

export function visiblePhotos(photos: Photo[]) {
  return photos.filter(isPhotoVisible);
}

export function sortPhotosForRecap(photos: Photo[]) {
  return [...photos].sort((a, b) => {
    const featuredDelta = Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
    if (featuredDelta) return featuredDelta;
    return byCreatedAtDesc(a, b);
  });
}

export function buildHostLaunchKit(event: Pick<EventSummary, "name" | "eventLink" | "liveWallLink" | "recapLink" | "challenge" | "eventTemplateSlug">): HostLaunchKit {
  const pack = getChallengePack(event.challenge?.type || "NONE");
  const template = getEventTemplate(event.eventTemplateSlug);
  const guestLink = event.eventLink;
  const liveWallLink = event.liveWallLink || "";
  const recapLink = event.recapLink || "";
  const inviteText = template ? `${template.inviteCopy} ${guestLink}` : "Upload your photos from tonight here: " + guestLink + ". No app download needed.";
  const socialCaption = template ? `${template.recapFraming} Add yours: ${guestLink}` : "Drop your favorite photos from " + event.name + " here: " + guestLink;

  return {
    eventName: event.name,
    modeLabel: pack.name,
    links: [
      {
        key: "guest",
        label: "Guest upload link",
        url: guestLink,
        purpose: "Share this with guests so they can upload photos without an account or app download.",
        instruction: inviteText,
      },
      {
        key: "live-wall",
        label: "Live Wall link",
        url: liveWallLink,
        purpose: "Open this during the event so the room can see photos appear.",
        instruction: template ? template.liveWallCopy : "Open this on a laptop, TV, projector, or iPad during the event so guests can scan the QR code and watch photos appear.",
      },
      {
        key: "recap",
        label: "Recap link",
        url: recapLink,
        purpose: "Share this after the reveal so everyone can view the final album and highlights.",
        instruction: template ? template.recapFraming : "Share this after the event so everyone can view the final album and highlights.",
      },
    ],
    inviteText,
    hostInstructions: template
      ? `Start from the ${template.name} setup, confirm the editable prompts, copy the guest link or QR code, open the Live Wall during the event, then share the Recap afterward.`
      : "Create the event, confirm the photo mode, copy the guest link or QR code, open the Live Wall during the event, then share the Recap afterward.",
    socialCaption,
    modeInstructions: pack.guestInstructions,
    checklist: [
      { key: "create-event", label: "Create event", complete: true },
      { key: "choose-mode", label: "Choose event mode", complete: true },
      { key: "copy-guest-link", label: "Copy guest link or QR code", complete: false },
      { key: "open-live-wall", label: "Open Live Wall", complete: false },
      { key: "share-recap", label: "Share Recap after event", complete: false },
    ],
  };
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

export function createPromptsFromPack(slug?: PromptPackSlug | string | null) {
  const pack = getPromptPack(slug);
  return pack.items.map((text, order) => createPrompt(text, order, `${pack.slug}-prompt-${order + 1}`));
}

export function createCategoriesFromPack(slug?: PromptPackSlug | string | null) {
  const pack = getPromptPack(slug);
  return pack.items.map((label, order) => createCategory(label, order, `${pack.slug}-award-${order + 1}`));
}

export function createDefaultParticipants() {
  return COLOR_HUNT_PALETTE.slice(0, 6).map((color) => ({ ...color, displayName: `${color.colorName} Team` }));
}

export function createEmptyChallengeDraft(): ChallengeDraft {
  return {
    type: "NONE",
    eventTemplateSlug: null,
    promptPackSlug: null,
    participants: createDefaultParticipants(),
    prompts: createStarterPrompts(),
    categories: createDefaultAwardCategories(),
    memoryCapsule: { ...DEFAULT_MEMORY_CAPSULE },
  };
}

export function applyEventTemplateToDraft(templateSlug: EventTemplateSlug | string, draft: ChallengeDraft = createEmptyChallengeDraft()): ChallengeDraft {
  const template = getEventTemplate(templateSlug);
  if (!template) return { ...draft, eventTemplateSlug: null, promptPackSlug: null };
  const promptPack = getPromptPack(template.promptPackSlug);

  return {
    ...draft,
    type: template.recommendedMode,
    eventTemplateSlug: template.slug,
    promptPackSlug: promptPack.slug,
    prompts: promptPack.kind === "prompt" ? createPromptsFromPack(promptPack.slug) : draft.prompts,
    categories: promptPack.kind === "award" ? createCategoriesFromPack(promptPack.slug) : draft.categories,
    memoryCapsule:
      template.recommendedMode === CHALLENGE_TYPES.MEMORY_CAPSULE
        ? {
            revealTitle: `${template.name} album unlocks soon`,
            revealNote: template.recapFraming,
          }
        : draft.memoryCapsule,
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
    eventTemplateSlug: null,
    promptPackSlug: null,
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
      config: { palette: COLOR_HUNT_PALETTE.map(({ colorName, colorHex, colorSlug }) => ({ colorName, colorHex, colorSlug })), promptPackSlug: draft.promptPackSlug, eventTemplateSlug: draft.eventTemplateSlug },
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
      config: { prompts, promptPackSlug: draft.promptPackSlug, eventTemplateSlug: draft.eventTemplateSlug },
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
      config: { categories, promptPackSlug: draft.promptPackSlug, eventTemplateSlug: draft.eventTemplateSlug },
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
      promptPackSlug: draft.promptPackSlug,
      eventTemplateSlug: draft.eventTemplateSlug,
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

function countUniqueContributors(photos: Photo[]) {
  const contributors = new Set<string>();
  photos.forEach((photo) => {
    const value = photo.guestNickname || photo.challengeParticipantName;
    if (value?.trim()) contributors.add(value.trim().toLowerCase());
  });
  return contributors.size;
}

function byCreatedAtDesc(a: Pick<Photo, "createdAt">, b: Pick<Photo, "createdAt">) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function buildChallengeProgressSummary(challenge: EventChallenge | null | undefined, photos: Photo[]): ChallengeProgressSummary {
  const mode = challenge?.type || "NONE";
  const pack = getChallengePack(mode);
  const totalPhotos = photos.length;

  if (!challenge) {
    return {
      mode: "NONE",
      modeLabel: pack.name,
      instructions: pack.guestInstructions,
      totalPhotos,
      rows: [],
    };
  }

  if (challenge.type === CHALLENGE_TYPES.COLOR_HUNT) {
    const rows = challenge.participants.map((participant) => {
      const count = photos.filter((photo) => {
        if (participant.id && photo.challengeParticipantId === participant.id) return true;
        return Boolean(participant.colorSlug && photo.challengeColorSlug === participant.colorSlug);
      }).length;
      return {
        id: participant.id || participant.colorSlug,
        label: participant.displayName || participant.colorName,
        count,
        kind: "color" as const,
        colorName: participant.colorName,
        colorHex: participant.colorHex,
        colorSlug: participant.colorSlug,
        complete: count > 0,
      };
    });
    return { mode: challenge.type, modeLabel: pack.name, instructions: challenge.instructions || pack.guestInstructions, totalPhotos, rows };
  }

  if (challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    const prompts = promptsFromChallenge(challenge);
    const rows = prompts.map((prompt) => {
      const count = photos.filter((photo) => photo.challengePromptId === prompt.id || photo.challengeItemId === prompt.id).length;
      return {
        id: prompt.id || `prompt-${prompt.order}`,
        label: prompt.text,
        count,
        total: 1,
        kind: "prompt" as const,
        complete: count > 0,
      };
    });
    return { mode: challenge.type, modeLabel: pack.name, instructions: challenge.instructions || pack.guestInstructions, totalPhotos, rows };
  }

  if (challenge.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    const categories = categoriesFromChallenge(challenge);
    const rows = categories.map((category) => {
      const count = photos.filter((photo) => photo.challengeItemId === category.id).length;
      return {
        id: category.id || `award-${category.order}`,
        label: category.label,
        count,
        kind: "award" as const,
        complete: count > 0,
      };
    });
    return { mode: challenge.type, modeLabel: pack.name, instructions: challenge.instructions || pack.guestInstructions, totalPhotos, rows };
  }

  return {
    mode: challenge.type,
    modeLabel: pack.name,
    instructions: challenge.instructions || pack.guestInstructions,
    totalPhotos,
    rows: [],
  };
}

export function buildEventRecapMetadata(event: Pick<EventSummary | PublicEvent, "challenge" | "eventTemplateSlug">, photos: Photo[]): EventRecapMetadata {
  const sortedPhotos = sortPhotosForRecap(visiblePhotos(photos));
  const template = getEventTemplate(event.eventTemplateSlug);
  return {
    modeLabel: challengeLabel(event.challenge),
    templateName: template?.name,
    recapTitle: template ? `${template.name} recap` : "Event recap",
    recapSubtitle: template?.recapFraming || "A shared album from the people who were there.",
    totalPhotos: sortedPhotos.length,
    contributorCount: countUniqueContributors(sortedPhotos),
    highlightPhotos: sortedPhotos.slice(0, 5),
    recentPhotos: sortedPhotos.slice(0, 8),
  };
}
