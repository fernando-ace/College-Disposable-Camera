import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createEventFilmApiClient } from "@eventfilm/api-client";
import type { AnalyticsSummary, EventAnalyticsSummary, EventRecapResponse } from "@eventfilm/api-client";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  CHALLENGE_PACKS,
  CHALLENGE_TYPES,
  COLOR_HUNT_PALETTE,
  PROMPT_PACKS,
  buildContributorSummary,
  buildGuestChallengeProgress,
  buildGuestUploadSuccessSummary,
  buildHostShareAssets,
  buildAwardResultsSummary,
  buildEventRecapStory,
  buildChallengePayload,
  buildDuplicateEventInput,
  buildHostNextStep,
  categoriesFromChallenge,
  challengeLabel,
  colorBySlug,
  colorTeamDisplayName,
  createCategoriesFromPack,
  createCategory,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createPromptsFromPack,
  createPrompt,
  createStarterPrompts,
  draftFromChallenge,
  getChallengePack,
  getPromptPack,
  plainModeLabel,
  hasDuplicateCategories,
  hasDuplicateParticipantColors,
  hasDuplicatePrompts,
  deriveEventLifecycleStatus,
  isAnonymousGuestDisplayName,
  memoryCapsuleFromChallenge,
  photoChallengeLabel,
  promptsFromChallenge,
  sanitizeGuestDisplayName,
  validateUploadFile,
  validateChallengeDraft,
  validateEventSettingsInput,
  validateHostFeedback,
} from "@eventfilm/shared";
import type { AnalyticsEventInput, AnalyticsEventName, AwardResultsSummary, ChallengeDraft, ChallengeParticipant, EventChallenge, EventLifecycle, EventRecapAlbumFilter, EventRecapStory, EventSettingsFieldErrors, EventSummary, FounderOverview, GuestUploadLocalMetadata, GuestUploadSuccessSummary, HostFeedbackInput, HostShareAssets, Photo, PromptPackSlug, PublicEvent, UpdateEventSettingsInput, User } from "@eventfilm/shared";
import {
  AppShell,
  BrandMark,
  Card as CleanCard,
  Icon as CleanIcon,
  PrimaryButton,
  SecondaryButton as CleanSecondaryButton,
} from "./components/ui";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is required. Set it to the deployed API base URL.");
}

const API_BASE_URL = API_URL.startsWith("http://") || API_URL.startsWith("https://") ? API_URL : `https://${API_URL}`;
const API_ORIGIN = new URL(API_BASE_URL).origin;
const LANDING_DEMO_PATH = "/demo";
const DEMO_EVENT = {
  id: "demo-event",
  name: "Demo Event",
  description: "A sample guest album with photos already added.",
  slug: "demo-event",
  eventDate: "2026-06-14T20:00:00.000Z",
  revealAt: "2026-06-14T20:00:00.000Z",
  photoLimitPerGuest: 0,
  eventTemplateSlug: null,
  promptPackSlug: null,
  isRevealed: true,
  photoCount: 4,
  challenge: null,
} satisfies PublicEvent;
const DEMO_PHOTOS = [
  {
    id: "demo-photo-1",
    url: "/demo/demo-album-1.jpg",
    previewUrl: "/demo/demo-album-1.jpg",
    originalFilename: "Demo Event sample photo 1",
    mimeType: "image/jpeg",
    sizeBytes: 195278,
    createdAt: "2026-06-14T20:08:00.000Z",
    guestNickname: "Maya",
    isFeatured: true,
    likeCount: 18,
    likedByMe: false,
  },
  {
    id: "demo-photo-2",
    url: "/demo/demo-album-2.jpg",
    previewUrl: "/demo/demo-album-2.jpg",
    originalFilename: "Demo Event sample photo 2",
    mimeType: "image/jpeg",
    sizeBytes: 3243200,
    createdAt: "2026-06-14T20:16:00.000Z",
    guestNickname: "Alex",
    isFeatured: false,
    likeCount: 12,
    likedByMe: false,
  },
  {
    id: "demo-photo-3",
    url: "/demo/demo-album-3.jpg",
    previewUrl: "/demo/demo-album-3.jpg",
    originalFilename: "Demo Event sample photo 3",
    mimeType: "image/jpeg",
    sizeBytes: 2455470,
    createdAt: "2026-06-14T20:23:00.000Z",
    guestNickname: "Jordan",
    isFeatured: true,
    likeCount: 21,
    likedByMe: false,
  },
  {
    id: "demo-photo-4",
    url: "/demo/demo-album-4.jpg",
    previewUrl: "/demo/demo-album-4.jpg",
    originalFilename: "Demo Event sample photo 4",
    mimeType: "image/jpeg",
    sizeBytes: 1671281,
    createdAt: "2026-06-14T20:31:00.000Z",
    guestNickname: "Taylor",
    isFeatured: false,
    likeCount: 9,
    likedByMe: false,
  },
] satisfies Photo[];
const LANDING_USE_CASES = [
  { label: "Pregames", icon: "cup", image: "/landing/pregames.jpg" },
  { label: "Birthdays", icon: "cake", image: "/landing/birthdays.jpg" },
  { label: "Club events", icon: "music", image: "/landing/club-events.jpg" },
  { label: "Friend trips", icon: "plane", image: "/landing/friend-trips.jpg" },
  { label: "Graduation dinners", icon: "cap", image: "/landing/graduation-dinners.jpg" },
  { label: "Greek life", icon: "columns", image: "/landing/greek-life.jpg" },
] as const;
const LANDING_STYLES = [
  { label: "Simple Album", icon: "grid", image: "/landing/style-simple-album.jpg", description: "A clean album of everyone's photos." },
  { label: "Photo Prompts", icon: "message", image: "/landing/style-photo-prompts.jpg", description: "Fun prompts to spark the best moments." },
  { label: "Color Hunt", icon: "droplet", image: "/landing/style-color-hunt.jpg", description: "See your event through a shared color lens." },
  { label: "Awards", icon: "trophy", image: "/landing/style-awards.jpg", description: "Celebrate the moments (and the people)." },
  { label: "Memory Capsule", icon: "lock", image: "/landing/style-memory-capsule.jpg", description: "Collect messages and memories for the future." },
] as const;
const LANDING_FAQS = [
  ["Do guests need an account?", "No. Guests can add photos from the event link in their browser without creating an account."],
  ["Can I control who sees the photos?", "Yes. Hosts can review the album and share the recap when it is ready."],
  ["When and how do we get the recap?", "After the event, share one recap link so everyone has the photos in one place."],
  ["Can I add photos after the event?", "Yes. Keep the guest link open if you want people to add more."],
  ["Is there a limit on photos?", "No. Guests can keep adding photos from the event link."],
] as const;

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
};
const BETA_ISSUE_AREAS = [
  ["guest_upload", "Guest upload"],
  ["recap", "Shared Recap"],
  ["qr_poster", "QR or poster"],
  ["moderation", "Review photos"],
  ["analytics", "Analytics"],
  ["other", "Other"],
] as const;

const AuthContext = createContext<AuthContextValue | null>(null);
const eventFilmApi = createEventFilmApiClient({ baseUrl: API_BASE_URL });
const api = eventFilmApi.request;
const ANALYTICS_ANON_KEY = "eventfilm_anon_id";

function isEditableKeyboardTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.matches("input:not([type='file']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']), textarea, select");
}

function useDocumentScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof window === "undefined") return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const originalHtmlOverflow = documentElement.style.overflow;
    const originalBodyOverflow = body.style.overflow;
    const originalBodyPosition = body.style.position;
    const originalBodyTop = body.style.top;
    const originalBodyLeft = body.style.left;
    const originalBodyRight = body.style.right;
    const originalBodyWidth = body.style.width;

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      documentElement.style.overflow = originalHtmlOverflow;
      body.style.overflow = originalBodyOverflow;
      body.style.position = originalBodyPosition;
      body.style.top = originalBodyTop;
      body.style.left = originalBodyLeft;
      body.style.right = originalBodyRight;
      body.style.width = originalBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

function useMobileKeyboardZoomRecovery() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return;

    const visualViewport = window.visualViewport;
    let lastKeyboardTarget: HTMLElement | null = null;
    let recoveryTimer: number | undefined;
    let viewportHeight = visualViewport?.height || window.innerHeight;

    function clearRecoveryTimer() {
      if (recoveryTimer === undefined) return;
      window.clearTimeout(recoveryTimer);
      recoveryTimer = undefined;
    }

    function recoverViewport() {
      clearRecoveryTimer();
      recoveryTimer = window.setTimeout(() => {
        if (isEditableKeyboardTarget(document.activeElement)) return;

        const viewportOffsetTop = visualViewport?.offsetTop || 0;
        const scale = visualViewport?.scale || 1;
        if (viewportOffsetTop || Math.abs(scale - 1) > 0.01) {
          window.scrollBy({ top: viewportOffsetTop, left: 0, behavior: "instant" });
        }

        if (lastKeyboardTarget?.isConnected) {
          const rect = lastKeyboardTarget.getBoundingClientRect();
          const visibleHeight = visualViewport?.height || window.innerHeight;
          const isOffscreen = rect.top < 0 || rect.bottom > visibleHeight;
          if (isOffscreen) lastKeyboardTarget.scrollIntoView({ block: "center", inline: "nearest" });
        }

        lastKeyboardTarget = null;
      }, 120);
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isEditableKeyboardTarget(event.target)) return;
      clearRecoveryTimer();
      lastKeyboardTarget = event.target;
      viewportHeight = visualViewport?.height || window.innerHeight;
    }

    function handleFocusOut(event: FocusEvent) {
      if (isEditableKeyboardTarget(event.target)) recoverViewport();
    }

    function handleViewportResize() {
      if (!visualViewport) return;
      const nextHeight = visualViewport.height;
      const keyboardLikelyClosed = lastKeyboardTarget && !isEditableKeyboardTarget(document.activeElement) && nextHeight >= viewportHeight - 2;
      viewportHeight = Math.max(viewportHeight, nextHeight);
      if (keyboardLikelyClosed) recoverViewport();
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      clearRecoveryTimer();
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      visualViewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);
}


function isLocalHost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function isPrivateHost(hostname: string) {
  return isLocalHost(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function assetUrl(value?: string | null) {
  if (!value) return "";
  try {
    const apiUrl = new URL(API_BASE_URL);
    const resolved = new URL(value, API_ORIGIN);
    if (isLocalHost(apiUrl.hostname) && isPrivateHost(resolved.hostname)) {
      resolved.protocol = apiUrl.protocol;
      resolved.host = apiUrl.host;
    }
    return resolved.toString();
  } catch {
    return value;
  }
}

function photoImageSrc(photo: Pick<Photo, "previewUrl" | "url">) {
  return assetUrl(photo.previewUrl || photo.url);
}

const preloadedPhotoUrls = new Set<string>();

function preloadPhotoUrl(value?: string | null) {
  const src = assetUrl(value);
  if (!src || preloadedPhotoUrls.has(src) || typeof Image === "undefined") return;
  preloadedPhotoUrls.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  if (image.decode) void image.decode().catch(() => undefined);
}

function photoFileExtension(photo: Pick<Photo, "originalFilename" | "mimeType">) {
  const originalExtension = photo.originalFilename.match(/\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i)?.[0].toLowerCase();
  if (originalExtension) return originalExtension;
  if (/png/i.test(photo.mimeType)) return ".png";
  if (/webp/i.test(photo.mimeType)) return ".webp";
  if (/gif/i.test(photo.mimeType)) return ".gif";
  if (/heic/i.test(photo.mimeType)) return ".heic";
  if (/heif/i.test(photo.mimeType)) return ".heif";
  return ".jpg";
}

function selectedPhotoFilename(photo: Pick<Photo, "id" | "originalFilename" | "mimeType">, index: number) {
  const withoutExtension = photo.originalFilename.replace(/\.[^.]+$/, "");
  const baseName = safeFilename(withoutExtension) || `event-photo-${photo.id.slice(0, 8)}`;
  return `${String(index + 1).padStart(2, "0")}-${baseName}${photoFileExtension(photo)}`;
}

async function fetchSelectedPhotoFile(photo: Pick<Photo, "id" | "url" | "originalFilename" | "mimeType">, index: number) {
  const response = await fetch(assetUrl(photo.url));
  if (!response.ok) throw new Error("Could not load one of the selected photos.");
  const blob = await response.blob();
  return new File([blob], selectedPhotoFilename(photo, index), { type: blob.type || photo.mimeType || "image/jpeg" });
}

function canSharePhotoFiles(files: File[]) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files });
  } catch {
    return false;
  }
}

function downloadPhotoFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 1000);
}

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth context is missing");
  return value;
}

function getAnalyticsAnonymousId() {
  try {
    const saved = localStorage.getItem(ANALYTICS_ANON_KEY);
    if (saved) return saved;
    const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(ANALYTICS_ANON_KEY, next);
    return next;
  } catch {
    return "anonymous";
  }
}

function trackAnalytics(name: AnalyticsEventName, input: Omit<AnalyticsEventInput, "name" | "source" | "anonymousId"> = {}) {
  eventFilmApi
    .trackAnalyticsEvent(
      {
        ...input,
        name,
        source: "web",
        path: input.path || window.location.pathname,
        anonymousId: getAnalyticsAnonymousId(),
      },
      localStorage.getItem("eventfilm_token"),
    )
    .catch(() => {});
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem("eventfilm_token"));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("eventfilm_user");
    return saved ? JSON.parse(saved) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      login(nextToken, nextUser) {
        localStorage.setItem("eventfilm_token", nextToken);
        localStorage.setItem("eventfilm_user", JSON.stringify(nextUser));
        setToken(nextToken);
        setUser(nextUser);
      },
      logout() {
        localStorage.removeItem("eventfilm_token");
        localStorage.removeItem("eventfilm_user");
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fff8ed] p-6 text-stone-950">
          <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-[#eadfce] bg-white p-6 text-center shadow-[0_24px_70px_rgba(101,62,0,0.08)]">
            <h1 className="font-display text-3xl font-bold">EventFilm needs a refresh</h1>
            <p className="mt-3 text-stone-600">Something unexpected happened while loading this page. Refresh once, then ask the host for a fresh link if it continues.</p>
            <Button className="mt-5" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatEventCardDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function publicRouteErrorMessage(error: unknown, fallback = "This event link is not available right now. Check the link or ask the host to resend it.") {
  const message = (error as Error).message || "";
  if (/not found/i.test(message)) return "We could not find this event. Check the link or ask the host to resend it.";
  if (/locked until/i.test(message)) return "This album is still locked until the host's reveal time.";
  if (/failed to fetch|network/i.test(message)) return "EventFilm could not reach the server. Check your connection and try again.";
  if (/photo must|upload a jpg|choose|enter your name|select|prompt|award/i.test(message)) return message;
  return fallback;
}

function toDateTimeLocal(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

type EventSettingsForm = {
  name: string;
  description: string;
  revealAt?: string;
};

function eventSettingsFormFromEvent(event: Pick<EventSummary, "name" | "description" | "revealAt">): EventSettingsForm {
  return {
    name: event.name,
    description: event.description || "",
    revealAt: toDateTimeLocal(new Date(event.revealAt)),
  };
}

function safeDateInputToIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function eventSettingsInputFromForm(form: EventSettingsForm, options: { requireRevealAt?: boolean } = {}): UpdateEventSettingsInput {
  return {
    name: form.name,
    description: form.description,
    ...(options.requireRevealAt ? { revealAt: safeDateInputToIso(form.revealAt || "") } : {}),
  };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function safeFilename(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "eventfilm";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(rows: Array<Array<string | number | null | undefined>>, filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for desktop browsers that block clipboard writes without focus.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0.01";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Copy command failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

async function shareOrCopyText({ title, text, url, fallbackLabel, onStatus, analyticsName, eventId, eventSlug, surface }: { title: string; text: string; url?: string; fallbackLabel: string; onStatus: (value: string) => void; analyticsName: AnalyticsEventName; eventId?: string; eventSlug?: string; surface: string }) {
  const payload = url ? { title, text, url } : { title, text };
  if (navigator.share) {
    trackAnalytics("native_share_opened", { eventId, eventSlug, metadata: { surface } });
    await navigator.share(payload);
    trackAnalytics(analyticsName, { eventId, eventSlug, metadata: { surface, method: "native" } });
    onStatus(`${fallbackLabel} shared`);
    return;
  }

  await copyText(url ? `${text} ${url}` : text);
  trackAnalytics(analyticsName, { eventId, eventSlug, metadata: { surface, method: "copy_fallback" } });
  onStatus(`${fallbackLabel} copied`);
}

function getGuestSession(slug: string) {
  const key = `eventfilm_guest_${slug}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const session = JSON.parse(saved) as { clientId: string; nickname: string };
      return { key, session: { ...session, nickname: isAnonymousGuestDisplayName(session.nickname) ? "" : session.nickname } };
    }
    const session = { clientId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, nickname: "" };
    localStorage.setItem(key, JSON.stringify(session));
    return { key, session };
  } catch {
    return { key, session: { clientId: `${Date.now()}-${Math.random()}`, nickname: "" } };
  }
}

function getGuestUploadMetadataKey(slug: string) {
  return `eventfilm_guest_uploads_${slug}`;
}

function loadGuestUploadMetadata(slug: string): GuestUploadLocalMetadata[] {
  try {
    const saved = localStorage.getItem(getGuestUploadMetadataKey(slug));
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is GuestUploadLocalMetadata => Boolean(item?.photoId && item?.uploadedAt && item?.guestDisplayName));
  } catch {
    return [];
  }
}

function saveGuestUploadMetadata(slug: string, uploads: GuestUploadLocalMetadata[]) {
  localStorage.setItem(getGuestUploadMetadataKey(slug), JSON.stringify(uploads.slice(0, 40)));
}

function recordGuestUploadMetadata(slug: string, photo: Photo) {
  const nextItem: GuestUploadLocalMetadata = {
    photoId: photo.id,
    uploadedAt: photo.createdAt,
    guestDisplayName: sanitizeGuestDisplayName(photo.challengeParticipantName || photo.guestNickname),
    challengeLabel: photoChallengeLabel(photo) || undefined,
  };
  const existing = loadGuestUploadMetadata(slug).filter((item) => item.photoId !== photo.id);
  saveGuestUploadMetadata(slug, [nextItem, ...existing]);
  return [nextItem, ...existing];
}

type GuestUploadQueueStatus = "queued" | "uploading" | "uploaded" | "failed";
type GuestPhotoPickerSource = "camera" | "library";
type GuestAlbumSaveStatus = { tone: "info" | "success" | "error"; text: string };
type GuestAlbumTabKey = "photos" | "people" | "highlights";
type GuestAlbumTab = { key: GuestAlbumTabKey; label: string };

const GUEST_LIBRARY_FILE_ACCEPT = [...ALLOWED_IMAGE_MIME_TYPES, ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].join(",");

type GuestUploadQueueItem = {
  id: string;
  file: File;
  status: GuestUploadQueueStatus;
  error?: string;
  photo?: Photo;
  retryable?: boolean;
};

function createGuestUploadQueueId(index: number) {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}-${Math.random()}`;
}

function GuestAlbumHeader({
  activeTab,
  canSelectPhotos,
  eventName,
  eventSlug,
  headerRef,
  isSnapshot = false,
  onAddPhotos,
  onBack,
  onOptionsToggle,
  onSelectPhotos,
  onTabChange,
  optionsOpen,
  subtitle,
  tabs,
}: {
  activeTab: GuestAlbumTabKey;
  canSelectPhotos: boolean;
  eventName: string;
  eventSlug: string;
  headerRef?: React.Ref<HTMLElement>;
  isSnapshot?: boolean;
  onAddPhotos: () => void;
  onBack: () => void;
  onOptionsToggle: () => void;
  onSelectPhotos: () => void;
  onTabChange: (tab: GuestAlbumTabKey) => void;
  optionsOpen: boolean;
  subtitle: string;
  tabs: GuestAlbumTab[];
}) {
  const topControlClass = "grid h-10 w-10 place-items-center rounded-full text-stone-700 hover:bg-stone-100";

  return (
    <header
      ref={headerRef}
      className={cx(
        "bg-white/96 backdrop-blur",
        isSnapshot ? "fixed inset-x-0 top-0 z-50 pointer-events-auto" : "sticky top-0 z-20",
      )}
      data-testid={isSnapshot ? "guest-album-header-snapshot" : "guest-album-header"}
      aria-hidden={isSnapshot || undefined}
    >
      <div className="mx-auto max-w-[430px] px-3 pt-3">
        <div className="relative flex min-h-16 items-center justify-between">
          {isSnapshot ? (
            <span className={topControlClass}>
              <CleanIcon name="chevronLeft" className="h-5 w-5" />
            </span>
          ) : (
            <button type="button" className={topControlClass} aria-label="Go back" onClick={onBack}>
              <CleanIcon name="chevronLeft" className="h-5 w-5" />
            </button>
          )}
          <div className="absolute left-12 right-12 top-1/2 -translate-y-1/2 text-center">
            <h1 className="truncate text-xl font-bold leading-6 text-stone-950">{eventName}</h1>
            <p className="mt-1 text-xs font-semibold text-stone-500">{subtitle}</p>
          </div>
          <div className="relative">
            {isSnapshot ? (
              <span className={topControlClass}>
                <CleanIcon name="more" className="h-5 w-5" />
              </span>
            ) : (
              <button type="button" className={topControlClass} aria-label="Open event options" onClick={onOptionsToggle}>
                <CleanIcon name="more" className="h-5 w-5" />
              </button>
            )}
            {!isSnapshot && optionsOpen ? (
              <div className="absolute right-0 top-11 z-30 w-44 rounded-lg border border-stone-200 bg-white p-1 text-sm font-semibold text-stone-800 shadow-sm">
                <a className="block rounded-md px-3 py-2 hover:bg-stone-50" href={`/recap/${eventSlug}`}>Shared Recap</a>
                <button type="button" className={cx("block w-full rounded-md px-3 py-2 text-left hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-white", canSelectPhotos ? "" : "text-stone-400")} disabled={!canSelectPhotos} onClick={onSelectPhotos}>Select Photos</button>
                <button type="button" className="block w-full rounded-md px-3 py-2 text-left hover:bg-stone-50" onClick={onAddPhotos}>Add photos</button>
              </div>
            ) : null}
          </div>
        </div>
        <nav className="mt-1 grid grid-cols-3 border-b border-stone-200 text-sm font-semibold">
          {tabs.map((tab) => (
            isSnapshot ? (
              <span
                className={cx("border-b-2 px-2 py-3 text-center transition", activeTab === tab.key ? "border-[#e85d3f] text-[#e85d3f]" : "border-transparent text-stone-500 hover:text-stone-950")}
                key={tab.key}
              >
                {tab.label}
              </span>
            ) : (
              <button
                type="button"
                className={cx("border-b-2 px-2 py-3 transition", activeTab === tab.key ? "border-[#e85d3f] text-[#e85d3f]" : "border-transparent text-stone-500 hover:text-stone-950")}
                onClick={() => onTabChange(tab.key)}
                key={tab.key}
              >
                {tab.label}
              </button>
            )
          ))}
        </nav>
      </div>
    </header>
  );
}

function getChallengeParticipantSession(slug: string) {
  return `eventfilm_challenge_participant_${slug}`;
}

function getChallengePromptSession(slug: string) {
  return `eventfilm_challenge_prompt_${slug}`;
}

function getChallengeItemSession(slug: string) {
  return `eventfilm_challenge_item_${slug}`;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <PrimaryButton className={className} {...props}>{children}</PrimaryButton>;
}

function SecondaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <CleanSecondaryButton className={className} {...props}>{children}</CleanSecondaryButton>;
}

function TextInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-[1.15rem] border border-[#e7ded3] bg-[#fffaf6] px-4 py-3 text-base font-semibold text-stone-950 outline-none transition placeholder:font-medium placeholder:text-stone-400 focus:border-[#e85d3f] focus:bg-white focus:ring-4 focus:ring-[#ffe1d8]",
        className,
      )}
      {...props}
    />
  );
}

function TextArea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-[1.15rem] border border-[#e7ded3] bg-[#fffaf6] px-4 py-3 text-base font-semibold text-stone-950 outline-none transition placeholder:font-medium placeholder:text-stone-400 focus:border-[#e85d3f] focus:bg-white focus:ring-4 focus:ring-[#ffe1d8]",
        className,
      )}
      {...props}
    />
  );
}

function Icon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const icon = String(children);
  const common = {
    className: cx("h-5 w-5 shrink-0", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
  const paths: Record<string, React.ReactNode> = {
    arrow_forward: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    photo_camera: <><path d="M14.5 5 13 3H8L6.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" /><circle cx="12" cy="12.5" r="3.5" /></>,
    photo_library: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 15 3-3 2 2 3-4 3 5" /></>,
    calendar_today: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /></>,
    qr_code_2: <><path d="M4 4h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6H4z" /><path d="M14 14h2v2h-2z" /><path d="M18 14h2v6h-6v-2h4z" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    cloud_upload: <><path d="M16 16l-4-4-4 4" /><path d="M12 12v9" /><path d="M20 16.5A4.5 4.5 0 0 0 17.2 8 6 6 0 0 0 5.5 9.3 4.5 4.5 0 0 0 6 18h2" /></>,
    live_tv: <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 18v3" /><path d="m10 9 5 3-5 3z" /></>,
    auto_stories: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" /><path d="M8 7h8" /><path d="M8 11h6" /></>,
    upload: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>,
  };

  return <svg {...common}>{paths[icon] || <circle cx="12" cy="12" r="8" />}</svg>;
}

function StatusPill({ children, tone = "amber" }: { children: React.ReactNode; tone?: "amber" | "green" | "stone" | "red" | "plum" }) {
  const tones = {
    amber: "bg-[#fff0d8] text-[#7c3f00] ring-[#f7d89c]",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    stone: "bg-stone-100 text-stone-700 ring-stone-200",
    red: "bg-red-50 text-red-800 ring-red-100",
    plum: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-100",
  };
  return <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase ring-1", tones[tone])}>{children}</span>;
}

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <CleanCard id={id} className={className}>{children}</CleanCard>;
}

function ColorChip({ participant }: { participant: Pick<ChallengeParticipant, "colorName" | "colorHex"> }) {
  const isLight = ["White", "Yellow"].includes(participant.colorName);
  return (
    <span className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold", isLight ? "bg-stone-100 text-stone-800" : "bg-stone-950 text-white")}>
      <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: participant.colorHex }} />
      {participant.colorName}
    </span>
  );
}

function PhotoStatusBadges({ photo }: { photo: Photo; host?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {photo.isFeatured && <StatusPill tone="amber">Host pick</StatusPill>}
      {Number(photo.likeCount || 0) > 0 && <StatusPill tone="red">{photo.likeCount} {photo.likeCount === 1 ? "heart" : "hearts"}</StatusPill>}
      {photoChallengeLabel(photo) && <StatusPill tone="stone">{photoChallengeLabel(photo)}</StatusPill>}
    </div>
  );
}

type PhotoLikeToggleHandler = (photo: Photo, liked: boolean) => void | Promise<void>;

function photoHeartLabel(count: number) {
  return `${count} ${count === 1 ? "heart" : "hearts"}`;
}

function applyPhotoLikeState(photo: Photo, liked: boolean, likeCount?: number): Photo {
  const currentCount = Math.max(0, Number(photo.likeCount || 0));
  const nextCount = likeCount === undefined ? Math.max(0, currentCount + (liked ? 1 : -1)) : Math.max(0, likeCount);
  return { ...photo, likedByMe: liked, likeCount: nextCount };
}

function updatePhotoInList(photos: Photo[], photoId: string, updater: (photo: Photo) => Photo) {
  return photos.map((photo) => photo.id === photoId ? updater(photo) : photo);
}

function PhotoHeartButton({
  photo,
  onToggle,
  className = "",
  variant = "light",
}: {
  photo: Photo;
  onToggle?: PhotoLikeToggleHandler;
  className?: string;
  variant?: "light" | "solid";
}) {
  const count = Math.max(0, Number(photo.likeCount || 0));
  const liked = Boolean(photo.likedByMe);
  const label = liked ? `Unlike photo, ${photoHeartLabel(count)}` : `Like photo, ${photoHeartLabel(count)}`;
  const baseTone = variant === "solid"
    ? liked
      ? "bg-[#e85d3f] text-white shadow-sm"
      : "bg-white/95 text-stone-900 shadow-sm ring-1 ring-black/5"
    : liked
      ? "bg-[#fff0ed] text-[#d94f33] ring-1 ring-[#ffd4c7]"
      : "bg-white text-stone-800 ring-1 ring-[#eadfce] hover:bg-[#fffaf6]";

  return (
    <button
      type="button"
      className={cx("inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60", baseTone, className)}
      aria-pressed={liked}
      aria-label={label}
      title={label}
      disabled={!onToggle}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.(photo, !liked);
      }}
    >
      <CleanIcon name="heart" className={cx("h-4 w-4", liked ? "fill-current" : "")} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "accent" | "green" | "plum" }) {
  const tones = {
    default: "border-[#eadfce] bg-white text-[#653e00]",
    accent: "border-[#ffd4c7] bg-[#fff3ee] text-[#d94f33]",
    green: "border-emerald-100 bg-emerald-50 text-emerald-800",
    plum: "border-[#ead8e4] bg-[#fff4fb] text-[#6d3f5b]",
  };
  return (
    <div className={cx("rounded-[1.35rem] border p-4 shadow-[0_12px_30px_rgba(101,62,0,0.05)]", tones[tone])}>
      <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase text-stone-500">{label}</p>
    </div>
  );
}

function FullScreenPhotoViewer({
  photo,
  photos = [],
  mode,
  onClose,
  onHostAction,
  onPhotoLike,
}: {
  photo: Photo | null;
  photos?: Photo[];
  mode: "public" | "host";
  onClose: () => void;
  onHostAction?: (action: "feature" | "unfeature" | "delete", photo: Photo) => Promise<void>;
  onPhotoLike?: PhotoLikeToggleHandler;
}) {
  const [busy, setBusy] = useState("");
  const [localStatus, setLocalStatus] = useState("");
  const [activePhotoId, setActivePhotoId] = useState(photo?.id || "");
  const viewerStripRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const galleryPhotos = useMemo(() => (photos.length ? photos : photo ? [photo] : []), [photos, photo]);
  const currentIndex = activePhotoId ? galleryPhotos.findIndex((item) => item.id === activePhotoId) : -1;
  const visibleIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentPhoto = currentIndex >= 0 ? galleryPhotos[currentIndex] : photo;
  const canNavigate = Boolean(currentPhoto && galleryPhotos.length > 1 && currentIndex >= 0);

  useDocumentScrollLock(Boolean(photo));

  useEffect(() => {
    setActivePhotoId(photo?.id || "");
  }, [photo?.id]);

  useEffect(() => {
    if (!photo || !galleryPhotos.length || !activePhotoId) return;
    if (galleryPhotos.some((item) => item.id === activePhotoId)) return;
    setActivePhotoId(galleryPhotos[0].id);
  }, [activePhotoId, galleryPhotos, photo]);

  useEffect(() => {
    if (!photo || !galleryPhotos.length) return;
    const nextIndex = Math.max(0, galleryPhotos.findIndex((item) => item.id === photo.id));
    const frame = window.requestAnimationFrame(() => scrollToIndex(nextIndex, "auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [photo?.id, galleryPhotos.length]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  useEffect(() => {
    setBusy("");
    setLocalStatus("");
  }, [currentPhoto?.id]);

  useEffect(() => {
    if (!currentPhoto) return;
    preloadPhotoUrl(currentPhoto.url);
    if (!canNavigate) return;
    preloadPhotoUrl(galleryPhotos[(visibleIndex + 1) % galleryPhotos.length]?.url);
    preloadPhotoUrl(galleryPhotos[(visibleIndex - 1 + galleryPhotos.length) % galleryPhotos.length]?.url);
  }, [canNavigate, currentPhoto?.url, galleryPhotos, visibleIndex]);

  useEffect(() => {
    if (!photo) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") navigatePhoto(-1);
      if (event.key === "ArrowRight") navigatePhoto(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photo, currentIndex, galleryPhotos, onClose]);

  if (!photo || !currentPhoto) return null;

  function navigatePhoto(direction: -1 | 1) {
    if (!canNavigate) return;
    const nextIndex = (visibleIndex + direction + galleryPhotos.length) % galleryPhotos.length;
    scrollToIndex(nextIndex);
  }

  function scrollToIndex(index: number, behavior: ScrollBehavior = "smooth") {
    const nextPhoto = galleryPhotos[index];
    if (!nextPhoto) return;
    setActivePhotoId(nextPhoto.id);
    const strip = viewerStripRef.current;
    if (!strip) return;
    strip.scrollTo({ left: strip.clientWidth * index, behavior });
  }

  function handleViewerScroll() {
    const strip = viewerStripRef.current;
    if (!strip || !galleryPhotos.length || scrollFrameRef.current !== null) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const pageWidth = Math.max(1, strip.clientWidth);
      const nextIndex = Math.max(0, Math.min(galleryPhotos.length - 1, Math.round(strip.scrollLeft / pageWidth)));
      const nextPhoto = galleryPhotos[nextIndex];
      if (nextPhoto && nextPhoto.id !== activePhotoId) setActivePhotoId(nextPhoto.id);
    });
  }

  async function runHostAction(action: "feature" | "unfeature" | "delete") {
    const photoForAction = currentPhoto;
    if (!onHostAction || !photoForAction) return;
    setBusy(action);
    try {
      await onHostAction(action, photoForAction);
      if (action !== "delete") setLocalStatus("Updated");
    } catch (err) {
      setLocalStatus((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  const guestName = currentPhoto.challengeParticipantName || currentPhoto.guestNickname || "Guest photo";
  const photoDate = formatEventCardDate(currentPhoto.createdAt);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-app text-ink" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div
        ref={viewerStripRef}
        className="photo-viewer-strip absolute inset-0 flex snap-x snap-mandatory overflow-x-auto pb-32 pt-24 sm:pb-36 sm:pt-28"
        aria-label="Photo carousel"
        data-testid="photo-viewer-strip"
        onScroll={handleViewerScroll}
      >
        {galleryPhotos.map((galleryPhoto, index) => (
          <div
            className="flex h-full w-full shrink-0 snap-center select-none items-center justify-center px-0 sm:px-8"
            data-active={index === visibleIndex ? "true" : "false"}
            data-testid="photo-viewer-slide"
            key={galleryPhoto.id}
          >
            <img
              className="max-h-full max-w-full object-contain"
              src={assetUrl(galleryPhoto.url)}
              alt={galleryPhoto.originalFilename}
              draggable={false}
              loading={Math.abs(index - visibleIndex) <= 1 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={index === visibleIndex ? "high" : "auto"}
            />
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
        <div className="pointer-events-auto relative mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-stone-900 shadow-sm ring-1 ring-[#eadfce] transition hover:bg-[#fffaf6]" onClick={onClose} aria-label="Close photo viewer">
            <Icon>close</Icon>
          </button>
          {galleryPhotos.length > 1 ? <p className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-bold tabular-nums text-stone-950">{visibleIndex + 1} of {galleryPhotos.length}</p> : null}
          <div className="flex min-h-11 min-w-11 justify-end">
            {mode === "public" && onPhotoLike ? (
              <PhotoHeartButton photo={currentPhoto} onToggle={onPhotoLike} variant="solid" />
            ) : (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-stone-800 shadow-sm ring-1 ring-[#eadfce]" aria-label={photoHeartLabel(Math.max(0, Number(currentPhoto.likeCount || 0)))}>
                <CleanIcon name="heart" className="h-4 w-4" />
                <span className="tabular-nums">{Math.max(0, Number(currentPhoto.likeCount || 0))}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {canNavigate ? (
        <>
          <button type="button" className="absolute left-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white text-stone-900 shadow-sm ring-1 ring-[#eadfce] transition hover:bg-[#fffaf6] sm:grid" onClick={() => navigatePhoto(-1)} aria-label="Previous photo">
            <CleanIcon name="chevronLeft" />
          </button>
          <button type="button" className="absolute right-3 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white text-stone-900 shadow-sm ring-1 ring-[#eadfce] transition hover:bg-[#fffaf6] sm:grid" onClick={() => navigatePhoto(1)} aria-label="Next photo">
            <span className="rotate-180"><CleanIcon name="chevronLeft" /></span>
          </button>
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-app/95 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-stone-950">{guestName}</h2>
          </div>
          <p className="shrink-0 pb-1 text-right text-sm font-semibold text-stone-600">{photoDate}</p>
        </div>
        {mode === "host" && onHostAction ? (
          <div className="mx-auto mt-4 flex max-w-5xl flex-wrap gap-2">
            {currentPhoto.isFeatured ? (
              <button type="button" className="min-h-11 rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-800 ring-1 ring-[#eadfce] disabled:opacity-50" disabled={Boolean(busy)} onClick={() => runHostAction("unfeature")}>Remove host pick</button>
            ) : (
              <button type="button" className="min-h-11 rounded-full bg-[#e85d3f] px-4 py-2 text-sm font-bold text-white disabled:bg-stone-300 disabled:text-stone-700" disabled={Boolean(busy)} onClick={() => runHostAction("feature")}>Make host pick</button>
            )}
            <button type="button" className="min-h-11 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:bg-stone-300" disabled={Boolean(busy)} onClick={() => runHostAction("delete")}>Delete</button>
          </div>
        ) : null}
        {localStatus ? <p className="mx-auto mt-3 max-w-5xl rounded-lg bg-white px-3 py-2 text-sm font-bold text-stone-800 ring-1 ring-[#eadfce]">{localStatus}</p> : null}
      </div>
    </div>
  );
}

function PhotoStylePicker({ draft, onSelect }: { draft: ChallengeDraft; onSelect: (type: ChallengeDraft["type"]) => void }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold text-ink">Photo style</h2>
      <p className="mt-1 text-sm text-muted">Simple Album is fastest. Add a lightweight game only if it helps the room.</p>
      <div className="mt-4 flex max-w-full min-w-0 gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {CHALLENGE_PACKS.map((pack) => {
          const selected = draft.type === pack.mode;
          return (
            <button
              type="button"
              className={cx(
                "min-w-[180px] rounded-lg border p-4 text-left text-sm transition lg:min-w-0",
                selected ? "border-coral bg-coral-soft text-ink" : "border-line bg-white text-ink hover:border-coral/40",
              )}
              onClick={() => onSelect(pack.mode)}
              key={pack.slug}
            >
              <span className="block font-bold">{plainModeLabel(pack.mode)}</span>
              <span className="mt-1 block leading-5 text-muted">{pack.shortDescription}</span>
              <span className="mt-3 block text-xs font-semibold text-muted">{pack.setupComplexity} setup</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function usesPromptPackSetup(type: ChallengeDraft["type"]) {
  return type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT || type === CHALLENGE_TYPES.EVENT_AWARDS;
}

function sortableItemId(item: { id?: string }, index: number, prefix: string) {
  return item.id || `${prefix}-${index}`;
}

function SortableEditorList<T extends { id?: string }>({
  items,
  idPrefix,
  getHandleLabel,
  onReorder,
  children,
}: {
  items: T[];
  idPrefix: string;
  getHandleLabel: (item: T, index: number) => string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: (item: T, index: number) => React.ReactNode;
}) {
  const [keyboardActiveId, setKeyboardActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const itemIds = useMemo(() => items.map((item, index) => sortableItemId(item, index, idPrefix)), [idPrefix, items]);

  useEffect(() => {
    if (keyboardActiveId && !itemIds.includes(keyboardActiveId)) setKeyboardActiveId(null);
  }, [itemIds, keyboardActiveId]);

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const fromIndex = itemIds.indexOf(String(event.active.id));
    const toIndex = itemIds.indexOf(String(event.over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    onReorder(fromIndex, toIndex);
  }

  function handleKeyboardMove(id: string, direction: -1 | 1) {
    const fromIndex = itemIds.indexOf(id);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= itemIds.length) return;
    onReorder(fromIndex, toIndex);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="mt-3 grid gap-3">
          {items.map((item, index) => (
            <SortableEditorRow
              id={itemIds[index]}
              index={index}
              handleLabel={getHandleLabel(item, index)}
              isKeyboardActive={keyboardActiveId === itemIds[index]}
              onKeyboardMove={(direction) => handleKeyboardMove(itemIds[index], direction)}
              onKeyboardToggle={() => setKeyboardActiveId((current) => (current === itemIds[index] ? null : itemIds[index]))}
              key={itemIds[index]}
            >
              {children(item, index)}
            </SortableEditorRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableEditorRow({
  id,
  index,
  handleLabel,
  isKeyboardActive,
  onKeyboardMove,
  onKeyboardToggle,
  children,
}: {
  id: string;
  index: number;
  handleLabel: string;
  isKeyboardActive: boolean;
  onKeyboardMove: (direction: -1 | 1) => void;
  onKeyboardToggle: () => void;
  children: React.ReactNode;
}) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onKeyboardToggle();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      onKeyboardMove(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        "grid gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center",
        isDragging && "relative z-10 ring-2 ring-amber-300",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold text-stone-600">{index + 1}</span>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={cx(
            "grid h-10 w-10 touch-none place-items-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-coral/40 hover:text-stone-900 focus:outline-none focus:ring-4 focus:ring-[#ffe1d8] active:cursor-grabbing sm:cursor-grab",
            isKeyboardActive && "border-coral text-stone-900 ring-4 ring-[#ffe1d8]",
          )}
          aria-label={handleLabel}
          title="Drag to reorder"
          {...attributes}
          {...(listeners || {})}
          aria-pressed={isKeyboardActive}
          onKeyDown={handleKeyDown}
        >
          <CleanIcon name="grip" className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function ChallengeSetup({
  draft,
  onChange,
  promptLibraryInitiallyOpen = false,
  compactForCreate = false,
  advancedOnly = false,
}: {
  draft: ChallengeDraft;
  onChange: (draft: ChallengeDraft) => void;
  promptLibraryInitiallyOpen?: boolean;
  compactForCreate?: boolean;
  advancedOnly?: boolean;
}) {
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(promptLibraryInitiallyOpen);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(advancedOnly || !compactForCreate);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isAwardEditorOpen, setIsAwardEditorOpen] = useState(false);
  const selectedPack = getChallengePack(draft.type);
  const selectedPromptPack = getPromptPack(draft.promptPackSlug);
  const showPromptPackSetup = usesPromptPackSetup(draft.type);
  const showDuplicateColorWarning = draft.type === CHALLENGE_TYPES.COLOR_HUNT && hasDuplicateParticipantColors(draft.participants);
  const showDuplicatePromptWarning = draft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && hasDuplicatePrompts(draft.prompts);
  const showDuplicateCategoryWarning = draft.type === CHALLENGE_TYPES.EVENT_AWARDS && hasDuplicateCategories(draft.categories);
  const validPromptCount = draft.prompts.filter((prompt) => prompt.text.trim()).length;
  const validCategoryCount = draft.categories.filter((category) => category.label.trim()).length;
  const validationError = validateChallengeDraft(draft);

  function updateType(type: ChallengeDraft["type"]) {
    trackAnalytics("event_mode_selected", { metadata: { mode: type } });
    onChange({ ...draft, type });
  }

  function selectPromptPack(promptPackSlug: PromptPackSlug) {
    const pack = getPromptPack(promptPackSlug);
    trackAnalytics("prompt_pack_selected", { metadata: { promptPackSlug, itemKind: pack.kind } });
    if (pack.kind === "award") {
      onChange({ ...draft, type: CHALLENGE_TYPES.EVENT_AWARDS, promptPackSlug, categories: createCategoriesFromPack(promptPackSlug) });
    } else {
      onChange({ ...draft, type: CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT, promptPackSlug, prompts: createPromptsFromPack(promptPackSlug) });
    }
  }

  function trackPromptsCustomized(itemKind: "prompt" | "award") {
    trackAnalytics("prompts_customized", { metadata: { itemKind, promptPackSlug: draft.promptPackSlug || "custom" } });
  }

  function updateParticipant(index: number, nextParticipant: ChallengeParticipant) {
    onChange({
      ...draft,
      participants: draft.participants.map((participant, participantIndex) => (participantIndex === index ? nextParticipant : participant)),
    });
  }

  function updateParticipantName(index: number, displayName: string) {
    updateParticipant(index, { ...draft.participants[index], displayName });
  }

  function updateParticipantColor(index: number, colorSlug: string) {
    const color = colorBySlug(colorSlug);
    updateParticipant(index, { ...draft.participants[index], ...color, displayName: draft.participants[index].displayName });
  }

  function addParticipant() {
    const color = COLOR_HUNT_PALETTE[draft.participants.length % COLOR_HUNT_PALETTE.length];
    onChange({ ...draft, participants: [...draft.participants, { ...color, displayName: "" }] });
  }

  function removeParticipant(index: number) {
    onChange({ ...draft, participants: draft.participants.filter((_, participantIndex) => participantIndex !== index) });
  }

  function randomizeColors() {
    const shuffledPalette = [...COLOR_HUNT_PALETTE];
    for (let index = shuffledPalette.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledPalette[index], shuffledPalette[swapIndex]] = [shuffledPalette[swapIndex], shuffledPalette[index]];
    }

    const hasDifferentAssignment = draft.participants.some((participant, index) => participant.colorSlug !== shuffledPalette[index % shuffledPalette.length].colorSlug);
    if (!hasDifferentAssignment && shuffledPalette.length > 1) {
      const firstColor = shuffledPalette.shift();
      if (firstColor) shuffledPalette.push(firstColor);
    }

    onChange({
      ...draft,
      participants: draft.participants.map((participant, index) => ({
        ...participant,
        ...shuffledPalette[index % shuffledPalette.length],
      })),
    });
  }

  function updatePrompt(index: number, text: string) {
    trackPromptsCustomized("prompt");
    onChange({
      ...draft,
      prompts: draft.prompts.map((prompt, promptIndex) => (promptIndex === index ? { ...prompt, text } : prompt)),
    });
  }

  function addPrompt() {
    setIsPromptEditorOpen(true);
    trackPromptsCustomized("prompt");
    onChange({ ...draft, prompts: [...draft.prompts, createPrompt("", draft.prompts.length)] });
  }

  function removePrompt(index: number) {
    trackPromptsCustomized("prompt");
    onChange({ ...draft, prompts: draft.prompts.filter((_, promptIndex) => promptIndex !== index).map((prompt, order) => ({ ...prompt, order })) });
  }

  function reorderPrompts(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    trackPromptsCustomized("prompt");
    onChange({ ...draft, prompts: arrayMove(draft.prompts, fromIndex, toIndex).map((nextPrompt, order) => ({ ...nextPrompt, order })) });
  }

  function useStarterPrompts() {
    setIsPromptEditorOpen(false);
    trackPromptsCustomized("prompt");
    onChange({ ...draft, promptPackSlug: null, prompts: createStarterPrompts() });
  }

  function updateCategory(index: number, label: string) {
    trackPromptsCustomized("award");
    onChange({
      ...draft,
      categories: draft.categories.map((category, categoryIndex) => (categoryIndex === index ? { ...category, label } : category)),
    });
  }

  function addCategory() {
    setIsAwardEditorOpen(true);
    trackPromptsCustomized("award");
    onChange({ ...draft, categories: [...draft.categories, createCategory("", draft.categories.length)] });
  }

  function removeCategory(index: number) {
    trackPromptsCustomized("award");
    onChange({ ...draft, categories: draft.categories.filter((_, categoryIndex) => categoryIndex !== index).map((category, order) => ({ ...category, order })) });
  }

  function reorderCategories(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    trackPromptsCustomized("award");
    onChange({ ...draft, categories: arrayMove(draft.categories, fromIndex, toIndex).map((nextCategory, order) => ({ ...nextCategory, order })) });
  }

  function useDefaultAwards() {
    setIsAwardEditorOpen(false);
    trackPromptsCustomized("award");
    onChange({ ...draft, promptPackSlug: null, categories: createDefaultAwardCategories() });
  }

  function updateCapsule(field: keyof ChallengeDraft["memoryCapsule"], value: string) {
    onChange({ ...draft, memoryCapsule: { ...draft.memoryCapsule, [field]: value } });
  }

  return (
    <div className={cx(advancedOnly ? "rounded-lg bg-white" : "rounded-xl bg-stone-50 p-5")}>
      {!advancedOnly && (
      <div className="grid gap-3">
        <div>
          <h2 className="font-serif-display text-3xl font-bold text-ink">How should photos work?</h2>
          <p className="mt-1 text-sm text-muted">{draft.type === "NONE" ? "Best for most hangouts. Everyone adds photos to one shared album." : selectedPack.shortDescription}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {CHALLENGE_PACKS.map((pack) => (
            <button
              type="button"
              className={cx("rounded-xl border p-4 text-left text-sm transition", draft.type === pack.mode ? "border-coral bg-white shadow-sm" : "border-line bg-white/70 hover:border-coral/40")}
              onClick={() => updateType(pack.mode)}
              key={pack.slug}
            >
              <span className="block font-bold text-ink">{plainModeLabel(pack.mode)}</span>
              <span className="mt-1 block text-muted">{pack.mode === "NONE" ? "Best for most hangouts. Everyone adds photos to one shared album." : pack.shortDescription}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {compactForCreate && !advancedOnly && (
        <div className="mt-5 rounded-xl bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-ink">{plainModeLabel(draft.type)}</h3>
              <p className="mt-1 text-sm text-muted">{draft.type === "NONE" ? "Best for most hangouts. Guests just add photos." : "Optional twist. You can adjust the details now or after creating the event."}</p>
            </div>
            <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={() => setIsMoreOptionsOpen((current) => !current)}>{isMoreOptionsOpen ? "Hide options" : "More options"}</SecondaryButton>
          </div>
        </div>
      )}

      {isMoreOptionsOpen && showPromptPackSetup ? (
      <div className={cx(advancedOnly ? "mt-4 rounded-lg border border-line bg-stone-50 p-4" : "mt-5 rounded-xl bg-white p-5")}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-500">Photo prompts</p>
            <h3 className="mt-1 text-lg font-bold text-ink">Selected: {selectedPromptPack.name}</h3>
            <p className="mt-1 text-sm text-stone-600">Includes {selectedPromptPack.items.length} ideas. You can change these later.</p>
          </div>
          <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={() => setIsPromptLibraryOpen((current) => !current)}>{isPromptLibraryOpen ? "Hide prompts" : "Customize prompts"}</SecondaryButton>
        </div>
        {isPromptLibraryOpen ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {PROMPT_PACKS.filter((pack) => pack.kind !== "custom").map((pack) => (
              <button
                type="button"
                className={cx("rounded-2xl border p-4 text-left text-sm transition", draft.promptPackSlug === pack.slug ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white hover:border-amber-300")}
                onClick={() => selectPromptPack(pack.slug)}
                key={pack.slug}
              >
                <span className="block text-xs font-bold uppercase text-amber-800">{pack.kind === "award" ? "Awards" : "Photo Prompts"}</span>
                <span className="mt-2 block font-bold text-stone-950">{pack.name}</span>
                <span className="mt-1 block text-stone-600">{pack.description}</span>
                <span className="mt-3 block text-xs font-semibold text-stone-500">{pack.items.slice(0, 4).join(" / ")}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      ) : null}

      {draft.type === "NONE" && !compactForCreate && (
        <div className="mt-5 rounded-3xl bg-white p-5">
          <StatusPill>Simple Album</StatusPill>
          <h3 className="mt-3 font-display text-lg font-bold">No extra setup needed</h3>
          <p className="mt-2 text-sm text-stone-600">{selectedPack.guestInstructions}</p>
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.COLOR_HUNT && isMoreOptionsOpen && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Set up Color Hunt</h3>
              <p className="text-sm text-stone-600">Assign each person a color. Guests will upload photos of things they find in their color.</p>
            </div>
            <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={randomizeColors}>Randomize colors</SecondaryButton>
          </div>

          <div className="grid gap-3">
            {draft.participants.map((participant, index) => (
              <div className="grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-[1fr_190px_auto] sm:items-center" key={index}>
                <TextInput value={participant.displayName} onChange={(event) => updateParticipantName(index, event.target.value)} placeholder={colorTeamDisplayName({ ...participant, displayName: "" })} />
                <label className="grid gap-1 text-xs font-bold uppercase text-stone-500">
                  Color
                  <select className="h-12 rounded-2xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" value={participant.colorSlug} onChange={(event) => updateParticipantColor(index, event.target.value)}>
                    {COLOR_HUNT_PALETTE.map((color) => (
                      <option value={color.colorSlug} key={color.colorSlug}>{color.colorName}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="min-h-10 rounded-full border border-stone-200 px-4 text-sm font-bold text-stone-600 hover:border-red-300 hover:text-red-700" onClick={() => removeParticipant(index)} disabled={draft.participants.length <= 1}>Remove</button>
              </div>
            ))}
          </div>

          {showDuplicateColorWarning && (
            <p className="rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">Two people have the same color. That is okay if you meant to do it.</p>
          )}

          <SecondaryButton type="button" className="justify-self-start" onClick={addParticipant}>Add participant</SecondaryButton>
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && isMoreOptionsOpen && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Set up Photo Prompts</h3>
              <p className="text-sm text-stone-600">Add prompts guests can complete by uploading photos.</p>
              <p className="mt-2 text-sm font-bold text-stone-800">{validPromptCount} prompts added</p>
            </div>
            <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={useStarterPrompts}>Use starter prompts</SecondaryButton>
          </div>

          <div className="rounded-2xl bg-white p-3">
            <button type="button" className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left font-bold text-stone-900" onClick={() => setIsPromptEditorOpen((isOpen) => !isOpen)} aria-expanded={isPromptEditorOpen}>
              <span>Edit prompts</span>
              <span className="text-sm text-stone-500">{isPromptEditorOpen ? "Hide" : "Show"}</span>
            </button>
            {isPromptEditorOpen && (
              <div>
                <SortableEditorList items={draft.prompts} idPrefix="prompt" getHandleLabel={(_prompt, index) => `Drag to reorder prompt ${index + 1}`} onReorder={reorderPrompts}>
                  {(prompt, index) => (
                    <>
                      <TextInput value={prompt.text} onChange={(event) => updatePrompt(index, event.target.value)} placeholder="Photo prompt" />
                      <button type="button" className="min-h-10 w-full shrink-0 rounded-full border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600 hover:border-red-300 hover:text-red-700 disabled:text-stone-300 sm:w-auto" onClick={() => removePrompt(index)} disabled={draft.prompts.length <= 1}>Remove</button>
                    </>
                  )}
                </SortableEditorList>
                <SecondaryButton type="button" className="mt-3 justify-self-start" onClick={addPrompt}>Add prompt</SecondaryButton>
              </div>
            )}
          </div>

          {draft.prompts.length < 3 && (
            <p className="rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">Add at least 3 prompts to start Photo Prompts.</p>
          )}
          {draft.prompts.some((prompt) => !prompt.text.trim()) && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Prompts cannot be empty.</p>
          )}
          {showDuplicatePromptWarning && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Remove duplicate prompts before saving.</p>
          )}
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.EVENT_AWARDS && isMoreOptionsOpen && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Set up Awards</h3>
              <p className="text-sm text-stone-600">Guests submit photos into award categories now. Voting can be added later without changing the upload idea.</p>
              <p className="mt-2 text-sm font-bold text-stone-800">{validCategoryCount} categories ready</p>
            </div>
            <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={useDefaultAwards}>Use default awards</SecondaryButton>
          </div>

          <div className="rounded-2xl bg-white p-3">
            <button type="button" className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left font-bold text-stone-900" onClick={() => setIsAwardEditorOpen((isOpen) => !isOpen)} aria-expanded={isAwardEditorOpen}>
              <span>Edit award categories</span>
              <span className="text-sm text-stone-500">{isAwardEditorOpen ? "Hide" : "Show"}</span>
            </button>
            {isAwardEditorOpen && (
              <div>
                <SortableEditorList items={draft.categories} idPrefix="award" getHandleLabel={(_category, index) => `Drag to reorder award category ${index + 1}`} onReorder={reorderCategories}>
                  {(category, index) => (
                    <>
                      <TextInput value={category.label} onChange={(event) => updateCategory(index, event.target.value)} placeholder="Award category" />
                      <button type="button" className="min-h-10 w-full shrink-0 rounded-full border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600 hover:border-red-300 hover:text-red-700 disabled:text-stone-300 sm:w-auto" onClick={() => removeCategory(index)} disabled={draft.categories.length <= 1}>Remove</button>
                    </>
                  )}
                </SortableEditorList>
                <SecondaryButton type="button" className="mt-3 justify-self-start" onClick={addCategory}>Add category</SecondaryButton>
              </div>
            )}
          </div>

          {draft.categories.length < 2 && <p className="rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">Add at least 2 award categories.</p>}
          {draft.categories.some((category) => !category.label.trim()) && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Award categories cannot be empty.</p>}
          {showDuplicateCategoryWarning && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Remove duplicate award categories before saving.</p>}
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.MEMORY_CAPSULE && isMoreOptionsOpen && (
        <div className="mt-5 grid gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Frame the reveal</h3>
            <p className="text-sm text-stone-600">This setup uses the event reveal time, with warmer copy while the album is locked.</p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Reveal title
            <TextInput value={draft.memoryCapsule.revealTitle} onChange={(event) => updateCapsule("revealTitle", event.target.value)} placeholder="The album unlocks after the event" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Reveal note
            <TextArea rows={3} value={draft.memoryCapsule.revealNote} onChange={(event) => updateCapsule("revealNote", event.target.value)} placeholder="Tell guests when and why to come back." />
          </label>
        </div>
      )}

      {validationError && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{validationError}</p>}
    </div>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-app text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/88 backdrop-blur">
        <div className={cx("mx-auto flex items-center justify-between px-5 py-4", wide ? "max-w-7xl lg:px-10" : "max-w-6xl")}>
          <BrandMark />
          <nav className="hidden items-center gap-8 text-sm font-semibold text-muted md:flex">
            <a className="hover:text-ink" href="/#how-it-works">How it works</a>
            <a className="hover:text-ink" href="/#event-styles">Event styles</a>
            <a className="hover:text-ink" href="/#use-cases">Use cases</a>
            <a className="hover:text-ink" href="/#faq">FAQ</a>
          </nav>
          <nav className="flex items-center gap-2 text-sm">
            {auth.token ? (
              <>
                <Link className="rounded-lg px-3 py-2 font-semibold text-muted hover:bg-stone-100 hover:text-ink" to="/dashboard">Dashboard</Link>
                <button className="rounded-lg px-3 py-2 font-semibold text-muted hover:bg-stone-100 hover:text-ink" onClick={auth.logout}>Sign out</button>
              </>
            ) : (
              <>
                <Link className="hidden rounded-lg px-3 py-2 font-semibold text-muted hover:bg-stone-100 hover:text-ink sm:inline-flex" to="/login">Host login</Link>
                <Link className="inline-flex min-h-10 items-center justify-center rounded-lg bg-coral px-4 py-2 font-bold text-white shadow-sm hover:bg-coral-strong" to="/signup">Create event</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={cx("mx-auto px-5 py-8", wide ? "max-w-7xl lg:px-10" : "max-w-6xl")}>{children}</main>
    </div>
  );
}

function AwardResultsPanel({
  awardResults,
  photos,
  onPhotoClick,
  onPhotoLike,
}: {
  awardResults?: AwardResultsSummary | null;
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onPhotoLike?: PhotoLikeToggleHandler;
}) {
  const photosById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  if (!awardResults?.categories.length) return null;

  return (
    <section className="rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_24px_70px_rgba(101,62,0,0.08)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusPill>Awards</StatusPill>
          <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">Award leaders</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">Heart favorite photos to help decide the winners. One browser can heart each photo once.</p>
        </div>
        <StatusPill tone="red">Hearts decide winners</StatusPill>
      </div>

      <div className="mt-6 grid gap-5">
        {awardResults.categories.map((category) => {
          const leaderPhotos = category.leaderPhotoIds.map((photoId) => photosById.get(photoId)).filter(Boolean) as Photo[];
          const topPhotos = (category.likeTotals.length ? category.likeTotals : photos
            .filter((photo) => photo.challengeItemId === category.categoryId)
            .map((photo) => ({ photoId: photo.id, likeCount: Math.max(0, Number(photo.likeCount || 0)) })))
            .slice(0, 8)
            .map((total) => ({ total, photo: photosById.get(total.photoId) }))
            .filter((item): item is { total: { photoId: string; likeCount: number }; photo: Photo } => Boolean(item.photo));

          return (
            <section className="rounded-[1.45rem] bg-[#fffaf6] p-4" key={category.categoryId}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-stone-950">{category.categoryLabel}</h3>
                  <p className="text-sm font-semibold text-stone-600">{category.submissionCount} submissions - {category.totalLikes} {category.totalLikes === 1 ? "heart" : "hearts"}</p>
                </div>
                {category.isTie && <StatusPill tone="amber">Tie for first</StatusPill>}
              </div>

              {leaderPhotos.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {leaderPhotos.map((photo) => (
                    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-amber-200" key={photo.id}>
                      <button type="button" className="shrink-0 overflow-hidden rounded-2xl" onClick={() => onPhotoClick?.(photo)} aria-label={`Open ${category.categoryLabel} leader photo`}>
                        <img className="h-16 w-16 object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold uppercase text-[#653e00]">{category.isTie ? "Tied leader" : "Current leader"}</p>
                        <p className="truncate font-bold text-stone-950">{photo.guestNickname || "Guest photo"}</p>
                        <p className="text-sm font-semibold text-stone-600">{photoHeartLabel(Math.max(0, Number(photo.likeCount || 0)))}</p>
                      </div>
                      {onPhotoLike ? <PhotoHeartButton photo={photo} onToggle={onPhotoLike} /> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-stone-600">{category.noSubmissions ? "No submissions in this category yet." : "No hearts yet. Heart a photo to start the leaderboard."}</p>
              )}

              {topPhotos.length ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {topPhotos.map(({ photo }) => (
                    <div className="overflow-hidden rounded-[1.15rem] bg-white p-2 ring-1 ring-[#eadfce]" key={photo.id}>
                      <button type="button" className="block w-full overflow-hidden rounded-[0.95rem]" onClick={() => onPhotoClick?.(photo)}>
                        <img className="aspect-square w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                      </button>
                      <div className="flex items-center justify-between gap-2 p-2">
                        <p className="min-w-0 truncate text-sm font-bold text-stone-900">{photo.guestNickname || "Guest photo"}</p>
                      {onPhotoLike ? <PhotoHeartButton photo={photo} onToggle={onPhotoLike} variant="solid" /> : <span className="shrink-0 rounded-full bg-[#fff0ed] px-3 py-2 text-xs font-bold text-[#d94f33]">{photo.likeCount || 0}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function HostAwardResultsSummary({
  awardResults,
  photos,
  onFeatureWinner,
}: {
  awardResults?: AwardResultsSummary | null;
  photos: Photo[];
  onFeatureWinner: (photo: Photo) => Promise<void>;
}) {
  if (!awardResults?.categories.length) return null;
  const visiblePhotos = photos;
  const photosById = new Map(visiblePhotos.map((photo) => [photo.id, photo]));

  return (
    <section className="mt-6 rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusPill>Awards</StatusPill>
          <h3 className="mt-3 font-display text-2xl font-bold text-stone-950">Award leaders</h3>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">Guest hearts are the crowd signal. Host picks stay separate for manual curation.</p>
        </div>
        <StatusPill tone="red">Heart based</StatusPill>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {awardResults.categories.map((category) => {
          const leader = category.leaderPhotoIds[0] ? photosById.get(category.leaderPhotoIds[0]) : null;
          const likeCount = leader ? Math.max(0, Number(leader.likeCount || category.likeTotals.find((item) => item.photoId === leader.id)?.likeCount || 0)) : 0;
          return (
            <div className="rounded-[1.25rem] bg-[#fffaf6] p-4" key={category.categoryId}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-bold text-stone-950">{category.categoryLabel}</p>
                {category.isTie && <StatusPill tone="amber">Tie</StatusPill>}
              </div>
              <p className="mt-1 text-sm font-semibold text-stone-600">{category.submissionCount} submissions - {category.totalLikes} {category.totalLikes === 1 ? "heart" : "hearts"}</p>
              {leader ? (
                <div className="mt-4 flex items-center gap-3">
                  <img className="h-16 w-16 rounded-2xl object-cover" src={photoImageSrc(leader)} alt={leader.originalFilename} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-[#653e00]">Current leader</p>
                    <p className="truncate font-bold text-stone-950">{leader.guestNickname || "Guest photo"}</p>
                    <p className="text-sm font-semibold text-stone-600">{photoHeartLabel(likeCount)}</p>
                  </div>
                  <SecondaryButton className="min-h-10 rounded-[0.95rem] px-3 py-2" disabled={leader.isFeatured} onClick={() => onFeatureWinner(leader)}>{leader.isFeatured ? "Host pick" : "Feature winner"}</SecondaryButton>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-bold text-stone-600">{category.noSubmissions ? "No submissions yet." : "No hearts yet."}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HostBetaIssuePanel({ event }: { event: EventSummary }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HostFeedbackInput>({ kind: "beta_issue", issueArea: "guest_upload", note: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const issueTemplate = `EventFilm beta issue\nEvent: ${event.name}\nEvent slug: ${event.slug}\nEvent id: ${event.id}\nWhat happened:\nDevice/browser:\nWhat I tried:`;

  function openForm() {
    setOpen(true);
    trackAnalytics("beta_issue_report_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "event_detail" } });
  }

  async function copyIssueTemplate() {
    await copyText(issueTemplate);
    setStatus("Issue template copied.");
  }

  async function submitIssue() {
    const validation = validateHostFeedback(form);
    if (!validation.ok) {
      setStatus(validation.message);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await eventFilmApi.submitHostEventFeedback(event.id, validation.value, auth.token);
      setStatus("Issue sent. The support team can review it with this event attached.");
      setForm({ kind: "beta_issue", issueArea: "guest_upload", note: "" });
      setOpen(false);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="beta-issue-report" className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusPill tone="plum">Beta support</StatusPill>
          <h3 className="mt-3 font-display text-2xl font-bold text-stone-950">Something off during the event?</h3>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">Send a short host-only issue with this event attached. Avoid phone numbers, private guest details, or anything sensitive.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={openForm}>{open ? "Issue form open" : "Report issue"}</Button>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900" to="/support" onClick={() => trackAnalytics("host_support_link_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "event_detail" } })}>Support</Link>
        </div>
      </div>

      {open ? (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {BETA_ISSUE_AREAS.map(([value, label]) => (
              <button type="button" className={cx("rounded-[1.15rem] border px-4 py-3 text-sm font-bold", form.issueArea === value ? "border-[#e85d3f] bg-[#fff3ee] text-[#653e00]" : "border-[#eadfce] bg-white text-stone-700")} onClick={() => setForm((current) => ({ ...current, issueArea: value }))} key={value}>{label}</button>
            ))}
          </div>
          <TextArea rows={4} value={form.note || ""} onChange={(input) => setForm((current) => ({ ...current, note: input.target.value }))} placeholder="What happened? Include device/browser only if useful." />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" disabled={busy} onClick={submitIssue}>{busy ? "Sending..." : "Send issue"}</Button>
            <SecondaryButton type="button" onClick={copyIssueTemplate}>Copy issue template</SecondaryButton>
          </div>
        </div>
      ) : null}
      {status ? <p className="mt-3 text-sm font-bold text-amber-800">{status}</p> : null}
    </Card>
  );
}

function LifecycleBadge({ lifecycle }: { lifecycle: EventLifecycle }) {
  return <StatusPill tone={lifecycle.tone}>{lifecycle.label}</StatusPill>;
}

function RepeatEventActions({ event, lifecycle, compact = false, onDuplicated }: { event: EventSummary; lifecycle: EventLifecycle; compact?: boolean; onDuplicated?: (event: EventSummary) => void }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const duplicateDefaults = buildDuplicateEventInput(event);
  const assets = buildHostShareAssets(event);

  async function createSimilar() {
    setBusy(true);
    setStatus("");
    trackAnalytics("duplicate_event_clicked", {
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: compact ? "dashboard_card" : "event_detail", duplicateSourceEventId: event.id },
    });
    trackAnalytics("repeat_event_cta_clicked", {
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: compact ? "dashboard_card" : "event_detail", label: "create_similar" },
    });
    try {
      const data = await eventFilmApi.duplicateHostEvent(
        event.id,
        {
          name: duplicateDefaults.name,
          description: duplicateDefaults.description,
          ...(duplicateDefaults.revealAt ? { revealAt: duplicateDefaults.revealAt } : {}),
        },
        auth.token,
      );
      trackAnalytics("duplicate_event_created", {
        eventId: data.event.id,
        eventSlug: data.event.slug,
        metadata: { surface: compact ? "dashboard_card" : "event_detail", duplicateSourceEventId: event.id, duplicateEventId: data.event.id },
      });
      onDuplicated?.(data.event);
      navigate(`/dashboard/events/${data.event.id}`);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function shareRecap() {
    try {
      await shareOrCopyText({
        title: `${event.name} recap`,
        text: assets.recapShareText,
        url: event.recapLink,
        fallbackLabel: "Shared recap",
        analyticsName: "recap_shared_after_event",
        eventId: event.id,
        eventSlug: event.slug,
        surface: compact ? "dashboard_card" : "event_detail",
        onStatus: setStatus,
      });
      trackAnalytics("repeat_event_cta_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: compact ? "dashboard_card" : "event_detail", label: "share_recap" } });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  if (!lifecycle.shouldShowRepeatCta && compact) return null;

  return (
    <div className={cx("grid gap-3", compact ? "mt-4" : "rounded-[1.45rem] border border-[#ffd4c7] bg-[#fff3ee] p-5")}>
      {!compact && (
        <div>
          <StatusPill tone="plum">Next event loop</StatusPill>
          <h3 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Turn this event into the next one.</h3>
          <p className="mt-2 text-sm font-semibold text-amber-950">Copy the setup, review what worked, share the recap, and gather host feedback while the event is fresh.</p>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={createSimilar} disabled={busy}>{busy ? "Creating..." : "Create similar event"}</Button>
        {event.recapLink ? <SecondaryButton type="button" onClick={shareRecap}>Share recap</SecondaryButton> : null}
        {!compact ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-bold text-stone-900" href="#post-event-summary">View what worked</a> : null}
      </div>
      {status ? <p className="text-sm font-bold text-amber-800">{status}</p> : null}
    </div>
  );
}

function HostFeedbackPanel({ event, analytics, onSubmitted }: { event: EventSummary; analytics: EventAnalyticsSummary | null; onSubmitted: () => Promise<void> }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HostFeedbackInput>({ outcome: "great", repeatIntent: "yes", guestConfusion: "", featureRequest: "", note: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const existingFeedback = analytics?.hostFeedback;

  function openForm() {
    setOpen(true);
    trackAnalytics("host_feedback_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "event_detail" } });
  }

  async function submit(input: HostFeedbackInput) {
    const validation = validateHostFeedback(input);
    if (!validation.ok) {
      setStatus(validation.message);
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await eventFilmApi.submitHostEventFeedback(event.id, validation.value, auth.token);
      setStatus(validation.value.skipped ? "Feedback skipped. We will not ask again on this event." : "Thanks. Feedback saved.");
      await onSubmitted();
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (existingFeedback) {
    return (
      <Card className="mt-5 bg-emerald-50">
        <StatusPill tone="green">Feedback saved</StatusPill>
        <h3 className="mt-3 font-display text-2xl font-bold text-emerald-950">Thanks for the host notes.</h3>
        <p className="mt-2 text-sm font-semibold text-emerald-800">{existingFeedback.skippedAt ? "This event feedback was skipped." : "This event has host feedback saved for review."}</p>
      </Card>
    );
  }

  return (
    <Card className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusPill tone="amber">Host feedback</StatusPill>
          <h3 className="mt-3 font-display text-2xl font-bold text-stone-950">How did this event go?</h3>
          <p className="mt-2 text-sm text-stone-600">A short host-only note helps shape the next event loop. Nothing here is shown to guests.</p>
        </div>
        {!open ? <Button type="button" onClick={openForm}>Give feedback</Button> : null}
      </div>
      {open ? (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["great", "Great"], ["okay", "Okay"], ["rough", "Rough"]].map(([value, label]) => (
              <button type="button" className={cx("rounded-[1.15rem] border px-4 py-3 text-sm font-bold", form.outcome === value ? "border-[#e85d3f] bg-[#fff3ee] text-[#653e00]" : "border-[#eadfce] bg-white text-stone-700")} onClick={() => setForm((current) => ({ ...current, outcome: value }))} key={value}>{label}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["yes", "Use again"], ["maybe", "Maybe"], ["no", "Not yet"]].map(([value, label]) => (
              <button type="button" className={cx("rounded-[1.15rem] border px-4 py-3 text-sm font-bold", form.repeatIntent === value ? "border-[#e85d3f] bg-[#fff3ee] text-[#653e00]" : "border-[#eadfce] bg-white text-stone-700")} onClick={() => setForm((current) => ({ ...current, repeatIntent: value }))} key={value}>{label}</button>
            ))}
          </div>
          <TextArea rows={2} value={form.guestConfusion || ""} onChange={(event) => setForm((current) => ({ ...current, guestConfusion: event.target.value }))} placeholder="What confused guests?" />
          <TextArea rows={2} value={form.featureRequest || ""} onChange={(event) => setForm((current) => ({ ...current, featureRequest: event.target.value }))} placeholder="What feature would help next?" />
          <TextArea rows={3} value={form.note || ""} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional note" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" disabled={busy} onClick={() => submit(form)}>{busy ? "Saving..." : "Submit feedback"}</Button>
            <SecondaryButton type="button" disabled={busy} onClick={() => submit({ skipped: true })}>Skip</SecondaryButton>
          </div>
        </div>
      ) : null}
      {status ? <p className="mt-3 text-sm font-bold text-amber-800">{status}</p> : null}
    </Card>
  );
}

function EventPosterPage() {
  const { eventId = "" } = useParams();
  const auth = useAuth();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    api<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${eventId}`, { token: auth.token })
      .then((data) => {
        setEvent(data.event);
        trackAnalytics("invite_poster_viewed", { eventId: data.event.id, eventSlug: data.event.slug, metadata: { surface: "poster_page" } });
      })
      .catch((err) => setError((err as Error).message));
  }, [auth.token, eventId]);

  useEffect(() => {
    if (!event) return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const timer = window.setTimeout(() => {
      trackAnalytics("invite_poster_printed", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "poster_page_auto" } });
      window.print();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [event]);

  async function copyPosterText(value: string, label: string) {
    try {
      await copyText(value);
      setStatus(`${label} copied`);
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  function printPoster() {
    if (!event) return;
    trackAnalytics("invite_poster_printed", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "poster_page" } });
    window.print();
  }

  const assets = event ? buildHostShareAssets(event) : null;

  return (
    <AppShell userEmail={auth.user?.email} canViewFounder={Boolean(auth.user?.isFounder)} onSignOut={auth.logout}>
      {!event && <Card className="text-center"><h1 className="font-serif-display text-3xl font-bold">Loading poster</h1><p className="mt-2 text-muted">{error || "Building the host invite poster..."}</p></Card>}
      {event && assets && (
        <div className="poster-page mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="poster-sheet mx-auto grid place-items-center rounded-xl border border-line bg-[#fff7ef] text-center text-ink shadow-sm">
            <div className="poster-content">
              <p className="poster-brand font-bold text-coral">EventFilm</p>
              <h1 className="poster-title mx-auto font-serif-display font-bold leading-none">{event.name}</h1>
              <div className="poster-qr-frame mx-auto rounded-xl bg-white shadow-sm">
                {event.qrCodeDataUrl ? <img className="poster-qr-code aspect-square w-full bg-white" src={event.qrCodeDataUrl} alt="Guest upload QR code" /> : null}
              </div>
              <h2 className="poster-instruction font-serif-display font-bold text-coral">Scan to add photos</h2>
              <p className="poster-no-account font-semibold text-ink">No account needed</p>
              <div className="poster-divider mx-auto h-px bg-line" />
              <p className="poster-mode-hint mx-auto text-muted">{assets.poster.modeHint || "Candid moments. Group pics. Event memories."}</p>
            </div>
          </section>

          <aside className="poster-actions grid content-start gap-3">
            <Card>
              <h2 className="font-serif-display text-2xl font-bold">Poster actions</h2>
              <p className="mt-2 text-sm text-muted">Print it, save it as a PDF, or download the QR for a group chat.</p>
              <p className="mt-2 text-sm font-semibold text-muted">{assets.qrPosterHint}</p>
              {status && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{status}</p>}
              <div className="mt-4 grid gap-2">
                <Button type="button" onClick={printPoster}>Print or save PDF</Button>
                <SecondaryButton type="button" onClick={() => copyPosterText(assets.poster.guestLink, "Guest link")}>Copy guest link</SecondaryButton>
                <SecondaryButton type="button" onClick={() => copyPosterText(assets.poster.inviteText, "Invite text")}>Copy invite text</SecondaryButton>
                {event.qrCodeDataUrl ? <SecondaryButton type="button" onClick={() => downloadDataUrl(event.qrCodeDataUrl || "", `${safeFilename(event.name)}-qr.png`)}>Download QR PNG</SecondaryButton> : null}
                <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-ink" to={`/dashboard/events/${event.id}`}>Back to event</Link>
              </div>
            </Card>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function LandingIcon({ name, className = "" }: { name: string; className?: string }) {
  const common = {
    className: cx("h-5 w-5 shrink-0", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.9,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
  const paths: Record<string, React.ReactNode> = {
    cake: <><path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 15c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0" /><path d="M8 11V8" /><path d="M12 11V8" /><path d="M16 11V8" /><path d="M8 5l.7 1.1L8 7.2 7.3 6.1z" /><path d="M12 5l.7 1.1-.7 1.1-.7-1.1z" /><path d="M16 5l.7 1.1-.7 1.1-.7-1.1z" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3.5 10h17" /></>,
    cap: <><path d="m3 9 9-4 9 4-9 4z" /><path d="M7 11v4c2.8 2 7.2 2 10 0v-4" /><path d="M21 9v5" /></>,
    columns: <><path d="M4 20h16" /><path d="M5 8h14" /><path d="m4 8 8-5 8 5" /><path d="M7 8v12" /><path d="M12 8v12" /><path d="M17 8v12" /></>,
    cup: <><path d="M7 8h10l-1 12H8z" /><path d="M6 4h12" /><path d="M9 4V2" /><path d="M15 4V2" /><path d="M8 12h8" /></>,
    droplet: <path d="M12 3s6 6.1 6 10.3A6 6 0 0 1 6 13.3C6 9.1 12 3 12 3z" />,
    envelope: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="m4 8 8 6 8-6" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l1.8-1.8a5 5 0 0 0-7.1-7.1L10.5 5.4" /><path d="M14 11a5 5 0 0 0-7.1 0l-1.8 1.8a5 5 0 0 0 7.1 7.1l1.3-1.3" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    message: <><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H6l-3 2 .8-4A8.5 8.5 0 1 1 21 12z" /></>,
    music: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    plane: <><path d="M22 3 10 14" /><path d="m22 3-7 19-5-8-8-5z" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a2 2 0 0 0 2 4h1" /><path d="M16 6h3a2 2 0 0 1-2 4h-1" /><path d="M12 13v5" /><path d="M8 21h8" /><path d="M9 18h6" /></>,
    upload: <><path d="M12 4v11" /><path d="m8 8 4-4 4 4" /><path d="M5 20h14" /></>,
  };

  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

function LandingBrand() {
  return (
    <Link className="inline-flex items-center gap-3 text-[22px] font-semibold text-[#171717]" to="/">
      <span className="relative grid h-8 w-8 place-items-center rounded-md border border-[#ff5a4f] text-[#ff5a4f]">
        <CleanIcon name="camera" className="h-4 w-4" />
        <span className="absolute -left-1 -top-1 h-4 w-4 rounded-[5px] border border-[#ff5a4f] bg-[#fffdfb]" aria-hidden="true" />
      </span>
      <span>EventFilm</span>
    </Link>
  );
}

function LandingButtonLink({ children, to, variant = "primary", onClick }: { children: React.ReactNode; to: string; variant?: "primary" | "secondary"; onClick?: () => void }) {
  const className = variant === "primary"
    ? "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-lg bg-[#ff5a4f] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#ec443a]"
    : "inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-lg border border-[#dedad4] bg-white px-6 py-3 text-sm font-semibold text-[#171717] shadow-none transition hover:border-[#ffb2aa] hover:bg-[#fff5f2]";
  return (
    <Link className={className} to={to} onClick={onClick}>
      {children}
    </Link>
  );
}

function LandingSectionIntro({ label, title, className = "" }: { label: string; title: React.ReactNode; className?: string }) {
  return (
    <div className={cx("mx-auto max-w-3xl text-center", className)}>
      <p className="text-[10px] font-bold text-[#ff5a4f]">{label}</p>
      <h2 className="mt-3 font-serif-display text-4xl font-bold leading-tight text-[#171717] md:text-[2.15rem]">{title}</h2>
    </div>
  );
}

function LandingStepArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={cx("absolute top-12 hidden h-12 w-32 text-[#ff5a4f] md:block", className)} viewBox="0 0 140 52" fill="none" aria-hidden="true">
      <path d="M8 40C37 11 83 10 124 34" stroke="currentColor" strokeWidth="1.7" strokeDasharray="5 6" strokeLinecap="round" />
      <path d="m121 24 12 14-18 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LandingRedesign() {
  const auth = useAuth();
  const createEventHref = auth.token ? "/dashboard/events/new" : "/signup";

  useEffect(() => {
    trackAnalytics("landing_page_viewed");
  }, []);

  function trackCta(label: string) {
    trackAnalytics("cta_clicked", { metadata: { label, surface: "landing_redesign" } });
  }

  const steps = [
    ["calendar", "Create an event", "Name it, pick a vibe, and you're ready to go."],
    ["link", "Share the guest link", "Send it in your group chat. No sign-up needed."],
    ["envelope", "Send the recap", "After the event, everyone gets the shared recap."],
  ] as const;

  return (
    <div className="landing-page min-h-screen bg-[#fffdfb] text-[#171717]">
      <header className="sticky top-0 z-40 bg-[#fffdfb]/92 backdrop-blur">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 md:grid-cols-[1fr_auto_1fr] md:px-10">
          <LandingBrand />
          <nav className="hidden items-center justify-center gap-8 text-sm font-semibold text-[#171717] md:flex" aria-label="Landing sections">
            <a className="hover:text-[#ff5a4f]" href="#how-it-works">How it works</a>
            <a className="hover:text-[#ff5a4f]" href="#event-styles">Event styles</a>
            <a className="hover:text-[#ff5a4f]" href="#use-cases">Use cases</a>
            <a className="hover:text-[#ff5a4f]" href="#faq">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 justify-self-end">
            <LandingButtonLink variant="secondary" to="/dashboard" onClick={() => trackCta("Dashboard nav")}>
              Dashboard
            </LandingButtonLink>
            <span className="hidden sm:block">
              <LandingButtonLink to={createEventHref} onClick={() => trackCta("Create your first event nav")}>
                Create your first event
              </LandingButtonLink>
            </span>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1240px] items-center gap-6 px-5 pb-8 pt-10 md:grid-cols-[0.98fr_1.02fr] md:px-10 md:pb-6 md:pt-12">
          <div>
            <h1 className="font-serif-display text-6xl font-bold leading-[0.95] text-[#171717] md:text-[4rem]">
              <span className="block md:whitespace-nowrap">Stop chasing</span>
              <span className="block md:whitespace-nowrap">photos after</span>
              <span className="block md:whitespace-nowrap">the event.</span>
            </h1>
            <p className="mt-7 max-w-[430px] text-base leading-7 text-[#69645f]">
              Create one link for your event. Guests add photos without an account, and everyone gets a shared recap after.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <LandingButtonLink to={createEventHref} onClick={() => trackCta("Create your first event hero")}>
                Create your first event
              </LandingButtonLink>
              <LandingButtonLink variant="secondary" to={LANDING_DEMO_PATH} onClick={() => trackCta("Try a demo")}>
                Try a demo
              </LandingButtonLink>
            </div>
            <p className="mt-7 inline-flex items-center gap-3 text-sm font-semibold text-[#69645f]">
              <LandingIcon name="shield" className="h-6 w-6 text-[#171717]" />
              No account needed for guests.
            </p>
          </div>
          <div className="relative flex justify-center md:-mt-10 md:justify-end">
            <img className="w-full max-w-[430px] object-contain md:max-w-[455px]" src="/landing/hero-phone-scene.jpg" alt="EventFilm phone album with guest photos" />
          </div>
        </section>

        <section id="how-it-works" className="px-5 pb-4 pt-8 md:px-10 md:pb-5">
          <LandingSectionIntro label="HOW IT WORKS" title="Three simple steps." />
          <div className="relative mx-auto mt-6 grid max-w-[820px] gap-8 md:grid-cols-3 md:gap-10">
            <LandingStepArrow className="left-[26%]" />
            <LandingStepArrow className="left-[58%]" />
            {steps.map(([icon, title, body], index) => (
              <div className="text-center" key={title}>
                <div className="mx-auto grid h-[62px] w-[62px] place-items-center rounded-full bg-[#fff1eb] text-[#ff5a4f]">
                  <LandingIcon name={icon} className="h-8 w-8" />
                </div>
                <h3 className="mt-5 text-base font-bold text-[#171717]">{index + 1}. {title}</h3>
                <p className="mx-auto mt-2 max-w-[170px] text-sm leading-5 text-[#69645f]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="use-cases" className="mx-auto max-w-[1240px] px-5 py-7 md:px-10">
          <LandingSectionIntro label="WHAT PEOPLE USE IT FOR" title="Every kind of good time." />
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {LANDING_USE_CASES.map((item) => (
              <article className="text-center" key={item.label}>
                <img className="aspect-square w-full rounded-lg object-cover shadow-sm" src={item.image} alt={`${item.label} event photos`} />
                <p className="mx-auto mt-4 flex min-h-10 max-w-[140px] items-start justify-center gap-2 text-sm font-semibold leading-5 text-[#171717]">
                  <LandingIcon name={item.icon} className="mt-0.5 h-5 w-5 text-[#ff5a4f]" />
                  <span>{item.label}</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="event-styles" className="mx-auto max-w-[1240px] px-5 py-6 md:px-10">
          <LandingSectionIntro label="EVENT STYLES" title="Pick a style that fits your vibe." />
          <div className="mt-7 grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            {LANDING_STYLES.map((style) => (
              <article className="rounded-lg border border-[#e7e1da] bg-white p-2.5 shadow-sm" key={style.label}>
                <img className="aspect-[1.45] w-full rounded-md object-cover" src={style.image} alt={`${style.label} preview`} />
                <h3 className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[#171717]">
                  <LandingIcon name={style.icon} className="h-4 w-4 text-[#ff5a4f]" />
                  {style.label}
                </h3>
                <p className="mt-2.5 text-xs leading-5 text-[#69645f]">{style.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="px-5 py-4 md:px-10">
          <LandingSectionIntro label="FAQ" title={<>Got questions? We&rsquo;ve got answers.</>} />
          <div className="landing-faq mx-auto mt-5 max-w-[620px] overflow-hidden rounded-lg border border-[#e7e1da] bg-white">
            {LANDING_FAQS.map(([question, answer]) => (
              <details className="group border-b border-[#e7e1da] last:border-b-0" key={question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-2 text-xs font-semibold text-[#171717]">
                  <span>{question}</span>
                  <LandingIcon name="plus" className="landing-plus h-4 w-4 text-[#171717] transition group-open:rotate-45" />
                </summary>
                <p className="px-4 pb-3 text-xs leading-5 text-[#69645f]">{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 pb-8 pt-3 md:px-10">
          <div className="grid items-center gap-7 rounded-xl border border-[#f1e1d6] bg-[#fff4ec] px-8 py-5 md:grid-cols-[0.65fr_1.35fr] md:px-[4.5rem]">
            <div className="flex justify-center md:justify-start">
              <img className="w-full max-w-[280px] object-contain" src="/landing/cta-polaroids.jpg" alt="Printed EventFilm memories" />
            </div>
            <div>
              <h2 className="font-serif-display text-4xl font-bold leading-tight text-[#171717] md:whitespace-nowrap md:text-[2rem]">Ready to make it easy?</h2>
              <p className="mt-3 max-w-[360px] text-base leading-6 text-[#69645f]">Create your event, share the link, and enjoy the memories.</p>
              <div className="mt-5">
                <LandingButtonLink to={createEventHref} onClick={() => trackCta("Create your first event bottom")}>
                  Create your first event
                </LandingButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function LandingDemoGate() {
  const [activeDemoTab, setActiveDemoTab] = useState<"photos" | "people" | "highlights">("photos");
  const [demoPhotos, setDemoPhotos] = useState<Photo[]>(() => DEMO_PHOTOS.map((photo) => ({ ...photo })));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const contributorSummary = useMemo(() => buildContributorSummary(demoPhotos, demoPhotos.length), [demoPhotos]);
  const contributorTiles = useMemo(() => contributorSummary.topContributors.map((contributor) => ({
    ...contributor,
    photos: demoPhotos
      .filter((photo) => sanitizeGuestDisplayName(photo.challengeParticipantName || photo.guestNickname).toLowerCase() === contributor.displayName.toLowerCase())
      .slice(0, 3),
  })), [contributorSummary, demoPhotos]);
  const highlightPhotos = useMemo(() => [...demoPhotos].sort((first, second) => {
    const featuredDelta = Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured));
    if (featuredDelta) return featuredDelta;
    const likeDelta = Number(second.likeCount || 0) - Number(first.likeCount || 0);
    if (likeDelta) return likeDelta;
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  }), [demoPhotos]);
  const demoTabs: Array<{ key: "photos" | "people" | "highlights"; label: string }> = [
    { key: "photos", label: "Photos" },
    { key: "people", label: "People" },
    { key: "highlights", label: "Highlights" },
  ];

  function trackDemoCta(label: string) {
    trackAnalytics("cta_clicked", { metadata: { label, surface: "landing_demo" } });
  }

  function handleDemoPhotoLike(photo: Photo, liked: boolean) {
    setDemoPhotos((current) => updatePhotoInList(current, photo.id, (item) => applyPhotoLikeState(item, liked)));
  }

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <div className="mx-auto min-h-screen max-w-[430px] bg-white pb-28">
        <header className="sticky top-0 z-20 bg-white/96 px-3 pt-3 backdrop-blur">
          <div className="relative flex min-h-16 items-center justify-between">
            <Link className="grid h-10 w-10 place-items-center rounded-full text-stone-700 hover:bg-stone-100" to="/" aria-label="Go back">
              <CleanIcon name="chevronLeft" className="h-5 w-5" />
            </Link>
            <div className="absolute left-12 right-12 top-1/2 -translate-y-1/2 text-center">
              <h1 className="truncate text-xl font-bold leading-6 text-stone-950">{DEMO_EVENT.name}</h1>
              <p className="mt-1 text-xs font-semibold text-stone-500">{DEMO_EVENT.photoCount} photos</p>
            </div>
            <div className="relative">
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-stone-700 hover:bg-stone-100" aria-label="Open event options" onClick={() => setOptionsOpen((open) => !open)}>
                <CleanIcon name="more" className="h-5 w-5" />
              </button>
              {optionsOpen ? (
                <div className="absolute right-0 top-11 z-30 w-40 rounded-lg border border-stone-200 bg-white p-1 text-sm font-semibold text-stone-800 shadow-sm">
                  <a className="block rounded-md px-3 py-2 hover:bg-stone-50" href="#demo-event-album" onClick={() => setOptionsOpen(false)}>Sample album</a>
                  <Link className="block rounded-md px-3 py-2 hover:bg-stone-50" to="/signup" onClick={() => {
                    setOptionsOpen(false);
                    trackDemoCta("Add photos options");
                  }}>Add photos</Link>
                </div>
              ) : null}
            </div>
          </div>
          <nav className="mt-1 grid grid-cols-3 border-b border-stone-200 text-sm font-semibold">
            {demoTabs.map((tab) => (
              <button
                type="button"
                className={cx("border-b-2 px-2 py-3 transition", activeDemoTab === tab.key ? "border-[#e85d3f] text-[#e85d3f]" : "border-transparent text-stone-500 hover:text-stone-950")}
                onClick={() => setActiveDemoTab(tab.key)}
                key={tab.key}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <section id="demo-event-album" className="scroll-mt-24 px-2 pt-2" aria-label="Demo Event sample photos">
          {activeDemoTab === "photos" ? (
            <div className="columns-2 gap-1.5">
              {demoPhotos.map((photo) => (
                <div className="relative mb-1.5 break-inside-avoid overflow-hidden rounded-lg bg-stone-100" key={photo.id}>
                  <PhotoHeartButton photo={photo} onToggle={handleDemoPhotoLike} variant="solid" className="absolute right-1.5 top-1.5 z-10" />
                  <img className="w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                </div>
              ))}
            </div>
          ) : null}

          {activeDemoTab === "people" ? (
            <div className="px-2 pt-4">
              <div className="grid gap-3">
                {contributorTiles.map((contributor) => (
                  <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3" key={contributor.displayName}>
                    <div className="flex h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                      {contributor.photos.map((photo) => (
                        <img className="h-full min-w-0 flex-1 object-cover" src={photo.previewUrl || photo.url} alt="" key={photo.id} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-950">{contributor.displayName}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-500">{contributor.photoCount} {contributor.photoCount === 1 ? "photo" : "photos"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeDemoTab === "highlights" ? (
            <div className="px-2 pt-4">
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <h2 className="text-lg font-bold text-stone-950">Highlights</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-stone-500">Host picks and most-loved photos rise here as the album grows.</p>
              </div>
              <div className="mt-3 columns-2 gap-1.5">
                {highlightPhotos.map((photo) => (
                  <div className="relative mb-1.5 break-inside-avoid overflow-hidden rounded-lg bg-stone-100" key={photo.id}>
                    <PhotoHeartButton photo={photo} onToggle={handleDemoPhotoLike} variant="solid" className="absolute right-1.5 top-1.5 z-10" />
                    <img className="w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="fixed inset-x-0 bottom-7 z-30 flex justify-center px-4 pointer-events-none">
          <Link className="pointer-events-auto inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#e85d3f] px-7 py-3 text-base font-bold text-white shadow-[0_6px_16px_rgba(232,93,63,0.24)] transition hover:bg-[#d84d32]" to="/signup" onClick={() => trackDemoCta("Add photos")}>
            <CleanIcon name="upload" className="h-5 w-5" />
            Add photos
          </Link>
        </div>
      </div>
    </main>
  );
}


function TrustPage({ kind }: { kind: "privacy" | "terms" | "support" }) {
  const content = {
    privacy: {
      title: "Privacy",
      intro: "Simple beta privacy notes for EventFilm hosts and guests. Fernando should replace this with final legal copy before broad public launch.",
      sections: [
        ["Guests can upload without an account", "Guests use the event link to add photos. They do not need to create an EventFilm account to participate."],
        ["What EventFilm stores", "EventFilm stores event details, guest nicknames, uploaded photo files, and basic usage analytics needed to operate and improve the product."],
        ["Photo safety", "Hosts should only share event links with invited guests. Hosts can delete photos from their event dashboard. Do not upload private, harmful, or illegal content."],
        ["Analytics", "EventFilm uses privacy-conscious internal analytics. It does not store photo content, filenames, guest names, or private captions in analytics events."],
      ],
    },
    terms: {
      title: "Terms",
      intro: "Plain-language beta terms. This is not legal advice and should be reviewed before a larger public launch.",
      sections: [
        ["Use EventFilm responsibly", "Hosts are responsible for how they share event links and for moderating photos in their event albums."],
        ["Guest uploads", "Guests should only upload photos they have the right to share with the event host and other invited guests."],
        ["Beta product", "EventFilm is under active development. Features, limits, and availability may change as the product improves."],
        ["No payments yet", "EventFilm does not add payments in this beta flow."],
      ],
    },
    support: {
      title: "Contact and Support",
      intro: "Need help with an event, guest link, QR poster, photo review, or Shared Recap? Use the placeholder contact details below until Fernando adds final support channels.",
      sections: [
        ["Contact", "Placeholder: Fernando should add a final support email, phone number, or contact form link here."],
        ["Running an event", "Create your event, copy the guest link or QR code, review incoming photos, and share the Shared Recap afterward."],
        ["Guests do not need an account", "If a guest is confused, send them the guest link directly. It opens in the browser."],
        ["Photo safety", "If a photo should not be in an album, the host can remove it from the event dashboard."],
      ],
    },
  }[kind];

  return (
    <Shell>
      <section className="mx-auto max-w-3xl">
        <StatusPill>Beta trust page</StatusPill>
        <h1 className="mt-4 font-display text-4xl font-bold text-stone-950">{content.title}</h1>
        <p className="mt-3 text-lg leading-8 text-stone-600">{content.intro}</p>
        <div className="mt-8 grid gap-4">
          {content.sections.map(([title, body]) => (
            <Card key={title}>
              <h2 className="font-display text-xl font-bold text-[#653e00]">{title}</h2>
              <p className="mt-2 leading-7 text-stone-600">{body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950" to="/signup">Create your first event</Link>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-900" to="/">Back to home</Link>
        </div>
      </section>
    </Shell>
  );
}

function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ token: string; user: User }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      auth.login(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <form className="mx-auto max-w-md rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_24px_70px_rgba(28,25,23,0.07)]" onSubmit={submit}>
        <h1 className="font-display text-3xl font-bold">{mode === "signup" ? "Create host account" : "Host login"}</h1>
        <p className="mt-2 text-sm text-stone-600">Manage your private albums, QR links, and downloads.</p>
        <label className="mt-6 block text-sm font-bold text-stone-700">Email</label>
        <TextInput autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="mt-4 block text-sm font-bold text-stone-700">Password</label>
        <TextInput autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="mt-5 w-full" disabled={loading}>{loading ? "Working..." : mode === "signup" ? "Sign up" : "Log in"}</Button>
        <Link className="mt-4 block text-center text-sm font-bold text-stone-700 underline decoration-amber-500 underline-offset-4 transition hover:text-stone-950" to={mode === "signup" ? "/login" : "/signup"}>
          {mode === "signup" ? "Already have an account? Sign in \u2192" : "Don't have an account? Sign up \u2192"}
        </Link>
      </form>
    </Shell>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.token) return <Navigate to="/login" replace />;
  return children;
}

function Dashboard() {
  const auth = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [canViewFounder, setCanViewFounder] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackAnalytics("host_dashboard_opened");
    api<{ events: EventSummary[] }>("/api/host/events", { token: auth.token })
      .then((data) => setEvents(data.events))
      .catch((err) => setError((err as Error).message));
    setCanViewFounder(Boolean(auth.user?.isFounder));
  }, [auth.token, auth.user?.isFounder]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return events;
    return events.filter((event) => [
      event.name,
      event.description || "",
      plainModeLabel(event.challenge?.type || "NONE"),
      challengeLabel(event.challenge),
    ].join(" ").toLowerCase().includes(normalizedQuery));
  }, [events, normalizedQuery]);
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);

  return (
    <AppShell userEmail={auth.user?.email} canViewFounder={canViewFounder} onSignOut={auth.logout}>
      <div className="rounded-xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif-display text-4xl font-bold text-ink">Event library</h1>
            <p className="mt-3 max-w-2xl text-muted">Open an event to manage guest links, QR posters, photo review, recap, downloads, and settings.</p>
            <p className="mt-2 text-sm font-semibold text-stone-500">{auth.user?.email}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-coral px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-coral-strong" to="/dashboard/events/new">Create event</Link>
          </div>
        </div>
        {canViewFounder ? (
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold">
            <Link className="text-stone-500 underline decoration-[#e85d3f]/40 underline-offset-4 hover:text-stone-950" to="/dashboard/founder">Internal analytics</Link>
            <Link className="text-stone-500 underline decoration-[#e85d3f]/40 underline-offset-4 hover:text-stone-950" to="/dashboard/beta-readiness">Beta readiness</Link>
          </div>
        ) : null}
      </div>
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="mt-8">
        <div className="mb-4 grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Search events
            <input
              className="h-12 rounded-lg border border-line bg-white px-4 text-base font-semibold text-ink outline-none transition placeholder:text-stone-400 focus:border-coral focus:ring-4 focus:ring-coral-soft"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by event name or photo setup"
              aria-label="Search events"
            />
          </label>
          <div className="text-sm font-semibold text-muted lg:text-right">
            <p>{filteredEvents.length} of {events.length} {events.length === 1 ? "event" : "events"}</p>
            <p>{totalPhotos} {totalPhotos === 1 ? "photo" : "photos"} across your library</p>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredEvents.map((event) => {
            const previewPhotos = (event.previewPhotos || []).slice(0, 4);
            const coverPhoto = previewPhotos[0];
            const eventDateLabel = formatEventCardDate(event.eventDate);
            const setupLabel = plainModeLabel(event.challenge?.type || "NONE");
            return (
              <React.Fragment key={event.id}>
                <Link
                  className="group relative block aspect-[16/9] overflow-hidden rounded-xl bg-stone-950 shadow-sm sm:hidden"
                  to={`/dashboard/events/${event.id}`}
                  aria-label={`Open event: ${event.name}`}
                >
                  {coverPhoto ? (
                    <img
                      className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      src={photoImageSrc(coverPhoto)}
                      alt=""
                    />
                  ) : (
                    <div className="absolute inset-0 z-[1] grid place-items-center bg-stone-900 text-white/75">
                      <div className="text-center">
                        <CleanIcon name="image" className="mx-auto h-9 w-9" />
                        <p className="mt-2 text-sm font-semibold">No photos yet</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" aria-hidden="true" />
                  <div className="relative z-[1] flex h-full flex-col justify-between p-4 text-white">
                    <div className="flex justify-end">
                      <span className="max-w-[72%] truncate rounded-lg bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                        {setupLabel}
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white/85">{eventDateLabel}</p>
                        <h3 className="mt-1 line-clamp-2 text-2xl font-bold leading-tight text-white">{event.name}</h3>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-black/35 px-2.5 py-2 text-sm font-bold text-white backdrop-blur">
                        <CleanIcon name="image" className="h-5 w-5" />
                        <span className="tabular-nums">{event.photoCount}</span>
                      </span>
                    </div>
                  </div>
                </Link>

                <article className="hidden overflow-hidden rounded-xl border border-line bg-white shadow-sm transition hover:border-coral/40 sm:block">
                  <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="grid min-h-40 grid-cols-2 gap-1 bg-stone-100 p-2">
                      {previewPhotos.length ? (
                        previewPhotos.map((photo) => (
                          <img
                            className="h-full min-h-16 w-full rounded-lg object-cover"
                            src={assetUrl(photo.previewUrl || photo.url)}
                            alt={photo.originalFilename || `${event.name} photo`}
                            key={photo.id}
                          />
                        ))
                      ) : (
                        <div className="col-span-2 grid min-h-36 place-items-center rounded-lg bg-[#fffaf6] text-muted">
                          <div className="text-center">
                            <CleanIcon name="image" className="mx-auto h-8 w-8" />
                            <p className="mt-2 text-sm font-semibold">No photos yet</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link to={`/dashboard/events/${event.id}`}><h3 className="truncate text-xl font-bold text-ink">{event.name}</h3></Link>
                          <p className="mt-1 text-sm font-semibold text-stone-600">Photo setup: {setupLabel}</p>
                        </div>
                        <div className="shrink-0 rounded-lg bg-coral-soft px-3 py-2 text-center">
                          <p className="text-xl font-bold text-coral tabular-nums">{event.photoCount}</p>
                          <p className="text-xs font-semibold text-muted">{event.photoCount === 1 ? "photo" : "photos"}</p>
                        </div>
                      </div>
                      {event.description ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{event.description}</p> : <p className="mt-3 text-sm leading-6 text-muted">Open this event to manage links, photos, recap, and settings.</p>}
                      <div className="mt-auto pt-5">
                        <Link className="inline-flex min-h-11 items-center justify-center rounded-lg bg-coral px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-coral-strong" to={`/dashboard/events/${event.id}`}>
                          Open event
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              </React.Fragment>
            );
          })}
        </div>
        {!filteredEvents.length && events.length ? (
          <Card className="mt-5 bg-[#fffaf3] text-center">
            <h3 className="font-display text-2xl font-bold text-stone-950">No events match that search</h3>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">Try a name, description, or photo setup.</p>
            <button className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-5 py-3 text-sm font-bold text-ink hover:bg-stone-50" type="button" onClick={() => setSearchQuery("")}>Clear search</button>
          </Card>
        ) : null}
        {!events.length && (
          <Card className="bg-[#fffaf3] text-center">
            <h3 className="font-display text-2xl font-bold">Create your first event</h3>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">Make a shared album for your next hangout, party, or club event.</p>
            <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" to="/dashboard/events/new">Create event</Link>
          </Card>
        )}
      </section>
    </AppShell>
  );
}

function BetaReadiness() {
  const auth = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [apiReachable, setApiReachable] = useState<"checking" | "yes" | "no">("checking");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((response) => setApiReachable(response.ok ? "yes" : "no"))
      .catch(() => setApiReachable("no"));

    Promise.all([
      eventFilmApi.getHostEvents(auth.token),
      eventFilmApi.getAnalyticsSummary(auth.token).catch(() => null),
    ])
      .then(([eventData, analytics]) => {
        setEvents(eventData.events);
        setAnalyticsSummary(analytics?.summary || null);
      })
      .catch((err) => setError((err as Error).message));
  }, [auth.token]);

  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);
  const recentEvents = events.slice(0, 4);
  const apiLooksDeployed = !API_BASE_URL.includes("localhost") && !API_BASE_URL.includes("127.0.0.1");
  const hasUsableEventLinks = events.some((event) => {
    const links = [event.eventLink, event.recapLink];
    return links.every((link) => link && !link.includes("localhost") && !link.includes("127.0.0.1"));
  });

  return (
    <Shell wide>
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusPill>Internal beta readiness</StatusPill>
          <h1 className="mt-3 font-display text-4xl font-bold text-stone-950">Release candidate check</h1>
          <p className="mt-2 max-w-2xl text-stone-600">Use this before sharing EventFilm with first beta hosts.</p>
        </div>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm" to="/dashboard/events/new">Create event</Link>
      </section>

      {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["API reachable", apiReachable === "checking" ? "Checking" : apiReachable === "yes" ? "Yes" : "No"],
          ["API target", apiLooksDeployed ? "Deployed" : "Local"],
          ["Events", events.length],
          ["Uploads", totalPhotos],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm font-bold uppercase text-stone-500">{label}</p>
            <p className="mt-3 font-display text-3xl font-bold text-[#653e00]">{value}</p>
          </Card>
        ))}
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl font-bold">Deployment checks</h2>
          <div className="mt-4 grid gap-3">
            <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-700">API base: {API_BASE_URL}</p>
            <p className={cx("rounded-2xl p-4 text-sm font-semibold", apiLooksDeployed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800")}>
              {apiLooksDeployed ? "Mobile/web clients are pointing at a non-local API." : "Client is still pointing at a local API."}
            </p>
            <p className={cx("rounded-2xl p-4 text-sm font-semibold", hasUsableEventLinks ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800")}>
              {hasUsableEventLinks ? "At least one event has non-local guest and Recap links." : "Create or reload a deployed event before first-host sharing."}
            </p>
            <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-700">Storage smoke runbook: docs/deployment-readiness.md</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl font-bold">Analytics summary</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Guest joins", analyticsSummary?.guestJoins ?? 0],
              ["Uploads", analyticsSummary?.uploads ?? 0],
              ["Recap", analyticsSummary?.recapOpens ?? 0],
              ["Active hosts", analyticsSummary?.activeHosts ?? 0],
              ["Active guests", analyticsSummary?.activeGuests ?? 0],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-stone-50 p-4" key={label}>
                <p className="text-xs font-bold uppercase text-stone-500">{label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-[#653e00]">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold">Recent event checks</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {recentEvents.map((event) => (
            <Card key={event.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <StatusPill tone={new Date(event.revealAt).getTime() > Date.now() ? "green" : "stone"}>{new Date(event.revealAt).getTime() > Date.now() ? "Live" : "Revealed"}</StatusPill>
                  <h3 className="mt-3 font-display text-xl font-bold text-stone-950">{event.name}</h3>
                  <p className="mt-1 text-sm text-stone-600">{event.photoCount} uploads</p>
                </div>
                <Link className="text-sm font-bold text-[#653e00] hover:text-stone-950" to={`/dashboard/events/${event.id}`}>Manage</Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {event.recapLink && <a className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200" href={event.recapLink} target="_blank" rel="noreferrer">Recap</a>}
                {event.eventLink && <a className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200" href={event.eventLink} target="_blank" rel="noreferrer">Guest link</a>}
              </div>
            </Card>
          ))}
        </div>
        {!recentEvents.length && (
          <Card className="text-center">
            <h3 className="font-display text-2xl font-bold">No events yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">Create a deployed test event before first-host beta sharing.</p>
          </Card>
        )}
      </section>
    </Shell>
  );
}

const FOUNDER_METRIC_LABELS: Array<[keyof FounderOverview["overview"], string, "default" | "accent" | "green" | "plum"]> = [
  ["totalHosts", "Total hosts", "default"],
  ["activeHostsLast30Days", "Active hosts 30d", "green"],
  ["totalEvents", "Total events", "default"],
  ["eventsCreatedLast7Days", "Events 7d", "accent"],
  ["eventsCreatedLast30Days", "Events 30d", "accent"],
  ["totalGuestJoins", "Guest joins", "green"],
  ["totalUploads", "Uploads", "accent"],
  ["uploadsLast7Days", "Uploads 7d", "accent"],
  ["totalContributors", "Contributors", "green"],
  ["totalRecapOpens", "Recap opens", "plum"],
  ["totalFeedbackSubmissions", "Feedback", "default"],
];

function FounderDashboard() {
  const auth = useAuth();
  const [overview, setOverview] = useState<FounderOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sectionTracked = useRef(false);

  useEffect(() => {
    trackAnalytics("founder_dashboard_viewed");
    eventFilmApi
      .getFounderOverview(auth.token)
      .then((data) => {
        setOverview(data.overview);
        setError("");
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [auth.token]);

  useEffect(() => {
    if (!overview || sectionTracked.current) return;
    sectionTracked.current = true;
    trackAnalytics("founder_feedback_inbox_viewed", { metadata: { surface: "founder_dashboard" } });
  }, [overview]);

  function exportMetrics() {
    if (!overview) return;
    const rows: Array<Array<string | number>> = [
      ["Metric", "Value", "Definition"],
      ...FOUNDER_METRIC_LABELS.map(([key, label]) => [label, overview.overview[key], overview.metricDefinitions[key] || ""]),
      ["Funnel hosts", overview.funnel.hosts, "Registered host accounts"],
      ["Funnel events", overview.funnel.events, "All created events"],
      ["Funnel guest joins", overview.funnel.guestJoins, "Tracked guest joins"],
      ["Funnel uploads", overview.funnel.uploads, "Stored non-deleted photos"],
      ["Funnel Recap opens", overview.funnel.recapOpens, "Tracked Recap opens"],
      ["Funnel feedback", overview.funnel.feedbackSubmissions, "Saved host feedback rows"],
      ["Event Awards votes", overview.usage.eventAwardsVotes, "Stored Event Awards vote rows"],
      ["Color Hunt events", overview.usage.colorHuntEvents, "Events using Color Hunt"],
      ["Memory Capsule events", overview.usage.memoryCapsuleEvents, "Events using Memory Capsule"],
    ];
    downloadCsv(rows, `eventfilm-founder-metrics-${new Date().toISOString().slice(0, 10)}.csv`);
    trackAnalytics("founder_metrics_exported", { metadata: { surface: "founder_dashboard", exportFormat: "csv" } });
  }

  function trackEventOpen(eventId: string, eventSlug: string, label: string) {
    trackAnalytics("founder_event_opened_from_dashboard", { eventId, eventSlug, metadata: { surface: "founder_dashboard", label } });
  }

  if (loading) {
    return (
      <Shell wide>
        <Card className="text-center">
          <StatusPill>Founder ops</StatusPill>
          <h1 className="mt-4 font-display text-3xl font-bold">Loading founder dashboard</h1>
          <p className="mt-2 text-stone-600">Gathering beta signals across EventFilm.</p>
        </Card>
      </Shell>
    );
  }

  if (error || !overview) {
    return (
      <Shell wide>
        <Card className="text-center">
          <StatusPill tone="red">Founder access</StatusPill>
          <h1 className="mt-4 font-display text-3xl font-bold">Founder dashboard unavailable</h1>
          <p className="mx-auto mt-2 max-w-xl text-stone-600">{error || "Founder overview could not be loaded."}</p>
          <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950" to="/dashboard">Back to dashboard</Link>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <section className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white shadow-[0_28px_80px_rgba(101,62,0,0.18)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <StatusPill tone="plum">Founder beta ops</StatusPill>
            <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">What is happening across EventFilm?</h1>
            <p className="mt-3 max-w-2xl text-stone-200">Traction, feedback, modes, and Unlock Alabama-ready signals in one private view.</p>
            <p className="mt-2 text-sm font-semibold text-stone-400">Generated {formatDateTime(overview.generatedAt)}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SecondaryButton type="button" onClick={exportMetrics}>Export CSV</SecondaryButton>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400" to="/dashboard">Host dashboard</Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FOUNDER_METRIC_LABELS.map(([key, label, tone]) => (
          <MetricCard key={key} label={label} value={overview.overview[key]} tone={tone} />
        ))}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <StatusPill tone="amber">First event checklist</StatusPill>
          <h2 className="mt-3 font-display text-2xl font-bold">Run the first beta event</h2>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-stone-700">
            {[
              "Confirm one real event has guest, poster, and Recap links.",
              "Watch guest joins, uploads, contributors, and Recap opens.",
              "Check Event Awards votes if the event uses awards.",
              "Review beta issues, host feedback, and recent uploads after the event.",
            ].map((item, index) => (
              <p className="rounded-[1.15rem] bg-[#fffaf6] p-4" key={item}><strong className="text-[#653e00]">{index + 1}.</strong> {item}</p>
            ))}
          </div>
        </Card>
        <FounderBetaIssueInbox issues={overview.recentBetaIssues || []} />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Beta funnel</h2>
              <p className="mt-1 text-sm text-stone-600">A quick story from host accounts to post-event signals.</p>
            </div>
            <StatusPill>Unlock Alabama</StatusPill>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Hosts", overview.funnel.hosts],
              ["Events", overview.funnel.events],
              ["Guest joins", overview.funnel.guestJoins],
              ["Uploads", overview.funnel.uploads],
              ["Recap", overview.funnel.recapOpens],
              ["Feedback", overview.funnel.feedbackSubmissions],
            ].map(([label, value]) => (
              <div className="rounded-[1.15rem] bg-[#fffaf6] p-4" key={label}>
                <p className="text-xs font-bold uppercase text-stone-500">{label}</p>
                <p className="mt-2 font-display text-2xl font-bold text-[#653e00]">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-2xl font-bold">Recent activity</h2>
          <div className="mt-4 grid gap-3">
            {overview.activity.slice(0, 8).map((item) => (
              <div className="rounded-[1.15rem] bg-stone-50 p-4" key={item.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-bold text-stone-950">{item.label}</p>
                  <p className="text-xs font-bold uppercase text-stone-500">{formatDateTime(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm text-stone-600">{item.eventName}</p>
              </div>
            ))}
            {!overview.activity.length && <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm font-semibold text-stone-600">No beta activity yet.</p>}
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <FounderEventList title="Active events" events={overview.activeEvents} empty="No active events need attention." onOpen={trackEventOpen} />
        <FounderEventList title="Recent events" events={overview.recentEvents} empty="No events have been created yet." onOpen={trackEventOpen} />
      </section>

      <section className="mt-8">
        <FounderFeedbackInbox feedback={overview.recentFeedback} />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <FounderUsageCard title="Event modes" rows={overview.usage.eventModes} empty="No modes used yet." />
        <FounderUsageCard title="Templates" rows={overview.usage.eventTemplates} empty="No templates used yet." />
        <FounderUsageCard title="Prompt packs" rows={overview.usage.promptPacks} empty="No prompt packs used yet." />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        <MetricCard label="Event Awards votes" value={overview.usage.eventAwardsVotes} tone="plum" />
        <MetricCard label="Color Hunt events" value={overview.usage.colorHuntEvents} tone="green" />
        <MetricCard label="Memory Capsule events" value={overview.usage.memoryCapsuleEvents} tone="accent" />
      </section>

      <section className="mt-8">
        <Card>
          <h2 className="font-display text-2xl font-bold">Metric definitions</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(overview.metricDefinitions).map(([key, value]) => (
              <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm text-stone-700" key={key}>
                <strong className="text-stone-950">{key}:</strong> {value}
              </p>
            ))}
          </div>
        </Card>
      </section>
    </Shell>
  );
}

function FounderEventList({ title, events, empty, onOpen }: { title: string; events: FounderOverview["recentEvents"]; empty: string; onOpen: (eventId: string, eventSlug: string, label: string) => void }) {
  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-4 grid gap-4">
        {events.map((event) => (
          <div className="rounded-[1.25rem] border border-[#eadfce] bg-[#fffaf6] p-4" key={event.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <StatusPill tone={event.photoCount ? "green" : "stone"}>{event.modeLabel}</StatusPill>
                <h3 className="mt-3 font-display text-xl font-bold text-stone-950">{event.name}</h3>
                <p className="mt-1 text-sm text-stone-600">{event.hostEmail || "Unknown host"}</p>
                <p className="text-sm text-stone-600">Created {formatDateTime(event.createdAt)}</p>
              </div>
              <div className="rounded-[1rem] bg-white px-4 py-3 text-center">
                <p className="font-display text-2xl font-bold text-[#d94f33]">{event.photoCount}</p>
                <p className="text-xs font-bold uppercase text-stone-500">Photos</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {event.hostEventPath && <Link className="rounded-full bg-stone-950 px-3 py-2 text-xs font-bold text-white hover:bg-stone-800" to={event.hostEventPath} onClick={() => onOpen(event.id, event.slug, "host_event_detail")}>Manage</Link>}
              <a className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100" href={event.eventLink} target="_blank" rel="noreferrer" onClick={() => onOpen(event.id, event.slug, "guest_link")}>Guest link</a>
              <a className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100" href={event.recapLink} target="_blank" rel="noreferrer" onClick={() => onOpen(event.id, event.slug, "recap")}>Recap</a>
            </div>
          </div>
        ))}
        {!events.length && <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm font-semibold text-stone-600">{empty}</p>}
      </div>
    </Card>
  );
}

function FounderBetaIssueInbox({ issues }: { issues: FounderOverview["recentBetaIssues"] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Beta issue watchlist</h2>
          <p className="mt-1 text-sm text-stone-600">Host-submitted beta issues with event context attached.</p>
        </div>
        <StatusPill tone={issues.length ? "amber" : "green"}>{issues.length}</StatusPill>
      </div>
      <div className="mt-4 grid gap-4">
        {issues.map((item) => (
          <div className="rounded-[1.25rem] bg-[#fffaf6] p-4" key={item.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-stone-950">{item.eventName}</h3>
                <p className="mt-1 text-sm text-stone-600">{item.hostEmail || "Unknown host"} - {formatDateTime(item.createdAt)}</p>
              </div>
              <StatusPill tone="amber">{String(item.issueArea || "issue").replace(/_/g, " ")}</StatusPill>
            </div>
            {item.note && <p className="mt-3 rounded-[1rem] bg-white p-3 text-sm font-semibold text-stone-700">{item.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {item.hostEventPath && <Link className="rounded-full bg-stone-950 px-3 py-2 text-xs font-bold text-white hover:bg-stone-800" to={item.hostEventPath}>Open event</Link>}
              <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-600">Slug: {item.eventSlug}</span>
            </div>
          </div>
        ))}
        {!issues.length && <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm font-semibold text-stone-600">No beta issues have been reported.</p>}
      </div>
    </Card>
  );
}

function FounderFeedbackInbox({ feedback }: { feedback: FounderOverview["recentFeedback"] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Host feedback inbox</h2>
          <p className="mt-1 text-sm text-stone-600">Recent host notes, repeat intent, confusion, and feature asks.</p>
        </div>
        <StatusPill>{feedback.length}</StatusPill>
      </div>
      <div className="mt-4 grid gap-4">
        {feedback.map((item) => (
          <div className="rounded-[1.25rem] bg-[#fffaf6] p-4" key={item.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-stone-950">{item.eventName}</h3>
                <p className="mt-1 text-sm text-stone-600">{item.hostEmail || "Unknown host"} - {formatDateTime(item.createdAt)}</p>
              </div>
              <StatusPill tone={item.skippedAt ? "stone" : item.outcome === "great" ? "green" : item.outcome === "rough" ? "red" : "amber"}>{item.skippedAt ? "Skipped" : item.outcome || "Feedback"}</StatusPill>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-stone-700">
              <p><strong className="text-stone-950">Would use again:</strong> {item.repeatIntent || "Not answered"}</p>
              {item.guestConfusion && <p><strong className="text-stone-950">Confusion:</strong> {item.guestConfusion}</p>}
              {item.featureRequest && <p><strong className="text-stone-950">Feature request:</strong> {item.featureRequest}</p>}
              {item.note && <p><strong className="text-stone-950">Note:</strong> {item.note}</p>}
            </div>
            {item.hostEventPath && <Link className="mt-3 inline-flex text-sm font-bold text-[#653e00] hover:text-stone-950" to={item.hostEventPath}>Open event</Link>}
          </div>
        ))}
        {!feedback.length && <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm font-semibold text-stone-600">No host feedback has been submitted yet.</p>}
      </div>
    </Card>
  );
}

function FounderUsageCard({ title, rows, empty }: { title: string; rows: FounderOverview["usage"]["eventModes"]; empty: string }) {
  return (
    <Card>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <div className="rounded-[1.15rem] bg-stone-50 p-4" key={row.key}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-stone-950">{row.label}</p>
              <p className="font-display text-2xl font-bold text-[#653e00]">{row.count}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#e85d3f]" style={{ width: `${Math.max(4, row.percent)}%` }} />
            </div>
            <p className="mt-1 text-xs font-bold uppercase text-stone-500">{row.percent}% of events</p>
          </div>
        ))}
        {!rows.length && <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm font-semibold text-stone-600">{empty}</p>}
      </div>
    </Card>
  );
}

function CreateEvent() {
  const auth = useAuth();
  const [form, setForm] = useState({
    name: "",
    description: "",
    revealAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  });
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [error, setError] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<EventSettingsFieldErrors>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const navigate = useNavigate();

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setCreateFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
  }

  const selectedMode = getChallengePack(challengeDraft.type);
  const selectedPromptPack = getPromptPack(challengeDraft.promptPackSlug);
  const showPromptPackSetup = usesPromptPackSetup(challengeDraft.type);
  const requiresRevealAt = challengeDraft.type === CHALLENGE_TYPES.MEMORY_CAPSULE;
  const eventSettingsInput = eventSettingsInputFromForm(form, { requireRevealAt: requiresRevealAt });
  const eventSettingsValidation = validateEventSettingsInput(eventSettingsInput, { requireRevealAt: requiresRevealAt });
  const challengeValidationError = validateChallengeDraft(challengeDraft);
  const liveCreateFieldErrors: EventSettingsFieldErrors = {};
  if (!eventSettingsValidation.ok) {
    if (form.name.trim() || createFieldErrors.name) liveCreateFieldErrors.name = eventSettingsValidation.fieldErrors.name;
    if (form.description || createFieldErrors.description) liveCreateFieldErrors.description = eventSettingsValidation.fieldErrors.description;
    if (requiresRevealAt && (!form.revealAt || createFieldErrors.revealAt)) liveCreateFieldErrors.revealAt = eventSettingsValidation.fieldErrors.revealAt;
  }
  const visibleCreateFieldErrors: EventSettingsFieldErrors = { ...liveCreateFieldErrors };
  (Object.keys(createFieldErrors) as Array<keyof EventSettingsFieldErrors>).forEach((field) => {
    if (createFieldErrors[field]) visibleCreateFieldErrors[field] = createFieldErrors[field];
  });
  const revealSummary = form.revealAt && !Number.isNaN(new Date(form.revealAt).getTime()) ? formatDateTime(form.revealAt) : "Needs reveal time";
  const disabledReason = !form.name.trim()
    ? "Add an event name to create your event."
    : !eventSettingsValidation.ok
        ? eventSettingsValidation.error
        : challengeValidationError;
  const canCreate = !disabledReason;
  const mobileCreateLabel = canCreate ? "Create event" : form.name.trim() ? "Review settings" : "Add event name";
  const invalidInputClass = "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100";

  function selectPhotoStyle(type: ChallengeDraft["type"]) {
    setChallengeDraft((current) => ({ ...current, type }));
    setAdvancedOpen(false);
    setError("");
    setCreateFieldErrors({});
    trackAnalytics("event_mode_selected", { path: "/dashboard/events/new", metadata: { mode: type } });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (disabledReason) {
        setError(disabledReason);
        if (!eventSettingsValidation.ok) setCreateFieldErrors(eventSettingsValidation.fieldErrors);
        return;
      }
      if (!eventSettingsValidation.ok) {
        setCreateFieldErrors(eventSettingsValidation.fieldErrors);
        setError(eventSettingsValidation.error);
        return;
      }
      setCreateFieldErrors({});
      const challenge = buildChallengePayload(challengeDraft);
      const data = await api<{ event: EventSummary }>("/api/host/events", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({
          ...eventSettingsValidation.value,
          eventTemplateSlug: challengeDraft.eventTemplateSlug,
          promptPackSlug: challengeDraft.promptPackSlug,
          challenge,
        }),
      });
      const metadata = { mode: challengeDraft.type, hasChallenge: challengeDraft.type !== "NONE", templateSlug: challengeDraft.eventTemplateSlug, promptPackSlug: challengeDraft.promptPackSlug };
      trackAnalytics("event_created", {
        eventId: data.event.id,
        eventSlug: data.event.slug,
        metadata,
      });
      navigate(`/dashboard/events/${data.event.id}?created=1`);
    } catch (err) {
      const apiFieldErrors = (err as { data?: { fieldErrors?: EventSettingsFieldErrors } }).data?.fieldErrors;
      if (apiFieldErrors) setCreateFieldErrors(apiFieldErrors);
      setError((err as Error).message);
    }
  }

  return (
    <AppShell userEmail={auth.user?.email} canViewFounder={Boolean(auth.user?.isFounder)} onSignOut={auth.logout}>
      <div className="mx-auto max-w-6xl pb-28 lg:pb-0">
        <div className="max-w-2xl">
          <h1 className="font-serif-display text-4xl font-bold leading-tight text-ink sm:text-5xl">Create an event</h1>
          <p className="mt-2 text-base text-muted">Name it, create the guest link, then tune the vibe only if you need to.</p>
        </div>
        <form id="create-event-form" className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" onSubmit={submit}>
          <div className="grid min-w-0 gap-4">
            <Card className="min-w-0 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-ink">Event basics</h2>
                <p className="mt-1 text-sm text-muted">These are the only required details before EventFilm creates your links.</p>
              </div>
              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-stone-700">
                  Event name
                  <TextInput
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Mia's graduation cookout"
                    required
                    aria-invalid={Boolean(visibleCreateFieldErrors.name) || undefined}
                    aria-describedby={visibleCreateFieldErrors.name ? "create-event-name-error" : undefined}
                    className={visibleCreateFieldErrors.name ? invalidInputClass : ""}
                  />
                  {visibleCreateFieldErrors.name ? <span id="create-event-name-error" className="text-xs font-semibold text-red-700">{visibleCreateFieldErrors.name}</span> : null}
                </label>
                <label className="grid gap-2 text-sm font-bold text-stone-700">
                  Description <span className="font-semibold text-stone-500">(optional)</span>
                  <TextArea
                    rows={3}
                    value={form.description}
                    onChange={(event) => update("description", event.target.value)}
                    placeholder="Tell guests what this album is for."
                    aria-invalid={Boolean(visibleCreateFieldErrors.description) || undefined}
                    aria-describedby={visibleCreateFieldErrors.description ? "create-event-description-error" : undefined}
                    className={visibleCreateFieldErrors.description ? invalidInputClass : ""}
                  />
                  {visibleCreateFieldErrors.description ? <span id="create-event-description-error" className="text-xs font-semibold text-red-700">{visibleCreateFieldErrors.description}</span> : null}
                </label>
                {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
                <div className="rounded-lg bg-[#fffaf6] p-3 text-sm font-semibold text-stone-700 lg:hidden">
                  {disabledReason || "Ready to create. You will get the guest link, QR poster, and recap next."}
                </div>
              </div>
            </Card>

            <PhotoStylePicker draft={challengeDraft} onSelect={selectPhotoStyle} />

            {requiresRevealAt ? (
              <section className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
                <label className="grid gap-2 text-sm font-bold text-stone-700">
                  Reveal time
                  <TextInput
                    type="datetime-local"
                    value={form.revealAt}
                    onChange={(event) => update("revealAt", event.target.value)}
                    required
                    aria-invalid={Boolean(visibleCreateFieldErrors.revealAt) || undefined}
                    aria-describedby={visibleCreateFieldErrors.revealAt ? "create-event-reveal-error create-event-reveal-helper" : "create-event-reveal-helper"}
                    className={visibleCreateFieldErrors.revealAt ? invalidInputClass : ""}
                  />
                  <span id="create-event-reveal-helper" className="text-xs font-semibold text-stone-500">Memory Capsule keeps the album hidden until this time.</span>
                  {visibleCreateFieldErrors.revealAt ? <span id="create-event-reveal-error" className="text-xs font-semibold text-red-700">{visibleCreateFieldErrors.revealAt}</span> : null}
                </label>
              </section>
            ) : null}

            <section className="min-w-0 rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink">Optional setup</h2>
                  <p className="mt-1 text-sm text-muted">
                    {challengeDraft.type === "NONE"
                      ? "Simple Album is ready. Guests can add photos without extra choices."
                      : showPromptPackSetup
                        ? `${plainModeLabel(challengeDraft.type)} uses ${selectedPromptPack.name}. You can customize it now or after creating the event.`
                        : `${selectedMode.name} setup is ready. You can customize it now or after creating the event.`}
                  </p>
                </div>
                {challengeDraft.type !== "NONE" ? (
                  <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={() => setAdvancedOpen((open) => !open)}>
                    {advancedOpen ? "Hide setup" : "Customize"}
                  </SecondaryButton>
                ) : null}
              </div>
              {challengeDraft.type !== "NONE" && !advancedOpen ? (
                <div className="mt-4 rounded-lg bg-stone-50 p-3 text-sm font-semibold text-stone-700">
                  <p>{selectedMode.name}: {selectedMode.shortDescription}</p>
                  {challengeValidationError ? <p className="mt-2 text-red-700">{challengeValidationError}</p> : null}
                </div>
              ) : null}
              {challengeDraft.type !== "NONE" && advancedOpen ? (
                <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} advancedOnly />
              ) : null}
            </section>
          </div>

          <aside className="hidden lg:sticky lg:top-24 lg:block">
            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink">Launch summary</h2>
              <div className="mt-4 grid gap-3 text-sm text-stone-700">
                <p><strong className="text-stone-950">Event:</strong> {form.name.trim() || "Untitled event"}</p>
                <p><strong className="text-stone-950">Photo style:</strong> {plainModeLabel(challengeDraft.type)}</p>
                {showPromptPackSetup ? <p><strong className="text-stone-950">Prompts:</strong> {selectedPromptPack.name}</p> : null}
                {requiresRevealAt ? <p><strong className="text-stone-950">Reveal:</strong> {revealSummary}</p> : null}
              </div>
              <div className={cx("mt-5 rounded-lg p-3 text-sm font-semibold", canCreate ? "bg-green-50 text-green-800" : "bg-[#fffaf6] text-[#653e00]")}>
                {disabledReason || "Ready to create. You can share the QR link after setup."}
              </div>
              {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
              <Button className="mt-4 w-full" disabled={!canCreate}>Create event</Button>
            </Card>
          </aside>
        </form>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 shadow-sm backdrop-blur lg:hidden">
          <div className="mx-auto max-w-md">
            <Button type="submit" form="create-event-form" className="w-full" disabled={!canCreate}>{mobileCreateLabel}</Button>
            <p className="mt-2 text-center text-xs font-semibold text-stone-600">{disabledReason || "Guest link, QR poster, and recap are created next."}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function EventReadyHandoffPanel({ event, shareAssets, onCopyGuestLink, onDismiss }: { event: EventSummary; shareAssets: HostShareAssets; onCopyGuestLink: () => Promise<void>; onDismiss: () => void }) {
  const isMemoryCapsule = event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE;
  const [copyFeedback, setCopyFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const steps = [
    ["Share the guest link", "Send this in the group chat. Guests can add photos without an account."],
    ["Review photos", "Keep an eye on uploads and delete anything that should not appear in the album."],
    ["Share the recap", isMemoryCapsule ? "Send it after reveal so everyone has the photos in one place." : "Send it whenever you want everyone to revisit the album."],
  ];

  async function handleCopyGuestLink() {
    setCopyBusy(true);
    setCopyFeedback(null);
    try {
      await onCopyGuestLink();
      setCopyFeedback({ tone: "success", message: "Guest link copied" });
    } catch (err) {
      setCopyFeedback({ tone: "error", message: (err as Error).message || "Could not copy guest link" });
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-[2rem] bg-[#fff3e6] p-4 sm:p-6" aria-label="Event creation success">
      <div className="rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <StatusPill tone="green">Next steps</StatusPill>
            <h2 className="mt-3 font-display text-4xl font-bold text-stone-950">Your event is ready.</h2>
            <p className="mt-2 font-display text-2xl font-bold text-[#653e00]">{event.name}</p>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-stone-600">Start by sharing the guest link. Guests can add photos without an account.</p>
          </div>
          <button type="button" className="self-start rounded-full border border-[#eadfce] bg-[#fffaf6] px-4 py-2 text-sm font-bold text-stone-700 hover:bg-white" onClick={onDismiss}>Dismiss</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Button type="button" onClick={handleCopyGuestLink} disabled={copyBusy}>
            <CleanIcon name="copy" />
            {copyBusy ? "Copying..." : "Copy guest link"}
          </Button>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={shareAssets.poster.posterPath}>Download QR poster</Link>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={`/e/${event.slug}`}>Preview guest page</Link>
        </div>
        {copyFeedback ? (
          <p
            className={cx(
              "mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold",
              copyFeedback.tone === "success" ? "bg-green-50 text-green-700 ring-1 ring-green-100" : "bg-red-50 text-red-700 ring-1 ring-red-100",
            )}
            role="status"
            aria-live="polite"
          >
            <CleanIcon name={copyFeedback.tone === "success" ? "check" : "copy"} className="h-4 w-4" />
            <span>{copyFeedback.message}</span>
          </p>
        ) : null}
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {steps.map(([title, copy], index) => (
            <div className="rounded-[1.15rem] bg-[#fffaf6] p-4 ring-1 ring-[#eadfce]" key={title}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e85d3f] text-sm font-bold text-white">{index + 1}</span>
              <h3 className="mt-3 font-display text-xl font-bold text-stone-950">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HostLinkPurposeHelper() {
  const rows = [
    ["Guest link", "Text this to friends so they can add photos from their phone."],
    ["QR poster", "Print it or show it when scanning is easier than texting a link."],
    ["Photo review", "Use the Photos tab to check uploads, feature favorites, and delete anything off-tone."],
    ["Shared Recap", "Send this when it is over so everyone has the photos in one place."],
  ];

  return (
    <details className="mt-5 rounded-[1.25rem] border border-[#eadfce] bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none font-display text-xl font-bold text-stone-950">Which link should I use?</summary>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map(([label, copy]) => (
          <div className="rounded-[1rem] bg-[#fffaf6] p-4 ring-1 ring-[#eadfce]" key={label}>
            <p className="font-bold text-stone-950">{label}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-stone-600">{copy}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ManageEvent() {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const auth = useAuth();
  const [event, setEvent] = useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [galleryFilter, setGalleryFilter] = useState("all");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalyticsSummary | null>(null);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [linkCopyStatus, setLinkCopyStatus] = useState("");
  const [error, setError] = useState("");
  const [challengeStatus, setChallengeStatus] = useState("");
  const [settingsForm, setSettingsForm] = useState<EventSettingsForm | null>(null);
  const [settingsFieldErrors, setSettingsFieldErrors] = useState<EventSettingsFieldErrors>({});
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function load() {
    const [data, analytics] = await Promise.all([
      api<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${eventId}`, { token: auth.token }),
      eventId ? eventFilmApi.getEventAnalyticsSummary(eventId, auth.token).catch(() => null) : Promise.resolve(null),
    ]);
    setEvent(data.event);
    setEventAnalytics(analytics?.summary || null);
    setChallengeDraft(draftFromChallenge(data.event.challenge));
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [eventId]);

  useEffect(() => {
    if (!event) return;
    setSettingsForm(eventSettingsFormFromEvent(event));
    setSettingsFieldErrors({});
    setSettingsStatus("");
  }, [event?.id]);

  useEffect(() => {
    if (galleryFilter === "all") return;
    if (["featured", "liked"].includes(galleryFilter)) return;
    if (!event?.challenge) {
      setGalleryFilter("all");
      return;
    }
    if (event.challenge.type === CHALLENGE_TYPES.COLOR_HUNT && (galleryFilter.startsWith("prompt:") || galleryFilter.startsWith("item:"))) setGalleryFilter("all");
    if (event.challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && (galleryFilter.startsWith("color:") || galleryFilter.startsWith("participant:") || galleryFilter.startsWith("item:"))) setGalleryFilter("all");
    if (event.challenge.type === CHALLENGE_TYPES.EVENT_AWARDS && !galleryFilter.startsWith("award:")) setGalleryFilter("all");
    if (event.challenge.type === CHALLENGE_TYPES.MEMORY_CAPSULE) setGalleryFilter("all");
  }, [event?.challenge, galleryFilter]);

  async function refreshAfterPhotoAction(nextPhoto?: Photo) {
    await load();
    if (nextPhoto) setSelectedPhoto(nextPhoto);
  }

  async function updatePhotoFeatured(photo: Photo, isFeatured: boolean) {
    const data = await eventFilmApi.updatePhotoFeatured(eventId || "", photo.id, isFeatured, auth.token);
    trackAnalytics(isFeatured ? "photo_featured" : "photo_unfeatured", { eventId, eventSlug: event?.slug, metadata: { photoId: photo.id } });
    await refreshAfterPhotoAction(data.photo);
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("Delete this photo? It will be removed from storage and public event views.")) return;
    await api(`/api/host/events/${eventId}/photos/${photoId}`, { method: "DELETE", token: auth.token });
    setSelectedPhoto(null);
    await load();
  }

  async function downloadZip() {
    if (!eventId) return;
    setDownloadStatus("");
    const response = await fetch(eventFilmApi.getHostEventDownloadUrl(eventId), {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.name || "event"}-photos.zip`;
    a.click();
    URL.revokeObjectURL(url);
    trackAnalytics("album_downloaded", { eventId, eventSlug: event?.slug, metadata: { scope: "photos", photoCount: visiblePhotos.length } });
    setDownloadStatus("Photo ZIP downloaded.");
  }

  async function saveChallenge() {
    setError("");
    setChallengeStatus("");
    try {
      const challenge = buildChallengePayload(challengeDraft);
      const data = await api<{ challenge: EventChallenge | null }>(`/api/host/events/${eventId}/challenge`, {
        method: "PUT",
        token: auth.token,
        body: JSON.stringify({ challenge }),
      });
      setChallengeDraft(draftFromChallenge(data.challenge));
      setChallengeStatus(data.challenge ? `${challengeLabel(data.challenge)} saved` : "Challenge disabled");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function updateSettingsField(field: keyof EventSettingsForm, value: string) {
    setSettingsForm((current) => (current ? { ...current, [field]: value } : current));
    setSettingsFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSettingsStatus("");
  }

  function resetSettingsForm() {
    if (!event) return;
    setSettingsForm(eventSettingsFormFromEvent(event));
    setSettingsFieldErrors({});
    setSettingsStatus("Changes canceled.");
  }

  async function saveEventSettings(saveEvent: React.FormEvent) {
    saveEvent.preventDefault();
    if (!event || !eventId || !settingsForm) return;

    const input = eventSettingsInputFromForm(settingsForm, { requireRevealAt: event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE });
    const validation = validateEventSettingsInput(input, { requireRevealAt: event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE });
    if (!validation.ok) {
      setSettingsFieldErrors(validation.fieldErrors);
      setSettingsStatus(validation.error);
      return;
    }

    setSettingsSaving(true);
    setSettingsStatus("");
    setSettingsFieldErrors({});
    try {
      const data = await eventFilmApi.updateHostEventSettings(eventId, validation.value, auth.token);
      setEvent(data.event);
      setSettingsForm(eventSettingsFormFromEvent(data.event));
      setSettingsStatus("Event settings saved.");
    } catch (err) {
      const apiFieldErrors = (err as { data?: { fieldErrors?: EventSettingsFieldErrors } }).data?.fieldErrors;
      if (apiFieldErrors) setSettingsFieldErrors(apiFieldErrors);
      setSettingsStatus((err as Error).message || "Could not save event settings. Try again.");
    } finally {
      setSettingsSaving(false);
    }
  }

  const challengeParticipants = event?.challenge?.participants || [];
  const challengeColors = useMemo(() => Array.from(new Map(challengeParticipants.map((participant) => [participant.colorSlug, participant])).values()), [challengeParticipants]);
  const challengePrompts = promptsFromChallenge(event?.challenge);
  const challengeAwards = categoriesFromChallenge(event?.challenge);
  const showPromptPackSetup = usesPromptPackSetup(challengeDraft.type);
  const filteredPhotos = useMemo(() => {
    const eventPhotos = event?.photos || [];
    return eventPhotos.filter((photo) => {
      if (galleryFilter === "all") return true;
      if (galleryFilter === "featured") return Boolean(photo.isFeatured);
      if (galleryFilter === "liked") return Number(photo.likeCount || 0) > 0;
      if (galleryFilter.startsWith("color:")) return photo.challengeColorSlug === galleryFilter.replace("color:", "");
      if (galleryFilter.startsWith("participant:")) return photo.challengeParticipantId === galleryFilter.replace("participant:", "");
      if (galleryFilter.startsWith("prompt:")) return photo.challengePromptId === galleryFilter.replace("prompt:", "");
      if (galleryFilter.startsWith("award:")) return photo.challengeItemId === galleryFilter.replace("award:", "");
      return true;
    }).sort((first, second) => {
      if (galleryFilter !== "liked") return 0;
      return Number(second.likeCount || 0) - Number(first.likeCount || 0) || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  }, [event?.photos, galleryFilter]);
  const visiblePhotos = useMemo(() => event?.photos || [], [event?.photos]);
  const hostContributorSummary = useMemo(() => buildContributorSummary(visiblePhotos), [visiblePhotos]);
  const featuredCount = useMemo(() => event?.photos.filter((photo) => Boolean(photo.isFeatured)).length || 0, [event?.photos]);
  const likedCount = useMemo(() => event?.photos.filter((photo) => Number(photo.likeCount || 0) > 0).length || 0, [event?.photos]);
  const hostAwardResults = useMemo(() => event ? eventAnalytics?.eventAwardResults || buildAwardResultsSummary({ challenge: event.challenge, photos: visiblePhotos }) : null, [event, eventAnalytics?.eventAwardResults, visiblePhotos]);
  const lifecycle = useMemo(() => event ? deriveEventLifecycleStatus(event, eventAnalytics || undefined) : null, [event, eventAnalytics]);
  const shareAssets = useMemo(() => event ? buildHostShareAssets(event) : null, [event]);
  const canViewFounderTools = Boolean(auth.user?.isFounder);
  const savedSettingsForm = useMemo(() => event ? eventSettingsFormFromEvent(event) : null, [event]);
  const settingsDirty = Boolean(settingsForm && savedSettingsForm && JSON.stringify(settingsForm) !== JSON.stringify(savedSettingsForm));
  const liveSettingsValidation = settingsForm ? validateEventSettingsInput(eventSettingsInputFromForm(settingsForm, { requireRevealAt: event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE }), { requireRevealAt: event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE }) : null;
  const visibleSettingsFieldErrors = {
    ...(settingsDirty && liveSettingsValidation && !liveSettingsValidation.ok ? liveSettingsValidation.fieldErrors : {}),
    ...settingsFieldErrors,
  };
  const canSaveSettings = Boolean(settingsDirty && !settingsSaving && liveSettingsValidation?.ok);
  const showCreatedHandoff = searchParams.get("created") === "1";
  const defaultDetailTab = lifecycle?.phase === "after" ? "recap" : "share";
  const tabItems = [
    ["share", "Share"],
    ["uploads", "Photos"],
    ["recap", "Recap"],
    ["settings", "Settings"],
  ];
  const requestedDetailTab = searchParams.get("tab");
  const activeTab = tabItems.some(([key]) => key === requestedDetailTab) ? requestedDetailTab || defaultDetailTab : defaultDetailTab;

  useEffect(() => {
    if (!event || !lifecycle) return;
    trackAnalytics("event_lifecycle_viewed", {
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", lifecycleStatus: lifecycle.status },
    });
  }, [event?.id, event?.slug, lifecycle?.status]);

  async function handleHostPhotoAction(action: "feature" | "unfeature" | "delete", photo: Photo) {
    if (action === "feature") return updatePhotoFeatured(photo, true);
    if (action === "unfeature") return updatePhotoFeatured(photo, false);
    return deletePhoto(photo.id);
  }

  async function copyDetailLink(label: string, url?: string | null) {
    if (!url) return;
    try {
      await copyText(url);
      setLinkCopyStatus(`${label} copied`);
    } catch (err) {
      setLinkCopyStatus((err as Error).message);
    }
  }

  async function copyDetailText(label: string, text?: string | null) {
    if (!text) return;
    try {
      await copyText(text);
      setLinkCopyStatus(`${label} copied`);
    } catch (err) {
      setLinkCopyStatus((err as Error).message);
    }
  }

  async function shareDetailGuestLink() {
    if (!event || !shareAssets) return;
    try {
      await shareOrCopyText({
        title: `${event.name} guest link`,
        text: shareAssets.guestInviteMessage,
        url: event.eventLink,
        fallbackLabel: "Guest link",
        analyticsName: "guest_link_shared",
        eventId: event.id,
        eventSlug: event.slug,
        surface: "event_detail",
        onStatus: setLinkCopyStatus,
      });
    } catch (err) {
      setLinkCopyStatus((err as Error).message);
    }
  }

  async function copyCreatedHandoffGuestLink() {
    if (!event?.eventLink) throw new Error("Guest link is unavailable");
    await copyText(event.eventLink);
    trackAnalytics("guest_link_copied", {
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "created_handoff", method: "clipboard" },
    });
  }

  function dismissCreatedHandoff() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("created");
    setSearchParams(nextParams);
  }

  const detailPrimaryAction = event && lifecycle ? (
    lifecycle.phase === "during" ? (
      <Button type="button" onClick={() => setSearchParams({ tab: "uploads" })}>Review photos</Button>
    ) : lifecycle.phase === "after" && event.recapLink ? (
      <Button type="button" onClick={() => copyDetailLink("Shared Recap link", event.recapLink)}>Share recap</Button>
    ) : (
      <Button type="button" onClick={shareDetailGuestLink}>Share guest link</Button>
    )
  ) : null;

  return (
    <AppShell userEmail={auth.user?.email} canViewFounder={canViewFounderTools} onSignOut={auth.logout}>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {event && (
        <>
          {showCreatedHandoff && shareAssets ? (
            <EventReadyHandoffPanel
              event={event}
              shareAssets={shareAssets}
              onCopyGuestLink={copyCreatedHandoffGuestLink}
              onDismiss={dismissCreatedHandoff}
            />
          ) : null}
          <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusPill>Next step</StatusPill>
              {lifecycle ? <span className="ml-2"><LifecycleBadge lifecycle={lifecycle} /></span> : null}
              <h1 className="mt-3 font-serif-display text-5xl font-bold text-ink">{event.name}</h1>
              <p className="mt-2 max-w-2xl text-base font-semibold text-stone-700">{buildHostNextStep(event, eventAnalytics || undefined)}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">photo_library</Icon>{event.photoCount} photos</span>
                {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">lock</Icon>Reveal time: {formatDateTime(event.revealAt)}</span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {detailPrimaryAction}
            </div>
          </section>

          <nav className="mt-8">
            <div className="grid w-full grid-cols-4 gap-1 rounded-[1.35rem] border border-[#eadfce] bg-white p-1.5 shadow-sm sm:inline-flex sm:w-auto sm:gap-2 sm:p-2">
              {tabItems.map(([key, label]) => (
                <button
                  type="button"
                  className={cx("min-h-11 min-w-0 rounded-[1rem] px-2 py-2.5 text-center text-sm font-bold leading-tight transition sm:px-4 sm:py-3", activeTab === key ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-[#fffaf6]")}
                  onClick={() => setSearchParams(key === defaultDetailTab ? {} : { tab: key })}
                  key={key}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>
          {linkCopyStatus ? <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">{linkCopyStatus}</p> : null}

          {activeTab === "share" ? (
          <section className="mt-8">
            {shareAssets ? (
              <>
                <section className="rounded-xl border border-line bg-coral-soft p-6 shadow-sm sm:p-8">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <h2 className="font-serif-display text-4xl font-bold text-ink">Get photos from your guests</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Share your link so everyone can add their photos. Start with the guest link, then use the QR code when people are in the same room.</p>
                    </div>
                    <CleanIcon name="paperPlane" className="h-14 w-14 text-coral" />
                  </div>
                </section>

                <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_0.9fr]">
                  <Card>
                    <h3 className="text-lg font-bold text-ink">Guest link</h3>
                    <p className="mt-1 text-sm text-muted">Send this before or during the event so people can add photos.</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <input className="w-full rounded-lg border border-line bg-stone-50 px-4 py-3 text-sm font-semibold text-muted" readOnly value={event.eventLink} aria-label="Guest link" />
                      <Button type="button" onClick={() => copyDetailLink("Guest link", event.eventLink)}>
                        <CleanIcon name="link" />
                        Copy guest link
                      </Button>
                    </div>
                  </Card>

                  <div className="grid gap-5">
                    <Card className="text-center">
                      <h3 className="text-lg font-bold text-ink">QR code event poster</h3>
                      <p className="mt-1 text-sm text-muted">Scan, print, or share</p>
                      {event.qrCodeDataUrl ? <img className="mx-auto mt-5 aspect-square w-44 rounded-lg bg-white p-2" src={event.qrCodeDataUrl} alt="Guest upload QR code" /> : <div className="mx-auto mt-5 grid aspect-square w-44 place-items-center rounded-lg bg-stone-100 text-muted"><CleanIcon name="qr" className="h-12 w-12" /></div>}
                      <Link className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-stone-50" to={`/dashboard/events/${event.id}/poster`}>Share</Link>
                    </Card>
                  </div>
                </div>

                <Card className="mt-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-ink">Message to paste in group chat</h3>
                      <p className="mt-3 whitespace-pre-line break-words rounded-lg border border-line bg-stone-50 p-4 text-sm leading-6 text-muted">{shareAssets.guestInviteMessage}</p>
                    </div>
                    <SecondaryButton className="w-full sm:w-auto" type="button" onClick={() => copyDetailText("Group chat message", shareAssets.guestInviteMessage)}>
                      <CleanIcon name="copy" />
                      Copy message
                    </SecondaryButton>
                  </div>
                </Card>

                <HostLinkPurposeHelper />
              </>
            ) : null}
          </section>
          ) : null}

          {activeTab === "recap" ? (
          <section className="mt-8">
            <Card className="lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <StatusPill tone={lifecycle?.phase === "after" || event.challenge?.type !== CHALLENGE_TYPES.MEMORY_CAPSULE ? "green" : "stone"}>
                    {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && lifecycle?.phase !== "after" ? "Ready after reveal" : "Ready to share"}
                  </StatusPill>
                  <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">Shared Recap</h2>
                  <p className="mt-2 max-w-2xl text-stone-600">
                    {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? "Send this after reveal so everyone can see the photos in one place." : "Send this whenever you want everyone to revisit the album."}
                  </p>
                </div>
                <div className="grid gap-2 rounded-[1.15rem] bg-[#fffaf6] p-4 text-sm font-bold text-stone-700">
                  <span>{visiblePhotos.length} album photos</span>
                  <span>{featuredCount} host picks</span>
                  <span>{likedCount} guest favorites</span>
                  <span>{hostContributorSummary.contributorCount || "Guest"} {hostContributorSummary.contributorCount === 1 ? "contributor" : "contributors"}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {event.recapLink ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" href={event.recapLink} target="_blank" rel="noreferrer">Preview recap</a> : null}
                {event.recapLink ? <SecondaryButton type="button" onClick={() => copyDetailLink("Recap link", event.recapLink)}>Copy recap link</SecondaryButton> : null}
                <SecondaryButton onClick={() => downloadZip()}>Download photos</SecondaryButton>
              </div>
              <div className="mt-6 grid gap-2 rounded-[1.15rem] bg-white p-4 text-sm font-semibold text-stone-700 ring-1 ring-[#eadfce]">
                <p className="font-bold text-stone-950">Before you share it</p>
                <p>Review photos</p>
                <p>Feature favorites</p>
                <p>Send recap link</p>
              </div>
              {downloadStatus && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">{downloadStatus}</p>}
            </Card>
          </section>
          ) : null}

          {activeTab === "recap" && eventAnalytics && (
            <details className="mt-8 rounded-[1.45rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
              <summary className="cursor-pointer list-none font-display text-2xl font-bold text-stone-950">More recap details</summary>
              <p className="mt-2 text-sm text-stone-600">Secondary upload details for host review.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Guest joins", eventAnalytics.guestJoins],
                  ["Uploads", eventAnalytics.uploads],
                  ["Recap views", eventAnalytics.recapOpens],
                  ["Album photos", eventAnalytics.visiblePhotos],
                  ["Host picks", eventAnalytics.featuredPhotos],
                  ["Guest hearts", eventAnalytics.photoLikes || 0],
                ].map(([label, value], index) => (
                  <MetricCard key={label} label={String(label)} value={String(value)} tone={index === 1 ? "accent" : index === 2 ? "plum" : "default"} />
                ))}
              </div>
              <div className="mt-4 rounded-[1.45rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-stone-950">People who uploaded</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-600">{hostContributorSummary.totalPhotos} album photos from {hostContributorSummary.contributorCount || "guest"} {hostContributorSummary.contributorCount === 1 ? "contributor" : "contributors"}.</p>
                  </div>
                  {hostContributorSummary.topContributors.length ? (
                    <div className="flex flex-wrap gap-2">
                      {hostContributorSummary.topContributors.map((contributor) => (
                        <span className="rounded-full bg-[#fffaf6] px-3 py-2 text-xs font-bold text-[#653e00]" key={contributor.displayName}>{contributor.displayName}: {contributor.photoCount}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <HostAwardResultsSummary awardResults={hostAwardResults} photos={event.photos} onFeatureWinner={(photo) => updatePhotoFeatured(photo, true)} />
            </details>
          )}

          {activeTab === "recap" && lifecycle?.phase === "after" ? (
            <HostFeedbackPanel event={event} analytics={eventAnalytics} onSubmitted={load} />
          ) : null}

          {activeTab === "settings" ? (
          <section className="mt-8">
            <Card className="mb-5 lg:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-3xl font-bold text-stone-950">Settings</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-600">Edit the basics hosts most often need to adjust before sharing.</p>
                </div>
                {settingsDirty ? <StatusPill tone="amber">Unsaved changes</StatusPill> : <StatusPill tone="stone">Saved</StatusPill>}
              </div>
              {settingsForm ? (
                <form className="mt-6 grid gap-5" onSubmit={saveEventSettings}>
                  <label className="grid gap-2 text-sm font-bold text-stone-700">
                    Event name
                    <TextInput value={settingsForm.name} onChange={(formEvent) => updateSettingsField("name", formEvent.target.value)} required maxLength={120} />
                    {visibleSettingsFieldErrors.name ? <span className="text-xs font-bold text-red-700">{visibleSettingsFieldErrors.name}</span> : null}
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-stone-700">
                    Description
                    <TextArea rows={3} value={settingsForm.description} onChange={(formEvent) => updateSettingsField("description", formEvent.target.value)} maxLength={1000} placeholder="Tell guests what this album is for." />
                    {visibleSettingsFieldErrors.description ? <span className="text-xs font-bold text-red-700">{visibleSettingsFieldErrors.description}</span> : null}
                  </label>
                  {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? (
                    <label className="grid gap-2 text-sm font-bold text-stone-700">
                      Reveal time
                      <TextInput type="datetime-local" value={settingsForm.revealAt || ""} onChange={(formEvent) => updateSettingsField("revealAt", formEvent.target.value)} required />
                      <span className="text-xs font-semibold text-stone-500">Memory Capsule keeps the album hidden until this reveal time.</span>
                      {visibleSettingsFieldErrors.revealAt ? <span className="text-xs font-bold text-red-700">{visibleSettingsFieldErrors.revealAt}</span> : null}
                    </label>
                  ) : null}
                  <div className="grid gap-3 rounded-[1rem] bg-[#fffaf6] p-4 text-sm text-stone-700 sm:grid-cols-2">
                    <p><strong className="block text-stone-950">Photo setup</strong>{plainModeLabel(challengeDraft.type)}</p>
                    {showPromptPackSetup ? <p><strong className="block text-stone-950">Photo prompts</strong>{getPromptPack(challengeDraft.promptPackSlug).name}</p> : null}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {settingsStatus ? <p className={cx("text-sm font-bold", /saved|canceled/i.test(settingsStatus) ? "text-green-700" : "text-red-700")}>{settingsStatus}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton type="button" onClick={resetSettingsForm} disabled={!settingsDirty || settingsSaving}>Cancel</SecondaryButton>
                      <Button type="submit" disabled={!canSaveSettings}>{settingsSaving ? "Saving..." : "Save changes"}</Button>
                    </div>
                  </div>
                </form>
              ) : null}
            </Card>
            <details className="rounded-[1.45rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
              <summary className="cursor-pointer list-none font-display text-2xl font-bold text-stone-950">More options</summary>
              <p className="mt-2 text-sm font-semibold text-stone-600">Change photo prompts or categories when this event needs more than a simple album.</p>
              <div className="mt-5">
                <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} promptLibraryInitiallyOpen />
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-stone-800">{event.challenge ? `${challengeLabel(event.challenge)} is active for this event.` : "Simple Album is active for this event."}</p>
                    {challengeStatus && <p className="mt-1 text-sm font-semibold text-amber-700">{challengeStatus}</p>}
                  </div>
                  <Button onClick={saveChallenge}>Save photo setup</Button>
                </div>
              </div>
            </details>
            <details className="mt-5 rounded-[1.45rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
              <summary className="cursor-pointer list-none font-display text-2xl font-bold text-stone-950">Help and repeat event</summary>
              <div className="mt-5 grid gap-5">
                {canViewFounderTools ? <HostBetaIssuePanel event={event} /> : null}
                {lifecycle ? <RepeatEventActions event={event} lifecycle={lifecycle} /> : null}
              </div>
            </details>
            <div className="mt-5 rounded-[1rem] bg-red-50 p-4 text-sm font-semibold text-red-800">
              <p className="font-bold">Danger zone</p>
              <p className="mt-1">Delete event stays separated here. Permanent deletion is not changed in this pass.</p>
            </div>
          </section>
          ) : null}

          {activeTab === "uploads" ? (
          <section className="mt-10">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-bold">Review photos</h2>
                <p className="text-stone-600">{event.photos.length ? "Review photos and keep public views clean." : "No photos yet. Share the QR code or guest link to start collecting photos."}</p>
              </div>
            </div>
            <div className="mb-5 grid gap-3 rounded-[1.45rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_34px_rgba(101,62,0,0.055)]">
              <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                  {[
                    ["all", `All photos (${event.photos.length})`],
                    ["featured", `Host picks (${featuredCount})`],
                    ["liked", `Most liked (${likedCount})`],
                  ].map(([key, label]) => (
                    <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === key ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200")} onClick={() => setGalleryFilter(key)} key={key}>{label}</button>
                  ))}
                </div>
              </div>
              {event.challenge && (
                <>
                <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                  <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                    {event.challenge.type === CHALLENGE_TYPES.COLOR_HUNT && challengeColors.map((participant) => (
                      <button className={cx("inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `color:${participant.colorSlug}` ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter(`color:${participant.colorSlug}`)} key={participant.colorSlug}>
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: participant.colorHex }} />
                        {participant.colorName}
                      </button>
                    ))}
                    {event.challenge.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && challengePrompts.map((prompt) => (
                      <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `prompt:${prompt.id}` ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter(`prompt:${prompt.id}`)} key={prompt.id}>{prompt.text}</button>
                    ))}
                    {event.challenge.type === CHALLENGE_TYPES.EVENT_AWARDS && challengeAwards.map((category) => (
                      <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `award:${category.id}` ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter(`award:${category.id}`)} key={category.id}>{category.label}</button>
                    ))}
                  </div>
                </div>
                {event.challenge.type === CHALLENGE_TYPES.COLOR_HUNT && (
                  <div className="flex flex-wrap gap-2">
                    {challengeParticipants.map((participant) => (
                      <button className={cx("rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `participant:${participant.id}` ? "bg-amber-500 text-stone-950" : "bg-amber-50 text-[#653e00]")} onClick={() => setGalleryFilter(`participant:${participant.id}`)} key={participant.id}>{participant.displayName}</button>
                    ))}
                  </div>
                )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredPhotos.map((photo, index) => (
                <div className="overflow-hidden rounded-[1.45rem] border border-[#eadfce] bg-white p-2 shadow-[0_12px_30px_rgba(101,62,0,0.055)]" key={photo.id}>
                  <button className="block w-full text-left" onClick={() => {
                    setSelectedPhoto(photo);
                    trackAnalytics("photo_lightbox_opened", { eventId, eventSlug: event.slug, metadata: { surface: "host", photoId: photo.id } });
                  }}>
                    <img className="aspect-square w-full rounded-[1.1rem] object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading={index < 8 ? "eager" : "lazy"} decoding="async" />
                  </button>
                  <div className="p-3 text-sm">
                    <PhotoStatusBadges photo={photo} host />
                    <p className="truncate font-bold">{photo.challengeParticipantName || photo.guestNickname || "Guest"}</p>
                    {photo.challengeColorName && (
                      <div className="mt-2">
                        <ColorChip participant={{ colorName: photo.challengeColorName, colorHex: photo.challengeColorHex || "#f59e0b" }} />
                      </div>
                    )}
                    {photo.challengePromptText && (
                      <p className="mt-2 text-sm font-semibold text-[#653e00]">Prompt: {photo.challengePromptText}</p>
                    )}
                    {photo.challengeItemLabel && !photo.challengeColorName && !photo.challengePromptText && (
                      <p className="mt-2 text-sm font-semibold text-[#653e00]">{photo.challengeItemKind === "award" ? "Award" : "Photo prompt"}: {photo.challengeItemLabel}</p>
                    )}
                    <p className="mt-1 text-stone-600">{formatDateTime(photo.createdAt)}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button className={cx("min-h-10 rounded-[0.95rem] px-4 py-2 text-sm font-bold", photo.isFeatured ? "bg-stone-950 text-white" : "bg-[#fff0d8] text-[#653e00]")} onClick={() => updatePhotoFeatured(photo, !photo.isFeatured)}>
                        {photo.isFeatured ? "Unpick" : "Host pick"}
                      </button>
                      <button className="min-h-10 rounded-[0.95rem] bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700 ring-1 ring-stone-200" onClick={() => setSelectedPhoto(photo)}>More</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!filteredPhotos.length && <Card className="text-center"><h3 className="font-display text-2xl font-bold text-stone-950">No photos yet</h3><p className="mt-2 font-semibold text-stone-600">Share the QR code or guest link to start collecting photos.</p></Card>}
          </section>
          ) : null}
          <FullScreenPhotoViewer photo={selectedPhoto} photos={filteredPhotos} mode="host" onClose={() => setSelectedPhoto(null)} onHostAction={handleHostPhotoAction} />
        </>
      )}
    </AppShell>
  );
}

function PhotoMosaic({ photos, dark = false, onPhotoClick, onPhotoLike }: { photos: Photo[]; dark?: boolean; onPhotoClick?: (photo: Photo) => void; onPhotoLike?: PhotoLikeToggleHandler }) {
  if (!photos.length) {
    return (
      <div className={cx("grid min-h-72 place-items-center rounded-[2rem] p-8 text-center", dark ? "bg-white/10 text-stone-200" : "border border-[#eadfce] bg-white text-stone-600")}>
        <div>
          <p className={cx("font-display text-2xl font-bold", dark ? "text-white" : "text-stone-950")}>No photos yet</p>
          <p className="mt-2 text-sm">Share the guest link so people can add theirs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, index) => (
        <figure className={cx("group overflow-hidden rounded-[1.45rem] border", index === 0 ? "col-span-2 row-span-2" : "", dark ? "border-white/10 bg-white/10" : "border-[#eadfce] bg-white shadow-[0_12px_30px_rgba(101,62,0,0.055)]")} key={photo.id}>
          <div className="relative">
            {onPhotoLike ? <PhotoHeartButton photo={photo} onToggle={onPhotoLike} variant="solid" className="absolute right-2 top-2 z-10" /> : null}
          <button className="block h-full w-full text-left" type="button" onClick={() => onPhotoClick?.(photo)}>
            <img className="aspect-square h-full w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading={index < 4 ? "eager" : "lazy"} decoding="async" />
          </button>
          </div>
          <figcaption className={cx("p-3 text-xs font-bold", dark ? "text-stone-100" : "text-stone-700")}>
            <span className="block truncate">{photo.challengeParticipantName || photo.guestNickname || "Guest"}</span>
            {photoChallengeLabel(photo) && <span className={cx("mt-1 block truncate", dark ? "text-amber-200" : "text-[#653e00]")}>{photoChallengeLabel(photo)}</span>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function RecapChallengeMoments({ story, awardResults, photos, onPhotoClick, onPhotoLike }: { story: EventRecapStory; awardResults?: AwardResultsSummary | null; photos: Photo[]; onPhotoClick: (photo: Photo) => void; onPhotoLike?: PhotoLikeToggleHandler }) {
  return (
    <section className="mt-8" id="recap-challenge-moments">
      <div className="mb-5">
        <StatusPill tone="plum">{story.modeLabel}</StatusPill>
        <h2 className="mt-3 font-display text-3xl font-bold text-stone-950 sm:text-4xl">{story.challengeHeadline}</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-600">{story.challengeCopy}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {story.challengeMoments.map((moment) => (
          <article className="rounded-[1.35rem] border border-[#eadfce] bg-white p-4 shadow-[0_16px_44px_rgba(101,62,0,0.055)]" key={moment.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {moment.colorHex ? <span className="h-4 w-4 shrink-0 rounded-full border border-stone-200" style={{ backgroundColor: moment.colorHex }} /> : null}
                  <h3 className="truncate font-display text-xl font-bold text-stone-950">{moment.title}</h3>
                </div>
                <p className="mt-2 text-sm font-semibold text-stone-600">{moment.description}</p>
              </div>
              <span className={cx("shrink-0 rounded-full px-3 py-1 text-xs font-bold", moment.isComplete ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600")}>
                {moment.total ? `${moment.count}/${moment.total}` : moment.count}
              </span>
            </div>
            {moment.isTie ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-[#653e00]">Tie at the top</p> : null}
            {moment.photos.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {moment.photos.slice(0, 3).map((photo) => (
                  <div className="relative overflow-hidden rounded-[0.9rem] bg-stone-100" key={photo.id}>
                    {onPhotoLike ? <PhotoHeartButton photo={photo} onToggle={onPhotoLike} variant="solid" className="absolute right-1 top-1 z-10 scale-90" /> : null}
                    <button className="block w-full" type="button" onClick={() => onPhotoClick(photo)}>
                      <img className="aspect-square h-full w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-[1rem] bg-[#fffaf6] p-3 text-sm font-semibold text-stone-600">No representative photo yet.</p>
            )}
          </article>
        ))}
      </div>
      {awardResults ? (
        <div className="mt-6">
          <AwardResultsPanel awardResults={awardResults} photos={photos} onPhotoClick={onPhotoClick} onPhotoLike={onPhotoLike} />
        </div>
      ) : null}
    </section>
  );
}

function RecapAlbumFilterTabs({ filters, activeFilter, onChange }: { filters: EventRecapAlbumFilter[]; activeFilter: string; onChange: (filter: EventRecapAlbumFilter) => void }) {
  if (filters.length <= 1) return null;
  return (
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => (
        <button
          className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold transition", activeFilter === filter.key ? "bg-stone-950 text-white" : "border border-[#eadfce] bg-white text-stone-700 hover:bg-[#fffaf6]")}
          key={filter.key}
          type="button"
          onClick={() => onChange(filter)}
        >
          {filter.label} <span className={cx("ml-1", activeFilter === filter.key ? "text-amber-200" : "text-[#653e00]")}>{filter.count}</span>
        </button>
      ))}
    </div>
  );
}

function EventRecap() {
  const { slug = "" } = useParams();
  const [{ session }] = useState(() => getGuestSession(slug));
  const [data, setData] = useState<EventRecapResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [recapLinkStatus, setRecapLinkStatus] = useState("");
  const [activeAlbumFilter, setActiveAlbumFilter] = useState("all");
  const trackedStoryRef = useRef("");

  async function loadRecap() {
    const nextData = await eventFilmApi.getRecapData(slug, session.clientId);
    setData(nextData);
    setError("");
  }

  useEffect(() => {
    trackAnalytics("recap_opened", { eventSlug: slug, path: `/recap/${slug}` });
    trackAnalytics("guest_recap_opened", { eventSlug: slug, path: `/recap/${slug}`, metadata: { surface: "recap" } });
    loadRecap()
      .catch((err) => setError(publicRouteErrorMessage(err, "Recap is not available right now. Check the event link or try again after reveal.")));
  }, [slug]);

  const event = data?.event;
  const visibleRecapPhotos = useMemo(() => data?.photos || [], [data?.photos]);
  const awardResults = useMemo(() => event ? buildAwardResultsSummary({ challenge: event.challenge, photos: visibleRecapPhotos }) : null, [event, visibleRecapPhotos]);
  const story = useMemo(() => event && data ? buildEventRecapStory(event, data.photos, { awardResults, awardVoting: data.awardVoting }) : null, [awardResults, data, event]);
  const recapHeroSentence = data?.isLocked
    ? `Photos are saved for the reveal. The recap unlocks after ${event ? formatDateTime(event.revealAt) : "the reveal time"}.`
    : story?.totalPhotos
      ? "Photos from the event, all in one place."
      : "No photos yet. Share the guest link so people can add theirs.";
  const selectedFilter = useMemo(() => story?.albumFilters.find((filter) => filter.key === activeAlbumFilter) || story?.albumFilters[0] || null, [activeAlbumFilter, story?.albumFilters]);
  const albumPhotoIds = useMemo(() => new Set(selectedFilter?.photoIds || []), [selectedFilter]);
  const albumPhotos = useMemo(() => data?.photos.filter((photo) => !selectedFilter || albumPhotoIds.has(photo.id)) || [], [albumPhotoIds, data?.photos, selectedFilter]);

  useEffect(() => {
    if (!event || !story) return;
    const key = `${event.id}:${story.totalPhotos}:${Boolean(data?.isLocked)}`;
    if (trackedStoryRef.current === key) return;
    trackedStoryRef.current = key;
    trackAnalytics("recap_hero_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { locked: Boolean(data?.isLocked), photoCount: story.totalPhotos } });
    if (!data?.isLocked) {
      trackAnalytics("recap_highlights_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { sectionCount: story.highlightReel.length } });
      trackAnalytics("recap_challenge_moments_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { mode: story.modeLabel, momentCount: story.challengeMoments.length } });
      trackAnalytics("recap_contributors_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { contributorCount: story.contributorCount } });
    }
  }, [data?.isLocked, event, story]);

  async function handleRecapPhotoLike(photo: Photo, liked: boolean) {
    if (!event) return;
    const previousPhoto = photo;
    const optimisticPhoto = applyPhotoLikeState(photo, liked);
    setData((current) => current ? { ...current, photos: updatePhotoInList(current.photos, photo.id, () => optimisticPhoto) } : current);
    setSelectedPhoto((current) => current?.id === photo.id ? optimisticPhoto : current);
    setRecapLinkStatus("");
    try {
      const response = await eventFilmApi.setPhotoLike(event.slug, photo.id, { clientId: session.clientId, liked });
      setData((current) => current ? { ...current, photos: updatePhotoInList(current.photos, photo.id, (item) => applyPhotoLikeState(item, response.liked, response.likeCount)) } : current);
      setSelectedPhoto((current) => current?.id === photo.id ? applyPhotoLikeState(current, response.liked, response.likeCount) : current);
      trackAnalytics(response.liked ? "photo_like_added" : "photo_like_removed", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap", photoId: photo.id } });
    } catch (err) {
      setData((current) => current ? { ...current, photos: updatePhotoInList(current.photos, photo.id, () => previousPhoto) } : current);
      setSelectedPhoto((current) => current?.id === photo.id ? previousPhoto : current);
      setRecapLinkStatus(publicRouteErrorMessage(err, "Could not update that heart. Try again."));
    }
  }

  function openPublicPhoto(photo: Photo) {
    setSelectedPhoto(photo);
    trackAnalytics("recap_photo_opened", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "recap", photoId: photo.id } });
    trackAnalytics("photo_lightbox_opened", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "recap", photoId: photo.id } });
  }

  function chooseAlbumFilter(filter: EventRecapAlbumFilter) {
    setActiveAlbumFilter(filter.key);
    trackAnalytics("recap_album_filter_used", { eventId: event?.id, eventSlug: event?.slug, metadata: { filter: filter.key, count: filter.count } });
  }

  async function copyHeroRecapLink() {
    if (!data?.recapLink || !event) return;
    try {
      await copyText(data.recapLink);
      trackAnalytics("recap_link_copied", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap_hero" } });
      setRecapLinkStatus("Recap link copied");
    } catch (err) {
      setRecapLinkStatus((err as Error).message);
    }
  }

  return (
    <main className="min-h-screen bg-app text-ink">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <BrandMark />
          {event ? <Link className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink" to={`/e/${slug}`}>Add photos</Link> : null}
        </header>

        {!event && (
          <Card className="mt-8 text-center">
            <h1 className="font-serif-display text-3xl font-bold">Loading recap</h1>
            <p className="mt-2 text-muted">{error || "Gathering the event story..."}</p>
          </Card>
        )}

        {event && story && (
          <>
            <section className="grid gap-8 py-10 lg:grid-cols-[1fr_0.62fr] lg:items-center">
              <div>
                <h1 className="font-serif-display text-6xl font-bold leading-none text-ink lg:text-7xl">Shared Recap</h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{data?.isLocked ? recapHeroSentence : `Photos from ${event.name}, all in one place.`}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-coral px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-coral-strong" to={`/e/${slug}`} onClick={() => trackAnalytics("guest_album_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap_upload_cta" } })}>
                    <CleanIcon name="upload" />
                    Add photos
                  </Link>
                  <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-white px-6 py-3 text-sm font-semibold text-ink shadow-none hover:bg-stone-50" type="button" onClick={copyHeroRecapLink}>
                    <CleanIcon name="link" />
                    Copy recap link
                  </button>
                </div>
                {recapLinkStatus ? <p className="mt-3 text-sm font-bold text-green-700">{recapLinkStatus}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(story.highlightPhotos.length ? story.highlightPhotos : data.photos).slice(0, 4).map((photo) => (
                  <div className="relative overflow-hidden rounded-xl bg-stone-100" key={photo.id}>
                    <PhotoHeartButton photo={photo} onToggle={handleRecapPhotoLike} variant="solid" className="absolute right-2 top-2 z-10" />
                    <button className="block w-full" type="button" onClick={() => openPublicPhoto(photo)}>
                      <img className="aspect-square w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="eager" decoding="async" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {data.isLocked ? (
              <Card className="text-center">
                <CleanIcon name="lock" className="mx-auto h-12 w-12 text-coral" />
                <h2 className="mt-4 font-serif-display text-4xl font-bold text-ink">Photos are saved for the reveal.</h2>
                <p className="mx-auto mt-3 max-w-2xl text-muted">The recap unlocks after {formatDateTime(event.revealAt)}.</p>
              </Card>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-ink">Guest favorites</h2>
                      <p className="mt-1 text-sm text-muted">Highlights from everyone</p>
                    </div>
                    <CleanIcon name="heart" className="text-coral" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {story.highlightPhotos.slice(0, 4).map((photo) => (
                      <div className="relative overflow-hidden rounded-lg bg-stone-100" key={photo.id}>
                        <PhotoHeartButton photo={photo} onToggle={handleRecapPhotoLike} variant="solid" className="absolute right-1 top-1 z-10 scale-90" />
                        <button className="block w-full" type="button" onClick={() => openPublicPhoto(photo)}>
                          <img className="aspect-square w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!story.highlightPhotos.length ? <p className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-muted">No favorites yet. Be the first to mark a moment.</p> : null}
                </Card>

                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-ink">Photos</h2>
                      <p className="mt-1 text-sm text-muted">All photos in one place</p>
                    </div>
                    <CleanIcon name="image" className="text-muted" />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {albumPhotos.slice(0, 9).map((photo) => (
                      <div className="relative overflow-hidden rounded-lg bg-stone-100" key={photo.id}>
                        <PhotoHeartButton photo={photo} onToggle={handleRecapPhotoLike} variant="solid" className="absolute right-1 top-1 z-10 scale-90" />
                        <button className="block w-full" type="button" onClick={() => openPublicPhoto(photo)}>
                          <img className="aspect-square w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!albumPhotos.length ? <p className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-muted">No photos yet. Share the guest link so people can add theirs.</p> : null}
                </Card>

                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-ink">People who added photos</h2>
                      <p className="mt-1 text-sm text-muted">Thanks to the group</p>
                    </div>
                    <CleanIcon name="users" className="text-muted" />
                  </div>
                  <div className="mt-6 grid gap-3">
                    {story.contributorSummary.topContributors.slice(0, 5).map((contributor) => (
                      <div className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-3" key={contributor.displayName}>
                        <span className="font-semibold text-ink">{contributor.displayName}</span>
                        <span className="text-sm text-muted">{contributor.photoCount}</span>
                      </div>
                    ))}
                  </div>
                  {!story.contributorSummary.topContributors.length ? <p className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-muted">No one here yet. Share the link or invite friends to add photos.</p> : null}
                </Card>
              </div>
            )}

            {!data.isLocked && albumPhotos.length ? (
              <section className="mt-8" id="recap-photos">
                <div className="mb-4">
                  <h2 className="font-serif-display text-4xl font-bold text-ink">Photos</h2>
                  <p className="text-muted">Photos from the event, all in one place.</p>
                </div>
                <RecapAlbumFilterTabs filters={story.albumFilters} activeFilter={selectedFilter?.key || "all"} onChange={chooseAlbumFilter} />
                <PhotoMosaic photos={albumPhotos} onPhotoClick={openPublicPhoto} onPhotoLike={handleRecapPhotoLike} />
              </section>
            ) : null}

            {event.challenge && !data.isLocked && story.challengeMoments.some((moment) => moment.photos.length || moment.count) ? <RecapChallengeMoments story={story} awardResults={awardResults} photos={data.photos} onPhotoClick={openPublicPhoto} onPhotoLike={handleRecapPhotoLike} /> : null}
            <FullScreenPhotoViewer photo={selectedPhoto} photos={data.photos} mode="public" onClose={() => setSelectedPhoto(null)} onPhotoLike={handleRecapPhotoLike} />
          </>
        )}
      </div>
    </main>
  );


}

function GuestEvent() {
  const { slug = "" } = useParams();
  const [{ key, session }, setGuestSessionState] = useState(() => getGuestSession(slug));
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [nickname, setNickname] = useState(session.nickname);
  const [selectedParticipantId, setSelectedParticipantId] = useState(() => localStorage.getItem(getChallengeParticipantSession(slug)) || "");
  const [selectedPromptId, setSelectedPromptId] = useState(() => localStorage.getItem(getChallengePromptSession(slug)) || "");
  const [selectedItemId, setSelectedItemId] = useState(() => localStorage.getItem(getChallengeItemSession(slug)) || "");
  const participantSelectRef = useRef<HTMLSelectElement | null>(null);
  const uploadCardRef = useRef<HTMLElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const albumRef = useRef<HTMLElement | null>(null);
  const guestHeaderRef = useRef<HTMLElement | null>(null);
  const myUploadsRef = useRef<HTMLElement | null>(null);
  const pageViewedTrackedRef = useRef(false);
  const joinedTrackedRef = useRef(false);
  const returnedTrackedRef = useRef(false);
  const nameChoiceTrackedRef = useRef(false);
  const progressTrackedRef = useRef(false);
  const lastSyncedNicknameRef = useRef(session.nickname);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [myUploads, setMyUploads] = useState<Photo[]>([]);
  const [localUploads, setLocalUploads] = useState<GuestUploadLocalMetadata[]>(() => loadGuestUploadMetadata(slug));
  const [uploadQueue, setUploadQueue] = useState<GuestUploadQueueItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllChallengeItems, setShowAllChallengeItems] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<GuestUploadSuccessSummary | null>(null);
  const [awardResults, setAwardResults] = useState<AwardResultsSummary | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [photoSelectionMode, setPhotoSelectionMode] = useState(false);
  const [selectedAlbumPhotoIds, setSelectedAlbumPhotoIds] = useState<Set<string>>(() => new Set());
  const [photoSaveStatus, setPhotoSaveStatus] = useState<GuestAlbumSaveStatus | null>(null);
  const [photoSaveBusy, setPhotoSaveBusy] = useState(false);
  const [activeGuestTab, setActiveGuestTab] = useState<GuestAlbumTabKey>("photos");
  const [guestHeaderHeight, setGuestHeaderHeight] = useState(0);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const navigate = useNavigate();
  useDocumentScrollLock(uploadSheetOpen);

  async function load() {
    const eventData = await api<{ event: PublicEvent }>(`/api/events/${slug}`);
    setEvent(eventData.event);
    if (!pageViewedTrackedRef.current) {
      pageViewedTrackedRef.current = true;
      trackAnalytics("guest_upload_page_viewed", {
        eventId: eventData.event.id,
        eventSlug: eventData.event.slug,
        metadata: { mode: eventData.event.challenge?.type || "NONE", isRevealed: eventData.event.isRevealed },
      });
    }
    const rememberedUploads = loadGuestUploadMetadata(slug);
    if (!joinedTrackedRef.current) {
      joinedTrackedRef.current = true;
      trackAnalytics("guest_joined_event", {
        eventId: eventData.event.id,
        eventSlug: eventData.event.slug,
        metadata: { mode: eventData.event.challenge?.type || "NONE", hasChallenge: Boolean(eventData.event.challenge) },
      });
    }
    const status = await eventFilmApi.getGuestStatus(slug, session.clientId);
    if (eventData.event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT) {
      const savedNickname = status.nickname && !isAnonymousGuestDisplayName(status.nickname) ? status.nickname : "";
      lastSyncedNicknameRef.current = savedNickname;
      if (savedNickname && !nickname) setNickname(savedNickname);
    }
    const myUploadData = await eventFilmApi.getGuestMyUploads(slug, session.clientId);
    setMyUploads(myUploadData.photos);
    const visibleUploadIds = new Set(myUploadData.photos.map((photo) => photo.id));
    const currentUploads = rememberedUploads.filter((item) => visibleUploadIds.has(item.photoId));
    if (currentUploads.length !== rememberedUploads.length) saveGuestUploadMetadata(slug, currentUploads);
    setLocalUploads(currentUploads);
    if (currentUploads.length && !returnedTrackedRef.current) {
      returnedTrackedRef.current = true;
      trackAnalytics("guest_returned_to_event", {
        eventId: eventData.event.id,
        eventSlug: eventData.event.slug,
        metadata: { photoCount: currentUploads.length },
      });
    }
    trackAnalytics("guest_my_uploads_viewed", { eventId: eventData.event.id, eventSlug: eventData.event.slug, metadata: { surface: "guest_upload", photoCount: myUploadData.photos.length } });
    if (eventData.event.isRevealed) {
      if (eventData.event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) {
        const recapData = await eventFilmApi.getRecapData(slug, session.clientId);
        setPhotos(recapData.photos);
        setAwardResults(recapData.awardResults || buildAwardResultsSummary({ challenge: eventData.event.challenge, photos: recapData.photos }));
      } else {
        const photoData = await eventFilmApi.getAlbumPhotos(slug, session.clientId);
        setPhotos(photoData.photos);
        setAwardResults(null);
      }
    } else {
      setPhotos([]);
      setAwardResults(null);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(publicRouteErrorMessage(err)));
  }, [slug]);

  useEffect(() => {
    if (event?.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT) return;
    const isValidParticipant = event.challenge.participants.some((participant) => participant.id === selectedParticipantId);
    if (!isValidParticipant) {
      setSelectedParticipantId("");
      localStorage.removeItem(getChallengeParticipantSession(slug));
    }
  }, [event, selectedParticipantId, slug]);

  useEffect(() => {
    if (event?.challenge?.type !== CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) return;
    const isValidPrompt = promptsFromChallenge(event.challenge).some((prompt) => prompt.id === selectedPromptId);
    if (!isValidPrompt) {
      setSelectedPromptId("");
      localStorage.removeItem(getChallengePromptSession(slug));
    }
  }, [event, selectedPromptId, slug]);

  useEffect(() => {
    if (event?.challenge?.type !== CHALLENGE_TYPES.EVENT_AWARDS) return;
    const isValidItem = categoriesFromChallenge(event.challenge).some((category) => category.id === selectedItemId);
    if (!isValidItem) {
      setSelectedItemId("");
      localStorage.removeItem(getChallengeItemSession(slug));
    }
  }, [event, selectedItemId, slug]);

  function saveNickname(nextNickname: string) {
    setNickname(nextNickname);
    const nextSession = { ...session, nickname: nextNickname };
    localStorage.setItem(key, JSON.stringify(nextSession));
    setGuestSessionState({ key, session: nextSession });
    if (nextNickname.trim() && !nameChoiceTrackedRef.current) {
      nameChoiceTrackedRef.current = true;
      trackAnalytics("guest_name_entered", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload" } });
    }
  }

  function applyGuestDisplayNameToCurrentUploads(displayName: string) {
    const uploadIds = new Set([...myUploads.map((photo) => photo.id), ...localUploads.map((item) => item.photoId)]);
    if (!uploadIds.size) return;
    const renamePhoto = (photo: Photo): Photo => uploadIds.has(photo.id) ? { ...photo, guestNickname: displayName } : photo;
    setPhotos((current) => current.map(renamePhoto));
    setMyUploads((current) => current.map((photo) => ({ ...photo, guestNickname: displayName })));
    setSelectedPhoto((current) => current && uploadIds.has(current.id) ? { ...current, guestNickname: displayName } : current);
    setLocalUploads((current) => current.map((item) => uploadIds.has(item.photoId) ? { ...item, guestDisplayName: displayName } : item));
  }

  async function commitGuestDisplayName() {
    if (!event || event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT) return;
    if (nickname === lastSyncedNicknameRef.current) return;

    try {
      const status = await eventFilmApi.updateGuestDisplayName(slug, { clientId: session.clientId, nickname });
      const savedNickname = status.nickname && !isAnonymousGuestDisplayName(status.nickname) ? status.nickname : "";
      lastSyncedNicknameRef.current = savedNickname || nickname;
      if (savedNickname && savedNickname !== nickname) saveNickname(savedNickname);
      if (status.nickname) applyGuestDisplayNameToCurrentUploads(status.nickname);
    } catch (err) {
      setError(publicRouteErrorMessage(err, "Name saved on this device, but prior uploads could not be renamed. Try again when connected."));
    }
  }

  function saveSelectedParticipant(participantId: string) {
    setSelectedParticipantId(participantId);
    setUploadSuccess(null);
    if (participantId) localStorage.setItem(getChallengeParticipantSession(slug), participantId);
    else localStorage.removeItem(getChallengeParticipantSession(slug));
    if (participantId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "color" } });
  }

  function switchParticipant() {
    saveSelectedParticipant("");
    setTimeout(() => participantSelectRef.current?.focus(), 0);
  }

  function saveSelectedPrompt(promptId: string) {
    setSelectedPromptId(promptId);
    setUploadSuccess(null);
    setMessage("");
    if (promptId) localStorage.setItem(getChallengePromptSession(slug), promptId);
    else localStorage.removeItem(getChallengePromptSession(slug));
    if (promptId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "prompt" } });
  }

  function saveSelectedItem(itemId: string) {
    setSelectedItemId(itemId);
    setUploadSuccess(null);
    setMessage("");
    if (itemId) localStorage.setItem(getChallengeItemSession(slug), itemId);
    else localStorage.removeItem(getChallengeItemSession(slug));
    if (itemId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "award" } });
  }

  function expandChallengeItems(label: string) {
    setShowAllChallengeItems(true);
    trackAnalytics("guest_prompt_hint_expanded", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE", label } });
  }

  function uploadContextError() {
    if (event?.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && !selectedParticipant) return "Select your Color Hunt name first";
    if (event?.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && !selectedPrompt) return "Choose a Photo Prompts idea first";
    if (event?.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && !selectedAward) return "Choose an Awards category first";
    return "";
  }

  function blockPhotoPickerForContext() {
    if (loading) {
      return true;
    }
    const contextError = uploadContextError();
    if (!contextError) return false;
    setMessage("");
    setUploadSuccess(null);
    setError(contextError);
    return true;
  }

  function openPhotoPicker(source: GuestPhotoPickerSource) {
    if (blockPhotoPickerForContext()) return;
    const input = source === "camera" ? cameraInputRef.current : libraryInputRef.current;
    if (!input) return;

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      try {
        pickerInput.showPicker();
        return;
      } catch {
        input.click();
        return;
      }
    }
    input.click();
  }

  function handlePhotoPickerClick(clickEvent: React.MouseEvent<HTMLInputElement>) {
    if (!blockPhotoPickerForContext()) return;
    clickEvent.preventDefault();
  }

  async function handlePhotoFilesSelected(inputEvent: React.ChangeEvent<HTMLInputElement>, source: GuestPhotoPickerSource) {
    const selectedFiles = Array.from(inputEvent.currentTarget.files || []);
    inputEvent.currentTarget.value = "";
    if (!selectedFiles.length) return;
    await uploadPhotoBatch(selectedFiles, source);
  }

  async function uploadPhotoBatch(files: File[], source: "camera" | "library" | "retry") {
    if (!event || loading || !files.length) return;

    const contextError = uploadContextError();
    if (contextError) {
      setMessage("");
      setUploadSuccess(null);
      setError(contextError);
      return;
    }

    const uploadContext = {
      eventId: event.id,
      eventSlug: event.slug,
      mode: event.challenge?.type || "NONE",
      nickname: selectedParticipant?.displayName || nickname,
      challengeParticipantId: selectedParticipant?.id,
      challengePromptId: selectedPrompt?.id,
      challengeItemId: selectedAward?.id,
    };

    if (event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT && !nickname.trim() && !nameChoiceTrackedRef.current) {
      nameChoiceTrackedRef.current = true;
      trackAnalytics("guest_continued_anonymous", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload" } });
    }

    setMessage("");
    setError("");
    setUploadSuccess(null);

    const nextQueue = files.map((selectedFile, index): GuestUploadQueueItem => {
      const validation = validateUploadFile(selectedFile);
      if (!validation.ok) {
        return {
          id: createGuestUploadQueueId(index),
          file: selectedFile,
          status: "failed",
          error: validation.message,
          retryable: false,
        };
      }
      return {
        id: createGuestUploadQueueId(index),
        file: selectedFile,
        status: "queued",
        retryable: true,
      };
    });

    setUploadQueue(nextQueue);

    nextQueue
      .filter((item) => item.status === "failed")
      .forEach((item, index) => {
        trackAnalytics("photo_upload_failed", {
          eventId: uploadContext.eventId,
          eventSlug: uploadContext.eventSlug,
          metadata: { mode: uploadContext.mode, outcome: "validation", source, batchSize: files.length, batchIndex: index + 1, selectedCount: files.length, fileName: item.file.name },
        });
      });

    const uploadableItems = nextQueue.filter((item) => item.status === "queued");
    if (!uploadableItems.length) {
      const failedCount = nextQueue.length;
      setError(`${failedCount} ${failedCount === 1 ? "photo" : "photos"} could not upload. ${nextQueue[0]?.error || "Choose different photos."}`);
      return;
    }

    let uploadedCount = 0;
    let failedCount = nextQueue.length - uploadableItems.length;
    let firstFailureMessage = nextQueue.find((item) => item.status === "failed")?.error || "";
    let refreshError = "";

    setLoading(true);
    try {
      for (const item of uploadableItems) {
        const batchIndex = nextQueue.findIndex((queueItem) => queueItem.id === item.id) + 1;
        setUploadQueue((current) => current.map((queueItem) => queueItem.id === item.id ? { ...queueItem, status: "uploading", error: undefined } : queueItem));

        const formData = new FormData();
        formData.append("photo", item.file);
        formData.append("nickname", uploadContext.nickname);
        formData.append("clientId", session.clientId);
        if (uploadContext.challengeParticipantId) formData.append("challengeParticipantId", uploadContext.challengeParticipantId);
        if (uploadContext.challengePromptId) formData.append("challengePromptId", uploadContext.challengePromptId);
        if (uploadContext.challengeItemId) formData.append("challengeItemId", uploadContext.challengeItemId);

        trackAnalytics("photo_upload_started", {
          eventId: uploadContext.eventId,
          eventSlug: uploadContext.eventSlug,
          metadata: { mode: uploadContext.mode, source, batchSize: files.length, batchIndex, selectedCount: files.length, fileName: item.file.name },
        });

        try {
          const data = await api<{ photo: Photo }>(`/api/events/${slug}/photos`, { method: "POST", body: formData });
          uploadedCount += 1;
          trackAnalytics("photo_upload_succeeded", {
            eventId: uploadContext.eventId,
            eventSlug: uploadContext.eventSlug,
            metadata: { mode: uploadContext.mode, source, batchSize: files.length, batchIndex, selectedCount: files.length, fileName: item.file.name },
          });
          const nextLocalUploads = recordGuestUploadMetadata(slug, data.photo);
          setLocalUploads(nextLocalUploads);
          setUploadSuccess(buildGuestUploadSuccessSummary({ event, photo: data.photo }));
          setUploadQueue((current) => current.map((queueItem) => queueItem.id === item.id ? { ...queueItem, status: "uploaded", photo: data.photo, error: undefined } : queueItem));
        } catch (err) {
          failedCount += 1;
          const failureMessage = publicRouteErrorMessage(err, "Upload failed. Check your connection and try again.");
          if (!firstFailureMessage) firstFailureMessage = failureMessage;
          trackAnalytics("photo_upload_failed", {
            eventId: uploadContext.eventId,
            eventSlug: uploadContext.eventSlug,
            metadata: { mode: uploadContext.mode, outcome: "error", source, batchSize: files.length, batchIndex, selectedCount: files.length, fileName: item.file.name },
          });
          setUploadQueue((current) => current.map((queueItem) => queueItem.id === item.id ? { ...queueItem, status: "failed", error: failureMessage, retryable: true } : queueItem));
        }
      }

      if (uploadedCount) {
        try {
          await load();
        } catch (err) {
          refreshError = publicRouteErrorMessage(err, "Photos uploaded, but the album could not refresh. Reload to see them.");
        }
      }
    } finally {
      setLoading(false);
      if (uploadedCount) {
        setMessage(`${uploadedCount} ${uploadedCount === 1 ? "photo" : "photos"} added${failedCount ? `. ${failedCount} ${failedCount === 1 ? "photo" : "photos"} could not upload.` : "."}`);
      }
      if (failedCount) {
        setError(`${failedCount} ${failedCount === 1 ? "photo" : "photos"} could not upload.${firstFailureMessage ? ` ${firstFailureMessage}` : ""}`);
      } else if (refreshError) {
        setError(refreshError);
      } else {
        setError("");
      }
    }
  }

  async function retryFailedUploads() {
    const retryFiles = uploadQueue.filter((item) => item.status === "failed" && item.retryable !== false).map((item) => item.file);
    if (!retryFiles.length) return;
    trackAnalytics("photo_upload_retry_clicked", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload", photoCount: retryFiles.length } });
    await uploadPhotoBatch(retryFiles, "retry");
  }

  const selectedParticipant = useMemo(() => event?.challenge?.participants.find((participant) => participant.id === selectedParticipantId), [event?.challenge?.participants, selectedParticipantId]);
  const guestPrompts = useMemo(() => promptsFromChallenge(event?.challenge), [event?.challenge]);
  const guestAwards = useMemo(() => categoriesFromChallenge(event?.challenge), [event?.challenge]);
  const selectedPrompt = useMemo(() => guestPrompts.find((prompt) => prompt.id === selectedPromptId), [guestPrompts, selectedPromptId]);
  const selectedAward = useMemo(() => guestAwards.find((category) => category.id === selectedItemId), [guestAwards, selectedItemId]);
  const capsuleCopy = useMemo(() => event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null, [event?.challenge]);
  const guestProgress = useMemo(() => event ? buildGuestChallengeProgress(event.challenge, photos, { participantId: selectedParticipantId, promptId: selectedPromptId, itemId: selectedItemId }) : null, [event, photos, selectedItemId, selectedParticipantId, selectedPromptId]);
  const contributorSummary = useMemo(() => buildContributorSummary(photos), [photos]);
  const compactPromptItems = useMemo(() => showAllChallengeItems ? guestPrompts : guestPrompts.slice(0, 3), [guestPrompts, showAllChallengeItems]);
  const compactAwardItems = useMemo(() => showAllChallengeItems ? guestAwards : guestAwards.slice(0, 3), [guestAwards, showAllChallengeItems]);
  useEffect(() => {
    if (!event || !guestProgress || progressTrackedRef.current) return;
    progressTrackedRef.current = true;
    trackAnalytics("challenge_progress_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { mode: guestProgress.mode, surface: "guest_upload" } });
  }, [event?.id, guestProgress?.mode]);

  function trackUploadSuccessAction(action: string) {
    trackAnalytics("upload_success_action_clicked", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload", label: action } });
  }

  async function handleGuestPhotoLike(photo: Photo, liked: boolean) {
    if (!event) return;
    const previousPhoto = photo;
    const optimisticPhoto = applyPhotoLikeState(photo, liked);
    setPhotos((current) => updatePhotoInList(current, photo.id, () => optimisticPhoto));
    setMyUploads((current) => updatePhotoInList(current, photo.id, () => optimisticPhoto));
    setSelectedPhoto((current) => current?.id === photo.id ? optimisticPhoto : current);
    setMessage("");
    setError("");
    try {
      const response = await eventFilmApi.setPhotoLike(event.slug, photo.id, { clientId: session.clientId, liked });
      const applyResponse = (item: Photo) => applyPhotoLikeState(item, response.liked, response.likeCount);
      setPhotos((current) => updatePhotoInList(current, photo.id, applyResponse));
      setMyUploads((current) => updatePhotoInList(current, photo.id, applyResponse));
      setSelectedPhoto((current) => current?.id === photo.id ? applyResponse(current) : current);
      trackAnalytics(response.liked ? "photo_like_added" : "photo_like_removed", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "guest_album", photoId: photo.id } });
    } catch (err) {
      setPhotos((current) => updatePhotoInList(current, photo.id, () => previousPhoto));
      setMyUploads((current) => updatePhotoInList(current, photo.id, () => previousPhoto));
      setSelectedPhoto((current) => current?.id === photo.id ? previousPhoto : current);
      setError(publicRouteErrorMessage(err, "Could not update that heart. Try again."));
    }
  }

  function openUploadSheet() {
    setUploadSheetOpen(true);
    setOptionsOpen(false);
    setPhotoSelectionMode(false);
    setSelectedAlbumPhotoIds(new Set());
  }

  function goBackFromGuestAlbum() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  const isMemoryCapsuleLocked = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && !event.isRevealed;
  const visibleAlbumPhotos = useMemo(() => isMemoryCapsuleLocked ? [] : photos, [isMemoryCapsuleLocked, photos]);
  const selectedAlbumPhotos = useMemo(() => visibleAlbumPhotos.filter((photo) => selectedAlbumPhotoIds.has(photo.id)), [selectedAlbumPhotoIds, visibleAlbumPhotos]);
  const selectedAlbumPhotoCount = selectedAlbumPhotos.length;
  const allVisibleAlbumPhotosSelected = visibleAlbumPhotos.length > 0 && selectedAlbumPhotoCount === visibleAlbumPhotos.length;
  const displayedPhotoCount = event?.photoCount ?? visibleAlbumPhotos.length;
  const guestSubtitle = isMemoryCapsuleLocked ? "Photos locked" : `${displayedPhotoCount} ${displayedPhotoCount === 1 ? "photo" : "photos"}`;
  const guestAwardResults = useMemo(() => event?.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS ? buildAwardResultsSummary({ challenge: event.challenge, photos: visibleAlbumPhotos }) : awardResults, [awardResults, event, visibleAlbumPhotos]);
  const highlightPhotos = useMemo(() => [...visibleAlbumPhotos].sort((first, second) => {
    const featuredDelta = Number(Boolean(second.isFeatured)) - Number(Boolean(first.isFeatured));
    if (featuredDelta) return featuredDelta;
    const likeDelta = Number(second.likeCount || 0) - Number(first.likeCount || 0);
    if (likeDelta) return likeDelta;
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  }).slice(0, 8), [visibleAlbumPhotos]);
  const contributorTiles = useMemo(() => contributorSummary.topContributors.map((contributor) => ({
    ...contributor,
    photos: visibleAlbumPhotos
      .filter((photo) => sanitizeGuestDisplayName(photo.challengeParticipantName || photo.guestNickname).toLowerCase() === contributor.displayName.toLowerCase())
      .slice(0, 3),
  })), [contributorSummary, visibleAlbumPhotos]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const header = guestHeaderRef.current;
    if (!header) {
      setGuestHeaderHeight(0);
      return;
    }

    const updateHeaderHeight = () => {
      const nextHeight = Math.ceil(header.getBoundingClientRect().height);
      setGuestHeaderHeight((currentHeight) => currentHeight === nextHeight ? currentHeight : nextHeight);
    };

    updateHeaderHeight();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeaderHeight) : null;
    resizeObserver?.observe(header);
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, [activeGuestTab, event?.name, guestSubtitle, uploadSheetOpen]);

  useEffect(() => {
    const visibleIds = new Set(visibleAlbumPhotos.map((photo) => photo.id));
    setSelectedAlbumPhotoIds((current) => {
      const next = new Set(Array.from(current).filter((photoId) => visibleIds.has(photoId)));
      return next.size === current.size ? current : next;
    });
    if (!visibleAlbumPhotos.length && photoSelectionMode) setPhotoSelectionMode(false);
  }, [photoSelectionMode, visibleAlbumPhotos]);

  useEffect(() => {
    if (activeGuestTab !== "photos" && photoSelectionMode) {
      setPhotoSelectionMode(false);
      setSelectedAlbumPhotoIds(new Set());
    }
  }, [activeGuestTab, photoSelectionMode]);

  function openPhotoSelectionMode() {
    setOptionsOpen(false);
    setUploadSheetOpen(false);
    setActiveGuestTab("photos");
    setSelectedAlbumPhotoIds(new Set());
    setPhotoSaveStatus(null);
    if (!visibleAlbumPhotos.length) {
      setPhotoSaveStatus({
        tone: "info",
        text: isMemoryCapsuleLocked ? "Photos unlock after reveal." : "No photos to select yet.",
      });
      return;
    }
    setPhotoSelectionMode(true);
  }

  function cancelPhotoSelection() {
    setPhotoSelectionMode(false);
    setSelectedAlbumPhotoIds(new Set());
    setPhotoSaveStatus(null);
  }

  function toggleAlbumPhotoSelection(photoId: string) {
    setPhotoSaveStatus(null);
    setSelectedAlbumPhotoIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function selectAllAlbumPhotos() {
    setPhotoSaveStatus(null);
    setSelectedAlbumPhotoIds(new Set(visibleAlbumPhotos.map((photo) => photo.id)));
  }

  function clearSelectedAlbumPhotos() {
    setPhotoSaveStatus(null);
    setSelectedAlbumPhotoIds(new Set());
  }

  async function saveSelectedAlbumPhotos() {
    if (!event || photoSaveBusy) return;
    if (!selectedAlbumPhotos.length) {
      setPhotoSaveStatus({ tone: "info", text: "Select at least one photo." });
      return;
    }

    setPhotoSaveBusy(true);
    setPhotoSaveStatus({ tone: "info", text: `Preparing ${selectedAlbumPhotoCount} ${selectedAlbumPhotoCount === 1 ? "photo" : "photos"}...` });

    try {
      const files = await Promise.all(selectedAlbumPhotos.map((photo, index) => fetchSelectedPhotoFile(photo, index)));
      const analyticsMetadata = {
        surface: "guest_album_select",
        photoCount: files.length,
        photoIds: selectedAlbumPhotos.map((photo) => photo.id).join(","),
      };

      if (canSharePhotoFiles(files)) {
        try {
          trackAnalytics("native_share_opened", { eventId: event.id, eventSlug: event.slug, metadata: analyticsMetadata });
          await navigator.share({
            files,
            title: `${event.name} photos`,
            text: `Save photos from ${event.name}.`,
          });
          trackAnalytics("album_downloaded", { eventId: event.id, eventSlug: event.slug, metadata: { ...analyticsMetadata, method: "native_share" } });
          setPhotoSaveStatus({ tone: "success", text: `Opened save options for ${files.length} ${files.length === 1 ? "photo" : "photos"}.` });
          setPhotoSelectionMode(false);
          setSelectedAlbumPhotoIds(new Set());
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") {
            setPhotoSaveStatus({ tone: "info", text: "Save canceled." });
            return;
          }
        }
      }

      files.forEach(downloadPhotoFile);
      trackAnalytics("album_downloaded", { eventId: event.id, eventSlug: event.slug, metadata: { ...analyticsMetadata, method: "download_fallback" } });
      setPhotoSaveStatus({ tone: "success", text: `${files.length} ${files.length === 1 ? "photo" : "photos"} downloaded.` });
      setPhotoSelectionMode(false);
      setSelectedAlbumPhotoIds(new Set());
    } catch (err) {
      setPhotoSaveStatus({ tone: "error", text: publicRouteErrorMessage(err, "Could not save selected photos. Try again or long-press one photo.") });
    } finally {
      setPhotoSaveBusy(false);
    }
  }

  const guestTabs: GuestAlbumTab[] = [
    { key: "photos", label: "Photos" },
    { key: "people", label: "People" },
    { key: "highlights", label: "Highlights" },
  ];
  const uploadSheetTop = uploadSheetOpen ? guestHeaderHeight : 0;
  const uploadQueueTotal = uploadQueue.length;
  const uploadedQueueCount = uploadQueue.filter((item) => item.status === "uploaded").length;
  const failedQueueCount = uploadQueue.filter((item) => item.status === "failed").length;
  const retryableFailedUploadCount = uploadQueue.filter((item) => item.status === "failed" && item.retryable !== false).length;
  const uploadingQueueIndex = uploadQueue.findIndex((item) => item.status === "uploading");
  const currentUploadNumber = uploadingQueueIndex >= 0 ? uploadingQueueIndex + 1 : Math.min(uploadedQueueCount, uploadQueueTotal);
  const uploadQueueStatusText = loading && uploadQueueTotal
    ? `Adding ${Math.max(1, currentUploadNumber)} of ${uploadQueueTotal}...`
    : message || (uploadQueueTotal && failedQueueCount ? `${uploadedQueueCount} ${uploadedQueueCount === 1 ? "photo" : "photos"} added. ${failedQueueCount} ${failedQueueCount === 1 ? "photo" : "photos"} could not upload.` : "");
  const photoSaveStatusClass = photoSaveStatus?.tone === "error"
    ? "bg-red-50 text-red-700"
    : photoSaveStatus?.tone === "success"
      ? "bg-green-50 text-green-800"
      : "bg-stone-100 text-stone-700";

  return (
    <main className="min-h-screen bg-white text-[#171717]">
      <div className="mx-auto min-h-screen max-w-[430px] bg-white pb-28">
      {!event && !error && (
        <div className="grid min-h-screen place-items-center px-6 text-center">
          <div>
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#fff0ed] text-[#e85d3f]">
              <CleanIcon name="image" className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-stone-600">Loading event...</p>
          </div>
        </div>
      )}
      {error && !event && (
        <div className="grid min-h-screen place-items-center px-6 text-center">
          <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>
        </div>
      )}
      {event && (
        <>
          <GuestAlbumHeader
            activeTab={activeGuestTab}
            canSelectPhotos={Boolean(visibleAlbumPhotos.length)}
            eventName={event.name}
            eventSlug={event.slug}
            headerRef={guestHeaderRef}
            isSnapshot={uploadSheetOpen}
            onAddPhotos={openUploadSheet}
            onBack={goBackFromGuestAlbum}
            onOptionsToggle={() => setOptionsOpen((open) => !open)}
            onSelectPhotos={openPhotoSelectionMode}
            onTabChange={setActiveGuestTab}
            optionsOpen={optionsOpen}
            subtitle={guestSubtitle}
            tabs={guestTabs}
          />

          <section id="event-album" ref={albumRef} className="scroll-mt-24 px-2 pt-2">
            {activeGuestTab === "photos" ? (
              isMemoryCapsuleLocked ? (
                <div className="mx-2 mt-10 rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-[#653e00]">
                    <CleanIcon name="lock" className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-[#653e00]">{capsuleCopy?.revealTitle || "Album reveal is locked"}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">{capsuleCopy?.revealNote || `Photos unlock after ${formatDateTime(event.revealAt)}.`}</p>
                </div>
              ) : visibleAlbumPhotos.length ? (
                <div className="columns-2 gap-1.5">
                  {visibleAlbumPhotos.map((photo, index) => {
                    const photoSelected = selectedAlbumPhotoIds.has(photo.id);
                    return (
                      <div className={cx("relative mb-1.5 break-inside-avoid overflow-hidden rounded-lg bg-stone-100", photoSelectionMode && photoSelected ? "ring-2 ring-[#e85d3f]" : "")} key={photo.id}>
                        {!photoSelectionMode ? <PhotoHeartButton photo={photo} onToggle={handleGuestPhotoLike} variant="solid" className="absolute right-1.5 top-1.5 z-10" /> : null}
                        <button
                          type="button"
                          className="relative block w-full text-left"
                          aria-pressed={photoSelectionMode ? photoSelected : undefined}
                          aria-label={photoSelectionMode ? `${photoSelected ? "Deselect" : "Select"} ${photo.originalFilename}` : undefined}
                          onClick={() => {
                            if (photoSelectionMode) {
                              toggleAlbumPhotoSelection(photo.id);
                              return;
                            }
                            setSelectedPhoto(photo);
                            trackAnalytics("photo_lightbox_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "guest_album", photoId: photo.id } });
                          }}
                        >
                          <img className="w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading={index < 6 ? "eager" : "lazy"} decoding="async" />
                          {photoSelectionMode ? (
                            <span className={cx("absolute inset-0 flex items-start justify-end p-2 transition", photoSelected ? "bg-black/20" : "bg-black/0")}>
                              <span className={cx("grid h-8 w-8 place-items-center rounded-full border text-white shadow-sm", photoSelected ? "border-[#e85d3f] bg-[#e85d3f]" : "border-white/90 bg-black/30")}>
                                {photoSelected ? <CleanIcon name="check" className="h-4 w-4" /> : null}
                              </span>
                            </span>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mx-2 mt-10 rounded-lg border border-dashed border-stone-200 bg-white p-6 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#fff0ed] text-[#e85d3f]">
                    <CleanIcon name="upload" className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-stone-950">No photos yet.</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-500">Add the first photo and it will appear here right away.</p>
                </div>
              )
            ) : null}

            {activeGuestTab === "people" ? (
              <div className="px-2 pt-4">
                {contributorTiles.length ? (
                  <div className="grid gap-3">
                    {contributorTiles.map((contributor) => (
                      <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3" key={contributor.displayName}>
                        <div className="flex h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                          {contributor.photos.length ? contributor.photos.map((photo) => (
                            <img className="h-full min-w-0 flex-1 object-cover" src={photoImageSrc(photo)} alt="" key={photo.id} loading="lazy" decoding="async" />
                          )) : <CleanIcon name="users" className="m-auto h-5 w-5 text-stone-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-stone-950">{contributor.displayName}</p>
                          <p className="mt-1 text-xs font-semibold text-stone-500">{contributor.photoCount} {contributor.photoCount === 1 ? "photo" : "photos"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-lg border border-dashed border-stone-200 p-5 text-center">
                    <h2 className="text-lg font-bold text-stone-950">No named contributors yet.</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-stone-500">Guests can add a name when they upload, or stay anonymous.</p>
                  </div>
                )}
              </div>
            ) : null}

            {activeGuestTab === "highlights" ? (
              <div className="px-2 pt-4">
                {guestAwardResults ? <AwardResultsPanel awardResults={guestAwardResults} photos={visibleAlbumPhotos} onPhotoClick={(photo) => {
                  setSelectedPhoto(photo);
                  trackAnalytics("photo_lightbox_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "guest_album_awards", photoId: photo.id } });
                }} onPhotoLike={handleGuestPhotoLike} /> : null}
                {highlightPhotos.length ? (
                  <div className="mt-4 columns-2 gap-1.5">
                    {highlightPhotos.map((photo) => (
                      <div className="relative mb-1.5 break-inside-avoid overflow-hidden rounded-lg bg-stone-100" key={photo.id}>
                        <PhotoHeartButton photo={photo} onToggle={handleGuestPhotoLike} variant="solid" className="absolute right-1.5 top-1.5 z-10" />
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => {
                            setSelectedPhoto(photo);
                            trackAnalytics("photo_lightbox_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "guest_album_highlights", photoId: photo.id } });
                          }}
                        >
                          <img className="w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-lg border border-dashed border-stone-200 p-5 text-center">
                    <h2 className="text-lg font-bold text-stone-950">Highlights will build here.</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-stone-500">Host picks, hearts, and recent photos appear as the album grows.</p>
                  </div>
                )}
              </div>
            ) : null}
          </section>

          <FullScreenPhotoViewer photo={selectedPhoto} photos={visibleAlbumPhotos} mode="public" onClose={() => setSelectedPhoto(null)} onPhotoLike={handleGuestPhotoLike} />

          {photoSelectionMode ? (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-3 shadow-[0_-6px_16px_rgba(23,23,23,0.08)] backdrop-blur">
              <div className="mx-auto max-w-[430px]">
                {photoSaveStatus ? <p className={cx("mb-2 rounded-lg px-3 py-2 text-sm font-semibold", photoSaveStatusClass)} role="status">{photoSaveStatus.text}</p> : null}
                <div className="flex items-center gap-2">
                  <button type="button" className="min-h-11 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100" onClick={cancelPhotoSelection} disabled={photoSaveBusy}>Cancel</button>
                  <p className="min-w-0 flex-1 text-center text-sm font-bold text-stone-900">{selectedAlbumPhotoCount} selected</p>
                  <button type="button" className="min-h-11 rounded-lg px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100 disabled:text-stone-400" onClick={allVisibleAlbumPhotosSelected ? clearSelectedAlbumPhotos : selectAllAlbumPhotos} disabled={photoSaveBusy || !visibleAlbumPhotos.length}>
                    {allVisibleAlbumPhotosSelected ? "Clear" : "Select all"}
                  </button>
                </div>
                <button type="button" className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#e85d3f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#d84d32] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600" disabled={photoSaveBusy || !selectedAlbumPhotoCount} onClick={() => {
                  void saveSelectedAlbumPhotos();
                }}>
                  <CleanIcon name="download" className="h-5 w-5" />
                  {photoSaveBusy ? "Preparing..." : "Save selected"}
                </button>
              </div>
            </div>
          ) : (
            <div className="fixed inset-x-0 bottom-7 z-30 flex flex-col items-center gap-2 px-4 pointer-events-none">
              {photoSaveStatus ? <p className={cx("pointer-events-auto max-w-[390px] rounded-lg px-3 py-2 text-center text-sm font-semibold shadow-sm", photoSaveStatusClass)} role="status">{photoSaveStatus.text}</p> : null}
              <button type="button" className="pointer-events-auto inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-[#e85d3f] px-7 py-3 text-base font-bold text-white shadow-[0_6px_16px_rgba(232,93,63,0.24)] transition hover:bg-[#d84d32]" onClick={openUploadSheet}>
                <CleanIcon name="upload" className="h-5 w-5" />
                Add photos
              </button>
            </div>
          )}

          {uploadSheetOpen ? (
            <div className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-center overflow-hidden overscroll-contain bg-black/25 px-0 sm:px-4" style={{ top: uploadSheetTop }} role="dialog" aria-modal="true" aria-label="Add photos">
              <button type="button" className="absolute inset-0 cursor-default" aria-label="Close upload sheet" onClick={() => setUploadSheetOpen(false)} />
              <div className="relative max-h-full w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-xl bg-white p-4 shadow-sm" data-testid="upload-sheet-panel">
                <div className="-mx-4 -mt-4 flex items-center justify-between border-b border-stone-100 bg-white px-4 py-3" data-testid="upload-sheet-header">
                  <div>
                    <h2 className="text-xl font-bold text-stone-950">Add photos</h2>
                    <p className="mt-1 text-xs font-semibold text-stone-500">No account needed.</p>
                  </div>
                  <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-stone-600 hover:bg-stone-100" aria-label="Close upload sheet" onClick={() => setUploadSheetOpen(false)}>
                    <Icon>close</Icon>
                  </button>
                </div>

                {event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && (
                  <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-base font-bold text-[#653e00]">Find your color.</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-700">Pick your name or team so the photo lands in the right lane.</p>
                    <label className="mt-4 grid gap-2 text-sm font-bold text-stone-700">
                      Pick your color
                      <select ref={participantSelectRef} className="h-12 rounded-lg border border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" value={selectedParticipantId} onChange={(selectEvent) => saveSelectedParticipant(selectEvent.target.value)} required>
                        <option value="">Select a participant</option>
                        {event.challenge.participants.map((participant) => (
                          <option value={participant.id} key={participant.id}>{participant.displayName} - {participant.colorName}</option>
                        ))}
                      </select>
                    </label>
                    {selectedParticipant ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-stone-800">
                        <span>Your color:</span>
                        <ColorChip participant={selectedParticipant} />
                        <button type="button" className="rounded-full border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:border-amber-400 hover:bg-amber-50" onClick={switchParticipant}>Switch participant</button>
                      </div>
                    ) : null}
                  </section>
                )}

                {event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && (
                  <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-base font-bold text-[#653e00]">Pick a prompt.</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-700">Choose one idea before uploading.</p>
                    <div className="mt-4 grid gap-2">
                      {compactPromptItems.map((prompt, index) => {
                        const promptId = prompt.id || `prompt-${prompt.order ?? index}`;
                        return (
                          <button type="button" className={cx("rounded-lg border p-3 text-left text-sm font-bold transition", selectedPromptId === promptId ? "border-[#e85d3f] bg-white text-[#653e00]" : "border-amber-200 bg-white/70 text-stone-800 hover:border-[#e85d3f]")} onClick={() => saveSelectedPrompt(promptId)} key={promptId}>
                            {prompt.text}
                          </button>
                        );
                      })}
                      {!showAllChallengeItems && guestPrompts.length > 3 ? <SecondaryButton type="button" className="min-h-10 justify-self-start px-4 py-2" onClick={() => expandChallengeItems("show_more_prompts")}>Show more prompts</SecondaryButton> : null}
                    </div>
                  </section>
                )}

                {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && (
                  <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-base font-bold text-[#653e00]">Choose an award.</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-700">Pick the category that fits the photo.</p>
                    <div className="mt-4 grid gap-2">
                      {compactAwardItems.map((category, index) => {
                        const categoryId = category.id || `award-${category.order ?? index}`;
                        return (
                          <button type="button" className={cx("rounded-lg border p-3 text-left text-sm font-bold transition", selectedItemId === categoryId ? "border-[#e85d3f] bg-white text-[#653e00]" : "border-amber-200 bg-white/70 text-stone-800 hover:border-[#e85d3f]")} onClick={() => saveSelectedItem(categoryId)} key={categoryId}>
                            {category.label}
                          </button>
                        );
                      })}
                      {!showAllChallengeItems && guestAwards.length > 3 ? <SecondaryButton type="button" className="min-h-10 justify-self-start px-4 py-2" onClick={() => expandChallengeItems("show_more_awards")}>Show more categories</SecondaryButton> : null}
                    </div>
                  </section>
                )}

                {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && capsuleCopy ? (
                  <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="text-base font-bold text-[#653e00]">{capsuleCopy.revealTitle}</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-700">{capsuleCopy.revealNote}</p>
                  </section>
                ) : null}

                <section id="guest-upload-card" ref={uploadCardRef} className="mt-4">
                  {event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && selectedParticipant ? <p className="rounded-lg bg-stone-50 p-3 text-sm font-bold text-stone-800">Posting as {selectedParticipant.displayName}</p> : null}
                  {event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && selectedPrompt ? <p className="rounded-lg bg-stone-50 p-3 text-sm font-bold text-stone-800">Uploading for: {selectedPrompt.text}</p> : null}
                  {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && selectedAward ? <p className="rounded-lg bg-stone-50 p-3 text-sm font-bold text-stone-800">Submitting for: {selectedAward.label}</p> : null}
                  {event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT ? (
                    <label className="mt-4 grid gap-2 text-sm font-bold text-stone-700">
                      Display name <span className="font-semibold text-stone-500">(optional)</span>
                      <TextInput value={nickname} onChange={(event) => saveNickname(event.target.value)} onBlur={() => {
                        void commitGuestDisplayName();
                      }} placeholder="Optional" />
                      <span className="text-xs font-semibold text-stone-500">Leave blank to post as Anonymous guest.</span>
                    </label>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" className={cx("flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#e85d3f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#d84d32]", loading ? "cursor-not-allowed opacity-70" : "")} disabled={loading} onClick={() => openPhotoPicker("camera")}>
                      <Icon>photo_camera</Icon>
                      Take photo
                    </button>
                    <button type="button" className={cx("flex min-h-12 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-bold text-stone-900 transition hover:border-[#e85d3f] hover:bg-[#fff0ed]", loading ? "cursor-not-allowed opacity-70" : "")} disabled={loading} onClick={() => openPhotoPicker("library")}>
                      <Icon>photo_library</Icon>
                      Library
                    </button>
                    <input ref={cameraInputRef} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Take a photo" disabled={loading} onClick={handlePhotoPickerClick} onChange={(event) => {
                      void handlePhotoFilesSelected(event, "camera");
                    }} />
                    <input ref={libraryInputRef} className="sr-only" type="file" accept={GUEST_LIBRARY_FILE_ACCEPT} multiple aria-label="Choose from phone" disabled={loading} onClick={handlePhotoPickerClick} onChange={(event) => {
                      void handlePhotoFilesSelected(event, "library");
                    }} />
                  </div>

                  {uploadQueueTotal ? (
                    <section className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3" role="status" aria-live="polite">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-stone-950">{uploadQueueStatusText}</h3>
                          <p className="mt-1 text-xs font-semibold text-stone-500">{loading ? "Keep this sheet open while the photos upload." : "You can choose more photos whenever you are ready."}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-700">{uploadedQueueCount}/{uploadQueueTotal}</span>
                      </div>
                      <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                        {uploadQueue.map((item) => (
                          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-3 py-2 last:border-b-0" key={item.id}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-stone-900">{item.file.name || "Selected photo"}</p>
                              <p className="mt-0.5 text-xs font-semibold text-stone-500">{formatBytes(item.file.size)} {item.file.type || "image"}</p>
                              {item.error ? <p className="mt-1 text-xs font-semibold text-red-700">{item.error}</p> : null}
                            </div>
                            <span className={cx("shrink-0 rounded-full px-3 py-1 text-xs font-bold", item.status === "uploaded" ? "bg-green-50 text-green-800" : item.status === "failed" ? "bg-red-50 text-red-700" : item.status === "uploading" ? "bg-[#fff0ed] text-[#e85d3f]" : "bg-stone-100 text-stone-600")}>
                              {item.status === "uploaded" ? "Added" : item.status === "failed" ? "Could not upload" : item.status === "uploading" ? "Adding" : "Waiting"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {uploadSuccess?.revealNote ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{uploadSuccess.revealNote}</p> : null}
                      {uploadedQueueCount ? (
                        <div className="mt-3 grid gap-2">
                          {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS ? <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#e1d4c5] bg-white px-4 py-3 text-sm font-bold text-stone-900" to={`/recap/${slug}`}>Heart award favorites</Link> : null}
                        <a className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#e1d4c5] bg-white px-4 py-3 text-sm font-bold text-stone-900" href="#my-uploads" onClick={() => {
                          trackUploadSuccessAction("view_my_uploads");
                          setTimeout(() => myUploadsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                        }}>View my uploads</a>
                        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#e1d4c5] bg-white px-4 py-3 text-sm font-bold text-stone-900" onClick={() => {
                          trackUploadSuccessAction("back_to_event_album");
                          setUploadSheetOpen(false);
                          setTimeout(() => albumRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                        }}>Back to album</button>
                      </div>
                      ) : null}
                    </section>
                  ) : null}
                  {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
                  {retryableFailedUploadCount ? <SecondaryButton type="button" className="mt-3 w-full" onClick={() => {
                    void retryFailedUploads();
                  }}>Try failed photos again</SecondaryButton> : null}
                </section>

                {guestProgress ? (
                  <section className="mt-5 rounded-lg border border-stone-200 p-4">
                    <h3 className="text-base font-bold text-stone-950">{guestProgress.headline}</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-600">{guestProgress.note}</p>
                    {guestProgress.rows.length ? (
                      <div className="mt-4 grid gap-2">
                        {guestProgress.rows.slice(0, 4).map((row) => (
                          <div className="rounded-lg bg-stone-50 p-3" key={row.id}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate text-sm font-bold text-stone-900">{row.label}</p>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#653e00]">{row.count}</span>
                            </div>
                            {row.colorHex ? <div className="mt-2 h-2 rounded-full" style={{ backgroundColor: row.colorHex }} /> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <section id="my-uploads" ref={myUploadsRef} className="mt-5 scroll-mt-5 rounded-lg border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-bold text-stone-950">Your uploads</h3>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{myUploads.length}</span>
                  </div>
                  {myUploads.length ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {myUploads.map((photo) => (
                        <div className="relative overflow-hidden rounded-lg bg-stone-100" key={photo.id}>
                          <PhotoHeartButton photo={photo} onToggle={handleGuestPhotoLike} variant="solid" className="absolute right-1 top-1 z-10 scale-90" />
                          <img className="aspect-square w-full object-cover" src={photoImageSrc(photo)} alt={photo.originalFilename} loading="lazy" decoding="async" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm font-semibold text-stone-600">No uploads from this device yet.</p>
                  )}
                </section>
              </div>
            </div>
          ) : null}
        </>
      )}
      </div>
    </main>
  );
}

function App() {
  useMobileKeyboardZoomRecovery();

  return (
    <AuthProvider>
      <AppErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingRedesign />} />
            <Route path="/demo" element={<LandingDemoGate />} />
            <Route path="/privacy" element={<TrustPage kind="privacy" />} />
            <Route path="/terms" element={<TrustPage kind="terms" />} />
            <Route path="/support" element={<TrustPage kind="support" />} />
            <Route path="/signup" element={<AuthForm mode="signup" />} />
            <Route path="/login" element={<AuthForm mode="login" />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard/founder" element={<ProtectedRoute><FounderDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/beta-readiness" element={<ProtectedRoute><BetaReadiness /></ProtectedRoute>} />
            <Route path="/dashboard/events/new" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
            <Route path="/dashboard/events/:eventId/poster" element={<ProtectedRoute><EventPosterPage /></ProtectedRoute>} />
            <Route path="/dashboard/events/:eventId" element={<ProtectedRoute><ManageEvent /></ProtectedRoute>} />
            <Route path="/recap/:slug" element={<EventRecap />} />
            <Route path="/e/:slug" element={<GuestEvent />} />
          </Routes>
        </BrowserRouter>
      </AppErrorBoundary>
    </AuthProvider>
  );
}

const rootElement = document.getElementById("root")! as HTMLElement & { eventFilmRoot?: ReturnType<typeof createRoot> };
const appRoot = rootElement.eventFilmRoot || createRoot(rootElement);
rootElement.eventFilmRoot = appRoot;
appRoot.render(<App />);
