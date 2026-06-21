import type {
  CreateEventInput,
  EventChallenge,
  EventChallengeInput,
  EventSummary,
  GuestStatus,
  Photo,
  PublicEvent,
  UploadPhotoMetadata,
  User,
} from "@eventfilm/shared";

export class EventFilmApiError extends Error {
  readonly status: number;
  readonly data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "EventFilmApiError";
    this.status = status;
    this.data = data;
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

export type LiveWallResponse = {
  event: PublicEvent & {
    eventLink: string;
    liveWallLink: string;
    recapLink: string;
    qrCodeDataUrl?: string;
  };
  eventLink: string;
  liveWallLink: string;
  recapLink: string;
  qrCodeDataUrl?: string;
  isLocked: boolean;
  photos: Photo[];
};

export type EventRecapResponse = {
  event: PublicEvent & {
    eventLink: string;
    liveWallLink: string;
    recapLink: string;
  };
  eventLink: string;
  liveWallLink: string;
  recapLink: string;
  isLocked: boolean;
  photos: Photo[];
};

export type EventFilmApiClientOptions = {
  baseUrl: string;
  tokenProvider?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
};

type RequestOptions = RequestInit & {
  token?: string | null;
  auth?: boolean;
};

function normalizeBaseUrl(baseUrl: string) {
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
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetcher = options.fetchImpl || fetch;

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const headers = new Headers(requestOptions.headers);
    const isFormData = requestOptions.body instanceof FormData;

    if (requestOptions.body && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = requestOptions.token ?? (requestOptions.auth ? await options.tokenProvider?.() : null);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetcher(`${baseUrl}${path}`, {
      ...requestOptions,
      headers,
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      throw new EventFilmApiError((data as { error?: string } | null)?.error || "Request failed", response.status, data);
    }

    return data as T;
  }

  function uploadPhoto(slug: string, input: UploadPhotoInput) {
    const formData = new FormData();
    appendUploadPhoto(formData, input.photo);
    formData.append("nickname", input.nickname);
    formData.append("clientId", input.clientId);
    if (input.challengeParticipantId) formData.append("challengeParticipantId", input.challengeParticipantId);
    if (input.challengePromptId) formData.append("challengePromptId", input.challengePromptId);
    if (input.challengeItemId) formData.append("challengeItemId", input.challengeItemId);

    return request<{ photo: Photo; uploadedCount: number; remainingUploads: number }>(`/api/events/${encodeURIComponent(slug)}/photos`, {
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
    getCurrentUser(token?: string | null) {
      return request<{ user: User }>("/api/me", { auth: !token, token });
    },
    getHostEvents(token?: string | null) {
      return request<{ events: EventSummary[] }>("/api/host/events", { auth: !token, token });
    },
    createEvent(input: CreateEventInput, token?: string | null) {
      return request<{ event: EventSummary }>("/api/host/events", {
        method: "POST",
        auth: !token,
        token,
        body: JSON.stringify(input),
      });
    },
    getHostEvent(eventId: string, token?: string | null) {
      return request<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${encodeURIComponent(eventId)}`, {
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
    getLiveWallUrl(slug: string) {
      return `/wall/${encodeURIComponent(slug)}`;
    },
    getRecapUrl(slug: string) {
      return `/recap/${encodeURIComponent(slug)}`;
    },
    getPublicEventBySlug(slug: string) {
      return request<{ event: PublicEvent }>(`/api/events/${encodeURIComponent(slug)}`);
    },
    getLiveWallData(slug: string) {
      return request<LiveWallResponse>(`/api/events/${encodeURIComponent(slug)}/live-wall`);
    },
    getRecapData(slug: string) {
      return request<EventRecapResponse>(`/api/events/${encodeURIComponent(slug)}/recap`);
    },
    getGuestStatus(slug: string, clientId: string) {
      return request<GuestStatus>(`/api/events/${encodeURIComponent(slug)}/guest-status?clientId=${encodeURIComponent(clientId)}`);
    },
    uploadPhoto,
    getAlbumPhotos(slug: string) {
      return request<{ photos: Photo[] }>(`/api/events/${encodeURIComponent(slug)}/photos`);
    },
  };
}
