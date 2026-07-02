import type {
  AnalyticsEventInput,
  CreateEventInput,
  EventChallenge,
  EventChallengeInput,
  EventDashboardRole,
  EventSummary,
  FounderOverview,
  HostFeedbackInput,
  GuestStatus,
  AwardResultsSummary,
  AwardVotingSummary,
  Photo,
  PublicEvent,
  UpdateEventSettingsInput,
  UploadPhotoMetadata,
  User,
} from "@eventfilm/shared";

export type EventFilmApiErrorKind = "auth" | "http" | "network" | "server" | "timeout";

export class EventFilmApiError extends Error {
  readonly status: number;
  readonly data?: unknown;
  readonly kind: EventFilmApiErrorKind;

  constructor(message: string, status: number, data?: unknown, kind: EventFilmApiErrorKind = "http") {
    super(message);
    this.name = "EventFilmApiError";
    this.status = status;
    this.data = data;
    this.kind = kind;
  }
}

export type AuthResponse = {
  token: string;
  user: User;
};

export type ReactNativeUploadAsset = {
  uri: string;
  name?: string;
  type?: string;
};

export type UploadPhotoInput = UploadPhotoMetadata & {
  photo: File | Blob | ReactNativeUploadAsset;
};

export type EventRecapResponse = {
  event: PublicEvent & {
    eventLink: string;
    recapLink: string;
  };
  eventLink: string;
  recapLink: string;
  isLocked: boolean;
  photos: Photo[];
  awardVoting?: AwardVotingSummary;
  awardResults?: AwardResultsSummary;
};

export type GuestMyUploadsResponse = {
  uploadedCount: number;
  remainingUploads: number | null;
  photos: Photo[];
};

export type GuestDisplayNameInput = {
  clientId: string;
  nickname: string;
};

export type AwardVoteRequest = {
  photoId: string;
  clientId: string;
  challengeItemId?: string;
};

export type AwardVoteResponse = {
  ok: true;
  photoId: string;
  challengeItemId: string;
  selected: boolean;
  duplicate?: boolean;
};

export type AnalyticsSummary = {
  eventsCreated: number;
  guestJoins: number;
  uploads: number;
  recapOpens: number;
  activeHosts: number;
  activeGuests: number;
};

export type EventAnalyticsSummary = {
  eventId: string;
  eventSlug: string;
  photoCount: number;
  visiblePhotos: number;
  featuredPhotos: number;
  photoLikes?: number;
  guestJoins: number;
  uploads: number;
  recapOpens: number;
  activeGuests: number;
  eventAwardsVoting?: AwardVotingSummary;
  eventAwardResults?: AwardResultsSummary;
  hostFeedback?: HostEventFeedback | null;
};

export type PhotoLikeRequest = {
  clientId: string;
  liked: boolean;
};

export type PhotoLikeResponse = {
  ok: true;
  photoId: string;
  liked: boolean;
  likeCount: number;
};

export type FounderOverviewResponse = {
  overview: FounderOverview;
};

export type EventAccessResponse = {
  role: EventDashboardRole;
};

export type HostEventFeedback = {
  id: string;
  kind?: string | null;
  issueArea?: string | null;
  outcome?: string | null;
  repeatIntent?: string | null;
  guestConfusion?: string | null;
  featureRequest?: string | null;
  note?: string | null;
  skippedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DuplicateEventOverrides = {
  name?: string;
  description?: string | null;
  revealAt?: string;
};

export type LaunchLinkVerification = {
  key: "guest" | "recap";
  label: string;
  url: string;
  ok: boolean;
  warning?: string;
};

export type LaunchLinksVerificationResponse = {
  eventId: string;
  eventSlug: string;
  links: LaunchLinkVerification[];
};

export type EventFilmApiClientOptions = {
  baseUrl: string;
  tokenProvider?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type RequestOptions = RequestInit & {
  token?: string | null;
  auth?: boolean;
  timeoutMs?: number;
};

export function normalizeEventFilmBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("EventFilm API base URL is required");
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
}

function appendUploadPhoto(formData: FormData, photo: UploadPhotoInput["photo"]) {
  const append = formData.append.bind(formData) as (name: string, value: unknown, fileName?: string) => void;

  if (typeof File !== "undefined" && photo instanceof File) {
    append("photo", photo, photo.name);
    return;
  }

  if (typeof Blob !== "undefined" && photo instanceof Blob) {
    append("photo", photo, "photo.jpg");
    return;
  }

  const asset = photo as ReactNativeUploadAsset;
  append("photo", {
    uri: asset.uri,
    name: asset.name || "eventfilm-photo.jpg",
    type: asset.type || "image/jpeg",
  });
}

export function createEventFilmApiClient(options: EventFilmApiClientOptions) {
  const baseUrl = normalizeEventFilmBaseUrl(options.baseUrl);
  const fetcher = options.fetchImpl || fetch;
  const defaultTimeoutMs = options.timeoutMs ?? 12000;

  function classifyHttpStatus(status: number): EventFilmApiErrorKind {
    if (status === 401 || status === 403) return "auth";
    if (status >= 500) return "server";
    return "http";
  }

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const headers = new Headers(requestOptions.headers);
    const isFormData = requestOptions.body instanceof FormData;
    const timeoutMs = requestOptions.timeoutMs ?? defaultTimeoutMs;
    const controller = new AbortController();
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const sourceSignal = requestOptions.signal;

    if (requestOptions.body && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = requestOptions.token ?? (requestOptions.auth ? await options.tokenProvider?.() : null);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    if (sourceSignal?.aborted) controller.abort();
    sourceSignal?.addEventListener("abort", () => controller.abort(), { once: true });
    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }

    try {
      const response = await fetcher(`${baseUrl}${path}`, {
        ...requestOptions,
        headers,
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await response.json() : null;

      if (!response.ok) {
        throw new EventFilmApiError((data as { error?: string } | null)?.error || "Request failed", response.status, data, classifyHttpStatus(response.status));
      }

      return data as T;
    } catch (error) {
      if (error instanceof EventFilmApiError) throw error;
      if (timedOut) throw new EventFilmApiError("Request timed out", 0, undefined, "timeout");
      throw new EventFilmApiError("Could not reach API", 0, undefined, "network");
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function uploadPhoto(slug: string, input: UploadPhotoInput) {
    const formData = new FormData();
    appendUploadPhoto(formData, input.photo);
    formData.append("nickname", input.nickname);
    formData.append("clientId", input.clientId);
    if (input.challengeParticipantId) formData.append("challengeParticipantId", input.challengeParticipantId);
    if (input.challengePromptId) formData.append("challengePromptId", input.challengePromptId);
    if (input.challengeItemId) formData.append("challengeItemId", input.challengeItemId);

    return request<{ photo: Photo; uploadedCount: number; remainingUploads: number | null }>(`/api/events/${encodeURIComponent(slug)}/photos`, {
      method: "POST",
      body: formData,
    });
  }

  return {
    baseUrl,
    request,
    signup(input: { email: string; password: string }) {
      return request<AuthResponse>("/api/auth/signup", { method: "POST", body: JSON.stringify(input) });
    },
    login(input: { email: string; password: string }) {
      return request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
    },
    checkHealth(timeoutMs?: number) {
      return request<{ ok: boolean }>("/api/health", timeoutMs === undefined ? {} : { timeoutMs });
    },
    getCurrentUser(token?: string | null) {
      return request<{ user: User }>("/api/me", { auth: !token, token });
    },
    trackAnalyticsEvent(input: AnalyticsEventInput, token?: string | null) {
      return request<{ ok: boolean }>("/api/analytics/events", {
        method: "POST",
        auth: Boolean(!token && options.tokenProvider),
        token,
        body: JSON.stringify(input),
      });
    },
    getAnalyticsSummary(token?: string | null) {
      return request<{ summary: AnalyticsSummary }>("/api/host/analytics/summary", { auth: !token, token });
    },
    getEventAnalyticsSummary(eventId: string, token?: string | null) {
      return request<{ summary: EventAnalyticsSummary }>(`/api/host/events/${encodeURIComponent(eventId)}/analytics/summary`, {
        auth: !token,
        token,
      });
    },
    getFounderOverview(token?: string | null) {
      return request<FounderOverviewResponse>("/api/founder/overview", { auth: !token, token });
    },
    getHostEvents(token?: string | null) {
      return request<{ events: EventSummary[] }>("/api/host/events", { auth: !token, token });
    },
    getDashboardEvents(token?: string | null) {
      return request<{ events: EventSummary[] }>("/api/dashboard/events", { auth: !token, token });
    },
    saveEventAccess(slug: string, token?: string | null) {
      return request<EventAccessResponse>(`/api/events/${encodeURIComponent(slug)}/access`, {
        method: "POST",
        auth: !token,
        token,
      });
    },
    createEvent(input: CreateEventInput, token?: string | null) {
      return request<{ event: EventSummary }>("/api/host/events", {
        method: "POST",
        auth: !token,
        token,
        body: JSON.stringify(input),
      });
    },
    getHostEvent(eventId: string, token?: string | null, options: { clientId?: string } = {}) {
      const query = options.clientId ? `?clientId=${encodeURIComponent(options.clientId)}` : "";
      return request<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${encodeURIComponent(eventId)}${query}`, {
        auth: !token,
        token,
      });
    },
    updateHostEventSettings(eventId: string, input: UpdateEventSettingsInput, token?: string | null) {
      return request<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        auth: !token,
        token,
        body: JSON.stringify(input),
      });
    },
    duplicateHostEvent(eventId: string, overrides: DuplicateEventOverrides = {}, token?: string | null) {
      return request<{ event: EventSummary }>(`/api/host/events/${encodeURIComponent(eventId)}/duplicate`, {
        method: "POST",
        auth: !token,
        token,
        body: JSON.stringify(overrides),
      });
    },
    submitHostEventFeedback(eventId: string, input: HostFeedbackInput, token?: string | null) {
      return request<{ feedback: HostEventFeedback }>(`/api/host/events/${encodeURIComponent(eventId)}/feedback`, {
        method: "POST",
        auth: !token,
        token,
        body: JSON.stringify(input),
      });
    },
    verifyHostEventLinks(eventId: string, token?: string | null) {
      return request<LaunchLinksVerificationResponse>(`/api/host/events/${encodeURIComponent(eventId)}/links/verify`, {
        auth: !token,
        token,
      });
    },
    updateEventChallenge(eventId: string, challenge: EventChallengeInput, token?: string | null) {
      return request<{ challenge: EventChallenge | null }>(`/api/host/events/${encodeURIComponent(eventId)}/challenge`, {
        method: "PUT",
        auth: !token,
        token,
        body: JSON.stringify({ challenge }),
      });
    },
    getHostPhotos(eventId: string, query: { featured?: boolean; challengeItemId?: string } = {}, token?: string | null) {
      const params = new URLSearchParams();
      if (query.featured !== undefined) params.set("featured", String(query.featured));
      if (query.challengeItemId) params.set("challengeItemId", query.challengeItemId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return request<{ photos: Photo[] }>(`/api/host/events/${encodeURIComponent(eventId)}/photos${suffix}`, {
        auth: !token,
        token,
      });
    },
    updatePhotoFeatured(eventId: string, photoId: string, isFeatured: boolean, token?: string | null) {
      return request<{ photo: Photo }>(`/api/host/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}/featured`, {
        method: "PATCH",
        auth: !token,
        token,
        body: JSON.stringify({ isFeatured }),
      });
    },
    deletePhoto(eventId: string, photoId: string, token?: string | null) {
      return request<{ ok: true }>(`/api/host/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}`, {
        method: "DELETE",
        auth: !token,
        token,
      });
    },
    getHostEventDownloadUrl(eventId: string) {
      return `${baseUrl}/api/host/events/${encodeURIComponent(eventId)}/download`;
    },
    getRecapUrl(slug: string) {
      return `/recap/${encodeURIComponent(slug)}`;
    },
    getPublicEventBySlug(slug: string) {
      return request<{ event: PublicEvent }>(`/api/events/${encodeURIComponent(slug)}`);
    },
    getRecapData(slug: string, clientId?: string) {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      return request<EventRecapResponse>(`/api/events/${encodeURIComponent(slug)}/recap${query}`);
    },
    castEventAwardVote(slug: string, input: AwardVoteRequest) {
      return request<AwardVoteResponse>(`/api/events/${encodeURIComponent(slug)}/votes`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    setPhotoLike(slug: string, photoId: string, input: PhotoLikeRequest) {
      return request<PhotoLikeResponse>(`/api/events/${encodeURIComponent(slug)}/photos/${encodeURIComponent(photoId)}/likes`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    getGuestStatus(slug: string, clientId: string) {
      return request<GuestStatus>(`/api/events/${encodeURIComponent(slug)}/guest-status?clientId=${encodeURIComponent(clientId)}`);
    },
    updateGuestDisplayName(slug: string, input: GuestDisplayNameInput) {
      return request<GuestStatus>(`/api/events/${encodeURIComponent(slug)}/guest-status`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },
    getGuestMyUploads(slug: string, clientId: string) {
      return request<GuestMyUploadsResponse>(`/api/events/${encodeURIComponent(slug)}/my-uploads?clientId=${encodeURIComponent(clientId)}`);
    },
    uploadPhoto,
    getAlbumPhotos(slug: string, clientId?: string) {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      return request<{ photos: Photo[] }>(`/api/events/${encodeURIComponent(slug)}/photos${query}`);
    },
  };
}
