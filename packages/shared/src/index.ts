export type ISODateString = string;

export const CHALLENGE_TYPES = {
  COLOR_HUNT: "COLOR_HUNT",
  PHOTO_SCAVENGER_HUNT: "PHOTO_SCAVENGER_HUNT",
  EVENT_AWARDS: "EVENT_AWARDS",
  MEMORY_CAPSULE: "MEMORY_CAPSULE",
} as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[keyof typeof CHALLENGE_TYPES];
export type ChallengeMode = "NONE" | ChallengeType;
export type LiveWallMode = "grid" | "slideshow" | "join" | "challenge" | "awards";
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
export const ANONYMOUS_GUEST_DISPLAY_NAME = "Anonymous guest";
export const MAX_GUEST_DISPLAY_NAME_LENGTH = 40;

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "unsupported_type" | "too_large"; message: string };

export type HostFeedbackRating = "great" | "okay" | "rough";
export type HostFeedbackRepeatIntent = "yes" | "maybe" | "no";

export type EventLifecycleStatus =
  | "draft_or_upcoming"
  | "live_or_happening_soon"
  | "collecting_photos"
  | "reveal_locked"
  | "recap_ready"
  | "archived_or_past";

export type EventLifecycle = {
  status: EventLifecycleStatus;
  label: string;
  description: string;
  phase: "before" | "during" | "after";
  tone: "stone" | "green" | "amber" | "plum";
  shouldShowRepeatCta: boolean;
  shouldAskFeedback: boolean;
};

export type User = {
  id: string;
  email: string;
  isFounder?: boolean;
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

export type LiveWallDisplayLink = {
  key: LiveWallMode;
  label: string;
  url: string;
  purpose: string;
  instruction: string;
  analyticsName: AnalyticsEventName;
};

export type LiveWallChallengeDisplaySummary = ChallengeProgressSummary & {
  headline: string;
  note: string;
  leaders: {
    categoryId: string;
    categoryLabel: string;
    leaderPhotoId?: string;
    voteCount: number;
    isTie: boolean;
    status: string;
  }[];
};

export type GuestChallengeProgress = ChallengeProgressSummary & {
  headline: string;
  note: string;
  selectedLabel?: string;
};

export type GuestUploadLocalMetadata = {
  photoId: string;
  uploadedAt: ISODateString;
  guestDisplayName: string;
  challengeLabel?: string;
};

export type GuestUploadSuccessSummary = {
  title: string;
  guestDisplayName: string;
  challengeLabel: string;
  detail: string;
  remainingUploads: number;
  revealNote?: string;
};

export type ContributorSummaryItem = {
  displayName: string;
  photoCount: number;
};

export type ContributorSummary = {
  contributorCount: number;
  totalPhotos: number;
  topContributors: ContributorSummaryItem[];
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

export type EventRecapHighlightKind = "featured" | "award_winner" | "voted" | "challenge" | "recent";

export type EventRecapHighlight = {
  key: string;
  title: string;
  description: string;
  kind: EventRecapHighlightKind;
  photos: Photo[];
};

export type EventRecapChallengeMoment = {
  key: string;
  title: string;
  description: string;
  count: number;
  total?: number;
  colorHex?: string;
  photos: Photo[];
  isComplete?: boolean;
  voteCount?: number;
  isTie?: boolean;
};

export type EventRecapAlbumFilter = {
  key: string;
  label: string;
  count: number;
  photoIds: string[];
};

export type EventRecapStory = EventRecapMetadata & {
  heroCopy: string;
  lockedTitle: string;
  lockedCopy: string;
  emptyTitle: string;
  emptyCopy: string;
  highlightReel: EventRecapHighlight[];
  challengeHeadline: string;
  challengeCopy: string;
  challengeMoments: EventRecapChallengeMoment[];
  contributorSummary: ContributorSummary;
  albumFilters: EventRecapAlbumFilter[];
  createEventCtaTitle: string;
  createEventCtaCopy: string;
};

type EventRecapSourceEvent = Pick<EventSummary | PublicEvent, "challenge" | "eventTemplateSlug" | "revealAt"> & {
  isRevealed?: boolean;
};

export type UploadTrendBucket = {
  label: string;
  count: number;
};

export type AwardWinnerSummary = {
  categoryId: string;
  categoryLabel: string;
  photoId?: string;
  voteCount: number;
  isTie: boolean;
};

export type PostEventHostSummary = {
  totalPhotos: number;
  visiblePhotos: number;
  hiddenPhotos: number;
  reportedPhotos: number;
  featuredPhotos: number;
  totalContributors: number;
  topContributors: ContributorSummaryItem[];
  guestJoins: number;
  liveWallOpens: number;
  recapOpens: number;
  uploadsOverTime: UploadTrendBucket[];
  challengeCompletion: ChallengeProgressSummary;
  awardWinners: AwardWinnerSummary[];
};

export type HostLaunchKitLink = {
  key: "guest" | "live-wall" | "recap" | `live-wall-${LiveWallMode}`;
  label: string;
  url: string;
  purpose: string;
  instruction: string;
};

export type HostShareLinkTiming = "Before event" | "During event" | "After reveal";

export type HostShareLinkAudience = "Guests" | "Host display" | "Everyone";

export type HostShareLinkCard = HostLaunchKitLink & {
  audience: HostShareLinkAudience;
  timing: HostShareLinkTiming;
  copyText: string;
  shareText: string;
  copyAnalyticsName: AnalyticsEventName;
  shareAnalyticsName: AnalyticsEventName;
};

export type HostInvitePoster = {
  title: string;
  instruction: string;
  guestLink: string;
  posterPath: string;
  modeBadge: string;
  templateBadge?: string;
  challengeInstruction?: string;
  modeHint: string;
  noDownloadCopy: string;
  brandLine: string;
  inviteText: string;
};

export type HostShareAssets = {
  eventName: string;
  modeLabel: string;
  templateName?: string;
  poster: HostInvitePoster;
  links: HostShareLinkCard[];
  liveWallDisplayLinks: LiveWallDisplayLink[];
  inviteText: string;
  guestInviteMessage: string;
  recapMessage: string;
  liveWallSetupTip: string;
  qrPosterHint: string;
  socialPostCopy: string;
  liveWallDisplayPrompt: string;
  recapShareText: string;
  winnerShareText: string;
  memoryCapsuleRevealCopy?: string;
  emptyRecapCopy: string;
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
  liveWallDisplayLinks: LiveWallDisplayLink[];
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
  "live_wall_upload_link_clicked",
  "live_wall_challenge_display_opened",
  "live_wall_awards_leaders_viewed",
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
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsSource = "web" | "mobile" | "api";
export type HostFeedbackKind = "post_event" | "beta_issue";
export type HostIssueArea = "guest_upload" | "live_wall" | "recap" | "qr_poster" | "moderation" | "analytics" | "other";

export type AwardVoteTotal = {
  photoId: string;
  voteCount: number;
};

export type AwardCategoryVotingSummary = {
  categoryId: string;
  categoryLabel: string;
  submissionCount: number;
  totalVotes: number;
  voteTotals: AwardVoteTotal[];
  leaderPhotoIds: string[];
  isTie: boolean;
  noSubmissions: boolean;
  noVotes: boolean;
  myVotePhotoId?: string;
};

export type AwardVotingSummary = {
  votingEnabled: boolean;
  categories: AwardCategoryVotingSummary[];
};

export type AnalyticsEventInput = {
  name: AnalyticsEventName;
  source: AnalyticsSource;
  path?: string;
  eventId?: string;
  eventSlug?: string;
  anonymousId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type HostFeedbackInput = {
  kind?: HostFeedbackKind | string | null;
  issueArea?: HostIssueArea | string | null;
  outcome?: HostFeedbackRating | string | null;
  repeatIntent?: HostFeedbackRepeatIntent | string | null;
  guestConfusion?: string | null;
  featureRequest?: string | null;
  note?: string | null;
  skipped?: boolean;
};

export type HostFeedbackValidationResult =
  | { ok: true; value: Required<Pick<HostFeedbackInput, "skipped">> & { kind: HostFeedbackKind; issueArea: HostIssueArea | null; outcome: HostFeedbackRating | null; repeatIntent: HostFeedbackRepeatIntent | null; guestConfusion: string | null; featureRequest: string | null; note: string | null } }
  | { ok: false; message: string };

export const BETA_METRIC_DEFINITIONS = {
  activeHost: "A signed-in host who opens the host dashboard in the last 30 days.",
  guestJoin: "A guest upload route visit that records guest_joined_event for an event.",
  photoUpload: "A successfully stored event photo that has not been deleted.",
  liveWallOpen: "A Live Wall route visit that records live_wall_opened for an event.",
  recapOpen: "A Recap route visit that records recap_opened for an event.",
} as const;

export type BetaMetricKey = keyof typeof BETA_METRIC_DEFINITIONS;

export type FounderOverviewMetrics = {
  totalHosts: number;
  activeHostsLast30Days: number;
  totalEvents: number;
  eventsCreatedLast7Days: number;
  eventsCreatedLast30Days: number;
  totalGuestJoins: number;
  totalUploads: number;
  uploadsLast7Days: number;
  totalContributors: number;
  totalRecapOpens: number;
  totalLiveWallOpens: number;
  totalFeedbackSubmissions: number;
  totalReportedPhotos: number;
  hiddenPhotoCount: number;
};

export type FounderFunnelMetrics = {
  hosts: number;
  events: number;
  guestJoins: number;
  uploads: number;
  liveWallOpens: number;
  recapOpens: number;
  feedbackSubmissions: number;
};

export type FounderEventSummary = {
  id: string;
  name: string;
  slug: string;
  hostEmail?: string | null;
  isOwnEvent: boolean;
  eventDate: ISODateString;
  revealAt: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  eventTemplateSlug?: string | null;
  promptPackSlug?: string | null;
  mode: ChallengeMode | ChallengeType | string;
  modeLabel: string;
  photoCount: number;
  guestCount: number;
  reportCount: number;
  eventLink: string;
  liveWallLink: string;
  recapLink: string;
  hostEventPath?: string | null;
};

export type FounderUploadSummary = {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  guestNickname?: string | null;
  createdAt: ISODateString;
  visibilityStatus?: PhotoVisibilityStatus;
  challengeItemLabel?: string | null;
  previewUrl?: string | null;
  eventLink?: string | null;
  liveWallLink?: string | null;
  recapLink?: string | null;
};

export type FounderFeedbackSummary = {
  id: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  hostEmail?: string | null;
  isOwnEvent: boolean;
  hostEventPath?: string | null;
  kind?: HostFeedbackKind | string | null;
  issueArea?: HostIssueArea | string | null;
  outcome?: string | null;
  repeatIntent?: string | null;
  guestConfusion?: string | null;
  featureRequest?: string | null;
  note?: string | null;
  skippedAt?: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type FounderReportedPhotoSummary = {
  id: string;
  photoId: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  hostEmail?: string | null;
  isOwnEvent: boolean;
  hostEventPath?: string | null;
  reason: string;
  note?: string | null;
  createdAt: ISODateString;
  reviewedAt?: ISODateString | null;
  dismissedAt?: ISODateString | null;
  reportCount: number;
  visibilityStatus: PhotoVisibilityStatus;
  hiddenReason?: string | null;
  previewUrl?: string | null;
  eventLink?: string | null;
  liveWallLink?: string | null;
  recapLink?: string | null;
};

export type FounderUsageRow = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export type FounderUsageInsights = {
  eventModes: FounderUsageRow[];
  eventTemplates: FounderUsageRow[];
  promptPacks: FounderUsageRow[];
  eventAwardsVotes: number;
  colorHuntEvents: number;
  memoryCapsuleEvents: number;
};

export type FounderActivityItem = {
  id: string;
  type: string;
  label: string;
  eventId?: string | null;
  eventName: string;
  eventSlug?: string | null;
  createdAt: ISODateString;
};

export type FounderOverview = {
  generatedAt: ISODateString;
  overview: FounderOverviewMetrics;
  funnel: FounderFunnelMetrics;
  recentEvents: FounderEventSummary[];
  activeEvents: FounderEventSummary[];
  recentUploads: FounderUploadSummary[];
  recentFeedback: FounderFeedbackSummary[];
  recentBetaIssues: FounderFeedbackSummary[];
  reportedPhotos: FounderReportedPhotoSummary[];
  usage: FounderUsageInsights;
  activity: FounderActivityItem[];
  metricDefinitions: Record<string, string>;
};

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

function parseBooleanConfigFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

export function isAwardVotingEnabled(challenge?: Pick<EventChallenge, "type" | "config"> | null) {
  if (!challenge || challenge.type !== CHALLENGE_TYPES.EVENT_AWARDS) return false;
  const config = challenge.config && typeof challenge.config === "object" ? challenge.config : {};
  const override = parseBooleanConfigFlag(config.votingEnabled);
  return override === null ? true : override;
}

export function buildAwardVotingSummary({
  challenge,
  photos,
  votes,
  myVotesByCategory,
}: {
  challenge?: Pick<EventChallenge, "type" | "config"> | null;
  photos: Pick<Photo, "id" | "challengeItemId">[];
  votes: Array<{ photoId: string; challengeItemId: string }>;
  myVotesByCategory?: Record<string, string>;
}) {
  const challengeType = challenge?.type || "NONE";
  const votingEnabled = isAwardVotingEnabled(challenge);
  if (challengeType !== CHALLENGE_TYPES.EVENT_AWARDS) {
    return { votingEnabled: false, categories: [] } as AwardVotingSummary;
  }

  const categories = categoriesFromChallenge(challenge);
  const votesByCategory = new Map<string, Map<string, number>>();
  for (const vote of votes) {
    if (!vote.challengeItemId || !vote.photoId) continue;
    const categoryVotes = votesByCategory.get(vote.challengeItemId) || new Map<string, number>();
    categoryVotes.set(vote.photoId, (categoryVotes.get(vote.photoId) || 0) + 1);
    votesByCategory.set(vote.challengeItemId, categoryVotes);
  }

  const photoIdsByCategory = new Map<string, Set<string>>();
  for (const photo of photos) {
    if (!photo.challengeItemId) continue;
    const set = photoIdsByCategory.get(photo.challengeItemId) || new Set<string>();
    set.add(photo.id);
    photoIdsByCategory.set(photo.challengeItemId, set);
  }

  const summary: AwardVotingSummary = {
    votingEnabled,
    categories: categories.map((category) => {
      const categoryId = category.id || `award-${category.order}`;
      const categoryPhotoIds = photoIdsByCategory.get(categoryId) || new Set<string>();
      const categoryTotals = votesByCategory.get(categoryId) || new Map<string, number>();
      const voteTotals = Array.from(categoryTotals.entries())
        .filter(([photoId]) => categoryPhotoIds.has(photoId))
        .map(([photoId, voteCount]) => ({ photoId, voteCount }))
        .sort((a, b) => b.voteCount - a.voteCount || a.photoId.localeCompare(b.photoId));
      const totalVotes = voteTotals.reduce((sum, item) => sum + item.voteCount, 0);
      const topVoteCount = voteTotals[0]?.voteCount || 0;
      const leaderPhotoIds = voteTotals.filter((item) => item.voteCount === topVoteCount && topVoteCount > 0).map((item) => item.photoId);
      return {
        categoryId,
        categoryLabel: category.label,
        submissionCount: categoryPhotoIds.size,
        totalVotes,
        voteTotals,
        leaderPhotoIds,
        isTie: leaderPhotoIds.length > 1,
        noSubmissions: categoryPhotoIds.size === 0,
        noVotes: voteTotals.length === 0,
        myVotePhotoId: myVotesByCategory?.[categoryId],
      };
    }),
  };

  return summary;
}

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

export const EVENT_SETTINGS_LIMITS = {
  nameMaxLength: 120,
  descriptionMaxLength: 1000,
  photoLimitMin: 1,
  photoLimitMax: 100,
} as const;

export type UpdateEventSettingsInput = {
  name: string;
  description?: string | null;
  eventDate: ISODateString;
  revealAt: ISODateString;
  photoLimitPerGuest: number;
};

export type EventSettingsFieldErrors = Partial<Record<keyof UpdateEventSettingsInput, string>>;

export type EventSettingsValidationResult =
  | { ok: true; value: UpdateEventSettingsInput }
  | { ok: false; error: string; fieldErrors: EventSettingsFieldErrors };

function parseEventSettingsDate(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateEventSettingsInput(input: Partial<UpdateEventSettingsInput> = {}): EventSettingsValidationResult {
  const fieldErrors: EventSettingsFieldErrors = {};
  const name = String(input.name ?? "").trim();
  const description = input.description == null ? "" : String(input.description).trim();
  const eventDate = parseEventSettingsDate(input.eventDate);
  const revealAt = parseEventSettingsDate(input.revealAt);
  const photoLimitPerGuest = Number(input.photoLimitPerGuest);

  if (!name) {
    fieldErrors.name = "Event name is required.";
  } else if (name.length > EVENT_SETTINGS_LIMITS.nameMaxLength) {
    fieldErrors.name = `Event name must be ${EVENT_SETTINGS_LIMITS.nameMaxLength} characters or fewer.`;
  }

  if (description.length > EVENT_SETTINGS_LIMITS.descriptionMaxLength) {
    fieldErrors.description = `Description must be ${EVENT_SETTINGS_LIMITS.descriptionMaxLength} characters or fewer.`;
  }

  if (!eventDate) {
    fieldErrors.eventDate = "Enter a valid event date.";
  }

  if (!revealAt) {
    fieldErrors.revealAt = "Enter a valid reveal time.";
  }

  if (!Number.isInteger(photoLimitPerGuest)) {
    fieldErrors.photoLimitPerGuest = "Photo limit must be a whole number.";
  } else if (photoLimitPerGuest < EVENT_SETTINGS_LIMITS.photoLimitMin || photoLimitPerGuest > EVENT_SETTINGS_LIMITS.photoLimitMax) {
    fieldErrors.photoLimitPerGuest = `Photo limit must be between ${EVENT_SETTINGS_LIMITS.photoLimitMin} and ${EVENT_SETTINGS_LIMITS.photoLimitMax}.`;
  }

  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Check the highlighted event settings.", fieldErrors };
  }

  const validEventDate = eventDate as Date;
  const validRevealAt = revealAt as Date;

  return {
    ok: true,
    value: {
      name,
      description: description || null,
      eventDate: validEventDate.toISOString(),
      revealAt: validRevealAt.toISOString(),
      photoLimitPerGuest,
    },
  };
}

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
    inviteCopy: "Share your favorite candid photos from the celebration. No account needed:",
    liveWallCopy: "Open the Photo Wall during the reception so guests can watch the celebration build.",
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
    liveWallCopy: "Use the Photo Wall to make the event feel active and shared.",
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
    liveWallCopy: "Use the Photo Wall between sessions to show the retreat taking shape.",
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
    shortDescription: "Start simple, then adjust prompts and copy if this event needs a specific vibe.",
    bestFor: "Anything that does not fit a preset or needs a host-specific vibe.",
    recommendedMode: "NONE",
    promptPackSlug: "custom",
    revealTiming: "Choose the reveal timing that fits the event.",
    suggestedUploadLimit: 10,
    inviteCopy: "Upload your favorite photos from the event here:",
    liveWallCopy: "Open the Photo Wall while guests upload photos.",
    recapFraming: "A shared recap from the people who were there.",
    icon: "auto_awesome",
    badge: "Fully editable",
  },
];

export const HOST_VISIBLE_TEMPLATE_SLUGS: EventTemplateSlug[] = [
  "birthday-party",
  "wedding-engagement",
  "greek-life-event",
  "graduation-party",
  "student-org-event",
  "open-custom-event",
];

export function getHostVisibleEventTemplates() {
  return HOST_VISIBLE_TEMPLATE_SLUGS.map((slug) => getEventTemplate(slug)).filter((template): template is EventTemplateDefinition => Boolean(template));
}

export const CHALLENGE_PACKS: ChallengePackDefinition[] = [
  {
    mode: "NONE",
    type: null,
    slug: "no-challenge",
    name: "Simple Album",
    shortDescription: "The easiest way to collect everyone's photos.",
    bestFor: "Hangouts, pregames, birthdays, club events, and anything where speed matters most.",
    badge: "Easy default",
    icon: "images",
    setupComplexity: "None",
    hostSetupFields: [],
    guestInstructions: "Add photos to the shared album. No extra setup needed.",
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
    name: "Photo Prompts",
    shortDescription: "Give the group a few fun photo ideas.",
    bestFor: "Club events, weekend trips, graduation nights, and groups that want ideas.",
    badge: "Photo ideas",
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
    name: "Awards",
    shortDescription: "Let the group submit photos for fun categories.",
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

export function plainModeLabel(mode?: ChallengeMode | ChallengeType | null) {
  if (mode === CHALLENGE_TYPES.COLOR_HUNT) return "Color Hunt";
  if (mode === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) return "Photo Prompts";
  if (mode === CHALLENGE_TYPES.EVENT_AWARDS) return "Awards";
  if (mode === CHALLENGE_TYPES.MEMORY_CAPSULE) return "Memory Capsule";
  return "Simple Album";
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

export function sanitizeGuestDisplayName(input: unknown) {
  const normalized = String(input || "").replace(/\s+/g, " ").trim();
  if (!normalized) return ANONYMOUS_GUEST_DISPLAY_NAME;
  return normalized.slice(0, MAX_GUEST_DISPLAY_NAME_LENGTH).trim() || ANONYMOUS_GUEST_DISPLAY_NAME;
}

export function isAnonymousGuestDisplayName(input: unknown) {
  return sanitizeGuestDisplayName(input).toLowerCase() === ANONYMOUS_GUEST_DISPLAY_NAME.toLowerCase();
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

function buildPosterPath(event: Pick<EventSummary | PublicEvent, "id">) {
  return `/dashboard/events/${encodeURIComponent(event.id)}/poster`;
}

function eventLinkOrFallback(value: string | undefined | null) {
  return value || "";
}

function buildPosterModeHint(challenge: Pick<EventChallenge, "type"> | null | undefined) {
  if (challenge?.type === CHALLENGE_TYPES.COLOR_HUNT) return "Color Hunt: Find your color and upload your best photo.";
  if (challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) return "Photo Prompts: Pick a prompt and add a matching photo.";
  if (challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) return "Awards: Submit photos for the fun categories.";
  if (challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE) return "Memory Capsule: Add photos now. Everyone sees them after the reveal.";
  return "Simple Album: Add any photos you want the host to have.";
}

export const LIVE_WALL_MODES = ["grid", "slideshow", "join", "challenge", "awards"] as const satisfies readonly LiveWallMode[];

export const LIVE_WALL_MODE_LABELS: Record<LiveWallMode, string> = {
  grid: "Photo Wall",
  slideshow: "Slideshow",
  join: "Join screen",
  challenge: "Prompts",
  awards: "Awards",
};

export function getLiveWallModeLabel(mode: LiveWallMode) {
  return LIVE_WALL_MODE_LABELS[mode];
}

export function parseLiveWallMode(value: unknown): LiveWallMode {
  const normalized = String(value || "").trim().toLowerCase();
  return (LIVE_WALL_MODES as readonly string[]).includes(normalized) ? (normalized as LiveWallMode) : "grid";
}

export function buildLiveWallUrl(baseUrl: string | undefined | null, mode?: LiveWallMode | string | null) {
  const url = eventLinkOrFallback(baseUrl);
  const parsedMode = parseLiveWallMode(mode);
  if (!url || parsedMode === "grid") return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}mode=${encodeURIComponent(parsedMode)}`;
}

export function buildLiveWallDisplayLinks(
  event: Pick<EventSummary, "liveWallLink" | "challenge">,
): LiveWallDisplayLink[] {
  const liveWallLink = eventLinkOrFallback(event.liveWallLink);
  const links: LiveWallDisplayLink[] = [
    {
      key: "grid",
      label: getLiveWallModeLabel("grid"),
      url: buildLiveWallUrl(liveWallLink, "grid"),
      purpose: "Use this during the event so guests know where to add photos and can see pictures appear live.",
      instruction: "Open this on a TV or projector while guests upload.",
      analyticsName: "live_wall_mode_viewed",
    },
    {
      key: "join",
      label: getLiveWallModeLabel("join"),
      url: buildLiveWallUrl(liveWallLink, "join"),
      purpose: "Use this at the start of the event so guests know exactly how to upload.",
      instruction: "Put this on screen while guests arrive or whenever uploads slow down.",
      analyticsName: "live_wall_qr_display_opened",
    },
    {
      key: "slideshow",
      label: getLiveWallModeLabel("slideshow"),
      url: buildLiveWallUrl(liveWallLink, "slideshow"),
      purpose: "Use this once photos are flowing and the room wants a showpiece moment.",
      instruction: "Rotate through visible photos with event branding and safe metadata.",
      analyticsName: "live_wall_mode_viewed",
    },
  ];

  if (event.challenge) {
    links.push({
      key: "challenge",
      label: getLiveWallModeLabel("challenge"),
      url: buildLiveWallUrl(liveWallLink, "challenge"),
      purpose: "Use this to show prompt progress, Color Hunt context, or reveal messaging.",
      instruction: "Switch here when you want guests to know what to capture next.",
      analyticsName: "live_wall_challenge_display_opened",
    });
  }

  if (event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    links.push({
      key: "awards",
      label: getLiveWallModeLabel("awards"),
      url: buildLiveWallUrl(liveWallLink, "awards"),
      purpose: "Use this to celebrate Awards leaders and winners.",
      instruction: "Open this after guests have submitted and voted on award categories.",
      analyticsName: "live_wall_awards_leaders_viewed",
    });
  }

  return links;
}

export function buildHostShareAssets(
  event: Pick<EventSummary, "id" | "name" | "eventLink" | "liveWallLink" | "recapLink" | "challenge" | "eventTemplateSlug">,
): HostShareAssets {
  const pack = getChallengePack(event.challenge?.type || "NONE");
  const template = getEventTemplate(event.eventTemplateSlug);
  const guestLink = eventLinkOrFallback(event.eventLink);
  const liveWallLink = eventLinkOrFallback(event.liveWallLink);
  const recapLink = eventLinkOrFallback(event.recapLink);
  const liveWallDisplayLinks = buildLiveWallDisplayLinks(event);
  const challengeInstruction = event.challenge?.instructions || pack.guestInstructions;
  const guestInviteMessage = `Add your photos here: ${guestLink}\nNo account needed.`;
  const inviteText = template ? `${template.inviteCopy} ${guestLink}` : guestInviteMessage;
  const socialPostCopy = template ? `${template.recapFraming} Add yours: ${guestLink}` : `Drop your favorite photos from ${event.name} here: ${guestLink}`;
  const recapMessage = `Here are the photos from ${event.name}: ${recapLink}`;
  const recapShareText = template ? `${template.recapFraming} Photos are in one place here: ${recapLink}` : recapMessage;
  const liveWallSetupTip = "Open the Photo Wall during the event so people can scan the QR code and watch photos appear. For small hangouts, you can also just share the guest link.";
  const qrPosterHint = "Print this or show it on a phone so guests can scan to add photos.";
  const winnerShareText =
    event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS
      ? `The Awards from ${event.name} are ready. View the Shared Recap: ${recapLink}`
      : recapShareText;
  const memoryCapsuleRevealCopy =
    event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE
      ? `${memoryCapsuleFromChallenge(event.challenge).revealNote} Share the recap when the reveal opens: ${recapLink}`
      : undefined;

  const links: HostShareLinkCard[] = [
    {
      key: "guest",
      label: "Guest link",
      url: guestLink,
      purpose: "Send this to guests so they can add photos without an account or app download.",
      instruction: inviteText,
      audience: "Guests",
      timing: "Before event",
      copyText: inviteText,
      shareText: inviteText,
      copyAnalyticsName: "guest_link_copied",
      shareAnalyticsName: "guest_link_shared",
    },
    {
      key: "live-wall",
      label: "Photo Wall link",
      url: liveWallLink,
      purpose: "Use this during the event so guests know where to add photos and can see pictures appear live.",
      instruction: template ? template.liveWallCopy : "Open this on a TV, laptop, or iPad during the event.",
      audience: "Host display",
      timing: "During event",
      copyText: liveWallLink,
      shareText: `Open the ${event.name} Photo Wall during the event: ${liveWallLink}`,
      copyAnalyticsName: "live_wall_link_copied",
      shareAnalyticsName: "live_wall_link_shared",
    },
    {
      key: "recap",
      label: "Shared Recap link",
      url: recapLink,
      purpose: "Share this after the event so everyone can see the photos in one place.",
      instruction: template ? `${template.recapFraming} Send this after the event.` : "Share this after the event so everyone can see the photos in one place.",
      audience: "Everyone",
      timing: "After reveal",
      copyText: recapShareText,
      shareText: recapShareText,
      copyAnalyticsName: "recap_link_copied",
      shareAnalyticsName: "recap_link_shared",
    },
  ];

  return {
    eventName: event.name,
    modeLabel: pack.name,
    templateName: template?.name,
    poster: {
      title: event.name,
      instruction: "Scan to add photos",
      guestLink,
      posterPath: buildPosterPath(event),
      modeBadge: pack.name,
      templateBadge: template?.name,
      challengeInstruction,
      modeHint: buildPosterModeHint(event.challenge),
      noDownloadCopy: "No account needed.",
      brandLine: "EventFilm",
      inviteText: guestInviteMessage,
    },
    links,
    liveWallDisplayLinks,
    inviteText,
    guestInviteMessage,
    recapMessage,
    liveWallSetupTip,
    qrPosterHint,
    socialPostCopy,
    liveWallDisplayPrompt: template ? template.liveWallCopy : "Open the Photo Wall while guests upload photos.",
    recapShareText,
    winnerShareText,
    memoryCapsuleRevealCopy,
    emptyRecapCopy: "No photos yet. Share the guest link so people can add theirs.",
  };
}

export function buildHostLaunchKit(event: Pick<EventSummary, "name" | "eventLink" | "liveWallLink" | "recapLink" | "challenge" | "eventTemplateSlug">): HostLaunchKit {
  const pack = getChallengePack(event.challenge?.type || "NONE");
  const template = getEventTemplate(event.eventTemplateSlug);
  const guestLink = event.eventLink;
  const liveWallLink = event.liveWallLink || "";
  const recapLink = event.recapLink || "";
  const liveWallDisplayLinks = buildLiveWallDisplayLinks(event);
  const inviteText = template ? `${template.inviteCopy} ${guestLink}` : "Upload your photos from tonight here: " + guestLink + ". No account needed.";
  const socialCaption = template ? `${template.recapFraming} Add yours: ${guestLink}` : "Drop your favorite photos from " + event.name + " here: " + guestLink;

  return {
    eventName: event.name,
    modeLabel: pack.name,
    links: [
      {
        key: "guest",
        label: "Guest link",
        url: guestLink,
        purpose: "Share this with guests so they can upload photos without an account or app download.",
        instruction: inviteText,
      },
      {
        key: "live-wall",
        label: "Photo Wall link",
        url: liveWallLink,
        purpose: "Open this during the event so the room can see photos appear.",
        instruction: template ? template.liveWallCopy : "Open this on a laptop, TV, projector, or iPad during the event so guests can scan the QR code and watch photos appear.",
      },
      {
        key: "recap",
        label: "Shared Recap link",
        url: recapLink,
        purpose: "Share this after the reveal so everyone can view the finished memory page.",
        instruction: template ? `${template.recapFraming} Send this as the finished memory page after reveal.` : "Share this after the event as the finished memory page with highlights, contributors, challenge moments, and the full album.",
      },
    ],
    inviteText,
    hostInstructions: template
      ? `Start from the ${template.name} setup, confirm the editable prompts, copy the guest link or QR code, open the Photo Wall during the event, then share the Shared Recap afterward.`
      : "Create the event, copy the guest link or QR code, open the Photo Wall during the event, then share the Shared Recap afterward.",
    socialCaption,
    modeInstructions: pack.guestInstructions,
    liveWallDisplayLinks,
    checklist: [
      { key: "create-event", label: "Create event", complete: true },
      { key: "choose-mode", label: "Choose photo setup", complete: true },
      { key: "copy-guest-link", label: "Copy guest link or QR code", complete: false },
      { key: "open-live-wall", label: "Open Photo Wall", complete: false },
      { key: "share-recap", label: "Share Shared Recap after event", complete: false },
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
    if (draft.prompts.length < 3) return "Add at least 3 prompts to start Photo Prompts.";
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

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function deriveEventLifecycleStatus(
  event: Pick<EventSummary | PublicEvent, "eventDate" | "revealAt" | "photoCount" | "challenge">,
  counts: { totalPhotos?: number | null; visiblePhotos?: number | null; recapOpens?: number | null } = {},
  now: Date = new Date(),
): EventLifecycle {
  const eventAt = new Date(event.eventDate);
  const revealAt = new Date(event.revealAt);
  const totalPhotos = counts.totalPhotos ?? event.photoCount ?? 0;
  const visibleCount = counts.visiblePhotos ?? totalPhotos;
  const isRevealLocked = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && revealAt.getTime() > now.getTime();
  const happeningSoonAt = addHours(now, 24);
  const archiveCutoff = addDays(revealAt, 14);

  if (revealAt.getTime() <= now.getTime() && archiveCutoff.getTime() < now.getTime()) {
    return {
      status: "archived_or_past",
      label: "Past event",
      description: "Your recap is ready to share again.",
      phase: "after",
      tone: "stone",
      shouldShowRepeatCta: true,
      shouldAskFeedback: false,
    };
  }

  if (revealAt.getTime() <= now.getTime()) {
    return {
      status: "recap_ready",
      label: "Recap ready",
      description: visibleCount > 0 ? "The event story is ready to share and review." : "The recap is open, but the album still needs photos.",
      phase: "after",
      tone: "plum",
      shouldShowRepeatCta: true,
      shouldAskFeedback: true,
    };
  }

  if (isRevealLocked && totalPhotos > 0) {
    return {
      status: "reveal_locked",
      label: "Reveal time",
      description: "Photos are coming in, and the public album opens at reveal time.",
      phase: "during",
      tone: "amber",
      shouldShowRepeatCta: false,
      shouldAskFeedback: false,
    };
  }

  if (totalPhotos > 0) {
    return {
      status: "collecting_photos",
      label: "Collecting photos",
      description: "Guests have started uploading. Keep the Photo Wall and photo review close.",
      phase: "during",
      tone: "green",
      shouldShowRepeatCta: false,
      shouldAskFeedback: false,
    };
  }

  if (eventAt.getTime() <= happeningSoonAt.getTime()) {
    return {
      status: "live_or_happening_soon",
      label: eventAt.getTime() <= now.getTime() ? "Happening now" : "Happening soon",
      description: "Share the guest link, keep the QR handy, and open the Photo Wall when guests arrive.",
      phase: "during",
      tone: "green",
      shouldShowRepeatCta: false,
      shouldAskFeedback: false,
    };
  }

  return {
    status: "draft_or_upcoming",
    label: "Upcoming",
    description: "Share the guest link before people arrive.",
    phase: "before",
    tone: "stone",
    shouldShowRepeatCta: false,
    shouldAskFeedback: false,
  };
}

export function buildHostNextStep(
  event: Pick<EventSummary | PublicEvent, "eventDate" | "revealAt" | "photoCount" | "challenge">,
  counts: { totalPhotos?: number | null; visiblePhotos?: number | null; recapOpens?: number | null } = {},
  now: Date = new Date(),
) {
  const lifecycle = deriveEventLifecycleStatus(event, counts, now);
  if (lifecycle.status === "draft_or_upcoming") return "Share the guest link before people arrive.";
  if (lifecycle.status === "live_or_happening_soon") return "Share the guest link.";
  if (lifecycle.status === "collecting_photos") return "Open the Photo Wall.";
  if (lifecycle.status === "reveal_locked") return "Keep collecting photos until reveal time.";
  if (lifecycle.status === "recap_ready") return "Share the recap.";
  return "Your recap is ready to share again.";
}

export function buildDuplicateEventInput(event: Pick<EventSummary, "name" | "description" | "photoLimitPerGuest" | "eventTemplateSlug" | "promptPackSlug" | "challenge">, now: Date = new Date()): CreateEventInput {
  const eventDate = addDays(now, 7);
  const revealAt = addHours(eventDate, 4);
  const draft = draftFromChallenge(event.challenge);
  const challenge = buildChallengePayload({
    ...draft,
    eventTemplateSlug: (event.eventTemplateSlug as EventTemplateSlug | null) || draft.eventTemplateSlug,
    promptPackSlug: (event.promptPackSlug as PromptPackSlug | null) || draft.promptPackSlug,
  });

  return {
    name: `${event.name} (Copy)`,
    description: event.description || null,
    eventDate: eventDate.toISOString(),
    revealAt: revealAt.toISOString(),
    photoLimitPerGuest: event.photoLimitPerGuest,
    eventTemplateSlug: event.eventTemplateSlug || null,
    promptPackSlug: event.promptPackSlug || null,
    challenge,
  };
}

function uploadBucketLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function buildUploadTrend(photos: Photo[], limit = 5): UploadTrendBucket[] {
  const buckets = new Map<string, UploadTrendBucket>();
  for (const item of visiblePhotos(photos)) {
    const date = new Date(item.createdAt);
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key) || { label: uploadBucketLabel(date), count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([, bucket]) => bucket);
}

export function buildPostEventHostSummary(
  event: Pick<EventSummary, "challenge">,
  photos: Photo[],
  analytics: {
    guestJoins?: number | null;
    liveWallOpens?: number | null;
    recapOpens?: number | null;
    featuredPhotos?: number | null;
    eventAwardsVoting?: AwardVotingSummary | null;
  } = {},
): PostEventHostSummary {
  const contributorSummary = buildContributorSummary(photos, 5);
  const visible = visiblePhotos(photos);
  const hiddenPhotos = photos.filter((photo) => photo.visibilityStatus === "HIDDEN").length;
  const reportedPhotos = photos.filter((photo) => Boolean(photo.reportCount)).length;
  const featuredPhotos = analytics.featuredPhotos ?? photos.filter((photo) => Boolean(photo.isFeatured)).length;
  const winners = (analytics.eventAwardsVoting?.categories || []).map((category) => {
    const leaderPhotoId = category.leaderPhotoIds[0];
    const leaderVotes = leaderPhotoId ? category.voteTotals.find((vote) => vote.photoId === leaderPhotoId)?.voteCount || 0 : 0;
    return {
      categoryId: category.categoryId,
      categoryLabel: category.categoryLabel,
      photoId: leaderPhotoId,
      voteCount: leaderVotes,
      isTie: category.isTie,
    };
  });

  return {
    totalPhotos: photos.length,
    visiblePhotos: visible.length,
    hiddenPhotos,
    reportedPhotos,
    featuredPhotos,
    totalContributors: contributorSummary.contributorCount,
    topContributors: contributorSummary.topContributors,
    guestJoins: analytics.guestJoins ?? 0,
    liveWallOpens: analytics.liveWallOpens ?? 0,
    recapOpens: analytics.recapOpens ?? 0,
    uploadsOverTime: buildUploadTrend(photos),
    challengeCompletion: buildChallengeProgressSummary(event.challenge, visible),
    awardWinners: winners,
  };
}

function cleanFeedbackText(value: unknown, maxLength: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength).trim() : null;
}

export function validateHostFeedback(input: HostFeedbackInput): HostFeedbackValidationResult {
  const kind: HostFeedbackKind = input.kind === "beta_issue" ? "beta_issue" : "post_event";
  const issueAreas: HostIssueArea[] = ["guest_upload", "live_wall", "recap", "qr_poster", "moderation", "analytics", "other"];
  const issueArea = issueAreas.includes(input.issueArea as HostIssueArea) ? (input.issueArea as HostIssueArea) : null;
  const skipped = Boolean(input.skipped);
  if (skipped) {
    return {
      ok: true,
      value: { skipped: true, kind, issueArea: null, outcome: null, repeatIntent: null, guestConfusion: null, featureRequest: null, note: null },
    };
  }

  if (kind === "beta_issue") {
    const note = cleanFeedbackText(input.note, 1000);
    if (!issueArea) return { ok: false, message: "Choose what the issue is about." };
    if (!note) return { ok: false, message: "Add a short note so the support team knows what happened." };
    return {
      ok: true,
      value: {
        skipped: false,
        kind,
        issueArea,
        outcome: null,
        repeatIntent: null,
        guestConfusion: null,
        featureRequest: null,
        note,
      },
    };
  }

  const outcomes: HostFeedbackRating[] = ["great", "okay", "rough"];
  const repeatIntents: HostFeedbackRepeatIntent[] = ["yes", "maybe", "no"];
  const outcome = outcomes.includes(input.outcome as HostFeedbackRating) ? (input.outcome as HostFeedbackRating) : null;
  const repeatIntent = repeatIntents.includes(input.repeatIntent as HostFeedbackRepeatIntent) ? (input.repeatIntent as HostFeedbackRepeatIntent) : null;
  if (!outcome) return { ok: false, message: "Choose how the event went." };
  if (!repeatIntent) return { ok: false, message: "Choose whether you would use EventFilm again." };

  return {
    ok: true,
    value: {
      skipped: false,
      kind,
      issueArea: null,
      outcome,
      repeatIntent,
      guestConfusion: cleanFeedbackText(input.guestConfusion, 500),
      featureRequest: cleanFeedbackText(input.featureRequest, 500),
      note: cleanFeedbackText(input.note, 1000),
    },
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

function contributorDisplayName(photo: Pick<Photo, "guestNickname" | "challengeParticipantName">) {
  return sanitizeGuestDisplayName(photo.challengeParticipantName || photo.guestNickname);
}

export function buildContributorSummary(photos: Photo[], limit = 3): ContributorSummary {
  const counts = new Map<string, ContributorSummaryItem>();
  const sortedPhotos = visiblePhotos(photos);
  for (const photo of sortedPhotos) {
    const displayName = contributorDisplayName(photo);
    if (isAnonymousGuestDisplayName(displayName)) continue;
    const key = displayName.toLowerCase();
    const current = counts.get(key) || { displayName, photoCount: 0 };
    current.photoCount += 1;
    counts.set(key, current);
  }

  return {
    contributorCount: counts.size,
    totalPhotos: sortedPhotos.length,
    topContributors: Array.from(counts.values())
      .sort((a, b) => b.photoCount - a.photoCount || a.displayName.localeCompare(b.displayName))
      .slice(0, limit),
  };
}

export function buildGuestUploadSuccessSummary({
  event,
  photo,
  remainingUploads,
}: {
  event: Pick<PublicEvent, "challenge" | "isRevealed" | "revealAt">;
  photo: Photo;
  remainingUploads: number;
}): GuestUploadSuccessSummary {
  const capsuleCopy = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const challengeDetail = photoChallengeLabel(photo);
  return {
    title: "Upload succeeded",
    guestDisplayName: contributorDisplayName(photo),
    challengeLabel: challengeLabel(event.challenge),
    detail: challengeDetail || "Added to the event album",
    remainingUploads,
    revealNote: capsuleCopy && !event.isRevealed ? capsuleCopy.revealNote : undefined,
  };
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

export function buildLiveWallChallengeDisplaySummary(
  challenge: EventChallenge | null | undefined,
  photos: Photo[],
  awardVoting?: AwardVotingSummary | null,
): LiveWallChallengeDisplaySummary {
  const summary = buildChallengeProgressSummary(challenge, visiblePhotos(photos));
  const pack = getChallengePack(summary.mode);
  const completedRows = summary.rows.filter((row) => row.complete).length;
  const leaders = (awardVoting?.categories || []).map((category) => {
    const leaderPhotoId = category.leaderPhotoIds[0];
    const voteCount = leaderPhotoId ? category.voteTotals.find((vote) => vote.photoId === leaderPhotoId)?.voteCount || 0 : 0;
    const status = leaderPhotoId
      ? `${voteCount} ${voteCount === 1 ? "vote" : "votes"}${category.isTie ? " - tie" : ""}`
      : category.noSubmissions
        ? "No submissions yet"
        : category.noVotes
          ? "No votes yet"
          : "Leader pending";
    return {
      categoryId: category.categoryId,
      categoryLabel: category.categoryLabel,
      leaderPhotoId,
      voteCount,
      isTie: category.isTie,
      status,
    };
  });

  let headline = pack.name;
  let note = summary.instructions;

  if (!challenge) {
    headline = "Open photo wall";
    note = summary.totalPhotos ? "Recent uploads are ready for the room." : "Share the QR code so the first photos can land here.";
  } else if (challenge.type === CHALLENGE_TYPES.COLOR_HUNT) {
    headline = `${completedRows}/${summary.rows.length} color teams on the board`;
    note = "Show guests which colors need more photos.";
  } else if (challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    headline = `${completedRows}/${summary.rows.length} prompts captured`;
    note = "Point the room toward the prompts still waiting for a photo.";
  } else if (challenge.type === CHALLENGE_TYPES.EVENT_AWARDS) {
    const activeLeaders = leaders.filter((leader) => leader.leaderPhotoId).length;
    headline = activeLeaders ? `${activeLeaders} award ${activeLeaders === 1 ? "leader" : "leaders"} live` : "Awards are ready for submissions";
    note = activeLeaders ? "Celebrate the categories getting votes right now." : "Invite guests to submit and vote from the recap after reveal.";
  } else if (challenge.type === CHALLENGE_TYPES.MEMORY_CAPSULE) {
    const capsule = memoryCapsuleFromChallenge(challenge);
    headline = capsule.revealTitle;
    note = capsule.revealNote;
  }

  return { ...summary, headline, note, leaders };
}

export function buildGuestChallengeProgress(
  challenge: EventChallenge | null | undefined,
  photos: Photo[],
  selection: { participantId?: string; promptId?: string; itemId?: string } = {},
): GuestChallengeProgress {
  const summary = buildChallengeProgressSummary(challenge, photos);
  const mode = challenge?.type || "NONE";
  if (!challenge) {
    return {
      ...summary,
      headline: `${summary.totalPhotos} ${summary.totalPhotos === 1 ? "photo" : "photos"} in the album`,
      note: "Every upload helps build the event story.",
    };
  }

  if (mode === CHALLENGE_TYPES.COLOR_HUNT) {
    const selected = challenge.participants.find((participant) => participant.id === selection.participantId);
    return {
      ...summary,
      headline: "Color teams are filling the album",
      note: selected ? `You are posting for ${selected.displayName}.` : "Pick a color team before uploading.",
      selectedLabel: selected?.displayName,
    };
  }

  if (mode === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    const selected = promptsFromChallenge(challenge).find((prompt) => prompt.id === selection.promptId);
    const completed = summary.rows.filter((row) => row.count > 0).length;
    return {
      ...summary,
      headline: `${completed} of ${summary.rows.length} prompts have photos`,
      note: selected ? `Current prompt: ${selected.text}` : "Choose a prompt and complete it with a photo.",
      selectedLabel: selected?.text,
    };
  }

  if (mode === CHALLENGE_TYPES.EVENT_AWARDS) {
    const selected = categoriesFromChallenge(challenge).find((category) => category.id === selection.itemId);
    return {
      ...summary,
      headline: "Award categories are collecting contenders",
      note: selected ? `Submitting for ${selected.label}. Vote from the recap after reveal.` : "Pick an award category for your upload.",
      selectedLabel: selected?.label,
    };
  }

  if (mode === CHALLENGE_TYPES.MEMORY_CAPSULE) {
    const capsuleCopy = memoryCapsuleFromChallenge(challenge);
    return {
      ...summary,
      headline: capsuleCopy.revealTitle,
      note: capsuleCopy.revealNote,
    };
  }

  return {
    ...summary,
    headline: "Challenge progress",
    note: summary.instructions,
  };
}

function firstPhotosWithoutUsed(photos: Photo[], used: Set<string>, limit: number) {
  const selected: Photo[] = [];
  for (const photo of photos) {
    if (!photo.id || used.has(photo.id)) continue;
    selected.push(photo);
    used.add(photo.id);
    if (selected.length >= limit) break;
  }
  return selected;
}

function photoIds(photos: Photo[]) {
  return photos.map((photo) => photo.id).filter(Boolean);
}

function photosByIds(photos: Photo[], ids: string[]) {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return ids.map((id) => byId.get(id)).filter((photo): photo is Photo => Boolean(photo));
}

function photosForChallengeMoment(photos: Photo[], row: ChallengeProgressRow) {
  return photos.filter((photo) => {
    if (row.kind === "color") {
      return photo.challengeParticipantId === row.id || photo.challengeColorSlug === row.colorSlug || photo.challengeColorName === row.colorName;
    }
    if (row.kind === "prompt") {
      return photo.challengePromptId === row.id || photo.challengeItemId === row.id;
    }
    if (row.kind === "award") {
      return photo.challengeItemId === row.id;
    }
    return false;
  });
}

function buildRecapHighlightReel(photos: Photo[], awardVoting?: AwardVotingSummary | null): EventRecapHighlight[] {
  const sortedPhotos = sortPhotosForRecap(photos);
  const used = new Set<string>();
  const sections: EventRecapHighlight[] = [];
  const addSection = (key: string, title: string, description: string, kind: EventRecapHighlightKind, nextPhotos: Photo[]) => {
    const selected = firstPhotosWithoutUsed(nextPhotos, used, 6);
    if (!selected.length) return;
    sections.push({ key, title, description, kind, photos: selected });
  };

  addSection("featured", "Favorite moments", "Photos the host marked as favorites for everyone to see first.", "featured", sortedPhotos.filter((photo) => Boolean(photo.isFeatured)));

  const winnerIds = (awardVoting?.categories || []).flatMap((category) => category.leaderPhotoIds);
  addSection("award-winners", "Award winners", "Winning and tied Awards photos from the recap vote.", "award_winner", photosByIds(sortedPhotos, winnerIds));

  const votedIds = (awardVoting?.categories || [])
    .flatMap((category) => category.voteTotals)
    .sort((a, b) => b.voteCount - a.voteCount)
    .map((vote) => vote.photoId);
  addSection("most-voted", "Guest favorites", "Photos guests voted for, kept below the main album.", "voted", photosByIds(sortedPhotos, votedIds));

  addSection(
    "challenge-moments",
    "Prompts",
    "Photos tied to teams, prompts, award categories, or event-specific moments.",
    "challenge",
    sortedPhotos.filter((photo) => Boolean(photo.challengeItemId || photo.challengePromptId || photo.challengeParticipantId || photo.challengeColorName)),
  );

  addSection("recent", "Photos", "Recent photos from the shared album.", "recent", sortedPhotos);

  return sections;
}

function buildRecapChallengeMoments(challenge: EventChallenge | null | undefined, photos: Photo[], awardVoting?: AwardVotingSummary | null): EventRecapChallengeMoment[] {
  const progress = buildChallengeProgressSummary(challenge, photos);
  if (!challenge || progress.mode === "NONE") {
    return [
      {
        key: "shared-album",
        title: "Photos from the event",
        description: photos.length ? "The recap is built from the photos guests added together." : "Photos will appear here once guests start uploading.",
        count: photos.length,
        photos: photos.slice(0, 4),
        isComplete: photos.length > 0,
      },
    ];
  }

  if (challenge.type === CHALLENGE_TYPES.MEMORY_CAPSULE) {
    const capsule = memoryCapsuleFromChallenge(challenge);
    return [
      {
        key: "opened-memories",
        title: "The Memory Capsule is open",
        description: photos.length ? "The capsule is open, and these are the memories guests left for reveal time." : capsule.revealNote,
        count: photos.length,
        photos: photos.slice(0, 4),
        isComplete: photos.length > 0,
      },
    ];
  }

  return progress.rows.map((row) => {
    const rowPhotos = photosForChallengeMoment(photos, row);
    const awardCategory = awardVoting?.categories.find((category) => category.categoryId === row.id);
    const winnerPhotos = awardCategory?.leaderPhotoIds.length ? photosByIds(photos, awardCategory.leaderPhotoIds) : [];
    const representative = winnerPhotos.length ? winnerPhotos : rowPhotos;
    const status = row.kind === "award" && awardCategory
      ? awardCategory.noSubmissions
        ? "No submissions yet."
        : awardCategory.noVotes
          ? "Submissions are in; votes are still open."
          : `${awardCategory.totalVotes} ${awardCategory.totalVotes === 1 ? "vote" : "votes"}${awardCategory.isTie ? " with a tie at the top." : "."}`
      : row.complete
        ? `${row.count} ${row.count === 1 ? "photo" : "photos"} captured.`
        : "Waiting for a photo.";
    return {
      key: row.id,
      title: row.label,
      description: status,
      count: row.count,
      total: row.total,
      colorHex: row.colorHex,
      photos: representative.slice(0, 3),
      isComplete: row.complete,
      voteCount: awardCategory?.totalVotes,
      isTie: awardCategory?.isTie,
    };
  });
}

function buildRecapAlbumFilters(challenge: EventChallenge | null | undefined, photos: Photo[]): EventRecapAlbumFilter[] {
  const sortedPhotos = sortPhotosForRecap(photos);
  const filters: EventRecapAlbumFilter[] = [
    { key: "all", label: "Photos from the event", count: sortedPhotos.length, photoIds: photoIds(sortedPhotos) },
  ];
  const featured = sortedPhotos.filter((photo) => Boolean(photo.isFeatured));
  if (featured.length) filters.push({ key: "featured", label: "Favorite moments", count: featured.length, photoIds: photoIds(featured) });
  const recent = sortedPhotos.slice(0, Math.min(12, sortedPhotos.length));
  if (recent.length && recent.length !== sortedPhotos.length) filters.push({ key: "recent", label: "Recent photos", count: recent.length, photoIds: photoIds(recent) });

  for (const row of buildChallengeProgressSummary(challenge, sortedPhotos).rows) {
    const rowPhotos = photosForChallengeMoment(sortedPhotos, row);
    if (rowPhotos.length) filters.push({ key: `challenge-${row.id}`, label: row.label, count: rowPhotos.length, photoIds: photoIds(rowPhotos) });
  }
  return filters;
}

export function buildEventRecapStory(
  event: EventRecapSourceEvent,
  photos: Photo[],
  options: { awardVoting?: AwardVotingSummary | null } = {},
): EventRecapStory {
  const sortedPhotos = sortPhotosForRecap(visiblePhotos(photos));
  const template = getEventTemplate(event.eventTemplateSlug);
  const modeLabel = challengeLabel(event.challenge);
  const contributors = buildContributorSummary(sortedPhotos, 5);
  const highlights = buildRecapHighlightReel(sortedPhotos, options.awardVoting);
  const challengeMoments = buildRecapChallengeMoments(event.challenge, sortedPhotos, options.awardVoting);
  const capsuleCopy = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const isLocked = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && event.isRevealed === false;
  const highlightPhotos = highlights.flatMap((section) => section.photos).slice(0, 8);
  const heroCopy = isLocked
    ? capsuleCopy?.revealNote || "Photos are tucked away until reveal time."
    : template?.recapFraming || (sortedPhotos.length ? "The event story is ready to revisit, share, and keep." : "A shared album from the people who were there.");
  const completedMoments = challengeMoments.filter((moment) => moment.isComplete).length;
  const challengeHeadline = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && !isLocked
    ? "Opened memories"
    : event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS
      ? "Award winners"
      : event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT
        ? "Color Hunt progress"
        : event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT
          ? "Photo prompt progress"
          : "Photos from the event";
  const challengeCopy = event.challenge
    ? `${completedMoments}/${challengeMoments.length || 1} ${challengeMoments.length === 1 ? "moment" : "moments"} have photos.`
    : sortedPhotos.length
      ? "Guests built this album together, one upload at a time."
      : "Photos will appear here once guests start uploading.";

  return {
    modeLabel,
    templateName: template?.name,
    recapTitle: "Favorite moments",
    recapSubtitle: "Photos the host picked to show first.",
    totalPhotos: sortedPhotos.length,
    contributorCount: contributors.contributorCount,
    highlightPhotos: highlightPhotos.length ? highlightPhotos : sortedPhotos.slice(0, 8),
    recentPhotos: sortedPhotos.slice(0, 8),
    heroCopy,
    lockedTitle: capsuleCopy?.revealTitle || "Photos are saved for the reveal",
    lockedCopy: capsuleCopy?.revealNote || "Photos are still private until the reveal time.",
    emptyTitle: "No photos yet",
    emptyCopy: "No photos yet. Share the guest link so people can add theirs.",
    highlightReel: highlights,
    challengeHeadline,
    challengeCopy,
    challengeMoments,
    contributorSummary: contributors,
    albumFilters: buildRecapAlbumFilters(event.challenge, sortedPhotos),
    createEventCtaTitle: "Stop chasing event photos.",
    createEventCtaCopy: "Create one EventFilm link, let guests add photos from their phones, then share a recap that feels finished.",
  };
}

export function buildEventRecapMetadata(event: EventRecapSourceEvent, photos: Photo[]): EventRecapMetadata {
  return buildEventRecapStory(event, photos);
}
