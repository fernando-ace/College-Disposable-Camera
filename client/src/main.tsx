import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { createEventFilmApiClient } from "@eventfilm/api-client";
import type { AnalyticsSummary, EventAnalyticsSummary, EventRecapResponse, LiveWallResponse } from "@eventfilm/api-client";
import {
  CHALLENGE_PACKS,
  CHALLENGE_TYPES,
  COLOR_HUNT_PALETTE,
  EVENT_TEMPLATES,
  PROMPT_PACKS,
  applyEventTemplateToDraft,
  buildContributorSummary,
  buildGuestChallengeProgress,
  buildGuestUploadSuccessSummary,
  buildLiveWallChallengeDisplaySummary,
  buildLiveWallDisplayLinks,
  buildHostShareAssets,
  buildChallengeProgressSummary,
  buildEventRecapStory,
  buildChallengePayload,
  buildDuplicateEventInput,
  buildHostNextStep,
  categoriesFromChallenge,
  challengeLabel,
  colorBySlug,
  createCategoriesFromPack,
  createCategory,
  createDefaultAwardCategories,
  createEmptyChallengeDraft,
  createPromptsFromPack,
  createPrompt,
  createStarterPrompts,
  draftFromChallenge,
  getEventTemplate,
  getHostVisibleEventTemplates,
  getChallengePack,
  getLiveWallModeLabel,
  getPromptPack,
  plainModeLabel,
  hasDuplicateCategories,
  hasDuplicateParticipantColors,
  hasDuplicatePrompts,
  deriveEventLifecycleStatus,
  isPhotoVisible,
  memoryCapsuleFromChallenge,
  parseLiveWallMode,
  photoChallengeLabel,
  promptsFromChallenge,
  sanitizeGuestDisplayName,
  validateUploadFile,
  validateChallengeDraft,
  validateEventSettingsInput,
  validateHostFeedback,
} from "@eventfilm/shared";
import type { AnalyticsEventInput, AnalyticsEventName, AwardVotingSummary, ChallengeDraft, ChallengeParticipant, EventChallenge, EventLifecycle, EventRecapAlbumFilter, EventRecapStory, EventSettingsFieldErrors, EventSummary, EventTemplateSlug, FounderOverview, GuestUploadLocalMetadata, GuestUploadSuccessSummary, HostFeedbackInput, HostShareAssets, LiveWallDisplayLink, LiveWallMode, Photo, PhotoReportReason, PhotoVisibilityStatus, PromptPackSlug, PublicEvent, UpdateEventSettingsInput, User } from "@eventfilm/shared";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is required. Set it to the deployed API base URL.");
}

const API_BASE_URL = API_URL.startsWith("http://") || API_URL.startsWith("https://") ? API_URL : `https://${API_URL}`;
const DEMO_STORAGE_KEY = "eventfilm_demo_uploads";
const DEFAULT_DEMO_PHOTOS = [
  { id: "demo-album-1", name: "Mia", dataUrl: "/demo/demo-album-1.jpg", createdAt: "2026-05-27T00:00:00.000Z" },
  { id: "demo-album-2", name: "Alex", dataUrl: "/demo/demo-album-2.jpg", createdAt: "2026-05-27T00:00:00.000Z" },
  { id: "demo-album-3", name: "Jordan", dataUrl: "/demo/demo-album-3.jpg", createdAt: "2026-05-27T00:00:00.000Z" },
  { id: "demo-album-4", name: "Taylor", dataUrl: "/demo/demo-album-4.jpg", createdAt: "2026-05-27T00:00:00.000Z" },
];

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
};
type DemoPhoto = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
};

const BETA_ISSUE_AREAS = [
  ["guest_upload", "Guest upload"],
  ["live_wall", "Live Wall"],
  ["recap", "Recap"],
  ["qr_poster", "QR or poster"],
  ["moderation", "Moderation"],
  ["analytics", "Analytics"],
  ["other", "Other"],
] as const;

const AuthContext = createContext<AuthContextValue | null>(null);
const eventFilmApi = createEventFilmApiClient({ baseUrl: API_BASE_URL });
const api = eventFilmApi.request;
const ANALYTICS_ANON_KEY = "eventfilm_anon_id";


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
  if (/used all uploads/i.test(message)) return "You have used all uploads for this event.";
  if (/photo must|upload a jpg|choose|enter your name|select|prompt|award/i.test(message)) return message;
  return fallback;
}

const REPORT_REASONS: Array<{ value: PhotoReportReason; label: string }> = [
  { value: "inappropriate", label: "Inappropriate" },
  { value: "privacy", label: "Privacy concern" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

function toDateTimeLocal(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

type EventSettingsForm = {
  name: string;
  description: string;
  eventDate: string;
  revealAt: string;
  photoLimitPerGuest: string;
};

function eventSettingsFormFromEvent(event: Pick<EventSummary, "name" | "description" | "eventDate" | "revealAt" | "photoLimitPerGuest">): EventSettingsForm {
  return {
    name: event.name,
    description: event.description || "",
    eventDate: toDateTimeLocal(new Date(event.eventDate)),
    revealAt: toDateTimeLocal(new Date(event.revealAt)),
    photoLimitPerGuest: String(event.photoLimitPerGuest),
  };
}

function safeDateInputToIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function eventSettingsInputFromForm(form: EventSettingsForm): UpdateEventSettingsInput {
  return {
    name: form.name,
    description: form.description,
    eventDate: safeDateInputToIso(form.eventDate),
    revealAt: safeDateInputToIso(form.revealAt),
    photoLimitPerGuest: Number(form.photoLimitPerGuest),
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected photo"));
    reader.readAsDataURL(file);
  });
}

function getGuestSession(slug: string) {
  const key = `eventfilm_guest_${slug}`;
  const saved = localStorage.getItem(key);
  if (saved) return { key, session: JSON.parse(saved) as { clientId: string; nickname: string } };
  const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return { key, session: { clientId, nickname: "" } };
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

function guestChallengeHint(event: PublicEvent) {
  if (event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT) return "Find your color and upload your best photos.";
  if (event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) return "Pick a prompt and upload a matching photo.";
  if (event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) return "Submit photos for the award categories.";
  if (event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE) return "Add photos now. Everyone sees them after the reveal.";
  return "Add any photos you want the host to have.";
}

function uploadLimitCopy(remaining: number | null, limit: number) {
  if (remaining === null) return "Checking uploads...";
  if (remaining <= 0) return "No uploads left from this browser.";
  if (limit <= 10) return `You can add up to ${limit} ${limit === 1 ? "photo" : "photos"}. ${remaining} left.`;
  return `${remaining} uploads left.`;
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
  return (
    <button
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(232,93,63,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d94f33] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)] transition hover:-translate-y-0.5 hover:border-[#e85d3f] hover:bg-[#fff7f1] disabled:translate-y-0 disabled:cursor-not-allowed disabled:text-stone-400 disabled:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
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
  return <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ring-1", tones[tone])}>{children}</span>;
}

function LiveDemoPill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#fff0d8] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#7c3f00] ring-1 ring-[#f7d89c]">
      <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-[live-pulse_1.4s_ease-in-out_infinite]" aria-hidden="true" />
      Live demo
    </span>
  );
}

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cx("rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]", className)}>{children}</div>;
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

function PhotoStatusBadges({ photo, host = false }: { photo: Photo; host?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {photo.isFeatured && <StatusPill tone="amber">Featured</StatusPill>}
      {host && photo.visibilityStatus === "HIDDEN" && <StatusPill tone="red">Hidden</StatusPill>}
      {host && Boolean(photo.reportCount) && <StatusPill tone="red">{photo.reportCount} reported</StatusPill>}
      {photoChallengeLabel(photo) && <StatusPill tone="stone">{photoChallengeLabel(photo)}</StatusPill>}
    </div>
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
      <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );
}

function PhotoDetailModal({
  photo,
  mode,
  onClose,
  onReport,
  reportStatus,
  onHostAction,
}: {
  photo: Photo | null;
  mode: "public" | "host";
  onClose: () => void;
  onReport?: (reason: PhotoReportReason, note: string) => Promise<void>;
  reportStatus?: string;
  onHostAction?: (action: "hide" | "restore" | "feature" | "unfeature" | "delete", photo: Photo) => Promise<void>;
}) {
  const [reason, setReason] = useState<PhotoReportReason>("inappropriate");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [localStatus, setLocalStatus] = useState("");

  useEffect(() => {
    setReason("inappropriate");
    setNote("");
    setBusy("");
    setLocalStatus("");
  }, [photo?.id]);

  if (!photo) return null;
  const currentPhoto = photo;

  async function runHostAction(action: "hide" | "restore" | "feature" | "unfeature" | "delete") {
    if (!onHostAction) return;
    setBusy(action);
    try {
      await onHostAction(action, currentPhoto);
      if (action !== "delete") setLocalStatus("Updated");
    } catch (err) {
      setLocalStatus((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function submitReport() {
    if (!onReport) return;
    setBusy("report");
    try {
      await onReport(reason, note);
      setNote("");
    } catch (err) {
      setLocalStatus((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/80 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[2rem] bg-white p-4 shadow-2xl sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <PhotoStatusBadges photo={photo} host={mode === "host"} />
            <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">{photo.challengeParticipantName || photo.guestNickname || "Guest photo"}</h2>
            <p className="mt-1 text-sm text-stone-600">{formatDateTime(photo.createdAt)} {photo.sizeBytes ? `- ${formatBytes(photo.sizeBytes)}` : ""}</p>
          </div>
          <button className="rounded-full bg-stone-100 p-3 text-stone-700 hover:bg-stone-200" onClick={onClose} aria-label="Close photo detail"><Icon>close</Icon></button>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
          <img className="max-h-[68vh] w-full rounded-[1.5rem] bg-stone-100 object-contain" src={photo.url} alt={photo.originalFilename} />
          <aside className="grid content-start gap-4">
            <Card className="shadow-none">
              <p className="text-sm font-bold text-stone-950">Photo details</p>
              <div className="mt-3 grid gap-2 text-sm text-stone-600">
                <p><strong className="text-stone-900">Guest:</strong> {photo.challengeParticipantName || photo.guestNickname || "Guest"}</p>
                <p><strong className="text-stone-900">Uploaded:</strong> {formatDateTime(photo.createdAt)}</p>
                {photoChallengeLabel(photo) && <p><strong className="text-stone-900">Challenge:</strong> {photoChallengeLabel(photo)}</p>}
                {mode === "host" && photo.hiddenReason && <p><strong className="text-stone-900">Hidden reason:</strong> {photo.hiddenReason}</p>}
                {mode === "host" && Boolean(photo.reports?.length) && <p><strong className="text-stone-900">Latest report:</strong> {photo.reports?.[0]?.reason}</p>}
              </div>
            </Card>
            {mode === "host" && onHostAction && (
              <Card className="shadow-none">
                <p className="text-sm font-bold text-stone-950">Host controls</p>
                <div className="mt-3 grid gap-2">
                  {photo.visibilityStatus === "HIDDEN" ? (
                    <SecondaryButton disabled={Boolean(busy)} onClick={() => runHostAction("restore")}>Restore photo</SecondaryButton>
                  ) : (
                    <SecondaryButton disabled={Boolean(busy)} onClick={() => runHostAction("hide")}>Hide photo</SecondaryButton>
                  )}
                  {photo.isFeatured ? (
                    <SecondaryButton disabled={Boolean(busy)} onClick={() => runHostAction("unfeature")}>Remove feature</SecondaryButton>
                  ) : (
                    <Button disabled={Boolean(busy) || photo.visibilityStatus === "HIDDEN"} onClick={() => runHostAction("feature")}>Feature photo</Button>
                  )}
                  <button className="min-h-12 rounded-full bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:bg-stone-300" disabled={Boolean(busy)} onClick={() => runHostAction("delete")}>Delete permanently</button>
                </div>
              </Card>
            )}
            {mode === "public" && onReport && (
              <Card className="shadow-none">
                <p className="text-sm font-bold text-stone-950">Report photo</p>
                <div className="mt-3 grid gap-3">
                  <select className="h-12 rounded-2xl border border-stone-200 bg-white px-3 text-sm font-bold text-stone-800" value={reason} onChange={(event) => setReason(event.target.value as PhotoReportReason)}>
                    {REPORT_REASONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                  <TextArea rows={3} maxLength={500} placeholder="Optional note" value={note} onChange={(event) => setNote(event.target.value)} />
                  <SecondaryButton disabled={busy === "report"} onClick={submitReport}>{busy === "report" ? "Sending..." : "Submit report"}</SecondaryButton>
                </div>
              </Card>
            )}
            {(reportStatus || localStatus) && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-[#653e00]">{reportStatus || localStatus}</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}

const TEMPLATE_DISPLAY_NAMES: Partial<Record<EventTemplateSlug, string>> = {
  "birthday-party": "Birthday",
  "wedding-engagement": "Wedding",
  "greek-life-event": "Greek life",
  "graduation-party": "Graduation",
  "student-org-event": "Club or team event",
  "open-custom-event": "Custom",
};

function templateDisplayName(template: { slug: EventTemplateSlug; name: string }) {
  return TEMPLATE_DISPLAY_NAMES[template.slug] || template.name;
}

function TemplateLibrary({ draft, onSelect, onSkip }: { draft: ChallengeDraft; onSelect: (slug: EventTemplateSlug) => void; onSkip: () => void }) {
  const [showMoreTemplates, setShowMoreTemplates] = useState(false);
  const visibleTemplates = getHostVisibleEventTemplates();
  const hiddenTemplates = EVENT_TEMPLATES.filter((template) => !visibleTemplates.some((visible) => visible.slug === template.slug));
  const templates = showMoreTemplates ? [...visibleTemplates, ...hiddenTemplates] : visibleTemplates;

  return (
    <section className="rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.055)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-stone-950">What are you hosting?</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">Choose the closest starting point. EventFilm will suggest the mode and prompts.</p>
        </div>
        <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={onSkip}>Start custom</SecondaryButton>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const mode = getChallengePack(template.recommendedMode);
          const selected = draft.eventTemplateSlug === template.slug;
          return (
            <article className={cx("rounded-[1.25rem] border p-4 transition", selected ? "border-[#e85d3f] bg-[#fff3ee] shadow-[0_18px_44px_rgba(232,93,63,0.14)]" : "border-[#eadfce] bg-[#fffaf6] hover:border-[#ffd4c7]")} key={template.slug}>
              <h3 className="font-display text-xl font-bold text-stone-950">{templateDisplayName(template)}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{template.shortDescription}</p>
              <p className="mt-4 rounded-[1rem] bg-white px-3 py-2 text-xs font-extrabold text-[#653e00]">Best mode: {plainModeLabel(mode.mode)}</p>
              <button type="button" className={cx("mt-4 min-h-10 w-full rounded-[1rem] px-4 py-2 text-sm font-extrabold", selected ? "bg-stone-950 text-white" : "bg-[#e85d3f] text-white hover:bg-[#d94f33]")} onClick={() => onSelect(template.slug)}>
                {selected ? "Selected" : "Start with this"}
              </button>
            </article>
          );
        })}
      </div>
      {!showMoreTemplates ? (
        <div className="mt-4 text-center">
          <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={() => setShowMoreTemplates(true)}>More templates</SecondaryButton>
        </div>
      ) : null}
    </section>
  );
}

function ChallengeSetup({ draft, onChange, promptLibraryInitiallyOpen = false }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void; promptLibraryInitiallyOpen?: boolean }) {
  const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(promptLibraryInitiallyOpen);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isAwardEditorOpen, setIsAwardEditorOpen] = useState(false);
  const selectedPack = getChallengePack(draft.type);
  const selectedPromptPack = getPromptPack(draft.promptPackSlug);
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

  function autoAssignColors() {
    onChange({
      ...draft,
      participants: draft.participants.map((participant, index) => ({
        ...participant,
        ...COLOR_HUNT_PALETTE[index % COLOR_HUNT_PALETTE.length],
        displayName: participant.displayName,
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

  function movePrompt(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.prompts.length) return;
    const prompts = [...draft.prompts];
    const [prompt] = prompts.splice(index, 1);
    prompts.splice(nextIndex, 0, prompt);
    trackPromptsCustomized("prompt");
    onChange({ ...draft, prompts: prompts.map((nextPrompt, order) => ({ ...nextPrompt, order })) });
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

  function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.categories.length) return;
    const categories = [...draft.categories];
    const [category] = categories.splice(index, 1);
    categories.splice(nextIndex, 0, category);
    trackPromptsCustomized("award");
    onChange({ ...draft, categories: categories.map((nextCategory, order) => ({ ...nextCategory, order })) });
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
    <div className="rounded-3xl bg-stone-50 p-5">
      <div className="grid gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#653e00]">Choose the event mode</h2>
          <p className="mt-1 text-sm text-stone-600">{selectedPack.shortDescription}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {CHALLENGE_PACKS.map((pack) => (
            <button
              type="button"
              className={cx("rounded-2xl border p-4 text-left text-sm transition", draft.type === pack.mode ? "border-stone-950 bg-white shadow-sm" : "border-stone-200 bg-white/70 hover:border-amber-300")}
              onClick={() => updateType(pack.mode)}
              key={pack.slug}
            >
              <span className="block font-bold text-stone-950">{plainModeLabel(pack.mode)}</span>
              <span className="mt-1 block text-stone-600">{pack.shortDescription}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Photo prompts</p>
            <h3 className="mt-1 font-display text-lg font-bold">Prompt set selected: {selectedPromptPack.name}</h3>
            <p className="mt-1 text-sm text-stone-600">Includes {selectedPromptPack.items.length} prompts. You can edit them after creating the event.</p>
          </div>
          <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={() => setIsPromptLibraryOpen((current) => !current)}>{isPromptLibraryOpen ? "Hide prompts" : "Edit prompts"}</SecondaryButton>
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
                <span className="block text-xs font-bold uppercase tracking-wide text-amber-800">{pack.kind === "award" ? "Awards" : "Photo Prompts"}</span>
                <span className="mt-2 block font-bold text-stone-950">{pack.name}</span>
                <span className="mt-1 block text-stone-600">{pack.description}</span>
                <span className="mt-3 block text-xs font-semibold text-stone-500">{pack.items.slice(0, 4).join(" / ")}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {draft.type === "NONE" && (
        <div className="mt-5 rounded-3xl bg-white p-5">
          <StatusPill>Classic album</StatusPill>
          <h3 className="mt-3 font-display text-lg font-bold">No extra setup needed</h3>
          <p className="mt-2 text-sm text-stone-600">{selectedPack.guestInstructions}</p>
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.COLOR_HUNT && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Set up Color Hunt</h3>
              <p className="text-sm text-stone-600">Assign each person a color. Guests will upload photos of things they find in their color.</p>
            </div>
            <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={autoAssignColors}>Auto assign colors</SecondaryButton>
          </div>

          <div className="grid gap-3">
            {draft.participants.map((participant, index) => (
              <div className="grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-[1fr_190px_auto] sm:items-center" key={index}>
                <TextInput value={participant.displayName} onChange={(event) => updateParticipantName(index, event.target.value)} placeholder="Participant name" />
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-stone-500">
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

      {draft.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Set up Photo Scavenger Hunt</h3>
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
              <div className="mt-3 grid gap-3">
                {draft.prompts.map((prompt, index) => (
                  <div className="grid gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={prompt.id || index}>
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold text-stone-600">{index + 1}</span>
                    <TextInput value={prompt.text} onChange={(event) => updatePrompt(index, event.target.value)} placeholder="Photo prompt" />
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                      <button type="button" className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-3 text-sm font-bold text-stone-600 disabled:text-stone-300" onClick={() => movePrompt(index, -1)} disabled={index === 0}>Up</button>
                      <button type="button" className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-3 text-sm font-bold text-stone-600 disabled:text-stone-300" onClick={() => movePrompt(index, 1)} disabled={index === draft.prompts.length - 1}>Down</button>
                      <button type="button" className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600 hover:border-red-300 hover:text-red-700" onClick={() => removePrompt(index)} disabled={draft.prompts.length <= 1}>Remove</button>
                    </div>
                  </div>
                ))}
                <SecondaryButton type="button" className="justify-self-start" onClick={addPrompt}>Add prompt</SecondaryButton>
              </div>
            )}
          </div>

          {draft.prompts.length < 3 && (
            <p className="rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">Add at least 3 prompts to start Photo Scavenger Hunt.</p>
          )}
          {draft.prompts.some((prompt) => !prompt.text.trim()) && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Prompts cannot be empty.</p>
          )}
          {showDuplicatePromptWarning && (
            <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Remove duplicate prompts before saving.</p>
          )}
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.EVENT_AWARDS && (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-bold">Set up Event Awards</h3>
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
              <div className="mt-3 grid gap-3">
                {draft.categories.map((category, index) => (
                  <div className="grid gap-3 rounded-2xl bg-stone-50 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={category.id || index}>
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold text-stone-600">{index + 1}</span>
                    <TextInput value={category.label} onChange={(event) => updateCategory(index, event.target.value)} placeholder="Award category" />
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                      <button type="button" className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-3 text-sm font-bold text-stone-600 disabled:text-stone-300" onClick={() => moveCategory(index, -1)} disabled={index === 0}>Up</button>
                      <button type="button" className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-3 text-sm font-bold text-stone-600 disabled:text-stone-300" onClick={() => moveCategory(index, 1)} disabled={index === draft.categories.length - 1}>Down</button>
                      <button type="button" className="min-h-10 shrink-0 rounded-full border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600 hover:border-red-300 hover:text-red-700" onClick={() => removeCategory(index)} disabled={draft.categories.length <= 1}>Remove</button>
                    </div>
                  </div>
                ))}
                <SecondaryButton type="button" className="justify-self-start" onClick={addCategory}>Add category</SecondaryButton>
              </div>
            )}
          </div>

          {draft.categories.length < 2 && <p className="rounded-2xl bg-amber-100 p-3 text-sm font-bold text-amber-900">Add at least 2 award categories.</p>}
          {draft.categories.some((category) => !category.label.trim()) && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Award categories cannot be empty.</p>}
          {showDuplicateCategoryWarning && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">Remove duplicate award categories before saving.</p>}
        </div>
      )}

      {draft.type === CHALLENGE_TYPES.MEMORY_CAPSULE && (
        <div className="mt-5 grid gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Frame the reveal</h3>
            <p className="text-sm text-stone-600">This mode uses the event reveal time, with intentional copy for the locked album state.</p>
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
    <div className="min-h-screen bg-[#fff8ed] text-stone-950">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#fff8ed]/85 backdrop-blur-xl">
        <div className={cx("mx-auto flex items-center justify-between px-5 py-4", wide ? "max-w-7xl lg:px-10" : "max-w-6xl")}>
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-[#653e00] sm:text-2xl">EventFilm</Link>
          <nav className="flex items-center gap-2 text-sm">
            {auth.token ? (
              <>
                <Link className="rounded-full px-3 py-2 font-bold text-stone-700 hover:bg-white" to="/dashboard">Dashboard</Link>
                <button className="rounded-full px-3 py-2 font-bold text-stone-700 hover:bg-white" onClick={auth.logout}>Log out</button>
              </>
            ) : (
              <>
                <Link className="rounded-full px-3 py-2 font-bold text-stone-700 hover:bg-white" to="/login">Host login</Link>
                <Link className="rounded-full bg-amber-500 px-4 py-2 font-bold text-stone-950 shadow-sm transition hover:bg-amber-400" to="/signup">Start free</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={cx("mx-auto px-5 py-8", wide ? "max-w-7xl lg:px-10" : "max-w-6xl")}>{children}</main>
    </div>
  );
}

function DemoUploader() {
  const [name, setName] = useState("Guest");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [photos, setPhotos] = useState<DemoPhoto[]>(() => {
    const saved = sessionStorage.getItem(DEMO_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const albumPhotos = [...photos, ...DEFAULT_DEMO_PHOTOS].slice(0, 6);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function savePhotos(nextPhotos: DemoPhoto[]) {
    setPhotos(nextPhotos);
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextPhotos.slice(0, 6)));
    } catch {
      setMessage("Saved for this page view. Your browser skipped session storage for this large photo.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!file) return setError("Choose a photo to try the demo");
    if (!file.type.startsWith("image/")) return setError("Choose an image file");
    if (!name.trim()) return setError("Add a name first");

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const nextPhoto = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`, name: name.trim(), dataUrl, createdAt: new Date().toISOString() };
      savePhotos([nextPhoto, ...photos].slice(0, 6));
      setFile(null);
      setMessage("Demo photo added locally");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
      <div>
        <LiveDemoPill />
        <h3 className="mt-4 font-display text-3xl font-bold leading-tight text-stone-950">Mia's Graduation Cookout</h3>
        <p className="mt-3 text-stone-600">Preview the guest upload flow. Choose a photo, add a name, and EventFilm temporarily saves it in this browser session only.</p>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Your name
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Mia" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400">
              <Icon>photo_camera</Icon>
              Take photo
              <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-900 transition hover:border-amber-500 hover:bg-amber-50">
              <Icon>photo_library</Icon>
              Choose photo
              <input className="sr-only" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
          </div>
          {file && previewUrl && (
            <div className="flex items-center gap-4 rounded-2xl bg-stone-50 p-3">
              <img className="h-20 w-20 rounded-2xl object-cover" src={previewUrl} alt="Selected demo preview" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{file.name || "Selected photo"}</p>
                <p className="text-sm text-stone-600">Ready for local demo upload</p>
              </div>
            </div>
          )}
          {message && <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}
          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <Button type="submit" className="w-full justify-between rounded-2xl px-5">
            <span>Add to demo album</span>
            <Icon>arrow_forward</Icon>
          </Button>
        </form>
      </div>
      <div className="rounded-[2rem] bg-stone-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Guest preview</p>
            <h4 className="font-display text-xl font-bold">Demo album</h4>
          </div>
          <Link className="rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white" to="/signup">Create real event</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {albumPhotos.map((photo) => (
            <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-sm" key={photo.id}>
              <img className="aspect-square w-full rounded-2xl object-cover" src={photo.dataUrl} alt={`Demo upload by ${photo.name}`} />
              <p className="mt-2 truncate px-1 text-xs font-bold text-stone-700">Uploaded by {photo.name}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function LiveWallDisplayLinkCard({ link, event }: { link: LiveWallDisplayLink; event: EventSummary }) {
  function openLink() {
    trackAnalytics(link.analyticsName, { eventId: event.id, eventSlug: event.slug, metadata: { surface: "launch_kit", mode: link.key } });
  }

  return (
    <a
      className="group rounded-[1.25rem] border border-[#eadfce] bg-[#fffaf6] p-4 transition hover:-translate-y-0.5 hover:border-[#ffd4c7] hover:bg-[#fff3ee]"
      href={link.url}
      target="_blank"
      rel="noreferrer"
      onClick={openLink}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-bold text-stone-950">{link.label}</p>
        <Icon className="h-4 w-4 text-[#d94f33]">arrow_forward</Icon>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">{link.purpose}</p>
      <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-[#653e00]">{link.instruction}</p>
    </a>
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
              <button type="button" className={cx("rounded-[1.15rem] border px-4 py-3 text-sm font-extrabold", form.issueArea === value ? "border-[#e85d3f] bg-[#fff3ee] text-[#653e00]" : "border-[#eadfce] bg-white text-stone-700")} onClick={() => setForm((current) => ({ ...current, issueArea: value }))} key={value}>{label}</button>
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
          eventDate: duplicateDefaults.eventDate,
          revealAt: duplicateDefaults.revealAt,
          photoLimitPerGuest: duplicateDefaults.photoLimitPerGuest,
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
        {!compact ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900" href="#post-event-summary">View what worked</a> : null}
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
              <button type="button" className={cx("rounded-[1.15rem] border px-4 py-3 text-sm font-extrabold", form.outcome === value ? "border-[#e85d3f] bg-[#fff3ee] text-[#653e00]" : "border-[#eadfce] bg-white text-stone-700")} onClick={() => setForm((current) => ({ ...current, outcome: value }))} key={value}>{label}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["yes", "Use again"], ["maybe", "Maybe"], ["no", "Not yet"]].map(([value, label]) => (
              <button type="button" className={cx("rounded-[1.15rem] border px-4 py-3 text-sm font-extrabold", form.repeatIntent === value ? "border-[#e85d3f] bg-[#fff3ee] text-[#653e00]" : "border-[#eadfce] bg-white text-stone-700")} onClick={() => setForm((current) => ({ ...current, repeatIntent: value }))} key={value}>{label}</button>
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
    <Shell wide>
      {!event && <Card className="text-center"><h1 className="font-display text-3xl font-bold">Loading poster</h1><p className="mt-2 text-stone-600">{error || "Building the host invite poster..."}</p></Card>}
      {event && assets && (
        <div className="poster-page mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
          <section className="poster-sheet overflow-hidden rounded-[1.25rem] bg-white p-8 text-stone-950 shadow-[0_28px_90px_rgba(101,62,0,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-xl font-bold text-stone-900">{assets.poster.brandLine}</p>
              <div className="flex flex-wrap justify-end gap-2">
                {assets.poster.templateBadge ? <span className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-extrabold text-stone-800">{assets.poster.templateBadge}</span> : null}
                <span className="rounded-full bg-stone-950 px-4 py-2 text-sm font-extrabold text-white">{assets.poster.modeBadge}</span>
              </div>
            </div>
            <div className="mt-8 text-center">
              <h1 className="font-display text-4xl font-black leading-tight text-stone-950 lg:text-6xl">{assets.poster.title}</h1>
              <p className="mt-4 font-display text-3xl font-bold text-stone-950">{assets.poster.instruction}</p>
              <p className="mt-2 text-xl font-bold text-stone-700">{assets.poster.noDownloadCopy}</p>
            </div>
            <div className="mx-auto mt-8 grid max-w-4xl gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
              <div>
                <div className="rounded-[1.25rem] border border-stone-200 bg-stone-50 p-5 text-left">
                  <p className="text-sm font-bold uppercase text-stone-500">Mode hint</p>
                  <p className="mt-2 text-xl font-bold leading-8 text-stone-900">{assets.poster.modeHint}</p>
                  {assets.poster.challengeInstruction ? <p className="mt-4 text-base font-semibold leading-7 text-stone-700">{assets.poster.challengeInstruction}</p> : null}
                </div>
                <div className="mt-5 rounded-[1.25rem] border border-stone-200 bg-white p-5 text-left">
                  <p className="text-sm font-bold uppercase text-stone-500">Short link</p>
                  <p className="mt-2 break-all text-lg font-extrabold text-stone-950">{assets.poster.guestLink}</p>
                </div>
              </div>
              <div className="rounded-[1.25rem] border-2 border-stone-950 bg-white p-5">
                {event.qrCodeDataUrl ? <img className="aspect-square w-full bg-white" src={event.qrCodeDataUrl} alt="Guest upload QR code" /> : null}
              </div>
            </div>
            <div className="mt-8 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-5 text-center">
              <p className="text-sm font-bold uppercase text-stone-500">Invite copy</p>
              <p className="mt-2 whitespace-pre-line text-xl font-bold leading-8 text-stone-800">{assets.poster.inviteText}</p>
            </div>
          </section>

          <aside className="poster-actions grid content-start gap-3">
            <Card>
              <h2 className="font-display text-2xl font-bold">Poster actions</h2>
              <p className="mt-2 text-sm text-stone-600">Use browser print to save as PDF or send to a printer. Standalone poster image export is intentionally out of scope for this pass.</p>
              <p className="mt-2 text-sm font-semibold text-stone-700">{assets.qrPosterHint}</p>
              {status && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{status}</p>}
              <div className="mt-4 grid gap-2">
                <Button type="button" onClick={printPoster}>Print or save PDF</Button>
                <SecondaryButton type="button" onClick={() => copyPosterText(assets.poster.guestLink, "Guest link")}>Copy guest link</SecondaryButton>
                <SecondaryButton type="button" onClick={() => copyPosterText(assets.poster.inviteText, "Invite text")}>Copy invite text</SecondaryButton>
                {event.qrCodeDataUrl ? <SecondaryButton type="button" onClick={() => downloadDataUrl(event.qrCodeDataUrl || "", `${safeFilename(event.name)}-qr.png`)}>Download QR PNG</SecondaryButton> : null}
                <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900" to={`/dashboard/events/${event.id}`}>Back to event</Link>
              </div>
            </Card>
          </aside>
        </div>
      )}
    </Shell>
  );
}

function Landing() {
  useEffect(() => {
    trackAnalytics("landing_page_viewed");
  }, []);

  function trackCta(label: string) {
    trackAnalytics("cta_clicked", { metadata: { label, surface: "landing" } });
  }

  return (
    <Shell wide>
      <section className="grid items-center gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-14">
        <div className="text-center lg:text-left">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-stone-950 sm:text-6xl">
            Stop chasing photos after the event.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg lg:mx-0">
            Create a QR upload link, let guests add photos, show a Live Wall, and share a recap when it is over.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[1.15rem] bg-[#e85d3f] px-7 py-4 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(232,93,63,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d94f33]" to="/signup" onClick={() => trackCta("Create your first event")}>
              Create your first event
              <Icon>arrow_forward</Icon>
            </Link>
            <a className="inline-flex min-h-13 items-center justify-center rounded-[1.15rem] border border-[#d5c4b2] bg-white px-7 py-4 text-sm font-extrabold text-[#653e00] shadow-[0_10px_24px_rgba(101,62,0,0.06)] transition hover:-translate-y-0.5 hover:border-[#e85d3f] hover:bg-[#fff7f1]" href="#demo" onClick={() => trackCta("Try the demo")}>
              Try the demo
            </a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[390px]">
          <div className="relative overflow-hidden rounded-[2rem] shadow-[0_30px_90px_rgba(245,158,11,0.14)]">
            <video className="aspect-[390/844] w-full object-cover" autoPlay muted loop playsInline poster="/demo/guest-upload-poster.webp?v=2" aria-label="Guest upload walkthrough demo">
              <source src="/demo/guest-upload-demo.webm?v=2" type="video/webm" />
              <source src="/demo/guest-upload-demo.mp4?v=2" type="video/mp4" />
            </video>
            <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/50 bg-white/85 px-5 py-3 text-sm font-bold text-stone-900 shadow-lg backdrop-blur">
              <Icon className="text-[#653e00]">qr_code_2</Icon>
              Guests upload without an account.
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-stone-200 py-14">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">How it works</h2>
          <p className="mt-3 text-stone-600">One clean host flow from setup to final memory page.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Create an event", "Name it, choose a mode, get your links."],
            ["Guests upload photos", "Share the QR code or link. No account needed."],
            ["Share the recap", "After the event, send everyone the finished album."],
          ].map(([title, body], index) => (
            <div className="rounded-[1.5rem] border border-[#eadfce] bg-white p-5 shadow-[0_12px_34px_rgba(101,62,0,0.055)]" key={title}>
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#fff0d8] font-display text-lg font-bold text-[#653e00]">{index + 1}</div>
              <h3 className="mt-5 font-display text-lg font-bold text-stone-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-stone-200 px-0 py-14" id="demo">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">See it in action</h2>
          <p className="mt-3 text-stone-600">Experience the simplicity from both sides. Upload locally in this demo, then create a real event when you are ready.</p>
        </div>
        <DemoUploader />
      </section>

      <section className="py-14">
        <div className="mx-auto mb-12 max-w-2xl">
          <h2 className="text-center font-display text-3xl font-bold">Event modes for the room you are hosting</h2>
          <p className="mt-3 text-center text-stone-600">Start with a classic album or add a lightweight game that makes guests want to join in.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {CHALLENGE_PACKS.map((pack) => (
            <div className="rounded-[1.5rem] border border-[#eadfce] bg-white p-5 shadow-[0_12px_34px_rgba(101,62,0,0.055)]" key={pack.slug}>
              <h3 className="font-display text-xl font-bold text-stone-950">{plainModeLabel(pack.mode)}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{
                pack.mode === "NONE"
                  ? "Simple shared album."
                  : pack.mode === CHALLENGE_TYPES.COLOR_HUNT
                    ? "Give each guest or team a color."
                    : pack.mode === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT
                      ? "Guests complete photo prompts."
                      : pack.mode === CHALLENGE_TYPES.EVENT_AWARDS
                        ? "Turn photos into fun categories."
                        : "Reveal photos after the event."
              }</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 py-14 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-stone-950 p-6 text-white sm:p-8">
          <LiveDemoPill />
          <h2 className="mt-5 font-display text-4xl font-bold">Live Wall for the room.</h2>
          <p className="mt-3 text-stone-200">Open EventFilm on a TV, projector, laptop, or iPad so guests can scan the code and watch the newest moments appear.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {DEFAULT_DEMO_PHOTOS.map((photo) => (
              <img className="aspect-square rounded-3xl object-cover" src={photo.dataUrl} alt={`Live Wall preview ${photo.name}`} key={photo.id} />
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
          <StatusPill tone="stone">Post-event recap</StatusPill>
          <h2 className="mt-5 font-display text-4xl font-bold text-stone-950">A shareable story after the event.</h2>
          <p className="mt-3 text-stone-600">When the reveal time arrives, hosts can send one recap link with highlights, contributors, challenge progress, and the full album.</p>
          <div className="mt-6 grid gap-3 rounded-3xl bg-stone-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-[#653e00]">Photos</p>
                <p className="mt-2 font-display text-4xl font-bold">42</p>
              </div>
              <div className="rounded-3xl bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-[#653e00]">Contributors</p>
                <p className="mt-2 font-display text-4xl font-bold">18</p>
              </div>
            </div>
            <p className="rounded-2xl bg-amber-100 p-4 text-sm font-bold text-amber-950">Share this after the event so everyone can view the final album and highlights.</p>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold">Made for social events</h2>
          <p className="mt-3 text-stone-600">EventFilm fits the moments where photos are everywhere, but the host never gets them all.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Birthdays", "Weddings", "Greek life", "Student orgs", "Camps", "Retreats", "Graduation parties", "Friend trips"].map((useCase) => (
            <p className="rounded-2xl bg-white p-4 text-center font-bold text-stone-800 shadow-sm" key={useCase}>{useCase}</p>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-[2rem] border border-[#ffd8cf] bg-[#fff1ec] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <StatusPill>Host confidence</StatusPill>
          <h2 className="mt-4 font-display text-3xl font-bold text-stone-950">Clear links for every event moment.</h2>
          <p className="mt-3 text-stone-700">EventFilm keeps the host flow simple: collect photos before and during the event, display the room feed, then share the recap after reveal.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Guest Upload", "The QR/link guests use without an account."],
            ["Live Wall", "A display-ready view for the room."],
            ["Recap", "A polished memory page after reveal."],
          ].map(([label, body]) => (
            <div className="rounded-[1.35rem] bg-white/85 p-5 shadow-[0_12px_30px_rgba(101,62,0,0.05)]" key={label}>
              <p className="text-sm font-extrabold uppercase tracking-wide text-[#d94f33]">{label}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold">FAQ</h2>
        </div>
        <div className="mx-auto grid max-w-4xl gap-4">
          {[
            ["Do guests need an account?", "No. Guests can upload from the event link in a browser without creating an account."],
            ["Can I show photos during the event?", "Yes. Use the Live Wall link on a laptop, TV, projector, or iPad."],
            ["What happens after the event?", "Share the Recap link so everyone can view the final album and highlights."],
            ["How does privacy work?", "EventFilm is built for private event sharing. Guests upload through your event link, and you control when the album is shared."],
          ].map(([question, answer]) => (
            <div className="rounded-3xl bg-white p-5 shadow-sm" key={question}>
              <h3 className="font-display text-lg font-bold text-stone-950">{question}</h3>
              <p className="mt-2 text-stone-600">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid items-center gap-8 rounded-t-[3rem] bg-stone-200 p-8 text-center sm:p-12 lg:grid-cols-[1fr_0.8fr] lg:text-left">
        <div>
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">Ready to collect the moments that matter?</h2>
          <p className="mt-4 max-w-2xl text-stone-600">Create one event, share one QR code, and stop asking everyone to text you photos afterward.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Link className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#e85d3f] px-7 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#d94f33]" to="/signup" onClick={() => trackCta("Create your first event bottom")}>Create your first event</Link>
          <p className="rounded-2xl bg-white/60 p-4 text-sm text-stone-600">Guests can upload without an account. Hosts get the QR, Live Wall, and Recap from one event hub.</p>
        </div>
      </section>

      <footer className="grid gap-4 border-t border-stone-200 py-8 text-sm text-stone-600 sm:grid-cols-[1fr_auto]">
        <p className="font-bold text-[#653e00]">EventFilm</p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/privacy" className="font-semibold hover:text-stone-950">Privacy</Link>
          <Link to="/terms" className="font-semibold hover:text-stone-950">Terms</Link>
          <Link to="/support" className="font-semibold hover:text-stone-950">Contact</Link>
          <Link to="/login" className="font-semibold hover:text-stone-950">Host login</Link>
          <Link to="/signup" className="font-semibold hover:text-stone-950">Create event</Link>
        </nav>
      </footer>
    </Shell>
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
      intro: "Need help with an event, upload link, Live Wall, or Recap? Use the placeholder contact details below until Fernando adds final support channels.",
      sections: [
        ["Contact", "Placeholder: Fernando should add a final support email, phone number, or contact form link here."],
        ["Running an event", "Create your event, choose a mode, copy the guest link or QR code, open the Live Wall during the event, and share the Recap afterward."],
        ["Guests do not need an account", "If a guest is confused, send them the guest upload link directly. It opens in the browser."],
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
        {mode === "signup" && (
          <Link className="mt-4 block text-center text-sm font-bold text-stone-700 underline decoration-amber-500 underline-offset-4 transition hover:text-stone-950" to="/login">
            Already have an account? Sign in &rarr;
          </Link>
        )}
      </form>
    </Shell>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.token) return <Navigate to="/login" replace />;
  return children;
}

function EventPhotoBanner({ photos, eventName }: { photos: Photo[]; eventName: string }) {
  if (!photos.length) {
    return null;
  }

  const visible = photos.slice(0, 3);
  const remaining = Math.max(photos.length - visible.length, 0);

  return (
    <div className="grid grid-cols-3 gap-2 bg-[#fffaf6] p-3">
        {visible.map((photo, index) => (
          <div className="relative event-photo-strip-frame h-28 overflow-hidden rounded-xl bg-white p-1.5 shadow-sm" key={`${photo.id}-${index}`}>
            <img
              className="h-full w-full rounded-lg object-cover"
              src={photo.previewUrl || photo.url}
              alt={`${eventName} upload preview ${index % photos.length + 1}`}
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
            {index === visible.length - 1 && remaining > 0 ? <span className="absolute inset-1.5 grid place-items-center rounded-lg bg-stone-950/55 text-sm font-extrabold text-white">+{remaining} more</span> : null}
          </div>
        ))}
    </div>
  );
}

function Dashboard() {
  const auth = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [canViewFounder, setCanViewFounder] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [error, setError] = useState("");
  const previewLoadIds = useRef(new Set<string>());

  useEffect(() => {
    trackAnalytics("host_dashboard_opened");
    api<{ events: EventSummary[] }>("/api/host/events", { token: auth.token })
      .then((data) => setEvents(data.events))
      .catch((err) => setError((err as Error).message));
    setCanViewFounder(Boolean(auth.user?.isFounder));
  }, [auth.token, auth.user?.isFounder]);

  useEffect(() => {
    const missingPreviewEvents = events.filter((event) => event.photoCount > 0 && !event.previewPhotos?.length && !previewLoadIds.current.has(event.id));
    if (!missingPreviewEvents.length) return;

    missingPreviewEvents.forEach((event) => previewLoadIds.current.add(event.id));
    Promise.all(
      missingPreviewEvents.map((event) =>
        api<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${event.id}`, { token: auth.token })
          .then((data) => ({ id: event.id, photos: data.event.photos.slice(0, 6) }))
          .catch(() => ({ id: event.id, photos: [] })),
      ),
    ).then((previews) => {
      setEvents((currentEvents) =>
        currentEvents.map((event) => {
          const preview = previews.find((item) => item.id === event.id);
          return preview ? { ...event, previewPhotos: preview.photos } : event;
        }),
      );
    });
  }, [auth.token, events]);

  const eventRows = events.map((event) => ({ event, lifecycle: deriveEventLifecycleStatus(event) }));
  const upcomingEvents = eventRows.filter((row) => row.lifecycle.status === "draft_or_upcoming").length;
  const liveEvents = eventRows.filter((row) => row.lifecycle.phase === "during").length;
  const recapReady = eventRows.filter((row) => row.lifecycle.phase === "after").length;
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);
  const defaultTab = liveEvents ? "live" : recapReady ? "recap" : upcomingEvents ? "upcoming" : "past";
  const selectedTab = activeTab || defaultTab;
  const filteredRows = eventRows.filter(({ lifecycle }) => {
    if (selectedTab === "upcoming") return lifecycle.status === "draft_or_upcoming";
    if (selectedTab === "live") return lifecycle.phase === "during";
    if (selectedTab === "recap") return lifecycle.phase === "after";
    return lifecycle.status === "archived_or_past";
  });

  async function copyEventLink(event: EventSummary) {
    try {
      await copyText(event.eventLink);
      setCopyStatus(`${event.name} guest link copied`);
    } catch (err) {
      setCopyStatus((err as Error).message);
    }
  }

  function primaryAction(event: EventSummary, lifecycle: EventLifecycle) {
    if (lifecycle.phase === "after" && event.recapLink) {
      return <a className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-[#e85d3f] px-4 py-2 text-sm font-extrabold text-white" href={event.recapLink} target="_blank" rel="noreferrer">Share recap</a>;
    }
    if (lifecycle.phase === "during" && event.liveWallLink) {
      return <a className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-[#e85d3f] px-4 py-2 text-sm font-extrabold text-white" href={event.liveWallLink} target="_blank" rel="noreferrer">Open Photo Wall</a>;
    }
    return <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-[1rem] bg-[#e85d3f] px-4 py-2 text-sm font-extrabold text-white" onClick={() => copyEventLink(event)}>Share guest link</button>;
  }

  return (
    <Shell wide>
      <div className="rounded-[1.65rem] border border-[#eadfce] bg-white p-6 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-stone-950">Welcome back</h1>
            <p className="mt-3 max-w-2xl text-stone-600">You have {upcomingEvents} {upcomingEvents === 1 ? "event" : "events"} coming up and {recapReady} {recapReady === 1 ? "recap" : "recaps"} ready to share.</p>
            <p className="mt-2 text-sm font-semibold text-stone-500">{auth.user?.email}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#d94f33]" to="/dashboard/events/new">Create event</Link>
            <button type="button" className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-sm" onClick={() => setActiveTab("recap")}>View recaps</button>
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
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <MetricCard label="Upcoming events" value={upcomingEvents} tone="accent" />
        <MetricCard label="Photos collected" value={totalPhotos} tone="green" />
        <MetricCard label="Recaps ready" value={recapReady} tone="plum" />
      </div>
      <section className="mt-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-2xl font-bold">Your events</h2>
          <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
            <div className="flex min-w-max gap-2">
              {[
                ["upcoming", "Upcoming"],
                ["live", "Live now"],
                ["recap", "Recap ready"],
                ["past", "Past"],
              ].map(([key, label]) => (
                <button type="button" className={cx("rounded-full px-4 py-2 text-sm font-extrabold", selectedTab === key ? "bg-stone-950 text-white" : "bg-white text-stone-700 ring-1 ring-[#eadfce]")} onClick={() => setActiveTab(key)} key={key}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        {copyStatus ? <p className="mb-4 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">{copyStatus}</p> : null}
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredRows.map(({ event, lifecycle }) => (
            <div className="overflow-hidden rounded-[1.65rem] border border-[#eadfce] bg-white shadow-[0_18px_54px_rgba(101,62,0,0.075)] transition hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(232,93,63,0.12)]" key={event.id}>
              {event.photoCount > 0 ? <Link className="group block" to={`/dashboard/events/${event.id}`}><EventPhotoBanner photos={event.previewPhotos || []} eventName={event.name} /></Link> : null}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <LifecycleBadge lifecycle={lifecycle} />
                    <Link to={`/dashboard/events/${event.id}`}><h3 className="mt-3 font-display text-xl font-bold text-stone-950">{event.name}</h3></Link>
                    <p className="mt-1 text-sm text-stone-600">Event: {formatDateTime(event.eventDate)}</p>
                  </div>
                  <div className="rounded-[1.15rem] bg-[#fff3ee] px-4 py-3 text-center">
                    <p className="font-display text-2xl font-bold text-[#d94f33]">{event.photoCount}</p>
                    <p className="text-xs font-bold uppercase text-stone-500">Photos</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-600">{buildHostNextStep(event)}</p>
                {lifecycle.status === "draft_or_upcoming" ? <p className="mt-1 text-sm font-semibold text-[#653e00]">Share this before people arrive.</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {primaryAction(event, lifecycle)}
                  {lifecycle.phase === "during" ? <button type="button" className="inline-flex min-h-10 items-center justify-center rounded-[1rem] border border-[#eadfce] bg-white px-4 py-2 text-sm font-extrabold text-stone-900" onClick={() => copyEventLink(event)}>Share guest link</button> : null}
                  <Link className="inline-flex min-h-10 items-center justify-center rounded-[1rem] border border-[#eadfce] bg-white px-4 py-2 text-sm font-extrabold text-stone-900" to={`/dashboard/events/${event.id}`}>View event</Link>
                  <details className="relative">
                    <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center rounded-[1rem] border border-[#eadfce] bg-[#fffaf6] px-4 py-2 text-sm font-extrabold text-stone-700">More</summary>
                    <div className="absolute right-0 z-20 mt-2 grid w-44 gap-1 rounded-[1rem] border border-[#eadfce] bg-white p-2 text-sm font-bold shadow-xl">
                      <Link className="rounded-lg px-3 py-2 text-stone-700 hover:bg-[#fffaf6]" to="/dashboard/events/new">Create similar</Link>
                      <Link className="rounded-lg px-3 py-2 text-stone-700 hover:bg-[#fffaf6]" to={`/dashboard/events/${event.id}?tab=recap`}>Download photos</Link>
                      <Link className="rounded-lg px-3 py-2 text-red-700 hover:bg-red-50" to={`/dashboard/events/${event.id}?tab=settings`}>Delete event</Link>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!filteredRows.length && events.length ? (
          <Card className="mt-5 bg-[#fffaf3] text-center">
            <h3 className="font-display text-2xl font-bold text-stone-950">No events in this view</h3>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">Switch tabs to find the next event that needs attention.</p>
          </Card>
        ) : null}
        {!events.length && (
          <Card className="bg-[#fffaf3] text-center">
            <StatusPill>First event</StatusPill>
            <h3 className="mt-4 font-display text-2xl font-bold">Create your first EventFilm album</h3>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">Start with the event name and reveal time. EventFilm will give you a guest link and QR code right after setup.</p>
            <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" to="/dashboard/events/new">Create event</Link>
          </Card>
        )}
      </section>
    </Shell>
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
    const links = [event.eventLink, event.liveWallLink, event.recapLink];
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
            <p className="text-sm font-bold uppercase tracking-wide text-stone-500">{label}</p>
            <p className="mt-3 font-display text-3xl font-bold text-[#653e00]">{value}</p>
          </Card>
        ))}
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl font-bold">Deployment signals</h2>
          <div className="mt-4 grid gap-3">
            <p className="rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-700">API base: {API_BASE_URL}</p>
            <p className={cx("rounded-2xl p-4 text-sm font-semibold", apiLooksDeployed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800")}>
              {apiLooksDeployed ? "Mobile/web clients are pointing at a non-local API." : "Client is still pointing at a local API."}
            </p>
            <p className={cx("rounded-2xl p-4 text-sm font-semibold", hasUsableEventLinks ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800")}>
              {hasUsableEventLinks ? "At least one event has non-local guest, Live Wall, and Recap links." : "Create or reload a deployed event before first-host sharing."}
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
              ["Live Wall", analyticsSummary?.liveWallOpens ?? 0],
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
                {event.liveWallLink && <a className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200" href={event.liveWallLink} target="_blank" rel="noreferrer">Live Wall</a>}
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
  ["totalLiveWallOpens", "Live Wall opens", "green"],
  ["totalFeedbackSubmissions", "Feedback", "default"],
  ["totalReportedPhotos", "Reports", "default"],
  ["hiddenPhotoCount", "Hidden photos", "default"],
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
    trackAnalytics("founder_reported_photo_review_viewed", { metadata: { surface: "founder_dashboard" } });
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
      ["Funnel Live Wall opens", overview.funnel.liveWallOpens, "Tracked Live Wall opens"],
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
            <p className="mt-3 max-w-2xl text-stone-200">Traction, feedback, reports, modes, and Unlock Alabama-ready signals in one private view.</p>
            <p className="mt-2 text-sm font-semibold text-stone-400">Generated {formatDateTime(overview.generatedAt)}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SecondaryButton type="button" onClick={exportMetrics}>Export CSV</SecondaryButton>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-amber-500 px-5 py-3 text-sm font-extrabold text-stone-950 shadow-sm transition hover:bg-amber-400" to="/dashboard">Host dashboard</Link>
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
              "Confirm one real event has guest, poster, Live Wall, and Recap links.",
              "Watch guest joins, uploads, contributors, Live Wall opens, and Recap opens.",
              "Check Event Awards votes if the event uses awards.",
              "Review beta issues, host feedback, reported photos, and hidden photos after the event.",
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
              ["Live Wall", overview.funnel.liveWallOpens],
              ["Recap", overview.funnel.recapOpens],
              ["Feedback", overview.funnel.feedbackSubmissions],
            ].map(([label, value]) => (
              <div className="rounded-[1.15rem] bg-[#fffaf6] p-4" key={label}>
                <p className="text-xs font-extrabold uppercase text-stone-500">{label}</p>
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

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <FounderFeedbackInbox feedback={overview.recentFeedback} />
        <FounderReportedPhotos reports={overview.reportedPhotos} />
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
                <StatusPill tone={event.reportCount ? "red" : event.photoCount ? "green" : "stone"}>{event.modeLabel}</StatusPill>
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
              <a className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100" href={event.liveWallLink} target="_blank" rel="noreferrer" onClick={() => onOpen(event.id, event.slug, "live_wall")}>Live Wall</a>
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

function FounderReportedPhotos({ reports }: { reports: FounderOverview["reportedPhotos"] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Reported photo review</h2>
          <p className="mt-1 text-sm text-stone-600">Read-only founder view. Host-owned moderation remains the action path.</p>
        </div>
        <StatusPill tone={reports.length ? "red" : "green"}>{reports.length}</StatusPill>
      </div>
      <div className="mt-4 grid gap-4">
        {reports.map((report) => (
          <div className="rounded-[1.25rem] bg-[#fffaf6] p-4" key={report.id}>
            <div className="flex gap-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-[1rem] bg-stone-200">
                {report.previewUrl ? <img className="h-full w-full object-cover" src={report.previewUrl} alt={`${report.eventName} reported photo`} /> : <div className="flex h-full items-center justify-center px-2 text-center text-xs font-bold text-stone-500">No public preview</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-stone-950">{report.eventName}</h3>
                    <p className="mt-1 text-sm text-stone-600">{report.hostEmail || "Unknown host"} - {formatDateTime(report.createdAt)}</p>
                  </div>
                  <StatusPill tone={report.visibilityStatus === "HIDDEN" ? "stone" : "red"}>{report.visibilityStatus === "HIDDEN" ? "Hidden" : `${report.reportCount} reported`}</StatusPill>
                </div>
                <p className="mt-2 text-sm text-stone-700"><strong className="text-stone-950">Reason:</strong> {report.reason}</p>
                {report.note && <p className="mt-1 text-sm text-stone-700"><strong className="text-stone-950">Note:</strong> {report.note}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.hostEventPath && <Link className="rounded-full bg-stone-950 px-3 py-2 text-xs font-bold text-white hover:bg-stone-800" to={report.hostEventPath}>Open host event</Link>}
                  {report.recapLink && <a className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100" href={report.recapLink} target="_blank" rel="noreferrer">Recap</a>}
                  {report.liveWallLink && <a className="rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100" href={report.liveWallLink} target="_blank" rel="noreferrer">Live Wall</a>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {!reports.length && <p className="rounded-[1.15rem] bg-stone-50 p-4 text-sm font-semibold text-stone-600">No open reported photos need review.</p>}
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
    eventDate: toDateTimeLocal(),
    revealAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    photoLimitPerGuest: "10",
  });
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [error, setError] = useState("");
  const [createStep, setCreateStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    trackAnalytics("event_template_viewed", { path: "/dashboard/events/new", metadata: { surface: "create_event" } });
  }, []);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectTemplate(templateSlug: EventTemplateSlug) {
    const template = getEventTemplate(templateSlug);
    setChallengeDraft((current) => applyEventTemplateToDraft(templateSlug, current));
    if (template?.suggestedUploadLimit) {
      setForm((current) => ({ ...current, photoLimitPerGuest: String(template.suggestedUploadLimit) }));
    }
    trackAnalytics("event_template_selected", { path: "/dashboard/events/new", metadata: { templateSlug, mode: template?.recommendedMode || "NONE", promptPackSlug: template?.promptPackSlug || null } });
  }

  function skipTemplate() {
    setChallengeDraft((current) => ({ ...current, eventTemplateSlug: "open-custom-event", promptPackSlug: "custom" }));
    trackAnalytics("template_skipped", { path: "/dashboard/events/new", metadata: { templateSlug: "open-custom-event" } });
  }

  const selectedTemplate = getEventTemplate(challengeDraft.eventTemplateSlug);
  const createSteps = ["What are you hosting?", "Choose the event mode", "Confirm details"];
  const stepCanContinue = createStep === 0 ? Boolean(challengeDraft.eventTemplateSlug) : true;

  function goNextCreateStep() {
    if (!stepCanContinue) {
      setError("Choose a template or start with Custom.");
      return;
    }
    setError("");
    setCreateStep((current) => Math.min(current + 1, createSteps.length - 1));
  }

  function goBackCreateStep() {
    setError("");
    setCreateStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const challenge = buildChallengePayload(challengeDraft);
      const data = await api<{ event: EventSummary }>("/api/host/events", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({
          ...form,
          eventDate: new Date(form.eventDate).toISOString(),
          revealAt: new Date(form.revealAt).toISOString(),
          photoLimitPerGuest: Number(form.photoLimitPerGuest),
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
      if (challengeDraft.eventTemplateSlug && challengeDraft.eventTemplateSlug !== "open-custom-event") {
        trackAnalytics("event_created_from_template", { eventId: data.event.id, eventSlug: data.event.slug, metadata });
      }
      navigate(`/dashboard/events/${data.event.id}?created=1`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold text-stone-950">Create your first event</h1>
        <p className="mt-3 text-lg text-stone-600">Choose a starting point, confirm the mode, then get one guest link to share.</p>
      </div>
      <form className="mx-auto mt-8 grid max-w-4xl gap-5" onSubmit={submit}>
        <div className="grid gap-3 rounded-[1.35rem] border border-[#eadfce] bg-white p-3 shadow-sm sm:grid-cols-3">
          {createSteps.map((label, index) => (
            <button
              type="button"
              className={cx("rounded-[1rem] px-4 py-3 text-left text-sm font-extrabold transition", createStep === index ? "bg-[#fff3ee] text-[#653e00]" : "bg-[#fffaf6] text-stone-600 hover:bg-white")}
              onClick={() => setCreateStep(index)}
              key={label}
            >
              <span className="block text-xs uppercase text-stone-500">Step {index + 1}</span>
              {label}
            </button>
          ))}
        </div>

        {createStep === 0 ? <TemplateLibrary draft={challengeDraft} onSelect={selectTemplate} onSkip={skipTemplate} /> : null}

        {createStep === 1 ? (
          <Card className="lg:p-8">
            {selectedTemplate ? (
              <p className="mb-4 rounded-[1rem] bg-[#fff3ee] px-4 py-3 text-sm font-extrabold text-[#653e00]">Recommended for {templateDisplayName(selectedTemplate)}: {plainModeLabel(selectedTemplate.recommendedMode)}</p>
            ) : null}
            <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} />
          </Card>
        ) : null}

        {createStep === 2 ? (
          <Card className="lg:p-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-stone-950">Confirm details</h2>
              <p className="mt-1 text-sm text-stone-600">These are the only details needed before EventFilm creates your links.</p>
            </div>
            <div className="mt-5 grid gap-5">
              <label className="grid gap-2 text-sm font-bold text-stone-700">
                Event name
                <TextInput value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Mia's graduation cookout" required />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-stone-700">
                  Event date
                  <TextInput type="datetime-local" value={form.eventDate} onChange={(event) => update("eventDate", event.target.value)} required />
                </label>
                <label className="grid gap-2 text-sm font-bold text-stone-700">
                  Reveal time
                  <TextInput type="datetime-local" value={form.revealAt} onChange={(event) => update("revealAt", event.target.value)} required />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold text-stone-700">
                Photo limit
                <TextInput type="number" min="1" value={form.photoLimitPerGuest} onChange={(event) => update("photoLimitPerGuest", event.target.value)} required />
              </label>
              <label className="grid gap-2 text-sm font-bold text-stone-700">
                Description
                <TextArea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Tell guests what this album is for." />
              </label>
              <div className="rounded-[1.25rem] bg-[#fffaf6] p-4 text-sm text-stone-700">
                <p><strong className="text-stone-950">Template:</strong> {selectedTemplate ? templateDisplayName(selectedTemplate) : "Custom"}</p>
                <p className="mt-1"><strong className="text-stone-950">Mode:</strong> {plainModeLabel(challengeDraft.type)}</p>
                <p className="mt-1"><strong className="text-stone-950">Photo prompts:</strong> {getPromptPack(challengeDraft.promptPackSlug).name}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col gap-3 rounded-[1.35rem] border border-[#eadfce] bg-white p-4 shadow-sm sm:flex-row sm:justify-between">
          <SecondaryButton type="button" disabled={createStep === 0} onClick={goBackCreateStep}>Back</SecondaryButton>
          {createStep < createSteps.length - 1 ? (
            <Button type="button" onClick={goNextCreateStep}>Continue</Button>
          ) : (
            <Button className="sm:px-12">Create event</Button>
          )}
        </div>
      </form>
    </Shell>
  );
}

function EventReadyHandoffPanel({ event, shareAssets, onCopyGuestLink, onDismiss }: { event: EventSummary; shareAssets: HostShareAssets; onCopyGuestLink: () => void; onDismiss: () => void }) {
  const steps = [
    ["Share the guest link", "Send this before people arrive. Guests can add photos without an account."],
    ["Open the Photo Wall during the event", "Put it on a TV, laptop, or iPad during the event."],
    ["Share the Shared Recap after the event", "Send the recap after reveal so everyone has one finished page."],
  ];

  return (
    <section className="mb-8 rounded-[2rem] bg-[#fff3e6] p-4 sm:p-6" aria-label="Event creation success">
      <div className="rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <StatusPill tone="green">Event dashboard</StatusPill>
            <h2 className="mt-3 font-display text-4xl font-bold text-stone-950">Your event is ready.</h2>
            <p className="mt-2 font-display text-2xl font-bold text-[#653e00]">{event.name}</p>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-stone-600">Start by sharing the guest upload link. Guests can add photos without an account.</p>
          </div>
          <button type="button" className="self-start rounded-full border border-[#eadfce] bg-[#fffaf6] px-4 py-2 text-sm font-extrabold text-stone-700 hover:bg-white" onClick={onDismiss}>Dismiss</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Button type="button" onClick={onCopyGuestLink}>Copy guest upload link</Button>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={shareAssets.poster.posterPath}>Download QR poster</Link>
          <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={`/e/${event.slug}`}>Preview guest page</Link>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {steps.map(([title, copy], index) => (
            <div className="rounded-[1.15rem] bg-[#fffaf6] p-4 ring-1 ring-[#eadfce]" key={title}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e85d3f] text-sm font-extrabold text-white">{index + 1}</span>
              <h3 className="mt-3 font-display text-xl font-bold text-stone-950">{title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
    if (["visible", "hidden", "featured", "reported"].includes(galleryFilter)) return;
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

  async function updatePhotoVisibility(photo: Photo, visibilityStatus: PhotoVisibilityStatus) {
    const hiddenReason = visibilityStatus === "HIDDEN" ? prompt("Why hide this photo? This note stays host-only.", "Hidden by host") || "Hidden by host" : undefined;
    const data = await eventFilmApi.updatePhotoVisibility(eventId || "", photo.id, visibilityStatus, hiddenReason, auth.token);
    trackAnalytics(visibilityStatus === "HIDDEN" ? "photo_hidden" : "photo_restored", { eventId, eventSlug: event?.slug, metadata: { photoId: photo.id, visibilityStatus } });
    await refreshAfterPhotoAction(data.photo);
  }

  async function updatePhotoFeatured(photo: Photo, isFeatured: boolean) {
    const data = await eventFilmApi.updatePhotoFeatured(eventId || "", photo.id, isFeatured, auth.token);
    trackAnalytics(isFeatured ? "photo_featured" : "photo_unfeatured", { eventId, eventSlug: event?.slug, metadata: { photoId: photo.id } });
    await refreshAfterPhotoAction(data.photo);
  }

  async function deletePhoto(photoId: string) {
    if (!confirm("Delete this photo permanently? Hidden photos can be restored, but deleted photos are removed from storage.")) return;
    await api(`/api/host/events/${eventId}/photos/${photoId}`, { method: "DELETE", token: auth.token });
    setSelectedPhoto(null);
    await load();
  }

  async function downloadZip(scope: "visible" | "all" = "visible") {
    if (!eventId) return;
    setDownloadStatus("");
    const response = await fetch(`${eventFilmApi.getHostEventDownloadUrl(eventId)}?scope=${scope}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.name || "event"}-${scope}-photos.zip`;
    a.click();
    URL.revokeObjectURL(url);
    trackAnalytics("album_downloaded", { eventId, eventSlug: event?.slug, metadata: { scope, photoCount: scope === "visible" ? visiblePhotos.length : event?.photos.length || 0 } });
    setDownloadStatus(scope === "visible" ? "Visible photo ZIP downloaded. Hidden and reported photos were excluded." : "All non-deleted photo ZIP downloaded for host review.");
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

    const input = eventSettingsInputFromForm(settingsForm);
    const validation = validateEventSettingsInput(input);
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
  const challengeColors = Array.from(new Map(challengeParticipants.map((participant) => [participant.colorSlug, participant])).values());
  const challengePrompts = promptsFromChallenge(event?.challenge);
  const challengeAwards = categoriesFromChallenge(event?.challenge);
  const filteredPhotos = event?.photos.filter((photo) => {
    if (galleryFilter === "all") return true;
    if (galleryFilter === "visible") return isPhotoVisible(photo);
    if (galleryFilter === "hidden") return photo.visibilityStatus === "HIDDEN";
    if (galleryFilter === "featured") return Boolean(photo.isFeatured);
    if (galleryFilter === "reported") return Boolean(photo.reportCount);
    if (galleryFilter.startsWith("color:")) return photo.challengeColorSlug === galleryFilter.replace("color:", "");
    if (galleryFilter.startsWith("participant:")) return photo.challengeParticipantId === galleryFilter.replace("participant:", "");
    if (galleryFilter.startsWith("prompt:")) return photo.challengePromptId === galleryFilter.replace("prompt:", "");
    if (galleryFilter.startsWith("award:")) return photo.challengeItemId === galleryFilter.replace("award:", "");
    return true;
  }) || [];
  const visiblePhotos = event?.photos.filter(isPhotoVisible) || [];
  const hostContributorSummary = buildContributorSummary(visiblePhotos);
  const hiddenCount = event?.photos.filter((photo) => photo.visibilityStatus === "HIDDEN").length || 0;
  const reportedCount = event?.photos.filter((photo) => Boolean(photo.reportCount)).length || 0;
  const featuredCount = event?.photos.filter((photo) => Boolean(photo.isFeatured)).length || 0;
  const lifecycle = event ? deriveEventLifecycleStatus(event, eventAnalytics || undefined) : null;
  const shareAssets = event ? buildHostShareAssets(event) : null;
  const savedSettingsForm = event ? eventSettingsFormFromEvent(event) : null;
  const settingsDirty = Boolean(settingsForm && savedSettingsForm && JSON.stringify(settingsForm) !== JSON.stringify(savedSettingsForm));
  const liveSettingsValidation = settingsForm ? validateEventSettingsInput(eventSettingsInputFromForm(settingsForm)) : null;
  const visibleSettingsFieldErrors = {
    ...(settingsDirty && liveSettingsValidation && !liveSettingsValidation.ok ? liveSettingsValidation.fieldErrors : {}),
    ...settingsFieldErrors,
  };
  const canSaveSettings = Boolean(settingsDirty && !settingsSaving && liveSettingsValidation?.ok);
  const showCreatedHandoff = searchParams.get("created") === "1";
  const activeTab = searchParams.get("tab") || "share";
  const tabItems = [
    ["share", "Share"],
    ["live-wall", "Photo Wall"],
    ["recap", "Shared Recap"],
    ["uploads", "Uploads"],
    ["settings", "Settings"],
  ];
  const liveWallStatus = event?.photoCount
    ? { label: "Photos are coming in", tone: "green" as const, copy: `${event.photoCount} ${event.photoCount === 1 ? "photo has" : "photos have"} been added.` }
    : lifecycle?.phase === "during"
      ? { label: "Waiting for photos", tone: "amber" as const, copy: "No photos yet. Ask guests to scan the QR code." }
      : { label: "Photo Wall is ready", tone: "stone" as const, copy: "Use this during the event so guests know where to add photos and can see pictures appear live." };

  useEffect(() => {
    if (!event || !lifecycle) return;
    trackAnalytics("event_lifecycle_viewed", {
      eventId: event.id,
      eventSlug: event.slug,
      metadata: { surface: "event_detail", lifecycleStatus: lifecycle.status },
    });
  }, [event?.id, event?.slug, lifecycle?.status]);

  async function handleHostPhotoAction(action: "hide" | "restore" | "feature" | "unfeature" | "delete", photo: Photo) {
    if (action === "hide") return updatePhotoVisibility(photo, "HIDDEN");
    if (action === "restore") return updatePhotoVisibility(photo, "VISIBLE");
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

  function dismissCreatedHandoff() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("created");
    setSearchParams(nextParams);
  }

  const isRecapReady = Boolean(event?.recapLink && lifecycle?.phase === "after");
  const recapUnavailableCopy = lifecycle?.phase === "after"
    ? "The recap link is not available yet. Refresh this event before sharing it."
    : "The recap will be ready after the reveal time.";
  const detailPrimaryAction = event && lifecycle ? (
    lifecycle.phase === "during" && event.liveWallLink ? (
      <a className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white shadow-sm" href={event.liveWallLink} target="_blank" rel="noreferrer">Open Photo Wall</a>
    ) : lifecycle.phase === "after" && event.recapLink ? (
      <Button type="button" onClick={() => copyDetailLink("Recap link", event.recapLink)}>Copy recap link</Button>
    ) : (
      <Button type="button" onClick={() => copyDetailLink("Guest upload link", event.eventLink)}>Copy guest upload link</Button>
    )
  ) : null;

  return (
    <Shell wide>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {event && (
        <>
          {showCreatedHandoff && shareAssets ? (
            <EventReadyHandoffPanel
              event={event}
              shareAssets={shareAssets}
              onCopyGuestLink={() => copyDetailLink("Guest upload link", event.eventLink)}
              onDismiss={dismissCreatedHandoff}
            />
          ) : null}
          <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusPill>Event status</StatusPill>
              {lifecycle ? <span className="ml-2"><LifecycleBadge lifecycle={lifecycle} /></span> : null}
              <h1 className="mt-3 font-display text-4xl font-bold text-stone-950">{event.name}</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-600">Next step: {buildHostNextStep(event, eventAnalytics || undefined)}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">calendar_today</Icon>{formatDateTime(event.eventDate)}</span>
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">photo_library</Icon>{event.photoCount} photos</span>
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">lock</Icon>Reveal time: {formatDateTime(event.revealAt)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {detailPrimaryAction}
            </div>
          </section>

          <nav className="mt-8 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
            <div className="flex min-w-max gap-2 rounded-[1.35rem] border border-[#eadfce] bg-white p-2 shadow-sm">
              {tabItems.map(([key, label]) => (
                <button
                  type="button"
                  className={cx("rounded-[1rem] px-4 py-3 text-sm font-extrabold transition", activeTab === key ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-[#fffaf6]")}
                  onClick={() => setSearchParams(key === "share" ? {} : { tab: key })}
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
                <Card className="lg:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <StatusPill>Event status</StatusPill>
                      <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">{event.name}</h2>
                      <p className="mt-2 max-w-2xl text-stone-600">Next step: {buildHostNextStep(event, eventAnalytics || undefined)}</p>
                      {lifecycle ? <div className="mt-4"><LifecycleBadge lifecycle={lifecycle} /></div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">{detailPrimaryAction}</div>
                  </div>
                </Card>

                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  <Card className="flex h-full flex-col">
                    <StatusPill tone="stone">Before the event</StatusPill>
                    <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">Send the guest upload link.</h2>
                    <p className="mt-2 text-sm font-semibold text-stone-600">Guests can open this from any browser. No account needed.</p>
                    <input className="mt-5 w-full rounded-[1rem] border border-[#eadfce] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-stone-700" readOnly value={event.eventLink} aria-label="Guest upload link" />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" onClick={() => copyDetailLink("Guest upload link", event.eventLink)}>Copy link</Button>
                      <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={`/dashboard/events/${event.id}/poster`}>Download QR poster</Link>
                    </div>
                    <div className="mt-5 rounded-[1.15rem] bg-[#fffaf6] p-4 text-sm font-semibold text-stone-700 ring-1 ring-[#eadfce]">
                      <p className="font-extrabold text-stone-950">Invite message</p>
                      <p className="mt-2 whitespace-pre-line">{shareAssets.guestInviteMessage}</p>
                      <SecondaryButton type="button" className="mt-4 w-full" onClick={() => copyDetailText("Invite message", shareAssets.guestInviteMessage)}>Copy invite message</SecondaryButton>
                    </div>
                  </Card>

                  <Card className="flex h-full flex-col">
                  <StatusPill tone={lifecycle?.phase === "during" ? "green" : "stone"}>During the event</StatusPill>
                    <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">Open the Photo Wall.</h2>
                    <p className="mt-2 text-sm font-semibold text-stone-600">{shareAssets.liveWallSetupTip}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {event.liveWallLink ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" href={event.liveWallLink} target="_blank" rel="noreferrer">Open Photo Wall</a> : null}
                      <SecondaryButton type="button" onClick={() => copyDetailLink("Guest upload link", event.eventLink)}>Copy guest upload link</SecondaryButton>
                      <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={`/dashboard/events/${event.id}/poster`}>Download QR poster</Link>
                    </div>
                    <div className="mt-5 rounded-[1.15rem] bg-[#fffaf6] p-4 text-sm font-semibold text-stone-700 ring-1 ring-[#eadfce]">
                      <p className="font-extrabold text-stone-950">Host tip</p>
                      <p className="mt-2">{shareAssets.liveWallSetupTip}</p>
                    </div>
                  </Card>

                  <Card className="flex h-full flex-col">
                    <StatusPill tone={isRecapReady ? "green" : "plum"}>After the event</StatusPill>
                    <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">{isRecapReady ? "Share the Shared Recap with everyone." : "Shared Recap is not ready yet."}</h2>
                    <p className="mt-2 text-sm font-semibold text-stone-600">{isRecapReady ? "Send one finished page after reveal." : recapUnavailableCopy}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {event.recapLink && isRecapReady ? <SecondaryButton type="button" onClick={() => copyDetailLink("Recap link", event.recapLink)}>Copy recap link</SecondaryButton> : null}
                      {event.recapLink && isRecapReady ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" href={event.recapLink} target="_blank" rel="noreferrer">Preview recap</a> : null}
                      <SecondaryButton onClick={() => downloadZip("visible")}>Download photos</SecondaryButton>
                    </div>
                    <div className="mt-5 rounded-[1.15rem] bg-[#fffaf6] p-4 text-sm font-semibold text-stone-700 ring-1 ring-[#eadfce]">
                      <p className="font-extrabold text-stone-950">Recap message</p>
                      <p className="mt-2">{isRecapReady ? shareAssets.recapMessage : recapUnavailableCopy}</p>
                      <SecondaryButton type="button" className="mt-4 w-full" disabled={!isRecapReady} onClick={() => copyDetailText("Recap message", shareAssets.recapMessage)}>Copy recap message</SecondaryButton>
                    </div>
                    {downloadStatus && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">{downloadStatus}</p>}
                  </Card>
                </div>
              </>
            ) : null}
          </section>
          ) : null}

          {activeTab === "live-wall" ? (
          <section className="mt-8">
            <Card className="lg:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <StatusPill tone={liveWallStatus.tone}>{liveWallStatus.label}</StatusPill>
                  <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">Photo Wall</h2>
                  <p className="mt-2 max-w-2xl text-stone-600">Use this during the event so guests know where to add photos and can see pictures appear live.</p>
                </div>
                <div className="rounded-[1.15rem] bg-[#fff3ee] px-5 py-4 text-center">
                  <p className="font-display text-3xl font-bold text-[#d94f33]">{event.photoCount}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">photos added</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {event.liveWallLink ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" href={event.liveWallLink} target="_blank" rel="noreferrer">Open Photo Wall</a> : null}
                <SecondaryButton type="button" onClick={() => copyDetailLink("Guest link", event.eventLink)}>Copy guest link</SecondaryButton>
                <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={`/dashboard/events/${event.id}/poster`}>Download QR poster</Link>
              </div>
              <div className="mt-6 grid gap-2 rounded-[1.15rem] bg-[#fffaf6] p-4 text-sm font-semibold text-stone-700 ring-1 ring-[#eadfce]">
                <p className="font-extrabold text-stone-950">Simple setup</p>
                <p>Put this on a TV, laptop, or iPad during the event.</p>
                <p>For small hangouts, you can also just share the guest link.</p>
                <p>Keep the QR code visible when people are adding photos.</p>
              </div>
              <details className="mt-6 rounded-[1.15rem] border border-[#eadfce] bg-white p-4">
                <summary className="cursor-pointer list-none font-display text-xl font-bold text-stone-950">Advanced display modes</summary>
                <p className="mt-2 text-sm font-semibold text-stone-600">Use these only when the room needs a specific display.</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {buildHostShareAssets(event).liveWallDisplayLinks
                    .filter((link) => link.key !== "grid")
                    .map((link) => <LiveWallDisplayLinkCard key={link.key} link={link} event={event} />)}
                </div>
              </details>
            </Card>
          </section>
          ) : null}

          {activeTab === "recap" ? (
          <section className="mt-8">
            <Card className="lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <StatusPill tone={lifecycle?.phase === "after" ? "green" : "plum"}>{lifecycle?.phase === "after" ? "Shared Recap ready" : "Shared Recap building"}</StatusPill>
                  <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">Shared Recap</h2>
                  <p className="mt-2 max-w-2xl text-stone-600">Send this after the event so everyone can see the photos in one place.</p>
                </div>
                <div className="grid gap-2 rounded-[1.15rem] bg-[#fffaf6] p-4 text-sm font-bold text-stone-700">
                  <span>{visiblePhotos.length} visible photos</span>
                  <span>{featuredCount} featured favorites</span>
                  <span>{hostContributorSummary.contributorCount || "Guest"} {hostContributorSummary.contributorCount === 1 ? "contributor" : "contributors"}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {event.recapLink ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" href={event.recapLink} target="_blank" rel="noreferrer">Preview recap</a> : null}
                {event.recapLink ? <SecondaryButton type="button" onClick={() => copyDetailLink("Recap link", event.recapLink)}>Copy recap link</SecondaryButton> : null}
                <SecondaryButton onClick={() => downloadZip("visible")}>Download photos</SecondaryButton>
              </div>
              <div className="mt-6 grid gap-2 rounded-[1.15rem] bg-white p-4 text-sm font-semibold text-stone-700 ring-1 ring-[#eadfce]">
                <p className="font-extrabold text-stone-950">Before you send it</p>
                <p>Review photos</p>
                <p>Feature favorites</p>
                <p>Send recap link</p>
              </div>
              {downloadStatus && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">{downloadStatus}</p>}
            </Card>
            <div className="mt-4 grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <p className="text-sm font-semibold text-stone-600">Visible export excludes hidden and reported photos by default.</p>
              <SecondaryButton onClick={() => downloadZip("visible")}>Download visible ZIP</SecondaryButton>
              <SecondaryButton onClick={() => downloadZip("all")}>Download all ZIP</SecondaryButton>
            </div>
          </section>
          ) : null}

          {activeTab === "recap" && eventAnalytics && (
            <details className="mt-8 rounded-[1.45rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
              <summary className="cursor-pointer list-none font-display text-2xl font-bold text-stone-950">Activity and analytics</summary>
              <p className="mt-2 text-sm text-stone-600">Secondary recap and upload details for host review.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Guest joins", eventAnalytics.guestJoins],
                  ["Uploads", eventAnalytics.uploads],
                  ["Live Wall opens", eventAnalytics.liveWallOpens],
                  ["Recap views", eventAnalytics.recapOpens],
                  ["Visible photos", eventAnalytics.visiblePhotos],
                  ["Hidden photos", eventAnalytics.hiddenPhotos],
                  ["Reported photos", eventAnalytics.reportedPhotos],
                  ["Featured photos", eventAnalytics.featuredPhotos],
                ].map(([label, value], index) => (
                  <MetricCard key={label} label={String(label)} value={String(value)} tone={index === 1 ? "accent" : index === 2 ? "green" : index === 3 ? "plum" : "default"} />
                ))}
              </div>
              <div className="mt-4 rounded-[1.45rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-stone-950">People who uploaded</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-600">{hostContributorSummary.totalPhotos} visible photos from {hostContributorSummary.contributorCount || "guest"} {hostContributorSummary.contributorCount === 1 ? "contributor" : "contributors"}.</p>
                  </div>
                  {hostContributorSummary.topContributors.length ? (
                    <div className="flex flex-wrap gap-2">
                      {hostContributorSummary.topContributors.map((contributor) => (
                        <span className="rounded-full bg-[#fffaf6] px-3 py-2 text-xs font-extrabold text-[#653e00]" key={contributor.displayName}>{contributor.displayName}: {contributor.photoCount}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <HostAwardVotingSummary awardVoting={eventAnalytics.eventAwardsVoting} photos={event.photos} onFeatureWinner={(photo) => updatePhotoFeatured(photo, true)} />
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
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold text-stone-700">
                      Event date
                      <TextInput type="datetime-local" value={settingsForm.eventDate} onChange={(formEvent) => updateSettingsField("eventDate", formEvent.target.value)} required />
                      {visibleSettingsFieldErrors.eventDate ? <span className="text-xs font-bold text-red-700">{visibleSettingsFieldErrors.eventDate}</span> : null}
                    </label>
                    <label className="grid gap-2 text-sm font-bold text-stone-700">
                      Reveal time
                      <TextInput type="datetime-local" value={settingsForm.revealAt} onChange={(formEvent) => updateSettingsField("revealAt", formEvent.target.value)} required />
                      <span className="text-xs font-semibold text-stone-500">Guests can upload before this, but the full album stays hidden until the reveal time.</span>
                      {visibleSettingsFieldErrors.revealAt ? <span className="text-xs font-bold text-red-700">{visibleSettingsFieldErrors.revealAt}</span> : null}
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-bold text-stone-700">
                    Photo limit per guest
                    <TextInput type="number" min="1" max="100" value={settingsForm.photoLimitPerGuest} onChange={(formEvent) => updateSettingsField("photoLimitPerGuest", formEvent.target.value)} required />
                    <span className="text-xs font-semibold text-stone-500">Keep this high for casual events and lower for games or prompts.</span>
                    {visibleSettingsFieldErrors.photoLimitPerGuest ? <span className="text-xs font-bold text-red-700">{visibleSettingsFieldErrors.photoLimitPerGuest}</span> : null}
                  </label>
                  <div className="grid gap-3 rounded-[1rem] bg-[#fffaf6] p-4 text-sm text-stone-700 sm:grid-cols-2">
                    <p><strong className="block text-stone-950">Event mode</strong>{plainModeLabel(challengeDraft.type)}</p>
                    <p><strong className="block text-stone-950">Prompt pack</strong>{getPromptPack(challengeDraft.promptPackSlug).name}</p>
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
              <p className="mt-5 rounded-[1rem] bg-red-50 p-4 text-sm font-semibold text-red-800">Delete event stays available from this settings area. Permanent deletion is not changed in this pass.</p>
            </Card>
            <Card className="lg:p-8">
              <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} promptLibraryInitiallyOpen />
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-800">{event.challenge ? `${challengeLabel(event.challenge)} is active for this event.` : "Normal EventFilm albums still work without a challenge."}</p>
                  {challengeStatus && <p className="mt-1 text-sm font-semibold text-amber-700">{challengeStatus}</p>}
                </div>
                <Button onClick={saveChallenge}>Save challenge</Button>
              </div>
            </Card>
            <HostBetaIssuePanel event={event} />
            {lifecycle ? <div className="mt-5"><RepeatEventActions event={event} lifecycle={lifecycle} /></div> : null}
          </section>
          ) : null}

          {activeTab === "uploads" ? (
          <section className="mt-10">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-bold">Uploads</h2>
                <p className="text-stone-600">{event.photos.length ? "Review photos and keep public views clean." : "No photos yet. Share the QR code to start collecting uploads."}</p>
              </div>
            </div>
            <div className="mb-5 grid gap-3 rounded-[1.45rem] border border-[#eadfce] bg-white p-4 shadow-[0_12px_34px_rgba(101,62,0,0.055)]">
              <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                  {[
                    ["all", `All photos (${event.photos.length})`],
                    ["visible", `Visible (${visiblePhotos.length})`],
                    ["hidden", `Hidden (${hiddenCount})`],
                    ["featured", `Featured (${featuredCount})`],
                    ["reported", `Reported (${reportedCount})`],
                  ].map(([key, label]) => (
                    <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-extrabold", galleryFilter === key ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200")} onClick={() => setGalleryFilter(key)} key={key}>{label}</button>
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
              {filteredPhotos.map((photo) => (
                <div className={cx("overflow-hidden rounded-[1.45rem] border bg-white p-2 shadow-[0_12px_30px_rgba(101,62,0,0.055)]", photo.visibilityStatus === "HIDDEN" ? "border-red-200 opacity-80" : "border-[#eadfce]")} key={photo.id}>
                  <button className="block w-full text-left" onClick={() => {
                    setSelectedPhoto(photo);
                    trackAnalytics("photo_lightbox_opened", { eventId, eventSlug: event.slug, metadata: { surface: "host", photoId: photo.id } });
                  }}>
                    <img className="aspect-square w-full rounded-[1.1rem] object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
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
                      <p className="mt-2 text-sm font-semibold text-[#653e00]">{photo.challengeItemKind === "award" ? "Award" : "Mode"}: {photo.challengeItemLabel}</p>
                    )}
                    <p className="mt-1 text-stone-600">{formatDateTime(photo.createdAt)}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <button className={cx("min-h-10 rounded-[0.95rem] px-4 py-2 text-sm font-extrabold", photo.isFeatured ? "bg-stone-950 text-white" : "bg-[#fff0d8] text-[#653e00]")} onClick={() => updatePhotoFeatured(photo, !photo.isFeatured)} disabled={photo.visibilityStatus === "HIDDEN"}>
                        {photo.isFeatured ? "Unfavorite" : "Favorite"}
                      </button>
                      {photo.visibilityStatus === "HIDDEN" ? (
                        <SecondaryButton className="min-h-10 rounded-[0.95rem] px-4 py-2" onClick={() => updatePhotoVisibility(photo, "VISIBLE")}>Restore</SecondaryButton>
                      ) : (
                        <SecondaryButton className="min-h-10 rounded-[0.95rem] px-4 py-2" onClick={() => updatePhotoVisibility(photo, "HIDDEN")}>Hide</SecondaryButton>
                      )}
                      <button className="min-h-10 rounded-[0.95rem] bg-stone-100 px-4 py-2 text-sm font-extrabold text-stone-700 ring-1 ring-stone-200" onClick={() => setSelectedPhoto(photo)}>More</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!filteredPhotos.length && <Card className="text-center"><h3 className="font-display text-2xl font-bold text-stone-950">No photos yet</h3><p className="mt-2 font-semibold text-stone-600">Share the QR code to start collecting uploads.</p></Card>}
          </section>
          ) : null}
          <PhotoDetailModal photo={selectedPhoto} mode="host" onClose={() => setSelectedPhoto(null)} onHostAction={handleHostPhotoAction} />
        </>
      )}
    </Shell>
  );
}

function PhotoMosaic({ photos, dark = false, onPhotoClick }: { photos: Photo[]; dark?: boolean; onPhotoClick?: (photo: Photo) => void }) {
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
          <button className="block h-full w-full text-left" type="button" onClick={() => onPhotoClick?.(photo)}>
            <img className="aspect-square h-full w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
          </button>
          <figcaption className={cx("p-3 text-xs font-bold", dark ? "text-stone-100" : "text-stone-700")}>
            <span className="block truncate">{photo.challengeParticipantName || photo.guestNickname || "Guest"}</span>
            {photoChallengeLabel(photo) && <span className={cx("mt-1 block truncate", dark ? "text-amber-200" : "text-[#653e00]")}>{photoChallengeLabel(photo)}</span>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function AwardLeadersPanel({ awardVoting, photos, dark = false }: { awardVoting?: AwardVotingSummary | null; photos: Photo[]; dark?: boolean }) {
  if (!awardVoting?.categories.length) return null;
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const leaders = awardVoting.categories.filter((category) => category.leaderPhotoIds.length || category.noVotes || category.noSubmissions);

  return (
    <section className={cx("rounded-[2rem] p-5", dark ? "bg-white/10 text-white" : "border border-[#eadfce] bg-white shadow-[0_24px_70px_rgba(101,62,0,0.08)]")}>
      <p className={cx("text-sm font-bold uppercase tracking-wide", dark ? "text-amber-200" : "text-[#653e00]")}>Event Awards</p>
      <h2 className={cx("mt-2 font-display text-2xl font-bold", dark ? "text-white" : "text-stone-950")}>Current leaders</h2>
      <p className={cx("mt-2 text-sm", dark ? "text-stone-200" : "text-stone-600")}>Voting is lightweight and based on each guest browser.</p>
      <div className="mt-5 grid gap-3">
        {leaders.map((category) => {
          const leader = category.leaderPhotoIds[0] ? photosById.get(category.leaderPhotoIds[0]) : null;
          const voteCount = category.voteTotals[0]?.voteCount || 0;
          return (
            <div className={cx("rounded-2xl p-4", dark ? "bg-white/10" : "bg-stone-50")} key={category.categoryId}>
              <div className="flex items-center justify-between gap-3">
                <p className={cx("min-w-0 truncate text-sm font-bold", dark ? "text-white" : "text-stone-900")}>{category.categoryLabel}</p>
                {category.isTie && <StatusPill tone="amber">Tie</StatusPill>}
              </div>
              {leader ? (
                <div className="mt-3 flex items-center gap-3">
                  <img className="h-14 w-14 rounded-2xl object-cover" src={leader.previewUrl || leader.url} alt={leader.originalFilename} />
                  <div className="min-w-0">
                    <p className={cx("truncate text-sm font-bold", dark ? "text-white" : "text-stone-900")}>{leader.guestNickname || "Guest photo"}</p>
                    <p className={cx("text-xs font-bold", dark ? "text-amber-200" : "text-[#653e00]")}>{voteCount} {voteCount === 1 ? "vote" : "votes"}</p>
                  </div>
                </div>
              ) : (
                <p className={cx("mt-3 text-sm font-semibold", dark ? "text-stone-200" : "text-stone-600")}>{category.noSubmissions ? "No submissions yet." : "No votes yet."}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AwardVotingPanel({
  event,
  photos,
  awardVoting,
  clientId,
  surface,
  onVoteComplete,
}: {
  event: Pick<PublicEvent, "slug" | "id">;
  photos: Photo[];
  awardVoting?: AwardVotingSummary | null;
  clientId: string;
  surface: "recap" | "guest_album";
  onVoteComplete: () => Promise<void>;
}) {
  const [busyVote, setBusyVote] = useState("");
  const [status, setStatus] = useState("");
  if (!awardVoting?.categories.length || !awardVoting.votingEnabled) return null;

  const photosByCategory = new Map<string, Photo[]>();
  for (const photo of photos) {
    if (!photo.challengeItemId) continue;
    const group = photosByCategory.get(photo.challengeItemId) || [];
    group.push(photo);
    photosByCategory.set(photo.challengeItemId, group);
  }

  async function castVote(photo: Photo, categoryId: string) {
    setBusyVote(`${categoryId}:${photo.id}`);
    setStatus("");
    try {
      const response = await eventFilmApi.castEventAwardVote(event.slug, { photoId: photo.id, clientId, challengeItemId: categoryId });
      trackAnalytics(response.duplicate ? "award_vote_duplicate_blocked" : "award_vote_cast", {
        eventId: event.id,
        eventSlug: event.slug,
        metadata: { surface, photoId: response.photoId, challengeItemId: response.challengeItemId, categoryId: response.challengeItemId },
      });
      setStatus(response.duplicate ? "You already voted in that category from this browser." : "Vote saved.");
      await onVoteComplete();
    } catch (err) {
      setStatus(publicRouteErrorMessage(err, "Could not save that vote. Refresh and try again."));
    } finally {
      setBusyVote("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-[#eadfce] bg-white p-5 shadow-[0_24px_70px_rgba(101,62,0,0.08)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusPill>Event Awards</StatusPill>
          <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">Vote for winners</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">Pick one photo per category from this browser. It is lightweight voting, not a fraud-proof ballot.</p>
        </div>
        {status && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-[#653e00]">{status}</p>}
      </div>

      <div className="mt-6 grid gap-5">
        {awardVoting.categories.map((category) => {
          const categoryPhotos = photosByCategory.get(category.categoryId) || [];
          const voteCounts = new Map(category.voteTotals.map((item) => [item.photoId, item.voteCount]));
          const winners = category.leaderPhotoIds.map((photoId) => categoryPhotos.find((photo) => photo.id === photoId)).filter(Boolean) as Photo[];
          return (
            <section className="rounded-[1.45rem] bg-[#fffaf6] p-4" key={category.categoryId}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-stone-950">{category.categoryLabel}</h3>
                  <p className="text-sm font-semibold text-stone-600">{category.submissionCount} submissions - {category.totalVotes} votes</p>
                </div>
                {category.isTie && <StatusPill tone="amber">Tie for first</StatusPill>}
              </div>

              {winners.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {winners.map((photo) => (
                    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-amber-200" key={photo.id}>
                      <img className="h-16 w-16 rounded-2xl object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[#653e00]">{category.isTie ? "Tied winner" : "Winner"}</p>
                        <p className="truncate font-bold text-stone-950">{photo.guestNickname || "Guest photo"}</p>
                        <p className="text-sm font-semibold text-stone-600">{voteCounts.get(photo.id) || 0} votes</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!categoryPhotos.length ? (
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-stone-600">No submissions in this category yet.</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {categoryPhotos.map((photo) => {
                    const selected = category.myVotePhotoId === photo.id;
                    const blockedByExistingVote = Boolean(category.myVotePhotoId && !selected);
                    return (
                      <div className={cx("overflow-hidden rounded-[1.15rem] bg-white p-2 ring-1", selected ? "ring-amber-400" : "ring-[#eadfce]")} key={photo.id}>
                        <img className="aspect-square w-full rounded-[0.95rem] object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                        <div className="p-2">
                          <p className="truncate text-sm font-bold text-stone-900">{photo.guestNickname || "Guest photo"}</p>
                          <p className="mt-1 text-xs font-bold text-stone-500">{voteCounts.get(photo.id) || 0} votes</p>
                          <button
                            className={cx("mt-3 min-h-10 w-full rounded-[0.9rem] px-3 py-2 text-xs font-extrabold", selected ? "bg-stone-950 text-white" : "bg-amber-500 text-stone-950 disabled:bg-stone-200 disabled:text-stone-500")}
                            disabled={Boolean(busyVote) || blockedByExistingVote}
                            onClick={() => castVote(photo, category.categoryId)}
                          >
                            {selected ? "Your vote" : blockedByExistingVote ? "Voted" : busyVote === `${category.categoryId}:${photo.id}` ? "Voting..." : "Vote"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {category.noVotes && categoryPhotos.length > 0 && <p className="mt-3 text-sm font-semibold text-stone-600">No votes yet in this category.</p>}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function HostAwardVotingSummary({
  awardVoting,
  photos,
  onFeatureWinner,
}: {
  awardVoting?: AwardVotingSummary | null;
  photos: Photo[];
  onFeatureWinner: (photo: Photo) => Promise<void>;
}) {
  if (!awardVoting?.categories.length) return null;
  const visiblePhotos = photos.filter(isPhotoVisible);
  const photosById = new Map(visiblePhotos.map((photo) => [photo.id, photo]));

  return (
    <section className="mt-6 rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusPill>Event Awards</StatusPill>
          <h3 className="mt-3 font-display text-2xl font-bold text-stone-950">Voting summary</h3>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">Guests get one lightweight browser/session vote per category. Hide or delete a photo to remove it from public winners.</p>
        </div>
        <StatusPill tone={awardVoting.votingEnabled ? "green" : "stone"}>{awardVoting.votingEnabled ? "Voting on" : "Voting off"}</StatusPill>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {awardVoting.categories.map((category) => {
          const leader = category.leaderPhotoIds[0] ? photosById.get(category.leaderPhotoIds[0]) : null;
          const voteCount = category.voteTotals[0]?.voteCount || 0;
          return (
            <div className="rounded-[1.25rem] bg-[#fffaf6] p-4" key={category.categoryId}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-bold text-stone-950">{category.categoryLabel}</p>
                {category.isTie && <StatusPill tone="amber">Tie</StatusPill>}
              </div>
              <p className="mt-1 text-sm font-semibold text-stone-600">{category.submissionCount} submissions - {category.totalVotes} votes</p>
              {leader ? (
                <div className="mt-4 flex items-center gap-3">
                  <img className="h-16 w-16 rounded-2xl object-cover" src={leader.previewUrl || leader.url} alt={leader.originalFilename} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-[#653e00]">Current leader</p>
                    <p className="truncate font-bold text-stone-950">{leader.guestNickname || "Guest photo"}</p>
                    <p className="text-sm font-semibold text-stone-600">{voteCount} {voteCount === 1 ? "vote" : "votes"}</p>
                  </div>
                  <SecondaryButton className="min-h-10 rounded-[0.95rem] px-3 py-2" disabled={leader.isFeatured} onClick={() => onFeatureWinner(leader)}>{leader.isFeatured ? "Featured" : "Feature"}</SecondaryButton>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-bold text-stone-600">{category.noSubmissions ? "No submissions yet." : "No votes yet."}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LiveWall() {
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = parseLiveWallMode(searchParams.get("mode"));
  const [data, setData] = useState<LiveWallResponse | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mode, setMode] = useState<LiveWallMode>(initialMode);
  const [showQr, setShowQr] = useState(true);
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  async function load() {
    const nextData = await api<LiveWallResponse>(`/api/events/${slug}/live-wall`);
    setData(nextData);
    setError("");
    setLastUpdated(new Date());
  }

  useEffect(() => {
    trackAnalytics("live_wall_opened", { eventSlug: slug, path: `/wall/${slug}` });
    trackAnalytics("live_wall_viewed", { eventSlug: slug, path: `/wall/${slug}`, metadata: { mode } });
    trackAnalytics("live_wall_mode_viewed", { eventSlug: slug, path: `/wall/${slug}`, metadata: { mode } });
    let isMounted = true;
    async function loadIfMounted() {
      try {
        const nextData = await api<LiveWallResponse>(`/api/events/${slug}/live-wall`);
        if (!isMounted) return;
        setData(nextData);
        setError("");
        setLastUpdated(new Date());
      } catch (err) {
        if (isMounted) setError(publicRouteErrorMessage(err, "Live Wall is not available right now. Check the event link or refresh in a moment."));
      }
    }
    loadIfMounted();
    const interval = window.setInterval(loadIfMounted, 15_000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [slug]);

  useEffect(() => {
    const nextMode = parseLiveWallMode(searchParams.get("mode"));
    setMode(nextMode);
  }, [searchParams]);

  useEffect(() => {
    if (!data?.event) return;
    trackAnalytics("live_wall_mode_viewed", { eventId: data.event.id, eventSlug: data.event.slug, metadata: { mode } });
    if (mode === "join") trackAnalytics("live_wall_qr_display_opened", { eventId: data.event.id, eventSlug: data.event.slug, metadata: { mode } });
    if (mode === "challenge") trackAnalytics("live_wall_challenge_display_opened", { eventId: data.event.id, eventSlug: data.event.slug, metadata: { mode } });
    if (mode === "awards") trackAnalytics("live_wall_awards_leaders_viewed", { eventId: data.event.id, eventSlug: data.event.slug, metadata: { mode } });
  }, [data?.event?.id, data?.event?.slug, mode]);

  useEffect(() => {
    const photos = data?.photos || [];
    if (mode !== "slideshow" || slideshowPaused || photos.length <= 1) return;
    const interval = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % photos.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [data?.photos, mode, slideshowPaused]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function switchMode(nextMode: LiveWallMode) {
    setMode(nextMode);
    setSlideIndex(0);
    setSearchParams(nextMode === "grid" ? {} : { mode: nextMode });
    trackAnalytics("live_wall_mode_switched", { eventId: data?.event.id, eventSlug: data?.event.slug || slug, metadata: { from: mode, to: nextMode } });
    trackAnalytics("live_wall_mode_changed", { eventId: data?.event.id, eventSlug: data?.event.slug || slug, metadata: { from: mode, to: nextMode } });
  }

  function toggleQr() {
    const nextShowQr = !showQr;
    setShowQr(nextShowQr);
    trackAnalytics("live_wall_qr_toggled", { eventId: data?.event.id, eventSlug: data?.event.slug || slug, metadata: { visible: nextShowQr, mode } });
  }

  function toggleSlideshow() {
    const nextPaused = !slideshowPaused;
    setSlideshowPaused(nextPaused);
    trackAnalytics(nextPaused ? "live_wall_slideshow_paused" : "live_wall_slideshow_resumed", { eventId: data?.event.id, eventSlug: data?.event.slug || slug, metadata: { mode } });
  }

  async function enterFullscreen() {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      await document.exitFullscreen().catch(() => {});
    }
    trackAnalytics("live_wall_fullscreen_clicked", { eventId: data?.event.id, eventSlug: data?.event.slug || slug, metadata: { mode } });
  }

  async function copyJoinLink() {
    if (!data?.eventLink) return;
    try {
      await copyText(data.eventLink);
      setCopyStatus("Guest upload link copied");
    } catch (err) {
      setCopyStatus((err as Error).message);
    }
  }

  function trackUploadLinkClick(label: string) {
    trackAnalytics("live_wall_upload_link_clicked", { eventId: data?.event.id, eventSlug: data?.event.slug || slug, metadata: { mode, label } });
  }

  const event = data?.event;
  const challengeSummary = event ? buildLiveWallChallengeDisplaySummary(event.challenge, data.photos, data.awardVoting) : null;
  const contributors = data ? buildContributorSummary(data.photos) : null;
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const displayLinks = event ? buildLiveWallDisplayLinks(event) : [];
  const availableModes = displayLinks.map((link) => link.key);
  const activeMode = availableModes.includes(mode) ? mode : "grid";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080808] pb-56 text-white sm:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_30%),radial-gradient(circle_at_50%_0%,rgba(232,93,63,0.16),transparent_34%)]" />
      {!event && (
        <div className="relative grid min-h-screen place-items-center p-8">
          <div className="max-w-xl text-center">
            <Icon className="mx-auto h-16 w-16 text-[#ff856d]">photo_camera</Icon>
            <h1 className="mt-5 font-display text-5xl font-bold">Preparing Photo Wall</h1>
            <p className="mt-3 text-stone-300">{error || "Loading the latest event photos..."}</p>
          </div>
        </div>
      )}
      {event && (
        <div className="relative flex min-h-[calc(100vh-14rem)] flex-col gap-5 p-4 sm:min-h-[calc(100vh-7rem)] sm:p-6 lg:p-8">
          <LiveWallHero event={event} mode={activeMode} lastUpdated={lastUpdated} />
          <div className={cx("grid flex-1 gap-5", showQr ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-1")}>
            <section className="min-h-[30rem]">
              {data.isLocked ? (
                <LiveWallLockedState title={capsuleCopy?.revealTitle || "Photos are being saved for the reveal."} note={capsuleCopy?.revealNote || "Photos are hidden until the reveal time."} />
              ) : activeMode === "slideshow" ? (
                <LiveWallSlideshow photos={data.photos} slideIndex={slideIndex} event={event} paused={slideshowPaused} />
              ) : activeMode === "join" ? (
                <LiveWallJoinMode data={data} photoCount={data.photos.length} />
              ) : activeMode === "challenge" ? (
                <LiveWallChallengeMode summary={challengeSummary} awardVoting={data.awardVoting} photos={data.photos} />
              ) : activeMode === "awards" ? (
                <LiveWallAwardsMode awardVoting={data.awardVoting} photos={data.photos} />
              ) : (
                <LiveWallGridMode photos={data.photos} event={event} />
              )}
            </section>
            {showQr ? (
              <aside className="grid content-start gap-4">
                <LiveWallQrPanel
                  data={data}
                  photoCount={data.photos.length}
                  contributors={contributors?.contributorCount || 0}
                  onUploadLinkClick={() => trackUploadLinkClick("qr_panel")}
                />
                <LiveWallContextPanel event={event} photos={data.photos} />
                {error ? <p className="rounded-[1rem] border border-red-300/30 bg-red-950/70 p-3 text-sm font-bold text-red-100">{error}</p> : null}
                {copyStatus ? <p className="rounded-[1rem] border border-emerald-300/30 bg-emerald-950/70 p-3 text-sm font-bold text-emerald-100">{copyStatus}</p> : null}
              </aside>
            ) : null}
          </div>
          <LiveWallControls
            mode={activeMode}
            availableModes={availableModes}
            displayLinks={displayLinks}
            showQr={showQr}
            paused={slideshowPaused}
            isFullscreen={isFullscreen}
            eventLink={data.eventLink}
            recapLink={data.recapLink}
            onModeChange={switchMode}
            onToggleQr={toggleQr}
            onToggleSlideshow={toggleSlideshow}
            onFullscreen={enterFullscreen}
            onRefresh={() => load().catch((err) => setError(publicRouteErrorMessage(err, "Live Wall is not available right now. Check the event link or refresh in a moment.")))}
            onCopyJoinLink={copyJoinLink}
            onUploadLinkClick={() => trackUploadLinkClick("controls")}
          />
        </div>
      )}
    </main>
  );
}

function LiveWallHero({ event, mode, lastUpdated }: { event: PublicEvent; mode: LiveWallMode; lastUpdated: Date | null }) {
  return (
    <header className="mx-auto w-full max-w-7xl">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <Icon className="h-10 w-10 text-[#ff856d]">photo_camera</Icon>
        <div>
          <h1 className="mx-auto max-w-5xl font-display text-3xl font-bold leading-tight text-white md:text-4xl xl:text-5xl">{event.name}</h1>
          <p className="mt-2 text-base font-semibold text-stone-200 md:text-lg">Add photos to the shared album.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide text-stone-400">
            <span>{getLiveWallModeLabel(mode)}</span>
            {lastUpdated ? <span>Updated {lastUpdated.toLocaleTimeString()}</span> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function LiveWallLockedState({ title, note }: { title: string; note: string }) {
  return (
    <section className="grid h-full min-h-[30rem] place-items-center rounded-[1.35rem] border border-white/15 bg-[#151311] p-8 text-center shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      <div className="max-w-3xl">
        <Icon className="mx-auto h-16 w-16 text-[#ff856d]">lock</Icon>
        <h2 className="mt-5 font-display text-4xl font-bold text-white md:text-6xl">{title}</h2>
        <p className="mt-4 text-lg font-semibold text-stone-200 md:text-xl">{note}</p>
      </div>
    </section>
  );
}

function LiveWallGridMode({ photos, event }: { photos: Photo[]; event: PublicEvent }) {
  if (!photos.length) return <LiveWallEmptyState event={event} title="Waiting for photos." note="Scan the QR code or open the link to add the first one." />;
  const displayPhotos = photos.slice(0, 14);
  return (
    <div className="grid h-full min-h-[30rem] auto-rows-fr grid-cols-2 gap-3 rounded-[1.35rem] border border-white/15 bg-[#111] p-3 shadow-[0_26px_80px_rgba(0,0,0,0.28)] md:grid-cols-4 xl:grid-cols-5">
      {displayPhotos.map((photo, index) => (
        <figure
          className={cx(
            "relative min-h-40 overflow-hidden rounded-[0.9rem] border border-white/10 bg-white/10 shadow-[0_18px_52px_rgba(0,0,0,0.26)]",
            index === 0 && "col-span-2 row-span-2",
            index === 5 && "md:col-span-2",
            index === 8 && "xl:row-span-2",
          )}
          key={photo.id}
        >
          <img className="h-full min-h-40 w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent p-4">
            <p className="truncate text-sm font-bold text-white/90">{photo.guestNickname || "Guest photo"}</p>
            {photoChallengeLabel(photo) ? <p className="mt-1 truncate text-xs font-bold text-amber-100">{photoChallengeLabel(photo)}</p> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function LiveWallSlideshow({ photos, slideIndex, event, paused }: { photos: Photo[]; slideIndex: number; event: PublicEvent; paused: boolean }) {
  if (!photos.length) return <LiveWallEmptyState event={event} title="Waiting for photos." note="Scan the QR code or open the link to add the first one." />;
  const photo = photos[slideIndex % photos.length] || photos[0];
  return (
    <section className="relative h-full min-h-[30rem] overflow-hidden rounded-[1.35rem] border border-white/15 bg-black shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      <img className="absolute inset-0 h-full w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-black/42" />
      <div className="absolute left-6 right-6 top-6 flex items-center justify-between gap-4">
        <span className="rounded-full bg-black/40 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-white ring-1 ring-white/15">{paused ? "Paused" : "Slideshow"}</span>
        <span className="rounded-full bg-[#fff0d8] px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-[#7c3f00]">{slideIndex + 1}/{photos.length}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
        <p className="font-display text-4xl font-bold text-white md:text-6xl">{event.name}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-stone-100 md:text-base">
          <span>{photo.guestNickname || "Guest photo"}</span>
          {photoChallengeLabel(photo) ? <span className="rounded-full bg-white/15 px-3 py-1 text-amber-100">{photoChallengeLabel(photo)}</span> : null}
          <span>{formatDateTime(photo.createdAt)}</span>
        </div>
      </div>
    </section>
  );
}

function LiveWallJoinMode({ data, photoCount }: { data: LiveWallResponse; photoCount: number }) {
  return (
    <section className="grid h-full min-h-[30rem] place-items-center rounded-[1.35rem] border border-white/15 bg-[#151311] p-8 text-center shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      <div className="max-w-3xl">
        <Icon className="mx-auto h-20 w-20 text-[#ff856d]">qr_code_2</Icon>
        <h2 className="mt-5 font-display text-5xl font-bold text-white md:text-7xl">Scan to add photos</h2>
        <p className="mt-4 text-xl font-semibold text-stone-200">No account needed.</p>
        <p className="mx-auto mt-6 max-w-2xl break-all rounded-[1rem] border border-white/10 bg-white/10 px-5 py-4 text-base font-extrabold text-stone-100">{data.eventLink}</p>
        <p className="mt-6 text-lg font-bold text-stone-300">{formatLiveWallPhotoCount(photoCount)}</p>
      </div>
    </section>
  );
}

function LiveWallQrPanel({ data, photoCount, contributors, onUploadLinkClick }: { data: LiveWallResponse; photoCount: number; contributors: number; onUploadLinkClick: () => void }) {
  return (
    <section className="rounded-[1.35rem] border border-white/15 bg-[#141414] p-5 text-center shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
      <Icon className="mx-auto h-10 w-10 text-[#ff856d]">phone_iphone</Icon>
      <h2 className="mt-3 text-2xl font-extrabold text-white">Scan to add photos</h2>
      <p className="mt-2 text-base font-semibold text-stone-300">No account needed.</p>
      {data.qrCodeDataUrl ? <img className="mx-auto mt-5 aspect-square w-full max-w-[15.5rem] rounded-[1rem] bg-white p-3" src={data.qrCodeDataUrl} alt="Guest upload QR code" /> : null}
      <a
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[0.9rem] border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-stone-200 hover:bg-white/[0.1]"
        href={data.eventLink}
        target="_blank"
        rel="noreferrer"
        onClick={onUploadLinkClick}
      >
        Open upload link
      </a>
      <p className="mt-5 text-lg font-bold text-stone-200"><Icon className="mr-2 inline h-5 w-5 text-[#ff856d]">photo_camera</Icon>{formatLiveWallPhotoCount(photoCount)}</p>
      {contributors ? <p className="mt-1 text-sm font-semibold text-stone-400">{contributors} {contributors === 1 ? "person has" : "people have"} added photos</p> : null}
    </section>
  );
}

function LiveWallContextPanel({ event, photos }: { event: PublicEvent; photos: Photo[] }) {
  const challengeType = event.challenge?.type;
  let title = "Add photos together.";
  let copy = "Photos show up here as people add them.";
  let icon = "auto_awesome";

  if (challengeType === CHALLENGE_TYPES.COLOR_HUNT) {
    title = "Color Hunt";
    copy = "Find your color and upload a photo.";
    icon = "palette";
  } else if (challengeType === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
    title = "Photo Prompts";
    copy = "Pick a prompt and add a matching photo.";
    icon = "checklist";
  } else if (challengeType === CHALLENGE_TYPES.EVENT_AWARDS) {
    title = "Event Awards";
    copy = "Add photos now. Vote later.";
    icon = "trophy";
  } else if (challengeType === CHALLENGE_TYPES.MEMORY_CAPSULE) {
    title = "Memory Capsule";
    copy = "Add photos now. They unlock after the reveal.";
    icon = "lock";
  } else if (photos.length) {
    title = "Photos are coming in.";
    copy = "Keep the QR code visible so guests can add theirs.";
  }

  return (
    <section className="rounded-[1rem] border border-white/15 bg-white/[0.06] p-5 text-white">
      <div className="flex gap-3">
        <Icon className="mt-1 h-8 w-8 shrink-0 text-[#ff856d]">{icon}</Icon>
        <div className="max-w-2xl">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-stone-300">{copy}</p>
        </div>
      </div>
    </section>
  );
}

function LiveWallChallengeMode({ summary, awardVoting, photos }: { summary: ReturnType<typeof buildLiveWallChallengeDisplaySummary> | null; awardVoting?: AwardVotingSummary | null; photos: Photo[] }) {
  if (!summary) return <LiveWallEmptyState title="Prompts are live." note="Pick a prompt and add a matching photo." />;
  return (
    <section className="grid h-full min-h-[30rem] gap-4 rounded-[1.35rem] border border-white/15 bg-[#151311] p-4 shadow-[0_26px_80px_rgba(0,0,0,0.28)] xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-[1rem] bg-[#fff8ee] p-6 text-amber-950">
        <p className="text-sm font-extrabold uppercase tracking-wide text-[#7c3f00]">{summary.modeLabel === "Photo Scavenger Hunt" ? "Photo Prompts" : summary.modeLabel}</p>
        <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">{summary.headline}</h2>
        <p className="mt-4 text-lg font-semibold">{summary.note}</p>
        <div className="mt-6 grid gap-3">
          {summary.rows.length ? summary.rows.map((row) => <LiveWallProgressRow key={row.id} row={row} />) : <p className="rounded-[1rem] bg-white/70 p-4 text-sm font-bold">Photos are collected as one shared album for this mode.</p>}
        </div>
      </div>
      <div className="grid content-start gap-4">
        <AwardLeadersPanel awardVoting={awardVoting} photos={photos} dark />
      </div>
    </section>
  );
}

function LiveWallAwardsMode({ awardVoting, photos }: { awardVoting?: AwardVotingSummary | null; photos: Photo[] }) {
  if (!awardVoting?.categories.length) return <LiveWallEmptyState title="Awards are live." note="Submit or vote on your favorites." />;
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  return (
    <section className="h-full min-h-[30rem] rounded-[1.35rem] border border-white/15 bg-[#fff8ee] p-4 text-amber-950 shadow-[0_26px_80px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-[#7c3f00]">Event Awards</p>
          <h2 className="mt-2 font-display text-4xl font-bold md:text-5xl">Leaders and winners</h2>
        </div>
        <StatusPill tone="amber">{awardVoting.categories.length} categories</StatusPill>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {awardVoting.categories.map((category) => {
          const leader = category.leaderPhotoIds[0] ? photosById.get(category.leaderPhotoIds[0]) : null;
          const voteCount = category.voteTotals[0]?.voteCount || 0;
          return (
            <article className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_18px_52px_rgba(101,62,0,0.12)]" key={category.categoryId}>
              {leader ? <img className="aspect-[4/3] w-full object-cover" src={leader.previewUrl || leader.url} alt={leader.originalFilename} /> : <div className="grid aspect-[4/3] place-items-center bg-[#fffaf6] p-6 text-center text-sm font-bold text-stone-600">Waiting for a leader</div>}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-bold text-stone-950">{category.categoryLabel}</h3>
                  {category.isTie ? <StatusPill tone="amber">Tie</StatusPill> : null}
                </div>
                <p className="mt-2 text-sm font-bold text-stone-600">{category.submissionCount} submissions - {category.totalVotes} votes</p>
                <p className="mt-3 text-base font-extrabold text-[#653e00]">{leader ? `${leader.guestNickname || "Guest photo"} leads with ${voteCount} ${voteCount === 1 ? "vote" : "votes"}` : category.noSubmissions ? "No submissions yet" : "No votes yet"}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LiveWallEmptyState({ title, note, event }: { title: string; note: string; event?: PublicEvent }) {
  return (
    <section className="relative grid h-full min-h-[30rem] place-items-center overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#111] p-8 text-center shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 grid grid-cols-3 opacity-20 md:grid-cols-5">
        {DEFAULT_DEMO_PHOTOS.concat(DEFAULT_DEMO_PHOTOS, DEFAULT_DEMO_PHOTOS).map((photo, index) => (
          <img className="h-full min-h-40 w-full object-cover grayscale" src={photo.dataUrl} alt="" key={`${photo.id}-${index}`} />
        ))}
      </div>
      <div className="absolute inset-0 bg-black/68" />
      <div className="relative max-w-3xl">
        <Icon className="mx-auto h-20 w-20 text-[#ff856d]">photo_camera</Icon>
        <h2 className="mt-6 font-display text-5xl font-bold text-white md:text-7xl">{title}</h2>
        <p className="mt-5 text-lg font-semibold text-stone-200 md:text-2xl">{note}</p>
        {event ? <p className="mt-5 text-sm font-bold uppercase tracking-wide text-stone-400">Photos show up here as people add them.</p> : null}
      </div>
    </section>
  );
}

function formatLiveWallPhotoCount(count: number) {
  return `${count} ${count === 1 ? "photo" : "photos"} added`;
}

function LiveWallProgressRow({ row, compact = false }: { row: ReturnType<typeof buildChallengeProgressSummary>["rows"][number]; compact?: boolean }) {
  const percent = row.total ? Math.min(100, Math.round((row.count / row.total) * 100)) : Math.min(100, row.count * 20);
  return (
    <div className={cx("rounded-[1rem] bg-white/75 p-4 text-stone-950", compact && "bg-white/10 text-white")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {row.colorHex ? <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: row.colorHex }} /> : null}
          <p className="truncate text-sm font-extrabold">{row.label}</p>
        </div>
        <p className={cx("shrink-0 text-sm font-extrabold tabular-nums", compact ? "text-amber-100" : "text-[#653e00]")}>{row.count}{row.total ? `/${row.total}` : ""}</p>
      </div>
      <div className={cx("mt-3 h-2 overflow-hidden rounded-full", compact ? "bg-white/15" : "bg-stone-200")}>
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${row.count > 0 ? Math.max(percent, 8) : 0}%` }} />
      </div>
    </div>
  );
}

function LiveWallControls({
  mode,
  availableModes,
  displayLinks,
  showQr,
  paused,
  isFullscreen,
  eventLink,
  recapLink,
  onModeChange,
  onToggleQr,
  onToggleSlideshow,
  onFullscreen,
  onRefresh,
  onCopyJoinLink,
  onUploadLinkClick,
}: {
  mode: LiveWallMode;
  availableModes: LiveWallMode[];
  displayLinks: LiveWallDisplayLink[];
  showQr: boolean;
  paused: boolean;
  isFullscreen: boolean;
  eventLink: string;
  recapLink?: string;
  onModeChange: (mode: LiveWallMode) => void;
  onToggleQr: () => void;
  onToggleSlideshow: () => void;
  onFullscreen: () => void;
  onRefresh: () => void;
  onCopyJoinLink: () => void;
  onUploadLinkClick: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/85 px-4 py-3 shadow-[0_-18px_52px_rgba(0,0,0,0.36)] backdrop-blur">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:grid-cols-4">
        <button className="inline-flex min-h-14 items-center justify-center gap-3 rounded-[0.9rem] px-4 py-2 text-sm font-extrabold text-white hover:bg-white/10" type="button" onClick={onFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
          <Icon>{isFullscreen ? "fullscreen_exit" : "fullscreen"}</Icon>
          {isFullscreen ? "Exit full" : "Fullscreen"}
        </button>
        <button className="inline-flex min-h-14 items-center justify-center gap-3 rounded-[0.9rem] px-4 py-2 text-sm font-extrabold text-white hover:bg-white/10" type="button" onClick={onToggleSlideshow} aria-label={paused ? "Resume slideshow" : "Pause slideshow"}>
          <Icon className="text-[#ff856d]">{paused ? "play_arrow" : "pause"}</Icon>
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="inline-flex min-h-14 items-center justify-center gap-3 rounded-[0.9rem] px-4 py-2 text-sm font-extrabold text-white hover:bg-white/10" type="button" onClick={onToggleQr} aria-label={showQr ? "Hide QR code" : "Show QR code"}>
          <Icon>qr_code_2</Icon>
          {showQr ? "Hide QR" : "Show QR"}
        </button>
        <details className="relative col-span-2 sm:col-span-1">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-center gap-3 rounded-[0.9rem] px-4 py-2 text-sm font-extrabold text-white hover:bg-white/10" aria-label="Open more Photo Wall controls">
            <Icon>more_horiz</Icon>
            More
          </summary>
          <div className="absolute bottom-full right-0 mb-3 grid w-64 gap-1 rounded-[1rem] border border-white/15 bg-[#151515] p-2 text-sm font-bold shadow-2xl">
            <button className="rounded-[0.75rem] px-3 py-3 text-left text-white hover:bg-white/10" type="button" onClick={onRefresh}>Refresh</button>
            <button className="rounded-[0.75rem] px-3 py-3 text-left text-white hover:bg-white/10" type="button" onClick={onCopyJoinLink}>Copy upload link</button>
            <a className="rounded-[0.75rem] px-3 py-3 text-white hover:bg-white/10" href={eventLink} target="_blank" rel="noreferrer" onClick={onUploadLinkClick}>Open upload page</a>
            {recapLink ? <a className="rounded-[0.75rem] px-3 py-3 text-white hover:bg-white/10" href={recapLink} target="_blank" rel="noreferrer">Open Shared Recap</a> : null}
            <p className="mt-1 border-t border-white/10 px-3 pb-1 pt-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Advanced display modes</p>
            {availableModes.map((item) => (
              <button
                className={cx("rounded-[0.75rem] px-3 py-3 text-left text-sm font-extrabold transition", mode === item ? "bg-[#ff856d] text-black" : "text-white hover:bg-white/10")}
                type="button"
                onClick={() => onModeChange(item)}
                aria-pressed={mode === item}
                key={item}
              >
                {getLiveWallModeLabel(item)}
              </button>
            ))}
            {displayLinks.filter((link) => link.key !== mode).map((link) => (
              <a className="rounded-[0.75rem] px-3 py-3 text-white hover:bg-white/10" href={link.url} target="_blank" rel="noreferrer" key={link.key}>Open {link.label}</a>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function RecapSharePanel({ event, data, assets, hasWinners }: { event: PublicEvent; data: EventRecapResponse; assets: HostShareAssets; hasWinners: boolean }) {
  const [status, setStatus] = useState("");
  const primaryText = data.isLocked && assets.memoryCapsuleRevealCopy ? assets.memoryCapsuleRevealCopy : hasWinners ? assets.winnerShareText : assets.recapShareText;
  const empty = data.photos.length === 0;

  async function copyRecapLink() {
    try {
      await copyText(data.recapLink);
      trackAnalytics("recap_link_copied", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap" } });
      setStatus("Recap link copied");
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  async function shareRecap() {
    try {
      await shareOrCopyText({
        title: `${event.name} recap`,
        text: primaryText,
        url: data.recapLink,
        fallbackLabel: "Recap",
        onStatus: setStatus,
        analyticsName: "recap_link_shared",
        eventId: event.id,
        eventSlug: event.slug,
        surface: "recap",
      });
      trackAnalytics("recap_share_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap", method: "native_or_copy" } });
      trackAnalytics("guest_share_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap", method: "native_or_copy" } });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <div className="rounded-[1.35rem] bg-white/10 p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Share this recap</p>
      <p className="mt-3 text-sm leading-6 text-stone-200">{empty ? assets.emptyRecapCopy : primaryText}</p>
      {status && <p className="mt-3 text-sm font-bold text-amber-200">{status}</p>}
      <div className="mt-4 grid gap-2">
        <button className="min-h-12 rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" type="button" onClick={shareRecap}>Share recap</button>
        <button className="min-h-12 rounded-[1.15rem] bg-white px-5 py-3 text-sm font-bold text-stone-950" type="button" onClick={copyRecapLink}>Copy recap link</button>
      </div>
    </div>
  );
}

function RecapStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[1.15rem] bg-white/10 p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-amber-200">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold text-white">{value}</p>
    </div>
  );
}

function RecapMiniStrip({ photos, onPhotoClick }: { photos: Photo[]; onPhotoClick: (photo: Photo) => void }) {
  if (!photos.length) return null;
  return (
    <div className="mt-6 grid grid-cols-4 gap-2 sm:max-w-md">
      {photos.slice(0, 4).map((photo, index) => (
        <button
          className={cx("overflow-hidden rounded-[1rem] border border-white/10 bg-white/10", index === 0 ? "col-span-2 row-span-2" : "")}
          key={photo.id}
          type="button"
          onClick={() => onPhotoClick(photo)}
        >
          <img className="aspect-square h-full w-full object-cover" src={photo.previewUrl || photo.url} alt={photoChallengeLabel(photo) || photo.originalFilename || "Event photo"} />
        </button>
      ))}
    </div>
  );
}

function RecapHighlightReel({ story, onPhotoClick }: { story: EventRecapStory; onPhotoClick: (photo: Photo) => void }) {
  return (
    <section className="mt-8" id="recap-highlights">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">{story.recapTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-600">{story.recapSubtitle}</p>
        </div>
      </div>
      {!story.totalPhotos ? (
        <Card className="border-dashed text-center">
          <h3 className="font-display text-2xl font-bold">No highlights yet.</h3>
          <p className="mx-auto mt-2 max-w-xl text-stone-600">{story.emptyCopy}</p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {story.highlightReel.map((section, index) => (
            <section className={cx("rounded-[1.65rem] border border-[#eadfce] bg-white p-4 shadow-[0_18px_54px_rgba(101,62,0,0.06)]", index === 0 ? "sm:p-5" : "")} key={section.key}>
              <div className="mb-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#653e00]">{section.title}</p>
                <p className="mt-1 text-sm font-semibold text-stone-600">{section.description}</p>
              </div>
              <PhotoMosaic photos={section.photos} onPhotoClick={onPhotoClick} />
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function RecapChallengeMoments({ story, awardVoting, event, photos, clientId, onVoteComplete, onPhotoClick }: { story: EventRecapStory; awardVoting?: AwardVotingSummary | null; event: PublicEvent; photos: Photo[]; clientId: string; onVoteComplete: () => Promise<void>; onPhotoClick: (photo: Photo) => void }) {
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
              <span className={cx("shrink-0 rounded-full px-3 py-1 text-xs font-extrabold", moment.isComplete ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600")}>
                {moment.total ? `${moment.count}/${moment.total}` : moment.count}
              </span>
            </div>
            {moment.isTie ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-extrabold text-[#653e00]">Tie at the top</p> : null}
            {moment.photos.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {moment.photos.slice(0, 3).map((photo) => (
                  <button className="overflow-hidden rounded-[0.9rem] bg-stone-100" key={photo.id} type="button" onClick={() => onPhotoClick(photo)}>
                    <img className="aspect-square h-full w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-[1rem] bg-[#fffaf6] p-3 text-sm font-semibold text-stone-600">No representative photo yet.</p>
            )}
          </article>
        ))}
      </div>
      {awardVoting ? (
        <div className="mt-6">
          <AwardVotingPanel event={event} photos={photos} awardVoting={awardVoting} clientId={clientId} surface="recap" onVoteComplete={onVoteComplete} />
        </div>
      ) : null}
    </section>
  );
}

function RecapContributorCelebration({ story }: { story: EventRecapStory }) {
  const contributors = story.contributorSummary;
  return (
    <section className="mt-8 rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.06)]" id="recap-contributors">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <StatusPill tone="green">People who uploaded</StatusPill>
          <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">People who added photos</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-600">
            {contributors.contributorCount
                ? `${contributors.contributorCount} named ${contributors.contributorCount === 1 ? "person" : "people"} added photos to this shared recap.`
              : contributors.totalPhotos
                ? "Guests added photos without display names, so the recap celebrates the group instead."
                : "People will appear here once guests add photos."}
          </p>
        </div>
        <div className="rounded-[1.15rem] bg-[#fffaf6] px-5 py-4 text-center">
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#653e00]">Photos</p>
          <p className="font-display text-4xl font-bold text-stone-950">{contributors.totalPhotos}</p>
        </div>
      </div>
      {contributors.topContributors.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {contributors.topContributors.map((contributor) => (
            <span className="rounded-full bg-[#fff0d8] px-4 py-2 text-sm font-extrabold text-[#653e00]" key={contributor.displayName}>{contributor.displayName}: {contributor.photoCount}</span>
          ))}
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
          className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition", activeFilter === filter.key ? "bg-stone-950 text-white" : "border border-[#eadfce] bg-white text-stone-700 hover:bg-[#fffaf6]")}
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

function RecapCreateEventCta({ story, event }: { story: EventRecapStory; event: PublicEvent }) {
  return (
    <section className="mt-8 rounded-[1.65rem] bg-stone-950 p-5 text-white shadow-[0_24px_70px_rgba(101,62,0,0.15)] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold">{story.createEventCtaTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-200">{story.createEventCtaCopy}</p>
        </div>
        <Link
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white shadow-[0_14px_32px_rgba(232,93,63,0.28)]"
          to="/dashboard/events/new"
          onClick={() => trackAnalytics("recap_create_event_cta_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap" } })}
        >
          Create your own event
        </Link>
      </div>
    </section>
  );
}

function EventRecap() {
  const { slug = "" } = useParams();
  const [{ session }] = useState(() => getGuestSession(slug));
  const [data, setData] = useState<EventRecapResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [reportStatus, setReportStatus] = useState("");
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
  const story = event ? buildEventRecapStory(event, data.photos, { awardVoting: data.awardVoting }) : null;
  const shareAssets = event
    ? buildHostShareAssets({
        ...event,
        eventLink: data.eventLink,
        liveWallLink: data.liveWallLink,
        recapLink: data.recapLink,
      })
    : null;
  const hasAwardWinners = Boolean(data?.awardVoting?.categories.some((category) => category.leaderPhotoIds.length > 0));
  const awardWinnerCount = data?.awardVoting?.categories.filter((category) => category.leaderPhotoIds.length > 0).length || 0;
  const completedChallengeCount = story?.challengeMoments.filter((moment) => moment.isComplete).length || 0;
  const recapStatusLabel = "Shared recap";
  const recapHeroSentence = data?.isLocked
    ? `Photos are saved for the reveal. The recap unlocks after ${event ? formatDateTime(event.revealAt) : "the reveal time"}.`
    : story?.totalPhotos
      ? "Photos from the event, all in one place."
      : "No photos yet. Share the guest link so people can add theirs.";
  const primaryHeroCta = { label: "Add photos", href: `/e/${slug}` };
  const heroStats = [
    { label: "Photos", value: story?.totalPhotos ?? 0 },
    { label: "People who uploaded", value: story?.contributorCount || "Guests" },
    ...(awardWinnerCount ? [{ label: "Awards", value: awardWinnerCount }] : completedChallengeCount ? [{ label: "Prompts", value: completedChallengeCount }] : []),
  ].slice(0, 3);
  const selectedFilter = story?.albumFilters.find((filter) => filter.key === activeAlbumFilter) || story?.albumFilters[0] || null;
  const albumPhotoIds = new Set(selectedFilter?.photoIds || []);
  const albumPhotos = data?.photos.filter((photo) => !selectedFilter || albumPhotoIds.has(photo.id)) || [];

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

  async function reportSelectedPhoto(reason: PhotoReportReason, note: string) {
    if (!selectedPhoto) return;
    await eventFilmApi.reportPhoto(selectedPhoto.id, { reason, note, reporterId: getAnalyticsAnonymousId() });
    setReportStatus("Thanks. The host can review this report.");
    trackAnalytics("photo_reported", { eventId: event?.id, eventSlug: event?.slug, metadata: { photoId: selectedPhoto.id, reason } });
  }

  function openPublicPhoto(photo: Photo) {
    setSelectedPhoto(photo);
    setReportStatus("");
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
    <main className="min-h-screen bg-[#fff8ed] text-stone-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-5 sm:py-10">
        {!event && (
          <Card className="text-center">
            <h1 className="font-display text-3xl font-bold">Loading recap</h1>
            <p className="mt-2 text-stone-600">{error || "Gathering the event story..."}</p>
          </Card>
        )}
        {event && story && (
          <>
            <section className="overflow-hidden rounded-[1.6rem] bg-stone-950 p-5 text-white shadow-[0_28px_90px_rgba(101,62,0,0.16)] sm:rounded-[2rem] sm:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_0.62fr] lg:items-end">
                <div>
                  <StatusPill>{recapStatusLabel}</StatusPill>
                  <h1 className="mt-5 font-display text-4xl font-bold leading-none sm:text-6xl lg:text-7xl">{event.name}</h1>
                  <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-stone-200 sm:text-lg">{recapHeroSentence}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white shadow-[0_14px_32px_rgba(232,93,63,0.24)]" to={primaryHeroCta.href} onClick={() => trackAnalytics("guest_album_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap_upload_cta" } })}>{primaryHeroCta.label}</Link>
                    <button className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-white/20 px-5 py-3 text-sm font-extrabold text-white" type="button" onClick={copyHeroRecapLink}>Copy recap link</button>
                  </div>
                  {recapLinkStatus ? <p className="mt-3 text-sm font-bold text-amber-200">{recapLinkStatus}</p> : null}
                  <RecapMiniStrip photos={story.highlightPhotos} onPhotoClick={openPublicPhoto} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {heroStats.map((stat) => <RecapStat key={stat.label} label={stat.label} value={stat.value} />)}
                </div>
              </div>
            </section>

            {data.isLocked ? (
              <>
                <section className="mt-8 rounded-[1.65rem] border border-amber-200 bg-amber-50 p-6 text-center sm:p-8">
                  <Icon className="mx-auto h-12 w-12 text-[#653e00]">lock</Icon>
                  <h2 className="mt-4 font-display text-3xl font-bold text-[#653e00] sm:text-4xl">Photos are saved for the reveal.</h2>
                  <p className="mx-auto mt-3 max-w-2xl text-amber-900">The recap unlocks after {formatDateTime(event.revealAt)}.</p>
                  <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-white px-5 py-3 text-sm font-extrabold text-stone-950 shadow-sm" to={`/e/${slug}`}>Add photos before reveal</Link>
                </section>
                {shareAssets ? (
                  <section className="mt-8 rounded-[1.65rem] bg-stone-950 p-5 text-white shadow-[0_24px_70px_rgba(101,62,0,0.15)] sm:p-7" id="recap-share">
                    <h2 className="font-display text-3xl font-bold">Share recap</h2>
                    <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-200">Copy the recap link now, or send it after the reveal opens.</p>
                    <div className="mt-4">
                      <RecapSharePanel event={event} data={data} assets={shareAssets} hasWinners={hasAwardWinners} />
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <>
                <section className="mt-8" id="recap-photos">
                  <div className="mb-4">
                    <h2 className="font-display text-3xl font-bold">Photos</h2>
                    <p className="text-stone-600">{albumPhotos.length ? "Photos from the event, all in one place." : "No photos yet. Share the guest link so people can add theirs."}</p>
                  </div>
                  <RecapAlbumFilterTabs filters={story.albumFilters} activeFilter={selectedFilter?.key || "all"} onChange={chooseAlbumFilter} />
                  <PhotoMosaic photos={albumPhotos} onPhotoClick={openPublicPhoto} />
                </section>
                {story.totalPhotos ? <RecapHighlightReel story={story} onPhotoClick={openPublicPhoto} /> : null}
                <RecapContributorCelebration story={story} />
                {event.challenge ? <RecapChallengeMoments story={story} awardVoting={data.awardVoting} event={event} photos={data.photos} clientId={session.clientId} onVoteComplete={loadRecap} onPhotoClick={openPublicPhoto} /> : null}
                {shareAssets ? (
                  <section className="mt-8 rounded-[1.65rem] bg-stone-950 p-5 text-white shadow-[0_24px_70px_rgba(101,62,0,0.15)] sm:p-7" id="recap-share">
                    <div className="mb-4">
                      <h2 className="font-display text-3xl font-bold">Share this recap</h2>
                      <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-200">Send this after the event so everyone can see the photos in one place.</p>
                    </div>
                    <RecapSharePanel event={event} data={data} assets={shareAssets} hasWinners={hasAwardWinners} />
                    <Link className="mt-4 inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-white/20 px-5 py-3 text-sm font-extrabold text-white" to={`/e/${slug}`} onClick={() => trackAnalytics("guest_album_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap_add_photos_cta" } })}>Add photos</Link>
                  </section>
                ) : null}
                <RecapCreateEventCta story={story} event={event} />
              </>
            )}
            <PhotoDetailModal photo={selectedPhoto} mode="public" onClose={() => setSelectedPhoto(null)} onReport={reportSelectedPhoto} reportStatus={reportStatus} />
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
  const uploadCardRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const albumRef = useRef<HTMLElement | null>(null);
  const myUploadsRef = useRef<HTMLElement | null>(null);
  const pageViewedTrackedRef = useRef(false);
  const joinedTrackedRef = useRef(false);
  const returnedTrackedRef = useRef(false);
  const nameChoiceTrackedRef = useRef(false);
  const progressTrackedRef = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [myUploads, setMyUploads] = useState<Photo[]>([]);
  const [localUploads, setLocalUploads] = useState<GuestUploadLocalMetadata[]>(() => loadGuestUploadMetadata(slug));
  const [file, setFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllChallengeItems, setShowAllChallengeItems] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<GuestUploadSuccessSummary | null>(null);
  const [uploadSuccessPhoto, setUploadSuccessPhoto] = useState<Photo | null>(null);
  const [awardVoting, setAwardVoting] = useState<AwardVotingSummary | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [reportStatus, setReportStatus] = useState("");

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
    setLocalUploads(rememberedUploads);
    if (rememberedUploads.length && !returnedTrackedRef.current) {
      returnedTrackedRef.current = true;
      trackAnalytics("guest_returned_to_event", {
        eventId: eventData.event.id,
        eventSlug: eventData.event.slug,
        metadata: { photoCount: rememberedUploads.length },
      });
    }
    if (!joinedTrackedRef.current) {
      joinedTrackedRef.current = true;
      trackAnalytics("guest_joined_event", {
        eventId: eventData.event.id,
        eventSlug: eventData.event.slug,
        metadata: { mode: eventData.event.challenge?.type || "NONE", hasChallenge: Boolean(eventData.event.challenge) },
      });
    }
    const status = await api<{ remainingUploads: number; nickname: string | null }>(`/api/events/${slug}/guest-status?clientId=${encodeURIComponent(session.clientId)}`);
    setRemaining(status.remainingUploads);
    if (eventData.event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT && status.nickname && !nickname) setNickname(status.nickname);
    const myUploadData = await eventFilmApi.getGuestMyUploads(slug, session.clientId);
    setMyUploads(myUploadData.photos);
    trackAnalytics("guest_my_uploads_viewed", { eventId: eventData.event.id, eventSlug: eventData.event.slug, metadata: { surface: "guest_upload", photoCount: myUploadData.photos.length } });
    if (eventData.event.isRevealed) {
      if (eventData.event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) {
        const recapData = await eventFilmApi.getRecapData(slug, session.clientId);
        setPhotos(recapData.photos);
        setAwardVoting(recapData.awardVoting || null);
      } else {
        const photoData = await api<{ photos: Photo[] }>(`/api/events/${slug}/photos`);
        setPhotos(photoData.photos);
        setAwardVoting(null);
      }
    } else {
      setPhotos([]);
      setAwardVoting(null);
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

  useEffect(() => {
    if (!file) {
      setPhotoPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [file]);

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

  function saveSelectedParticipant(participantId: string) {
    setSelectedParticipantId(participantId);
    setUploadSuccess(null);
    setUploadSuccessPhoto(null);
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
    setUploadSuccessPhoto(null);
    setMessage("");
    if (promptId) localStorage.setItem(getChallengePromptSession(slug), promptId);
    else localStorage.removeItem(getChallengePromptSession(slug));
    if (promptId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "prompt" } });
  }

  function saveSelectedItem(itemId: string) {
    setSelectedItemId(itemId);
    setUploadSuccess(null);
    setUploadSuccessPhoto(null);
    setMessage("");
    if (itemId) localStorage.setItem(getChallengeItemSession(slug), itemId);
    else localStorage.removeItem(getChallengeItemSession(slug));
    if (itemId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "award" } });
  }

  function expandChallengeItems(label: string) {
    setShowAllChallengeItems(true);
    trackAnalytics("guest_prompt_hint_expanded", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE", label } });
  }

  async function uploadPhoto(uploadEvent: React.FormEvent) {
    uploadEvent.preventDefault();
    setMessage("");
    setError("");
    setUploadSuccess(null);
    setUploadSuccessPhoto(null);

    if (loading) return;
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      trackAnalytics("photo_upload_failed", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE", outcome: validation.reason } });
      return setError(validation.message);
    }
    if (!file) return setError("Choose a photo first");
    if (event?.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && !selectedParticipant) return setError("Select your Color Hunt name first");
    if (event?.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && !selectedPrompt) return setError("Choose a Photo Scavenger Hunt prompt first");
    if (event?.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && !selectedAward) return setError("Choose an Event Awards category first");
    if (event?.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT && !nickname.trim() && !nameChoiceTrackedRef.current) {
      nameChoiceTrackedRef.current = true;
      trackAnalytics("guest_continued_anonymous", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload" } });
    }

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("nickname", selectedParticipant?.displayName || sanitizeGuestDisplayName(nickname));
    formData.append("clientId", session.clientId);
    if (selectedParticipant?.id) formData.append("challengeParticipantId", selectedParticipant.id);
    if (selectedPrompt?.id) formData.append("challengePromptId", selectedPrompt.id);
    if (selectedAward?.id) formData.append("challengeItemId", selectedAward.id);

    setLoading(true);
    trackAnalytics("photo_upload_started", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE" } });
    try {
      const data = await api<{ photo: Photo; remainingUploads: number }>(`/api/events/${slug}/photos`, { method: "POST", body: formData });
      trackAnalytics("photo_upload_succeeded", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE" } });
      setFile(null);
      setRemaining(data.remainingUploads);
      const nextLocalUploads = recordGuestUploadMetadata(slug, data.photo);
      setLocalUploads(nextLocalUploads);
      setUploadSuccess(buildGuestUploadSuccessSummary({ event: event as PublicEvent, photo: data.photo, remainingUploads: data.remainingUploads }));
      setUploadSuccessPhoto(data.photo);
      setMessage("Photo added.");
      await load();
    } catch (err) {
      const message = (err as Error).message || "Upload failed. Check your connection and try again.";
      trackAnalytics("photo_upload_failed", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE", outcome: message.includes("used all uploads") ? "event_limit" : "error" } });
      setError(publicRouteErrorMessage(err, "Upload failed. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  const selectedParticipant = event?.challenge?.participants.find((participant) => participant.id === selectedParticipantId);
  const guestPrompts = promptsFromChallenge(event?.challenge);
  const guestAwards = categoriesFromChallenge(event?.challenge);
  const selectedPrompt = guestPrompts.find((prompt) => prompt.id === selectedPromptId);
  const selectedAward = guestAwards.find((category) => category.id === selectedItemId);
  const activePack = getChallengePack(event?.challenge?.type || "NONE");
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const guestProgress = event ? buildGuestChallengeProgress(event.challenge, photos, { participantId: selectedParticipantId, promptId: selectedPromptId, itemId: selectedItemId }) : null;
  const contributorSummary = buildContributorSummary(photos);
  const visibleMyUploadIds = new Set(myUploads.map((photo) => photo.id));
  const unavailableUploads = localUploads.filter((item) => !visibleMyUploadIds.has(item.photoId));
  const compactPromptItems = showAllChallengeItems ? guestPrompts : guestPrompts.slice(0, 3);
  const compactAwardItems = showAllChallengeItems ? guestAwards : guestAwards.slice(0, 3);
  const shouldMentionLimit = remaining === 0 || event?.photoLimitPerGuest === undefined || event.photoLimitPerGuest <= 10 || (remaining !== null && remaining <= 10);

  useEffect(() => {
    if (!event || !guestProgress || progressTrackedRef.current) return;
    progressTrackedRef.current = true;
    trackAnalytics("challenge_progress_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { mode: guestProgress.mode, surface: "guest_upload" } });
  }, [event?.id, guestProgress?.mode]);

  function resetForAnotherUpload() {
    trackUploadSuccessAction("add_another_photo");
    setUploadSuccess(null);
    setUploadSuccessPhoto(null);
    setMessage("");
    setError("");
    setTimeout(() => uploadCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function trackUploadSuccessAction(action: string) {
    trackAnalytics("upload_success_action_clicked", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload", label: action } });
  }

  async function reportSelectedPhoto(reason: PhotoReportReason, note: string) {
    if (!selectedPhoto) return;
    await eventFilmApi.reportPhoto(selectedPhoto.id, { reason, note, reporterId: session.clientId });
    setReportStatus("Thanks. The host can review this report.");
    trackAnalytics("photo_reported", { eventId: event?.id, eventSlug: event?.slug, metadata: { photoId: selectedPhoto.id, reason } });
  }

  return (
    <Shell>
      {!event && (
        <div className="mx-auto mb-5 max-w-2xl text-center">
          <StatusPill>No app download. No account needed.</StatusPill>
        </div>
      )}
      {event && (
        <div className="mx-auto max-w-2xl pb-24 sm:pb-8">
          <section className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white shadow-[0_28px_80px_rgba(101,62,0,0.18)] sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill>{activePack.badge}</StatusPill>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-amber-100">No account needed</span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold">{event.name}</h1>
            <p className="mt-3 text-lg font-semibold text-stone-100">Add your photos to the private event album.</p>
            {event.description && <p className="mt-3 text-stone-300">{event.description}</p>}
            {!event.isRevealed && <p className="mt-4 text-sm font-semibold text-amber-100">The full album unlocks after {formatDateTime(event.revealAt)}.</p>}
            <p className="mt-5 rounded-3xl bg-white/10 p-4 text-sm font-bold text-white">{guestChallengeHint(event)}</p>
            <a className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(232,93,63,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d94f33] sm:w-auto" href="#guest-upload-card">
              <Icon>photo_camera</Icon>
              Add photos
            </a>
          </section>

          {event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && (
            <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Color Hunt</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Find your color.</h2>
              <p className="mt-2 text-stone-700">Pick your name or team so the photo lands in the right Color Hunt lane.</p>
              <label className="mt-5 grid gap-2 text-sm font-bold text-stone-700">
                Pick your color
                <select ref={participantSelectRef} className="h-12 rounded-2xl border border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" value={selectedParticipantId} onChange={(selectEvent) => saveSelectedParticipant(selectEvent.target.value)} required>
                  <option value="">Select a participant</option>
                  {event.challenge.participants.map((participant) => (
                    <option value={participant.id} key={participant.id}>{participant.displayName} - {participant.colorName}</option>
                  ))}
                </select>
              </label>
              {selectedParticipant && (
                <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-3 text-sm font-bold text-stone-800 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Your color:</span>
                    <ColorChip participant={selectedParticipant} />
                  </div>
                  <button type="button" className="self-start rounded-full border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:border-amber-400 hover:bg-amber-50 sm:self-auto" onClick={switchParticipant}>Switch participant</button>
                </div>
              )}
            </section>
          )}

          {event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && (
            <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Photo Prompts</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Pick a prompt.</h2>
              <p className="mt-2 text-stone-700">Choose one idea before uploading. The photo will be connected to that prompt.</p>
              <div className="mt-5 grid gap-2">
                {compactPromptItems.map((prompt, index) => {
                  const promptId = prompt.id || `prompt-${prompt.order ?? index}`;
                  return (
                  <button type="button" className={cx("rounded-2xl border p-4 text-left text-sm font-bold transition", selectedPromptId === promptId ? "border-[#e85d3f] bg-white text-[#653e00] shadow-sm" : "border-amber-200 bg-white/70 text-stone-800 hover:border-[#e85d3f]")} onClick={() => saveSelectedPrompt(promptId)} key={promptId}>
                    {prompt.text}
                  </button>
                  );
                })}
                {!showAllChallengeItems && guestPrompts.length > 3 && <SecondaryButton type="button" className="min-h-10 justify-self-start px-4 py-2" onClick={() => expandChallengeItems("show_more_prompts")}>Show more prompts</SecondaryButton>}
              </div>
              {selectedPrompt && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-stone-800">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Current prompt</p>
                  <p className="mt-1 font-display text-xl font-bold text-[#653e00]">{selectedPrompt.text}</p>
                </div>
              )}
            </section>
          )}

          {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && (
            <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Event Awards</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Choose an award category.</h2>
              <p className="mt-2 text-stone-700">Pick the category that fits the photo. Voting stays on the Recap.</p>
              <div className="mt-5 grid gap-2">
                {compactAwardItems.map((category, index) => {
                  const categoryId = category.id || `award-${category.order ?? index}`;
                  return (
                  <button type="button" className={cx("rounded-2xl border p-4 text-left text-sm font-bold transition", selectedItemId === categoryId ? "border-[#e85d3f] bg-white text-[#653e00] shadow-sm" : "border-amber-200 bg-white/70 text-stone-800 hover:border-[#e85d3f]")} onClick={() => saveSelectedItem(categoryId)} key={categoryId}>
                    {category.label}
                  </button>
                  );
                })}
                {!showAllChallengeItems && guestAwards.length > 3 && <SecondaryButton type="button" className="min-h-10 justify-self-start px-4 py-2" onClick={() => expandChallengeItems("show_more_awards")}>Show more categories</SecondaryButton>}
              </div>
              {selectedAward && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-stone-800">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Current award</p>
                  <p className="mt-1 font-display text-xl font-bold text-[#653e00]">{selectedAward.label}</p>
                </div>
              )}
            </section>
          )}

          {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && capsuleCopy && (
            <section className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Memory Capsule</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">{capsuleCopy.revealTitle}</h2>
              <p className="mt-2 text-stone-700">{capsuleCopy.revealNote}</p>
            </section>
          )}

          <form id="guest-upload-card" ref={uploadCardRef} className="mt-6 rounded-[1.75rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-6" onSubmit={uploadPhoto}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-bold text-stone-950">Add photos</h2>
                <p className="mt-2 text-stone-600">Choose from your phone or take a new photo. No sign-in, app download, or guest account.</p>
              </div>
              <span className="rounded-full bg-[#fff3ee] px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-[#653e00]">No account needed</span>
            </div>
            {event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && selectedParticipant && (
              <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-800">Posting as {selectedParticipant.displayName}</p>
            )}
            {event.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT && selectedPrompt && (
              <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-800">Uploading for: {selectedPrompt.text}</p>
            )}
            {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && selectedAward && (
              <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-800">Submitting for: {selectedAward.label}</p>
            )}
            {event.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT && (
              <label className="mt-5 grid gap-2 text-sm font-bold text-stone-700">
                Display name <span className="font-semibold text-stone-500">(optional)</span>
                <TextInput value={nickname} onChange={(event) => saveNickname(event.target.value)} placeholder="Optional" />
                <span className="text-xs font-semibold text-stone-500">Add your name if you want the host to know who uploaded it. Leave blank to post as Anonymous guest.</span>
              </label>
            )}
            {shouldMentionLimit && <p className="mt-4 rounded-[1rem] bg-[#fffaf6] p-3 text-sm font-bold text-stone-700">{uploadLimitCopy(remaining, event.photoLimitPerGuest)}</p>}
            {remaining === 0 && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">You have used all uploads for this event.</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400">
                <Icon>photo_camera</Icon>
                Take a photo
                <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" capture="environment" aria-label="Take a photo" onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setUploadSuccess(null);
                  setUploadSuccessPhoto(null);
                }} />
              </label>
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-900 transition hover:border-amber-500 hover:bg-amber-50">
                <Icon>photo_library</Icon>
                Choose from phone
                <input className="sr-only" type="file" accept="image/*" aria-label="Choose from phone" onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setUploadSuccess(null);
                  setUploadSuccessPhoto(null);
                }} />
              </label>
            </div>
            {file && photoPreviewUrl && (
              <div className="mt-4 flex items-center gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-3">
                <img className="h-24 w-24 rounded-2xl object-cover" src={photoPreviewUrl} alt="Selected photo preview" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-stone-900">{file.name || "Selected photo"}</p>
                  <p className="mt-1 text-sm text-stone-600">Ready to upload - {formatBytes(file.size)} {file.type || "image"}</p>
                </div>
              </div>
            )}
            {uploadSuccess && (
              <section className="mt-4 rounded-[1.35rem] border border-green-100 bg-green-50 p-4 text-green-950" role="status" aria-live="polite">
                <div className="grid gap-4 sm:grid-cols-[6rem_1fr] sm:items-center">
                  {uploadSuccessPhoto ? <img className="aspect-square w-full rounded-2xl object-cover" src={uploadSuccessPhoto.previewUrl || uploadSuccessPhoto.url} alt={`Uploaded photo by ${uploadSuccess.guestDisplayName}`} /> : null}
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">Photo added.</p>
                    <h3 className="mt-2 font-display text-2xl font-bold">Thanks, {uploadSuccess.guestDisplayName}.</h3>
                    <p className="mt-2 text-sm font-bold text-green-900">{uploadSuccess.detail}</p>
                    {uploadSuccess.revealNote ? <p className="mt-2 text-sm font-semibold text-green-900">{uploadSuccess.revealNote}</p> : !event.isRevealed ? <p className="mt-2 text-sm font-semibold text-green-900">The full album unlocks after {formatDateTime(event.revealAt)}.</p> : null}
                    <p className="mt-2 text-sm font-semibold text-green-900">The host can review event photos.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <SecondaryButton type="button" onClick={resetForAnotherUpload}>Add another photo</SecondaryButton>
                  <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" href="#my-uploads" onClick={() => {
                    trackUploadSuccessAction("view_my_uploads");
                    setTimeout(() => myUploadsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                  }}>View my uploads</a>
                  <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" href="#event-album" onClick={() => {
                    trackUploadSuccessAction("back_to_event_album");
                    setTimeout(() => albumRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                  }}>Back to event album</a>
                </div>
              </section>
            )}
            {message && !uploadSuccess && <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
            {message && !uploadSuccess && event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && (
              <Link className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" to={`/recap/${slug}`}>Vote on awards</Link>
            )}
            {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error} {file ? "Try again or choose a smaller image." : ""}</p>}
            {error && file && <SecondaryButton type="button" className="mt-3 w-full" onClick={() => {
              trackAnalytics("photo_upload_retry_clicked", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload" } });
              setError("");
            }}>Try again</SecondaryButton>}
            <Button className="mt-5 w-full" disabled={loading || remaining === 0}>{loading ? "Adding..." : "Add photos"}</Button>
          </form>

          {guestProgress && (
            <section className="mt-6 rounded-[1.75rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <StatusPill>{guestProgress.modeLabel}</StatusPill>
                  <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">{guestProgress.headline}</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-600">{guestProgress.note}</p>
                </div>
                <div className="rounded-2xl bg-[#fffaf6] p-4 text-center">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#653e00]">Contributed</p>
                  <p className="font-display text-3xl font-bold text-stone-950">{guestProgress.totalPhotos}</p>
                </div>
              </div>
              {guestProgress.rows.length ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {guestProgress.rows.slice(0, 6).map((row) => (
                    <div className="rounded-2xl bg-stone-50 p-4" key={row.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-bold text-stone-900">{row.label}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-[#653e00]">{row.count}</span>
                      </div>
                      {row.colorHex ? <div className="mt-3 h-2 rounded-full" style={{ backgroundColor: row.colorHex }} /> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-600">No challenge steps to track. Every photo counts.</p>
              )}
            </section>
          )}

          <section id="my-uploads" ref={myUploadsRef} className="mt-6 scroll-mt-6 rounded-[1.75rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <StatusPill>My Uploads</StatusPill>
                <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">Your uploads on this device</h2>
                <p className="mt-2 text-sm font-semibold text-stone-600">Photos you add from this browser will appear here.</p>
              </div>
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-extrabold text-stone-700">{myUploads.length} visible here</span>
            </div>
            {myUploads.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {myUploads.map((photo) => (
                  <figure className="overflow-hidden rounded-3xl border border-[#eadfce] bg-[#fffaf6] p-2" key={photo.id}>
                    <img className="aspect-square w-full rounded-2xl object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                    <figcaption className="p-2 text-xs font-bold text-stone-700">
                      <span className="block truncate">{photo.challengeParticipantName || photo.guestNickname || "Anonymous guest"}</span>
                      <span className="mt-1 block text-stone-500">{formatDateTime(photo.createdAt)}</span>
                      {photoChallengeLabel(photo) ? <span className="mt-1 block truncate text-[#653e00]">{photoChallengeLabel(photo)}</span> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-600">
                <p>No uploads from this device yet.</p>
                <p className="mt-1 font-semibold">Add a photo and it will show up here.</p>
              </div>
            )}
            {unavailableUploads.length ? (
              <div className="mt-4 grid gap-2">
                {unavailableUploads.slice(0, 4).map((item) => (
                  <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900" key={item.photoId}>
                    {item.challengeLabel || "This photo"} is only visible to the host right now.
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          {!event.isRevealed && (
            <section id="event-album" ref={albumRef} className="mt-8 scroll-mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-display text-2xl font-bold text-[#653e00]">Photos are being collected.</h2>
              <p className="mt-2 text-sm font-semibold text-amber-900">The album unlocks after {formatDateTime(event.revealAt)}.</p>
              <a className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white sm:w-auto" href="#guest-upload-card">Add your photos</a>
            </section>
          )}

          {event.isRevealed && (
            <section id="event-album" ref={albumRef} className="mt-8 scroll-mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">Album</h2>
                  <p className="mt-1 text-sm font-semibold text-stone-600">{photos.length} revealed photos from {contributorSummary.contributorCount || "the"} {contributorSummary.contributorCount === 1 ? "contributor" : "contributors"}.</p>
                </div>
                {contributorSummary.topContributors.length ? (
                  <div className="flex flex-wrap gap-2">
                    {contributorSummary.topContributors.map((contributor) => (
                      <span className="rounded-full bg-[#fffaf6] px-3 py-2 text-xs font-extrabold text-[#653e00]" key={contributor.displayName}>{contributor.displayName}: {contributor.photoCount}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {awardVoting && (
                <div className="mt-4">
                  <AwardVotingPanel event={event} photos={photos} awardVoting={awardVoting} clientId={session.clientId} surface="guest_album" onVoteComplete={load} />
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-sm" key={photo.id}>
                    <button type="button" className="block w-full text-left" onClick={() => {
                      setSelectedPhoto(photo);
                      setReportStatus("");
                      trackAnalytics("photo_lightbox_opened", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_album", photoId: photo.id } });
                    }}>
                      <img className="aspect-square w-full rounded-2xl object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                    </button>
                    {photo.challengeParticipantName && (
                      <p className="mt-2 truncate px-1 text-xs font-bold text-stone-700">{photo.challengeParticipantName} - {photo.challengeColorName}</p>
                    )}
                    {photoChallengeLabel(photo) && <p className="mt-2 truncate px-1 text-xs font-bold text-stone-700">{photoChallengeLabel(photo)}</p>}
                    <button type="button" className="mt-2 w-full rounded-full bg-stone-100 px-3 py-2 text-xs font-extrabold text-stone-700 hover:bg-stone-200" onClick={() => {
                      setSelectedPhoto(photo);
                      setReportStatus("");
                      trackAnalytics("photo_lightbox_opened", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_album", photoId: photo.id } });
                    }}>View / report</button>
                  </div>
                ))}
              </div>
              {!photos.length && <Card className="text-center"><h3 className="font-display text-2xl font-bold text-stone-950">No photos yet.</h3><p className="mt-2 font-semibold text-stone-600">Add your photos and help start the album.</p><a className="mt-4 inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white" href="#guest-upload-card">Add your photos</a></Card>}
            </section>
          )}
          <PhotoDetailModal photo={selectedPhoto} mode="public" onClose={() => setSelectedPhoto(null)} onReport={reportSelectedPhoto} reportStatus={reportStatus} />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eadfce] bg-white/95 p-3 shadow-[0_-12px_30px_rgba(101,62,0,0.08)] backdrop-blur sm:hidden">
            <a className="inline-flex min-h-12 w-full items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white" href="#guest-upload-card">Add photos</a>
          </div>
        </div>
      )}
      {!event && !error && <p>Loading event...</p>}
      {error && !event && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </Shell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
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
            <Route path="/wall/:slug" element={<LiveWall />} />
            <Route path="/recap/:slug" element={<EventRecap />} />
            <Route path="/e/:slug" element={<GuestEvent />} />
          </Routes>
        </BrowserRouter>
      </AppErrorBoundary>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
