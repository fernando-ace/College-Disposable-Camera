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
  buildHostLaunchKit,
  buildHostShareAssets,
  buildChallengeProgressSummary,
  buildEventRecapMetadata,
  buildChallengePayload,
  buildDuplicateEventInput,
  buildPostEventHostSummary,
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
  getChallengePack,
  getPromptPack,
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
  validateHostFeedback,
} from "@eventfilm/shared";
import type { AnalyticsEventInput, AnalyticsEventName, AwardVotingSummary, ChallengeDraft, ChallengeParticipant, EventChallenge, EventLifecycle, EventSummary, EventTemplateSlug, FounderOverview, GuestUploadLocalMetadata, GuestUploadSuccessSummary, HostFeedbackInput, HostLaunchKit, HostShareAssets, HostShareLinkCard, LiveWallDisplayLink, LiveWallMode, Photo, PhotoReportReason, PhotoVisibilityStatus, PromptPackSlug, PublicEvent, User } from "@eventfilm/shared";
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-[1.65rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)]", className)}>{children}</div>;
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

function TemplateLibrary({ draft, onSelect, onSkip }: { draft: ChallengeDraft; onSelect: (slug: EventTemplateSlug) => void; onSkip: () => void }) {
  return (
    <section className="rounded-[1.75rem] bg-stone-950 p-5 text-white sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-200">Event templates</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Choose the event shape.</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-300">Pick a polished setup, then adjust timing, prompts, and mode details before launch.</p>
        </div>
        <button type="button" className="min-h-10 rounded-full bg-white/10 px-4 py-2 text-sm font-extrabold text-white ring-1 ring-white/15 hover:bg-white/15" onClick={onSkip}>Open custom event</button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {EVENT_TEMPLATES.map((template) => {
          const pack = getPromptPack(template.promptPackSlug);
          const mode = getChallengePack(template.recommendedMode);
          const selected = draft.eventTemplateSlug === template.slug;
          return (
            <article className={cx("rounded-[1.35rem] border p-4 transition", selected ? "border-[#ffb9a8] bg-[#fff1ec] text-stone-950 shadow-[0_18px_44px_rgba(232,93,63,0.18)]" : "border-white/10 bg-white/5 hover:border-white/25")} key={template.slug}>
              <div className="flex items-start justify-between gap-3">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-[1rem]", selected ? "bg-stone-950 text-[#fff1ec]" : "bg-white/10 text-amber-200")}><Icon>{template.icon}</Icon></span>
                <span className={cx("rounded-full px-3 py-1 text-xs font-extrabold", selected ? "bg-stone-950 text-white" : "bg-white/10 text-amber-100")}>{selected ? "Selected" : template.badge}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">{template.name}</h3>
              <p className={cx("mt-2 text-sm", selected ? "text-stone-800" : "text-stone-300")}>{template.shortDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-extrabold">
                <span className={cx("rounded-full px-3 py-1", selected ? "bg-white/70 text-stone-800" : "bg-white/10 text-white")}>{mode.name}</span>
                <span className={cx("rounded-full px-3 py-1", selected ? "bg-white/70 text-stone-800" : "bg-white/10 text-white")}>{pack.name}</span>
              </div>
              <p className={cx("mt-3 text-xs font-semibold", selected ? "text-stone-800" : "text-stone-300")}>Best for: {template.bestFor}</p>
              <button type="button" className={cx("mt-4 min-h-10 w-full rounded-[1rem] px-4 py-2 text-sm font-extrabold", selected ? "bg-stone-950 text-white" : "bg-[#e85d3f] text-white hover:bg-[#d94f33]")} onClick={() => onSelect(template.slug)}>
                {selected ? "Selected" : "Start with this"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ChallengeSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isAwardEditorOpen, setIsAwardEditorOpen] = useState(false);
  const selectedPack = getChallengePack(draft.type);
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
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Choose an event mode</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#653e00]">{selectedPack.name}</h2>
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
              <span className="block text-xs font-bold uppercase tracking-wide text-amber-800">{pack.badge}</span>
              <span className="mt-2 block font-bold text-stone-950">{pack.name}</span>
              <span className="mt-1 block text-stone-600">{pack.shortDescription}</span>
              <span className="mt-3 inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">{pack.setupComplexity} setup</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Prompt pack library</p>
            <h3 className="mt-1 font-display text-lg font-bold">Swap in a polished prompt set</h3>
            <p className="mt-1 text-sm text-stone-600">Prompt packs work with Scavenger Hunt or Event Awards and can be edited immediately.</p>
          </div>
          {draft.promptPackSlug && <StatusPill tone="amber">{getPromptPack(draft.promptPackSlug).name}</StatusPill>}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {PROMPT_PACKS.filter((pack) => pack.kind !== "custom").map((pack) => (
            <button
              type="button"
              className={cx("rounded-2xl border p-4 text-left text-sm transition", draft.promptPackSlug === pack.slug ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white hover:border-amber-300")}
              onClick={() => selectPromptPack(pack.slug)}
              key={pack.slug}
            >
              <span className="block text-xs font-bold uppercase tracking-wide text-amber-800">{pack.kind === "award" ? "Event Awards" : "Scavenger Hunt"}</span>
              <span className="mt-2 block font-bold text-stone-950">{pack.name}</span>
              <span className="mt-1 block text-stone-600">{pack.description}</span>
              <span className="mt-3 block text-xs font-semibold text-stone-500">{pack.items.slice(0, 4).join(" / ")}</span>
            </button>
          ))}
        </div>
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

function LaunchKitCopyBlock({ title, value, onCopy }: { title: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-[1.25rem] border border-[#eadfce] bg-[#fffaf6] p-4">
      <p className="text-sm font-bold text-stone-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{value}</p>
      <SecondaryButton type="button" className="mt-3 min-h-10 px-4 py-2" onClick={onCopy}>Copy</SecondaryButton>
    </div>
  );
}

function LaunchKitLinkCard({ link, event }: { link: HostShareLinkCard; event: EventSummary }) {
  const [status, setStatus] = useState("");

  async function copyLink() {
    try {
      await copyText(link.copyText || link.url);
      setStatus(`${link.label} copied`);
      trackAnalytics(link.copyAnalyticsName, { eventId: event.id, eventSlug: event.slug, metadata: { surface: "launch_kit" } });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  async function shareLink() {
    try {
      await shareOrCopyText({
        title: `${event.name} on EventFilm`,
        text: link.shareText,
        url: link.url,
        fallbackLabel: link.label,
        onStatus: setStatus,
        analyticsName: link.shareAnalyticsName,
        eventId: event.id,
        eventSlug: event.slug,
        surface: "launch_kit",
      });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  function openLink() {
    if (link.key === "live-wall") trackAnalytics("live_wall_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "launch_kit" } });
    if (link.key === "recap") trackAnalytics("recap_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "launch_kit" } });
  }

  return (
    <div className={cx("rounded-[1.45rem] border p-4 shadow-[0_12px_30px_rgba(101,62,0,0.05)]", link.key === "guest" ? "border-[#ffd4c7] bg-[#fff3ee]" : "border-[#eadfce] bg-white")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-stone-950">{link.label}</p>
          <p className="mt-1 text-sm text-stone-600">{link.purpose}</p>
        </div>
        <StatusPill tone={link.key === "guest" ? "amber" : link.key === "live-wall" ? "green" : "stone"}>{link.timing}</StatusPill>
      </div>
      <div className="mt-4 grid gap-2 rounded-[1rem] bg-white/70 p-3 text-sm text-stone-700">
        <p><strong className="text-stone-950">Who:</strong> {link.audience}</p>
        <p><strong className="text-stone-950">When:</strong> {link.timing}</p>
      </div>
      <input className="mt-4 w-full rounded-[1rem] border border-[#eadfce] bg-white px-4 py-3 text-sm font-semibold text-stone-700" readOnly value={link.url} />
      <p className="mt-3 text-sm font-semibold text-stone-700">{link.instruction}</p>
      {status && <p className="mt-2 text-sm font-semibold text-amber-700">{status}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="min-h-10 px-4 py-2" onClick={shareLink}>Share</Button>
        {link.key !== "guest" && (
          <a className="inline-flex min-h-10 items-center justify-center rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white" href={link.url} target="_blank" rel="noreferrer" onClick={openLink}>Open</a>
        )}
        <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={copyLink}>Copy</SecondaryButton>
      </div>
    </div>
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

function HostLaunchKitPanel({ event, qrCodeDataUrl, compact = false }: { event: EventSummary; qrCodeDataUrl?: string; compact?: boolean }) {
  const kit: HostLaunchKit = buildHostLaunchKit(event);
  const assets: HostShareAssets = buildHostShareAssets(event);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    trackAnalytics("host_launch_kit_opened", { eventId: event.id, eventSlug: event.slug });
  }, [event.id, event.slug]);

  async function copyLaunchText(label: string, value: string) {
    try {
      await copyText(value);
      setCopyStatus(`${label} copied`);
    } catch (err) {
      setCopyStatus((err as Error).message);
    }
  }

  return (
    <Card className={cx("lg:p-8", compact && "shadow-none")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <StatusPill>Host launch kit</StatusPill>
          <h2 className="mt-4 font-display text-3xl font-bold text-stone-950">Everything to run {kit.eventName}</h2>
          <p className="mt-2 max-w-2xl text-stone-600">Poster, Guest Upload, Live Wall, and Recap each have one job. Keep them separate and hosting stays simple.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#e85d3f] px-4 py-2 text-sm font-bold text-white" to={assets.poster.posterPath}>View poster</Link>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#eadfce] bg-white px-4 py-2 text-sm font-bold text-stone-900" to={`${assets.poster.posterPath}?print=1`}>Print poster</Link>
          <StatusPill tone="stone">{assets.modeLabel}</StatusPill>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {kit.checklist.map((item, index) => (
          <div className={cx("rounded-[1.15rem] border p-3 text-sm font-bold", item.complete ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-[#eadfce] bg-[#fffaf6] text-stone-700")} key={item.key}>
            <span className="block text-xs uppercase tracking-wide opacity-70">Step {index + 1}</span>
            {item.label}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {assets.links.map((link) => <LaunchKitLinkCard key={link.key} link={link} event={event} />)}
      </div>

      <div className="mt-6 rounded-[1.45rem] border border-[#eadfce] bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#653e00]">Presenter displays</p>
            <h3 className="mt-2 font-display text-2xl font-bold text-stone-950">Open the right Live Wall for the room.</h3>
          </div>
          <StatusPill tone="green">{assets.liveWallDisplayLinks.length} modes</StatusPill>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {assets.liveWallDisplayLinks.map((link) => <LiveWallDisplayLinkCard key={link.key} link={link} event={event} />)}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <LaunchKitCopyBlock title="Guest invite text" value={assets.inviteText} onCopy={() => copyLaunchText("Guest invite", assets.inviteText)} />
        <LaunchKitCopyBlock title="Social story or post" value={assets.socialPostCopy} onCopy={() => copyLaunchText("Social copy", assets.socialPostCopy)} />
        <LaunchKitCopyBlock title="Live Wall display prompt" value={assets.liveWallDisplayPrompt} onCopy={() => copyLaunchText("Live Wall prompt", assets.liveWallDisplayPrompt)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[220px_1fr]">
        {qrCodeDataUrl && (
          <div className="rounded-3xl bg-stone-50 p-4">
            <img className="mx-auto h-48 w-48 rounded-2xl bg-white" src={qrCodeDataUrl} alt="Event QR code" />
            <SecondaryButton type="button" className="mt-4 w-full" onClick={() => downloadDataUrl(qrCodeDataUrl, `${safeFilename(event.name)}-qr.png`)}>Download QR</SecondaryButton>
          </div>
        )}
        <div className="rounded-[1.45rem] border border-[#ffd4c7] bg-[#fff3ee] p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-[#d94f33]">Mode instructions</p>
          <p className="mt-2 font-display text-xl font-bold text-[#653e00]">{assets.modeLabel}</p>
          <p className="mt-2 text-sm font-semibold text-amber-950">{assets.poster.challengeInstruction}</p>
          <p className="mt-3 text-sm font-semibold text-stone-700">{assets.recapShareText}</p>
          {copyStatus && <p className="mt-3 text-sm font-bold text-amber-800">{copyStatus}</p>}
        </div>
      </div>
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
        fallbackLabel: "Recap",
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

function PostEventSummaryPanel({ event, analytics }: { event: EventSummary & { photos: Photo[] }; analytics: EventAnalyticsSummary | null }) {
  const summary = buildPostEventHostSummary(event, event.photos, analytics || {});
  const hasTrend = summary.uploadsOverTime.length > 0;

  useEffect(() => {
    trackAnalytics("post_event_summary_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "event_detail" } });
  }, [event.id, event.slug]);

  return (
    <section id="post-event-summary" className="mt-8">
      <div className="mb-4">
        <StatusPill tone="plum">Post-event summary</StatusPill>
        <h2 className="mt-3 font-display text-3xl font-bold text-stone-950">What happened at this event?</h2>
        <p className="text-sm text-stone-600">A host-safe recap of activity, contributors, challenge progress, sharing, and moderation.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total photos" value={summary.totalPhotos} tone="accent" />
        <MetricCard label="Contributors" value={summary.totalContributors} />
        <MetricCard label="Guest joins" value={summary.guestJoins} tone="green" />
        <MetricCard label="Recap opens" value={summary.recapOpens} tone="plum" />
        <MetricCard label="Live Wall opens" value={summary.liveWallOpens} tone="green" />
        <MetricCard label="Hidden photos" value={summary.hiddenPhotos} />
        <MetricCard label="Reported photos" value={summary.reportedPhotos} />
        <MetricCard label="Featured photos" value={summary.featuredPhotos} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <h3 className="font-display text-2xl font-bold text-stone-950">Top contributors</h3>
          <p className="mt-1 text-sm text-stone-600">{summary.visiblePhotos} visible photos from named guests.</p>
          <div className="mt-4 grid gap-2">
            {summary.topContributors.length ? summary.topContributors.map((contributor) => (
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-sm font-bold" key={contributor.displayName}>
                <span>{contributor.displayName}</span>
                <span className="text-[#653e00]">{contributor.photoCount}</span>
              </div>
            )) : <p className="rounded-2xl bg-stone-50 p-3 text-sm font-semibold text-stone-600">No named contributors yet.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="font-display text-2xl font-bold text-stone-950">Uploads over time</h3>
          <div className="mt-4 grid gap-3">
            {hasTrend ? summary.uploadsOverTime.map((bucket) => {
              const max = Math.max(...summary.uploadsOverTime.map((item) => item.count), 1);
              return (
                <div key={bucket.label}>
                  <div className="flex justify-between text-sm font-bold text-stone-700"><span>{bucket.label}</span><span>{bucket.count}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#e85d3f]" style={{ width: `${Math.max(8, Math.round((bucket.count / max) * 100))}%` }} /></div>
                </div>
              );
            }) : <p className="rounded-2xl bg-stone-50 p-3 text-sm font-semibold text-stone-600">No upload trend yet.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="font-display text-2xl font-bold text-stone-950">Challenge completion</h3>
          <p className="mt-1 text-sm font-semibold text-stone-600">{summary.challengeCompletion.modeLabel}</p>
          <div className="mt-4 grid gap-2">
            {summary.challengeCompletion.rows.length ? summary.challengeCompletion.rows.slice(0, 5).map((row) => (
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-sm font-bold" key={row.id}>
                <span className="truncate">{row.label}</span>
                <span className={row.complete ? "text-emerald-700" : "text-stone-500"}>{row.count}{row.total ? `/${row.total}` : ""}</span>
              </div>
            )) : <p className="rounded-2xl bg-stone-50 p-3 text-sm font-semibold text-stone-600">Classic album mode collected photos without challenge steps.</p>}
          </div>
        </Card>
      </div>
      {summary.awardWinners.length ? (
        <Card className="mt-5">
          <h3 className="font-display text-2xl font-bold text-stone-950">Event Awards winners</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.awardWinners.map((winner) => (
              <div className="rounded-2xl bg-[#fffaf6] p-4" key={winner.categoryId}>
                <p className="font-bold text-stone-950">{winner.categoryLabel}</p>
                <p className="mt-1 text-sm font-semibold text-stone-600">{winner.photoId ? `${winner.voteCount} ${winner.voteCount === 1 ? "vote" : "votes"}` : "No winner yet"}{winner.isTie ? " - tie" : ""}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </section>
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
          <section className="poster-sheet overflow-hidden rounded-[2rem] bg-[#fffaf2] p-8 text-stone-950 shadow-[0_28px_90px_rgba(101,62,0,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-2xl font-bold text-[#653e00]">{assets.poster.brandLine}</p>
              <div className="flex flex-wrap justify-end gap-2">
                {assets.poster.templateBadge ? <span className="rounded-full bg-[#ffe0b7] px-4 py-2 text-sm font-extrabold text-[#653e00]">{assets.poster.templateBadge}</span> : null}
                <span className="rounded-full bg-stone-950 px-4 py-2 text-sm font-extrabold text-white">{assets.poster.modeBadge}</span>
              </div>
            </div>
            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-center">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-wide text-[#d94f33]">{assets.poster.noDownloadCopy}</p>
                <h1 className="mt-4 font-display text-5xl font-black leading-tight text-stone-950 lg:text-7xl">{assets.poster.title}</h1>
                <p className="mt-6 font-display text-3xl font-bold text-[#653e00]">{assets.poster.instruction}</p>
                {assets.poster.challengeInstruction ? <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-stone-700">{assets.poster.challengeInstruction}</p> : null}
              </div>
              <div className="rounded-[1.75rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_50px_rgba(101,62,0,0.09)]">
                {event.qrCodeDataUrl ? <img className="aspect-square w-full rounded-[1.25rem] bg-white" src={event.qrCodeDataUrl} alt="Guest upload QR code" /> : null}
                <p className="mt-4 break-all rounded-[1rem] bg-[#fff3ee] p-3 text-center text-sm font-extrabold text-[#653e00]">{assets.poster.guestLink}</p>
              </div>
            </div>
            <div className="mt-10 rounded-[1.5rem] border border-[#ffd4c7] bg-white/70 p-5">
              <p className="text-sm font-bold uppercase tracking-wide text-[#d94f33]">Invite copy</p>
              <p className="mt-2 text-xl font-bold leading-8 text-stone-800">{assets.poster.inviteText}</p>
            </div>
          </section>

          <aside className="poster-actions grid content-start gap-3">
            <Card>
              <h2 className="font-display text-2xl font-bold">Poster actions</h2>
              <p className="mt-2 text-sm text-stone-600">Use browser print to save as PDF or send to a printer. Standalone poster image export is intentionally out of scope for this pass.</p>
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
            Collect every moment. <span className="text-[#d94f33]">Relive what matters.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg lg:mx-0">
            Create an event, share one QR code, collect guest uploads, show a Live Wall, and send a polished recap when the reveal is ready.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[1.15rem] bg-[#e85d3f] px-7 py-4 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(232,93,63,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d94f33]" to="/signup" onClick={() => trackCta("Create your first event")}>
              Create your first event
              <Icon>arrow_forward</Icon>
            </Link>
            <a className="inline-flex min-h-13 items-center justify-center rounded-[1.15rem] border border-[#d5c4b2] bg-white px-7 py-4 text-sm font-extrabold text-[#653e00] shadow-[0_10px_24px_rgba(101,62,0,0.06)] transition hover:-translate-y-0.5 hover:border-[#e85d3f] hover:bg-[#fff7f1]" href="#demo" onClick={() => trackCta("View demo")}>
              View demo
            </a>
          </div>
          <div className="mt-7 grid gap-3 text-sm font-bold text-stone-700 sm:grid-cols-3">
            <p className="rounded-[1.15rem] border border-[#eadfce] bg-white/80 p-3">Guest Upload</p>
            <p className="rounded-[1.15rem] border border-[#eadfce] bg-white/80 p-3">Live Wall</p>
            <p className="rounded-[1.15rem] border border-[#eadfce] bg-white/80 p-3">Recap</p>
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
              Scan to join
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-stone-200 py-14">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">How it works</h2>
          <p className="mt-3 text-stone-600">One clean host flow from setup to final memory page.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Create an event", "Name it, set timing, and choose how guests should participate."],
            ["Share the QR code", "Put one code where guests already are: invite, table, screen, or group chat."],
            ["Guests upload photos", "Guests open the link in a browser and upload without making an account."],
            ["Show the Live Wall", "Open it on a laptop, TV, projector, or iPad during the event."],
            ["Share the recap", "Send the polished album story after the reveal time."],
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
              <StatusPill>{pack.badge}</StatusPill>
              <h3 className="mt-4 font-display text-xl font-bold text-stone-950">{pack.name}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{pack.shortDescription}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">{pack.bestFor}</p>
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
            ["Is this a legal privacy policy?", "No. The trust pages use simple beta copy and placeholders Fernando should finalize before a broad public launch."],
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
          <Link className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#653e00] px-7 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#855300]" to="/signup" onClick={() => trackCta("Create your first event bottom")}>Create your first event</Link>
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
    return <div className="h-36 bg-gradient-to-br from-amber-200 via-white to-[#ffdbd1]" />;
  }

  const stripPhotos = photos.length > 1 ? Array.from({ length: 4 }, () => photos).flat() : photos;

  return (
    <div className="relative h-36 overflow-hidden bg-[#f8f3ea]">
      <div className="absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#f8f3ea] to-transparent" />
      <div className="absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#f8f3ea] to-transparent" />
      <div
        className={cx("event-photo-strip-track flex h-full items-center gap-3 px-5", photos.length === 1 && "justify-center")}
        style={
          photos.length > 1
            ? {
                animationDuration: `${Math.max(photos.length * 4, 18)}s`,
                "--strip-shift": `${100 / 4}%`,
              } as React.CSSProperties
            : { animation: "none", width: "100%" }
        }
      >
        {stripPhotos.map((photo, index) => (
          <div className="event-photo-strip-frame h-28 w-22 shrink-0 overflow-hidden rounded-xl bg-white p-1.5 shadow-sm" key={`${photo.id}-${index}`}>
            <img
              className="h-full w-full rounded-lg object-cover"
              src={photo.previewUrl || photo.url}
              alt={`${eventName} upload preview ${index % photos.length + 1}`}
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const auth = useAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const previewLoadIds = useRef(new Set<string>());

  useEffect(() => {
    trackAnalytics("host_dashboard_opened");
    api<{ events: EventSummary[] }>("/api/host/events", { token: auth.token })
      .then((data) => setEvents(data.events))
      .catch((err) => setError((err as Error).message));
    eventFilmApi
      .getAnalyticsSummary(auth.token)
      .then((data) => setAnalyticsSummary(data.summary))
      .catch(() => {});
  }, [auth.token]);

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

  const liveEvents = events.filter((event) => deriveEventLifecycleStatus(event).phase !== "after").length;
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);

  return (
    <Shell wide>
      <div className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white shadow-[0_28px_80px_rgba(101,62,0,0.18)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <StatusPill>Host command center</StatusPill>
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-5xl">Plan it. Share it. Keep the album moving.</h1>
            <p className="mt-3 max-w-2xl text-stone-200">{auth.user?.email}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15" to="/dashboard/founder">Founder ops</Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15" to="/dashboard/beta-readiness">Beta readiness</Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400" to="/dashboard/events/new">Create event</Link>
          </div>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <MetricCard label="Live events" value={liveEvents} tone="green" />
        <MetricCard label="Total events" value={events.length} />
        <MetricCard label="Total photos" value={totalPhotos} tone="accent" />
      </div>
      {analyticsSummary && (
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="font-display text-2xl font-bold">Launch signals</h2>
            <p className="text-sm text-stone-600">Privacy-conscious usage signals from your events and recent product activity.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Guest joins", analyticsSummary.guestJoins],
              ["Uploads", analyticsSummary.uploads],
              ["Live Wall opens", analyticsSummary.liveWallOpens],
              ["Recap opens", analyticsSummary.recapOpens],
              ["Active hosts", analyticsSummary.activeHosts],
              ["Active guests", analyticsSummary.activeGuests],
            ].map(([label, value], index) => (
              <MetricCard key={label} label={String(label)} value={String(value)} tone={index === 2 ? "green" : index === 3 ? "plum" : "default"} />
            ))}
          </div>
        </section>
      )}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-display text-2xl font-bold">Your events</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {events.map((event) => (
            <div className="overflow-hidden rounded-[1.65rem] border border-[#eadfce] bg-white shadow-[0_18px_54px_rgba(101,62,0,0.075)] transition hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(232,93,63,0.12)]" key={event.id}>
              <Link className="group block" to={`/dashboard/events/${event.id}`}>
                <EventPhotoBanner photos={event.previewPhotos || []} eventName={event.name} />
              </Link>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <LifecycleBadge lifecycle={deriveEventLifecycleStatus(event)} />
                    <Link to={`/dashboard/events/${event.id}`}><h3 className="mt-3 font-display text-xl font-bold text-stone-950">{event.name}</h3></Link>
                    <p className="mt-1 text-sm text-stone-600">Event: {formatDateTime(event.eventDate)}</p>
                    <p className="text-sm text-stone-600">Reveal: {formatDateTime(event.revealAt)}</p>
                  </div>
                  <div className="rounded-[1.15rem] bg-[#fff3ee] px-4 py-3 text-center">
                    <p className="font-display text-2xl font-bold text-[#d94f33]">{event.photoCount}</p>
                    <p className="text-xs font-bold uppercase text-stone-500">Photos</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-600">{deriveEventLifecycleStatus(event).description}</p>
                <RepeatEventActions event={event} lifecycle={deriveEventLifecycleStatus(event)} compact onDuplicated={(created) => setEvents((current) => [created, ...current])} />
              </div>
            </div>
          ))}
        </div>
        {!events.length && (
          <Card className="bg-[#fffaf3] text-center">
            <StatusPill>First event</StatusPill>
            <h3 className="mt-4 font-display text-2xl font-bold">Create your first EventFilm album</h3>
            <p className="mx-auto mt-2 max-w-xl text-stone-600">Start with the event name and reveal time. EventFilm will give you a guest link and QR code right after setup.</p>
            <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950" to="/dashboard/events/new">Create event</Link>
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
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    description: "",
    eventDate: toDateTimeLocal(),
    revealAt: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    photoLimitPerGuest: "10",
  });
  const [created, setCreated] = useState<EventSummary | null>(null);
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [error, setError] = useState("");

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
      setCreated(data.event);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (created) {
    return (
      <Shell>
        <div className="mx-auto max-w-5xl">
          <HostLaunchKitPanel event={created} qrCodeDataUrl={created.qrCodeDataUrl} />
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white" to={`/dashboard/events/${created.id}/poster`}>View poster</Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900" to={`/dashboard/events/${created.id}/poster?print=1`}>Print poster</Link>
            <SecondaryButton onClick={() => navigate(`/dashboard/events/${created.id}`)}>Manage event</SecondaryButton>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold text-stone-950">Create your event.</h1>
        <p className="mt-3 text-lg text-stone-600">Choose a template, set the reveal, and get the QR, Live Wall, and Recap links in one place.</p>
      </div>
      <form className="mx-auto mt-8 grid max-w-3xl gap-5 rounded-[1.75rem] border border-[#eadfce] bg-white p-6 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-8" onSubmit={submit}>
        <TemplateLibrary draft={challengeDraft} onSelect={selectTemplate} onSkip={skipTemplate} />
        <section className="grid gap-5 rounded-[1.45rem] bg-[#fffaf6] p-5">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-950">Event details</h2>
            <p className="mt-1 text-sm text-stone-600">Use names and copy guests will recognize at a glance.</p>
          </div>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Event name
            <TextInput value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Mia's graduation cookout" required />
          </label>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Description
            <TextArea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Tell guests what this album is for." />
          </label>
        </section>
        <section className="grid gap-5 rounded-[1.45rem] bg-[#fffaf6] p-5">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-950">Timing and limits</h2>
            <p className="mt-1 text-sm text-stone-600">The reveal controls when guests can browse the album.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Event date
            <TextInput type="datetime-local" value={form.eventDate} onChange={(event) => update("eventDate", event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Reveal date/time
            <TextInput type="datetime-local" value={form.revealAt} onChange={(event) => update("revealAt", event.target.value)} required />
          </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-stone-700">
            Photo limit per guest
            <TextInput type="number" min="1" value={form.photoLimitPerGuest} onChange={(event) => update("photoLimitPerGuest", event.target.value)} required />
          </label>
        </section>
        <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} />
        <div className="rounded-[1.45rem] bg-[#fff3ee] p-5">
          <h2 className="font-display text-xl font-bold text-[#653e00]">After create</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="rounded-2xl bg-white p-4 text-sm text-stone-600"><strong className="block text-stone-950">QR upload</strong> Guests scan a QR code to upload photos.</p>
            <p className="rounded-2xl bg-white p-4 text-sm text-stone-600"><strong className="block text-stone-950">Reveal lock</strong> Photos stay private until the reveal time.</p>
          </div>
        </div>
        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="w-full sm:justify-self-end sm:px-12">Create event</Button>
      </form>
    </Shell>
  );
}

function ManageEvent() {
  const { eventId } = useParams();
  const auth = useAuth();
  const [event, setEvent] = useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(() => createEmptyChallengeDraft());
  const [galleryFilter, setGalleryFilter] = useState("all");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalyticsSummary | null>(null);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [error, setError] = useState("");
  const [challengeStatus, setChallengeStatus] = useState("");

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

  return (
    <Shell wide>
      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {event && (
        <>
          <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <StatusPill>Live event dashboard</StatusPill>
              {lifecycle ? <span className="ml-2"><LifecycleBadge lifecycle={lifecycle} /></span> : null}
              <h1 className="mt-3 font-display text-4xl font-bold text-stone-950">{event.name}</h1>
              {lifecycle ? <p className="mt-2 max-w-2xl text-sm font-semibold text-stone-600">{lifecycle.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">calendar_today</Icon>{formatDateTime(event.eventDate)}</span>
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">photo_library</Icon>{event.photoCount} photos</span>
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">lock</Icon>Reveal: {formatDateTime(event.revealAt)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm" to="/dashboard/events/new">Create event</Link>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#e85d3f] px-5 py-3 text-sm font-bold text-white shadow-sm" to={`/dashboard/events/${event.id}/poster`}>View poster</Link>
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#eadfce] bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm" to={`/dashboard/events/${event.id}/poster?print=1`}>Print poster</Link>
            </div>
          </section>

          <section className="mt-8">
            <HostLaunchKitPanel event={event} qrCodeDataUrl={event.qrCodeDataUrl} />
            {lifecycle ? <div className="mt-5"><RepeatEventActions event={event} lifecycle={lifecycle} /></div> : null}
            <div className="mt-4 grid gap-3 rounded-3xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <p className="text-sm font-semibold text-stone-600">Visible export excludes hidden and reported photos by default.</p>
              <SecondaryButton onClick={() => downloadZip("visible")}>Download visible ZIP</SecondaryButton>
              <SecondaryButton onClick={() => downloadZip("all")}>Download all ZIP</SecondaryButton>
            </div>
            {downloadStatus && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-bold text-green-700">{downloadStatus}</p>}
          </section>

          {eventAnalytics && (
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="font-display text-2xl font-bold">Event signal</h2>
                <p className="text-sm text-stone-600">Compact host-owned activity across guest, wall, recap, and moderation.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Guest joins", eventAnalytics.guestJoins],
                  ["Uploads", eventAnalytics.uploads],
                  ["Live Wall opens", eventAnalytics.liveWallOpens],
                  ["Recap opens", eventAnalytics.recapOpens],
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
                    <h3 className="font-display text-2xl font-bold text-stone-950">Contributor summary</h3>
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
            </section>
          )}

          {lifecycle?.phase === "after" ? (
            <>
              <PostEventSummaryPanel event={event} analytics={eventAnalytics} />
              <HostFeedbackPanel event={event} analytics={eventAnalytics} onSubmitted={load} />
            </>
          ) : null}

          <section className="mt-8">
            <Card className="lg:p-8">
              <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} />
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-800">{event.challenge ? `${challengeLabel(event.challenge)} is active for this event.` : "Normal EventFilm albums still work without a challenge."}</p>
                  {challengeStatus && <p className="mt-1 text-sm font-semibold text-amber-700">{challengeStatus}</p>}
                </div>
                <Button onClick={saveChallenge}>Save challenge</Button>
              </div>
            </Card>
          </section>

          <section className="mt-10">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-3xl font-bold">Recent uploads</h2>
                <p className="text-stone-600">Feature favorites, hide anything off-tone, and keep public views clean.</p>
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
                    <div className="mt-3 grid gap-2">
                      {photo.visibilityStatus === "HIDDEN" ? (
                        <SecondaryButton className="min-h-10 rounded-[0.95rem] px-4 py-2" onClick={() => updatePhotoVisibility(photo, "VISIBLE")}>Restore</SecondaryButton>
                      ) : (
                        <SecondaryButton className="min-h-10 rounded-[0.95rem] px-4 py-2" onClick={() => updatePhotoVisibility(photo, "HIDDEN")}>Hide</SecondaryButton>
                      )}
                      <button className={cx("min-h-10 rounded-[0.95rem] px-4 py-2 text-sm font-extrabold", photo.isFeatured ? "bg-stone-950 text-white" : "bg-[#fff0d8] text-[#653e00]")} onClick={() => updatePhotoFeatured(photo, !photo.isFeatured)} disabled={photo.visibilityStatus === "HIDDEN"}>
                        {photo.isFeatured ? "Unfeature" : "Feature"}
                      </button>
                      <button className="min-h-10 rounded-[0.95rem] bg-red-50 px-4 py-2 text-sm font-extrabold text-red-800 ring-1 ring-red-100" onClick={() => deletePhoto(photo.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!filteredPhotos.length && <Card className="text-center"><p className="font-semibold text-stone-600">No photos match this view yet.</p></Card>}
          </section>
          <PhotoDetailModal photo={selectedPhoto} mode="host" onClose={() => setSelectedPhoto(null)} onHostAction={handleHostPhotoAction} />
        </>
      )}
    </Shell>
  );
}

function ProgressSummaryPanel({ summary, dark = false }: { summary: ReturnType<typeof buildChallengeProgressSummary>; dark?: boolean }) {
  const hasRows = summary.rows.length > 0;
  return (
    <section className={cx("rounded-[2rem] p-5", dark ? "bg-white/10 text-white" : "border border-[#eadfce] bg-white shadow-[0_24px_70px_rgba(101,62,0,0.08)]")}>
      <p className={cx("text-sm font-bold uppercase tracking-wide", dark ? "text-amber-200" : "text-[#653e00]")}>{summary.modeLabel}</p>
      <h2 className={cx("mt-2 font-display text-2xl font-bold", dark ? "text-white" : "text-stone-950")}>Challenge progress</h2>
      <p className={cx("mt-2 text-sm", dark ? "text-stone-200" : "text-stone-600")}>{summary.instructions}</p>
      {!hasRows && <p className={cx("mt-5 rounded-2xl p-4 text-sm font-semibold", dark ? "bg-white/10 text-stone-100" : "bg-stone-50 text-stone-700")}>Photos are collected as one shared album for this mode.</p>}
      {hasRows && (
        <div className="mt-5 grid gap-3">
          {summary.rows.map((row) => {
            const percent = row.total ? Math.min(100, Math.round((row.count / row.total) * 100)) : Math.min(100, row.count * 20);
            return (
              <div className={cx("rounded-2xl p-4", dark ? "bg-white/10" : "bg-stone-50")} key={row.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {row.colorHex && <span className="h-4 w-4 shrink-0 rounded-full border border-white/40" style={{ backgroundColor: row.colorHex }} />}
                    <p className={cx("truncate text-sm font-bold", dark ? "text-white" : "text-stone-900")}>{row.label}</p>
                  </div>
                  <p className={cx("shrink-0 text-sm font-bold tabular-nums", dark ? "text-amber-200" : "text-[#653e00]")}>{row.count}{row.total ? `/${row.total}` : ""}</p>
                </div>
                <div className={cx("mt-3 h-2 overflow-hidden rounded-full", dark ? "bg-white/15" : "bg-stone-200")}>
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${row.count > 0 ? Math.max(percent, 8) : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PhotoMosaic({ photos, dark = false, onPhotoClick }: { photos: Photo[]; dark?: boolean; onPhotoClick?: (photo: Photo) => void }) {
  if (!photos.length) {
    return (
      <div className={cx("grid min-h-72 place-items-center rounded-[2rem] p-8 text-center", dark ? "bg-white/10 text-stone-200" : "border border-[#eadfce] bg-white text-stone-600")}>
        <div>
          <p className={cx("font-display text-2xl font-bold", dark ? "text-white" : "text-stone-950")}>No uploads yet</p>
          <p className="mt-2 text-sm">Once guests start adding photos, the newest moments will appear here.</p>
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

  const event = data?.event;
  const challengeSummary = event ? buildLiveWallChallengeDisplaySummary(event.challenge, data.photos, data.awardVoting) : null;
  const contributors = data ? buildContributorSummary(data.photos) : null;
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const displayLinks = event ? buildLiveWallDisplayLinks(event) : [];
  const availableModes = displayLinks.map((link) => link.key);
  const activeMode = availableModes.includes(mode) ? mode : "grid";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#12100d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(232,93,63,0.24),transparent_32%),linear-gradient(135deg,rgba(255,240,216,0.08),transparent_45%)]" />
      {!event && (
        <div className="relative grid min-h-screen place-items-center p-8">
          <div className="max-w-xl text-center">
            <LiveDemoPill />
            <h1 className="mt-5 font-display text-5xl font-bold">Preparing Live Wall</h1>
            <p className="mt-3 text-stone-300">{error || "Loading the latest event photos..."}</p>
          </div>
        </div>
      )}
      {event && (
        <div className="relative grid min-h-screen gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-0 flex-col gap-5">
            <LiveWallHero event={event} mode={activeMode} lastUpdated={lastUpdated} />
            <LiveWallControls
              mode={activeMode}
              availableModes={availableModes}
              showQr={showQr}
              paused={slideshowPaused}
              isFullscreen={isFullscreen}
              onModeChange={switchMode}
              onToggleQr={() => setShowQr((value) => !value)}
              onToggleSlideshow={toggleSlideshow}
              onFullscreen={enterFullscreen}
            />
            <section className="min-h-0 flex-1">
              {data.isLocked ? (
                <LiveWallLockedState title={capsuleCopy?.revealTitle || "The album is locked"} note={capsuleCopy?.revealNote || "Photos are hidden until the reveal time."} />
              ) : activeMode === "slideshow" ? (
                <LiveWallSlideshow photos={data.photos} slideIndex={slideIndex} event={event} paused={slideshowPaused} />
              ) : activeMode === "join" ? (
                <LiveWallJoinMode data={data} photoCount={data.photos.length} contributors={contributors?.contributorCount || 0} />
              ) : activeMode === "challenge" ? (
                <LiveWallChallengeMode summary={challengeSummary} awardVoting={data.awardVoting} photos={data.photos} />
              ) : activeMode === "awards" ? (
                <LiveWallAwardsMode awardVoting={data.awardVoting} photos={data.photos} />
              ) : (
                <LiveWallGridMode photos={data.photos} />
              )}
            </section>
          </section>

          <LiveWallSideRail
            data={data}
            summary={challengeSummary}
            contributors={contributors?.contributorCount || 0}
            showQr={showQr}
            error={error}
            onRefresh={() => load().catch((err) => setError(publicRouteErrorMessage(err, "Live Wall is not available right now. Check the event link or refresh in a moment.")))}
          />
        </div>
      )}
    </main>
  );
}

function LiveWallHero({ event, mode, lastUpdated }: { event: PublicEvent; mode: LiveWallMode; lastUpdated: Date | null }) {
  const modeLabels: Record<LiveWallMode, string> = {
    grid: "Live Wall",
    slideshow: "Slideshow",
    join: "QR Join Display",
    challenge: "Challenge Display",
    awards: "Event Awards",
  };

  return (
    <header className="rounded-[1.45rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_26px_80px_rgba(0,0,0,0.24)] backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveDemoPill />
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-100 ring-1 ring-white/10">{modeLabels[mode]}</span>
            {event.challenge ? <span className="rounded-full bg-[#fff0d8] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#7c3f00]">{challengeLabel(event.challenge)}</span> : null}
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-white md:text-5xl xl:text-6xl">{event.name}</h1>
          <p className="mt-3 max-w-4xl text-base font-semibold text-stone-200 md:text-lg">{event.description || "Scan, upload, and watch the event story grow in real time."}</p>
        </div>
        <div className="grid gap-1 text-xs font-extrabold uppercase tracking-wide text-stone-300 sm:grid-cols-3 xl:grid-cols-1 xl:text-right">
          <span>Event {formatDateTime(event.eventDate)}</span>
          <span>Reveal {formatDateTime(event.revealAt)}</span>
          {lastUpdated ? <span>Updated {lastUpdated.toLocaleTimeString()}</span> : null}
        </div>
      </div>
    </header>
  );
}

function LiveWallLockedState({ title, note }: { title: string; note: string }) {
  return (
    <section className="grid h-full min-h-[22rem] place-items-center rounded-[1.45rem] border border-amber-200/20 bg-[#fff0d8] p-6 text-center text-amber-950 shadow-[0_26px_80px_rgba(0,0,0,0.22)]">
      <div className="max-w-3xl">
        <Icon className="mx-auto h-16 w-16">lock</Icon>
        <h2 className="mt-5 font-display text-4xl font-bold md:text-5xl">{title}</h2>
        <p className="mt-4 text-lg font-semibold md:text-xl">{note}</p>
      </div>
    </section>
  );
}

function LiveWallGridMode({ photos }: { photos: Photo[] }) {
  if (!photos.length) return <LiveWallEmptyState title="No uploads yet" note="Keep the QR display open so guests can add the first photos." />;
  const displayPhotos = photos.slice(0, 14);
  return (
    <div className="grid h-full min-h-[22rem] auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
      {displayPhotos.map((photo, index) => (
        <figure
          className={cx(
            "relative min-h-40 overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/10 shadow-[0_18px_52px_rgba(0,0,0,0.26)]",
            index === 0 && "col-span-2 row-span-2",
            index === 5 && "md:col-span-2",
            index === 8 && "xl:row-span-2",
          )}
          key={photo.id}
        >
          <img className="h-full min-h-40 w-full object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent p-4">
            <p className="truncate text-sm font-extrabold text-white">{photo.guestNickname || "Guest photo"}</p>
            {photoChallengeLabel(photo) ? <p className="mt-1 truncate text-xs font-bold text-amber-100">{photoChallengeLabel(photo)}</p> : null}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function LiveWallSlideshow({ photos, slideIndex, event, paused }: { photos: Photo[]; slideIndex: number; event: PublicEvent; paused: boolean }) {
  if (!photos.length) return <LiveWallEmptyState title="Slideshow waiting" note="Once guests upload visible photos, this screen will rotate through the newest moments." />;
  const photo = photos[slideIndex % photos.length] || photos[0];
  return (
    <section className="relative h-full min-h-[22rem] overflow-hidden rounded-[1.45rem] border border-white/10 bg-black shadow-[0_26px_80px_rgba(0,0,0,0.28)]">
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

function LiveWallJoinMode({ data, photoCount, contributors }: { data: LiveWallResponse; photoCount: number; contributors: number }) {
  return (
    <section className="grid h-full min-h-[22rem] gap-4 rounded-[1.45rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_26px_80px_rgba(0,0,0,0.24)] lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid place-items-center rounded-[1.35rem] bg-[#fff0d8] p-8 text-center text-amber-950">
        <div className="max-w-2xl">
          <Icon className="mx-auto h-16 w-16">qr_code_2</Icon>
          <h2 className="mt-5 font-display text-4xl font-bold md:text-5xl">Scan to upload</h2>
          <p className="mt-4 text-lg font-semibold md:text-xl">No account. No app download. Add your photos from any browser.</p>
          <p className="mt-6 break-all rounded-[1rem] bg-white/75 px-5 py-4 text-base font-extrabold text-stone-800">{data.eventLink}</p>
        </div>
      </div>
      <div className="grid content-center gap-4">
        {data.qrCodeDataUrl ? <img className="aspect-square w-full rounded-[1.35rem] bg-white p-3 shadow-[0_24px_70px_rgba(0,0,0,0.22)]" src={data.qrCodeDataUrl} alt="Guest upload QR code" /> : null}
        <div className="grid grid-cols-2 gap-3">
          <LiveWallMetric label="Photos live" value={photoCount} />
          <LiveWallMetric label="Contributors" value={contributors || "Guest"} />
        </div>
      </div>
    </section>
  );
}

function LiveWallChallengeMode({ summary, awardVoting, photos }: { summary: ReturnType<typeof buildLiveWallChallengeDisplaySummary> | null; awardVoting?: AwardVotingSummary | null; photos: Photo[] }) {
  if (!summary) return <LiveWallEmptyState title="Challenge display" note="Challenge progress will appear here once the event is ready." />;
  return (
    <section className="grid h-full min-h-[22rem] gap-4 rounded-[1.45rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_26px_80px_rgba(0,0,0,0.24)] xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-[1.35rem] bg-[#fff0d8] p-6 text-amber-950">
        <p className="text-sm font-extrabold uppercase tracking-wide text-[#7c3f00]">{summary.modeLabel}</p>
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
  if (!awardVoting?.categories.length) return <LiveWallEmptyState title="Awards waiting" note="Event Awards leaders will appear once there are categories, submissions, or votes." />;
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  return (
    <section className="h-full min-h-[22rem] rounded-[1.45rem] border border-white/10 bg-[#fff0d8] p-4 text-amber-950 shadow-[0_26px_80px_rgba(0,0,0,0.24)]">
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

function LiveWallEmptyState({ title, note }: { title: string; note: string }) {
  return (
    <section className="grid h-full min-h-[22rem] place-items-center rounded-[1.45rem] border border-white/10 bg-white/[0.08] p-6 text-center shadow-[0_26px_80px_rgba(0,0,0,0.24)]">
      <div className="max-w-2xl">
        <Icon className="mx-auto h-16 w-16 text-amber-200">photo_library</Icon>
        <h2 className="mt-5 font-display text-4xl font-bold text-white md:text-5xl">{title}</h2>
        <p className="mt-4 text-lg font-semibold text-stone-200">{note}</p>
      </div>
    </section>
  );
}

function LiveWallSideRail({ data, summary, contributors, showQr, error, onRefresh }: { data: LiveWallResponse; summary: ReturnType<typeof buildLiveWallChallengeDisplaySummary> | null; contributors: number; showQr: boolean; error: string; onRefresh: () => void }) {
  return (
    <aside className="grid content-start gap-4">
      {showQr ? (
        <section className="rounded-[1.45rem] bg-white p-5 text-stone-950 shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
          <p className="text-sm font-extrabold uppercase tracking-wide text-[#653e00]">Scan to upload</p>
          {data.qrCodeDataUrl ? <img className="mt-4 aspect-square w-full rounded-[1.1rem] bg-white p-2" src={data.qrCodeDataUrl} alt="Guest upload QR code" /> : null}
          <p className="mt-4 break-all rounded-[1rem] bg-stone-50 p-3 text-sm font-semibold text-stone-700">{data.eventLink}</p>
        </section>
      ) : null}
      <section className="rounded-[1.45rem] bg-[#e85d3f] p-5 text-white shadow-[0_24px_70px_rgba(232,93,63,0.18)]">
        <p className="text-sm font-extrabold uppercase tracking-wide">Live count</p>
        <p className="mt-2 font-display text-6xl font-bold tabular-nums">{data.photos.length}</p>
        <p className="text-sm font-bold">photos uploaded</p>
        <p className="mt-2 text-sm font-bold">{contributors || "Guest"} {contributors === 1 ? "contributor" : "contributors"}</p>
        {error ? <p className="mt-4 rounded-[1rem] bg-red-100 p-3 text-sm font-bold text-red-800">{error}</p> : null}
        <button className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-[0.85rem] bg-white px-4 py-2 text-sm font-bold text-[#d94f33]" type="button" onClick={onRefresh}>Refresh now</button>
      </section>
      {summary ? (
        <section className="rounded-[1.45rem] bg-white/10 p-5 text-white">
          <p className="text-sm font-extrabold uppercase tracking-wide text-amber-200">{summary.modeLabel}</p>
          <h2 className="mt-2 font-display text-2xl font-bold">{summary.headline}</h2>
          <p className="mt-2 text-sm font-semibold text-stone-200">{summary.note}</p>
          {summary.rows.length ? (
            <div className="mt-4 grid gap-2">
              {summary.rows.slice(0, 4).map((row) => <LiveWallProgressRow key={row.id} row={row} compact />)}
            </div>
          ) : null}
        </section>
      ) : null}
      <AwardLeadersPanel awardVoting={data.awardVoting} photos={data.photos} dark />
    </aside>
  );
}

function LiveWallMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[1rem] bg-white/10 p-4 text-white">
      <p className="text-xs font-extrabold uppercase tracking-wide text-amber-100">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
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
  showQr,
  paused,
  isFullscreen,
  onModeChange,
  onToggleQr,
  onToggleSlideshow,
  onFullscreen,
}: {
  mode: LiveWallMode;
  availableModes: LiveWallMode[];
  showQr: boolean;
  paused: boolean;
  isFullscreen: boolean;
  onModeChange: (mode: LiveWallMode) => void;
  onToggleQr: () => void;
  onToggleSlideshow: () => void;
  onFullscreen: () => void;
}) {
  const labels: Record<LiveWallMode, string> = {
    grid: "Grid",
    slideshow: "Slideshow",
    join: "Join",
    challenge: "Challenge",
    awards: "Awards",
  };

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2 rounded-[1rem] border border-white/10 bg-black/55 p-2 shadow-[0_18px_52px_rgba(0,0,0,0.32)] backdrop-blur">
      {availableModes.map((item) => (
        <button
          className={cx("min-h-10 rounded-[0.75rem] px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition", mode === item ? "bg-[#fff0d8] text-[#653e00]" : "bg-white/10 text-white hover:bg-white/15")}
          type="button"
          onClick={() => onModeChange(item)}
          key={item}
        >
          {labels[item]}
        </button>
      ))}
      <button className="min-h-10 rounded-[0.75rem] bg-white/10 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white hover:bg-white/15" type="button" onClick={onToggleQr}>{showQr ? "Hide QR" : "Show QR"}</button>
      <button className="min-h-10 rounded-[0.75rem] bg-white/10 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white hover:bg-white/15" type="button" onClick={onToggleSlideshow}>{paused ? "Resume" : "Pause"}</button>
      <button className="min-h-10 rounded-[0.75rem] bg-white/10 px-3 py-2 text-xs font-extrabold uppercase tracking-wide text-white hover:bg-white/15" type="button" onClick={onFullscreen}>{isFullscreen ? "Exit full" : "Fullscreen"}</button>
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

  async function copyShareText() {
    try {
      await copyText(primaryText);
      trackAnalytics("recap_share_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap", method: "copy_text" } });
      setStatus("Recap share text copied");
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
        <button className="min-h-12 rounded-[1.15rem] border border-white/20 px-5 py-3 text-sm font-bold text-white" type="button" onClick={copyShareText}>Copy share text</button>
      </div>
    </div>
  );
}

function EventRecap() {
  const { slug = "" } = useParams();
  const [{ session }] = useState(() => getGuestSession(slug));
  const [data, setData] = useState<EventRecapResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [reportStatus, setReportStatus] = useState("");

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
  const summary = event ? buildChallengeProgressSummary(event.challenge, data.photos) : null;
  const recap = event ? buildEventRecapMetadata(event, data.photos) : null;
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;
  const contributors = data ? buildContributorSummary(data.photos) : null;
  const shareAssets = event
    ? buildHostShareAssets({
        ...event,
        eventLink: data.eventLink,
        liveWallLink: data.liveWallLink,
        recapLink: data.recapLink,
      })
    : null;
  const hasAwardWinners = Boolean(data?.awardVoting?.categories.some((category) => category.leaderPhotoIds.length > 0));

  async function reportSelectedPhoto(reason: PhotoReportReason, note: string) {
    if (!selectedPhoto) return;
    await eventFilmApi.reportPhoto(selectedPhoto.id, { reason, note, reporterId: getAnalyticsAnonymousId() });
    setReportStatus("Thanks. The host can review this report.");
    trackAnalytics("photo_reported", { eventId: event?.id, eventSlug: event?.slug, metadata: { photoId: selectedPhoto.id, reason } });
  }

  function openPublicPhoto(photo: Photo) {
    setSelectedPhoto(photo);
    setReportStatus("");
    trackAnalytics("photo_lightbox_opened", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "recap", photoId: photo.id } });
  }

  return (
    <main className="min-h-screen bg-[#fff8ed] text-stone-950">
      <div className="mx-auto w-full max-w-7xl px-5 py-6 sm:py-10">
        {!event && (
          <Card className="text-center">
            <h1 className="font-display text-3xl font-bold">Loading recap</h1>
            <p className="mt-2 text-stone-600">{error || "Gathering the event story..."}</p>
          </Card>
        )}
        {event && (
          <>
            <section className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white shadow-[0_28px_90px_rgba(101,62,0,0.16)] sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
                <div>
                  <StatusPill>{recap?.templateName || recap?.modeLabel || "EventFilm"}</StatusPill>
                  <h1 className="mt-5 font-display text-5xl font-bold lg:text-7xl">{event.name}</h1>
                  <p className="mt-4 max-w-2xl text-lg text-stone-200">{event.description || recap?.recapSubtitle || "A shared album from the people who were there."}</p>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-stone-200">
                    <span className="rounded-full bg-white/10 px-4 py-2">Event: {formatDateTime(event.eventDate)}</span>
                    <span className="rounded-full bg-white/10 px-4 py-2">Reveal: {formatDateTime(event.revealAt)}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] bg-[#e85d3f] px-5 py-3 text-sm font-extrabold text-white shadow-[0_14px_32px_rgba(232,93,63,0.24)]" to={`/e/${slug}`} onClick={() => trackAnalytics("guest_album_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap_upload_cta" } })}>Upload photos</Link>
                    {data.eventLink ? <a className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-white/20 px-5 py-3 text-sm font-extrabold text-white" href={data.eventLink} onClick={() => trackAnalytics("guest_share_clicked", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "recap_guest_link" } })}>Share event</a> : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[1.35rem] bg-white/10 p-5">
                    <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Photos</p>
                    <p className="mt-2 font-display text-5xl font-bold">{recap?.totalPhotos || 0}</p>
                  </div>
                  <div className="rounded-[1.35rem] bg-white/10 p-5">
                    <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Contributors</p>
                    <p className="mt-2 font-display text-5xl font-bold">{recap?.contributorCount || 0}</p>
                  </div>
                  {contributors?.topContributors.length ? (
                    <div className="col-span-2 rounded-[1.35rem] bg-white/10 p-5">
                      <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Top contributors</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {contributors.topContributors.map((contributor) => (
                          <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-extrabold text-white" key={contributor.displayName}>{contributor.displayName}: {contributor.photoCount}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {shareAssets ? <div className="col-span-2"><RecapSharePanel event={event} data={data} assets={shareAssets} hasWinners={hasAwardWinners} /></div> : null}
                </div>
              </div>
            </section>

            {data.isLocked ? (
              <section className="mt-8 rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-center">
                <Icon className="mx-auto h-12 w-12 text-[#653e00]">lock</Icon>
                <h2 className="mt-4 font-display text-4xl font-bold text-[#653e00]">{capsuleCopy?.revealTitle || "The recap opens at reveal time"}</h2>
                <p className="mx-auto mt-3 max-w-2xl text-amber-900">{capsuleCopy?.revealNote || "Photos are locked until the reveal time. Come back after the event story opens."}</p>
              </section>
            ) : (
              <>
                <section className="mt-8">
                  <div className="mb-4">
                    <h2 className="font-display text-3xl font-bold">{recap?.recapTitle || "Highlights"}</h2>
                    <p className="text-stone-600">{recap?.recapSubtitle || "Favorite moments from the event, ready to revisit."}</p>
                  </div>
                  {data.photos.length === 0 && shareAssets ? (
                    <Card className="mb-4 border-dashed text-center">
                      <h3 className="font-display text-2xl font-bold">No photos yet</h3>
                      <p className="mx-auto mt-2 max-w-xl text-stone-600">{shareAssets.emptyRecapCopy}</p>
                    </Card>
                  ) : null}
                  <PhotoMosaic photos={recap?.highlightPhotos || []} onPhotoClick={openPublicPhoto} />
                </section>

                {summary && (
                  <section className="mt-8">
                    <ProgressSummaryPanel summary={summary} />
                  </section>
                )}

                {data.awardVoting && (
                  <section className="mt-8">
                    <AwardVotingPanel event={event} photos={data.photos} awardVoting={data.awardVoting} clientId={session.clientId} surface="recap" onVoteComplete={loadRecap} />
                  </section>
                )}

                <section className="mt-8">
                  <div className="mb-4">
                    <h2 className="font-display text-3xl font-bold">Full album</h2>
                    <p className="text-stone-600">Every revealed photo from the event.</p>
                  </div>
                  <PhotoMosaic photos={data.photos} onPhotoClick={openPublicPhoto} />
                </section>
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
  const promptSelectRef = useRef<HTMLSelectElement | null>(null);
  const itemSelectRef = useRef<HTMLSelectElement | null>(null);
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
  const [showScavengerSuccessActions, setShowScavengerSuccessActions] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<GuestUploadSuccessSummary | null>(null);
  const [awardVoting, setAwardVoting] = useState<AwardVotingSummary | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [reportStatus, setReportStatus] = useState("");

  async function load() {
    const eventData = await api<{ event: PublicEvent }>(`/api/events/${slug}`);
    setEvent(eventData.event);
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
    setShowScavengerSuccessActions(false);
    setMessage("");
    if (promptId) localStorage.setItem(getChallengePromptSession(slug), promptId);
    else localStorage.removeItem(getChallengePromptSession(slug));
    if (promptId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "prompt" } });
  }

  function saveSelectedItem(itemId: string) {
    setSelectedItemId(itemId);
    setMessage("");
    if (itemId) localStorage.setItem(getChallengeItemSession(slug), itemId);
    else localStorage.removeItem(getChallengeItemSession(slug));
    if (itemId) trackAnalytics("challenge_item_selected", { eventId: event?.id, eventSlug: event?.slug, metadata: { itemKind: "award" } });
  }

  async function uploadPhoto(uploadEvent: React.FormEvent) {
    uploadEvent.preventDefault();
    setMessage("");
    setError("");
    setShowScavengerSuccessActions(false);
    setUploadSuccess(null);

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
      if (event?.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
        setMessage("Photo uploaded. Want to complete another prompt?");
        setShowScavengerSuccessActions(true);
      } else if (event?.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) {
        setMessage(event.isRevealed ? "Photo submitted. You can vote for award winners below." : "Photo submitted for the award category. Voting opens on the Recap after reveal.");
      } else {
        setMessage("Photo uploaded");
      }
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

  useEffect(() => {
    if (!event || !guestProgress || progressTrackedRef.current) return;
    progressTrackedRef.current = true;
    trackAnalytics("challenge_progress_viewed", { eventId: event.id, eventSlug: event.slug, metadata: { mode: guestProgress.mode, surface: "guest_upload" } });
  }, [event?.id, guestProgress?.mode]);

  function uploadAnotherForPrompt() {
    trackAnalytics("photo_upload_retry_clicked", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload" } });
    setShowScavengerSuccessActions(false);
    setMessage("");
    setError("");
  }

  function chooseNewPrompt() {
    saveSelectedPrompt("");
    setShowScavengerSuccessActions(false);
    setMessage("");
    setError("");
    setTimeout(() => promptSelectRef.current?.focus(), 0);
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
        <div className="mx-auto max-w-2xl">
          <section className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-center text-white shadow-[0_28px_80px_rgba(101,62,0,0.18)] sm:p-8">
            <StatusPill>{activePack.badge}</StatusPill>
            <h1 className="mt-5 font-display text-4xl font-bold">{event.name}</h1>
            {event.description && <p className="mt-3 text-stone-200">{event.description}</p>}
            <p className="mt-3 text-sm text-stone-300">Reveal: {formatDateTime(event.revealAt)}</p>
            {!event.isRevealed && (
              <p className="mt-5 rounded-3xl bg-amber-100 p-4 text-sm font-semibold text-amber-950">
                {capsuleCopy ? capsuleCopy.revealNote : "Photos are hidden until the reveal. Keep uploading throughout the event."}
              </p>
            )}
          </section>

          {event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT && (
            <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Color Hunt</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Choose your color.</h2>
              <p className="mt-2 text-stone-700">Find a real moment that matches your color, then send it in.</p>
              <label className="mt-5 grid gap-2 text-sm font-bold text-stone-700">
                Choose your name
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
            <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Photo Scavenger Hunt</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Pick your prompt.</h2>
              <p className="mt-2 text-stone-700">Choose the moment you are completing before you upload.</p>
              <label className="mt-5 grid gap-2 text-sm font-bold text-stone-700">
                Choose a prompt
                <select ref={promptSelectRef} className="h-12 rounded-2xl border border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" value={selectedPromptId} onChange={(selectEvent) => saveSelectedPrompt(selectEvent.target.value)} required>
                  <option value="">Select a prompt</option>
                  {guestPrompts.map((prompt) => (
                    <option value={prompt.id} key={prompt.id}>{prompt.text}</option>
                  ))}
                </select>
              </label>
              {selectedPrompt && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-stone-800">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Current prompt</p>
                  <p className="mt-1 font-display text-xl font-bold text-[#653e00]">{selectedPrompt.text}</p>
                </div>
              )}
            </section>
          )}

          {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && (
            <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Event Awards</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Submit to an award category.</h2>
              <p className="mt-2 text-stone-700">{activePack.guestInstructions}</p>
              <label className="mt-5 grid gap-2 text-sm font-bold text-stone-700">
                Choose an award
                <select ref={itemSelectRef} className="h-12 rounded-2xl border border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" value={selectedItemId} onChange={(selectEvent) => saveSelectedItem(selectEvent.target.value)} required>
                  <option value="">Select an award category</option>
                  {guestAwards.map((category) => (
                    <option value={category.id} key={category.id}>{category.label}</option>
                  ))}
                </select>
              </label>
              {selectedAward && (
                <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-stone-800">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Current award</p>
                  <p className="mt-1 font-display text-xl font-bold text-[#653e00]">{selectedAward.label}</p>
                </div>
              )}
            </section>
          )}

          {event.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE && capsuleCopy && (
            <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <StatusPill>Memory Capsule</StatusPill>
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">{capsuleCopy.revealTitle}</h2>
              <p className="mt-2 text-stone-700">{capsuleCopy.revealNote}</p>
            </section>
          )}

          <form className="mt-6 rounded-[1.75rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-6" onSubmit={uploadPhoto}>
            <h2 className="font-display text-2xl font-bold">Upload a photo</h2>
            <p className="mt-2 text-stone-600">{event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT ? "Pick a photo and send it to the private album." : "Use a nickname or continue anonymous, then send in your photo."}</p>
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
                Display name or nickname
                <TextInput value={nickname} onChange={(event) => saveNickname(event.target.value)} placeholder="Optional" />
                <span className="text-xs font-semibold text-stone-500">No account needed. Leave blank to post as Anonymous guest.</span>
              </label>
            )}
            <p className="mt-4 rounded-[1rem] bg-[#fffaf6] p-3 text-sm font-bold text-stone-700">
              {remaining === null ? "Checking uploads..." : `${remaining} uploads left`}
            </p>
            {remaining === 0 && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">You have used all uploads for this event.</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400">
                <Icon>photo_camera</Icon>
                Take photo
                <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-900 transition hover:border-amber-500 hover:bg-amber-50">
                <Icon>photo_library</Icon>
                Choose from library
                <input className="sr-only" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
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
              <section className="mt-4 rounded-[1.35rem] border border-green-100 bg-green-50 p-4 text-green-950">
                <p className="text-xs font-extrabold uppercase tracking-wide text-green-700">{uploadSuccess.title}</p>
                <h3 className="mt-2 font-display text-2xl font-bold">Thanks, {uploadSuccess.guestDisplayName}.</h3>
                <div className="mt-3 grid gap-2 text-sm font-bold text-green-900 sm:grid-cols-2">
                  <span className="rounded-2xl bg-white/70 p-3">{uploadSuccess.challengeLabel}</span>
                  <span className="rounded-2xl bg-white/70 p-3">{uploadSuccess.detail}</span>
                  <span className="rounded-2xl bg-white/70 p-3">{uploadSuccess.remainingUploads} uploads left</span>
                  {uploadSuccess.revealNote ? <span className="rounded-2xl bg-white/70 p-3">{uploadSuccess.revealNote}</span> : null}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <SecondaryButton type="button" onClick={() => {
                    trackUploadSuccessAction("upload_another");
                    setUploadSuccess(null);
                    setMessage("");
                    setError("");
                  }}>Upload another</SecondaryButton>
                  {event.isRevealed ? <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" to={`/e/${slug}`} onClick={() => {
                    trackUploadSuccessAction("view_album");
                    trackAnalytics("guest_album_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "upload_success" } });
                  }}>View album</Link> : null}
                  {event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS ? <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" to={`/recap/${slug}`} onClick={() => trackUploadSuccessAction("vote_on_awards")}>Vote on awards</Link> : null}
                  <Link className="inline-flex min-h-12 items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" to={`/recap/${slug}`} onClick={() => {
                    trackUploadSuccessAction("open_recap");
                    trackAnalytics("guest_recap_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "upload_success" } });
                  }}>Open recap</Link>
                </div>
              </section>
            )}
            {message && !uploadSuccess && <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
            {message && !uploadSuccess && event.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS && (
              <Link className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-[1.15rem] border border-[#e1d4c5] bg-white px-5 py-3 text-sm font-extrabold text-stone-900 shadow-[0_10px_24px_rgba(101,62,0,0.06)]" to={`/recap/${slug}`}>Vote on awards</Link>
            )}
            {showScavengerSuccessActions && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SecondaryButton type="button" onClick={uploadAnotherForPrompt}>Upload another for this prompt</SecondaryButton>
                <SecondaryButton type="button" onClick={chooseNewPrompt}>Choose a new prompt</SecondaryButton>
              </div>
            )}
            {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error} {file ? "Try again or choose a smaller image." : ""}</p>}
            {error && file && <SecondaryButton type="button" className="mt-3 w-full" onClick={() => {
              trackAnalytics("photo_upload_retry_clicked", { eventId: event?.id, eventSlug: event?.slug, metadata: { surface: "guest_upload" } });
              setError("");
            }}>Try again</SecondaryButton>}
            <Button className="mt-5 w-full" disabled={loading || remaining === 0}>{loading ? "Uploading..." : "Upload photo"}</Button>
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

          <section className="mt-6 rounded-[1.75rem] border border-[#eadfce] bg-white p-5 shadow-[0_18px_54px_rgba(101,62,0,0.075)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <StatusPill>My uploads</StatusPill>
                <h2 className="mt-3 font-display text-2xl font-bold text-stone-950">Photos from this browser</h2>
                <p className="mt-2 text-sm font-semibold text-stone-600">No account needed. This only remembers uploads on this device.</p>
              </div>
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-extrabold text-stone-700">{myUploads.length} visible</span>
            </div>
            {myUploads.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {myUploads.map((photo) => (
                  <figure className="overflow-hidden rounded-3xl border border-[#eadfce] bg-[#fffaf6] p-2" key={photo.id}>
                    <img className="aspect-square w-full rounded-2xl object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
                    <figcaption className="p-2 text-xs font-bold text-stone-700">
                      <span className="block truncate">{photo.challengeParticipantName || photo.guestNickname || "Anonymous guest"}</span>
                      {photoChallengeLabel(photo) ? <span className="mt-1 block truncate text-[#653e00]">{photoChallengeLabel(photo)}</span> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm font-bold text-stone-600">Uploads from this browser will appear here after they are accepted.</p>
            )}
            {unavailableUploads.length ? (
              <div className="mt-4 grid gap-2">
                {unavailableUploads.slice(0, 4).map((item) => (
                  <p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900" key={item.photoId}>
                    {item.challengeLabel || "Uploaded photo"} is not available publicly right now.
                  </p>
                ))}
              </div>
            ) : null}
          </section>

          {!event.isRevealed && (
            <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-display text-2xl font-bold text-[#653e00]">{capsuleCopy?.revealTitle || "Album"}</h2>
              <p className="mt-2 text-sm font-semibold text-amber-900">{capsuleCopy?.revealNote || "Photos are hidden until the reveal. Keep uploading throughout the event."}</p>
            </section>
          )}

          {event.isRevealed && (
            <section className="mt-8">
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
                  </div>
                ))}
              </div>
              {!photos.length && <Card className="text-center"><p className="font-semibold text-stone-600">No photos yet.</p></Card>}
            </section>
          )}
          <PhotoDetailModal photo={selectedPhoto} mode="public" onClose={() => setSelectedPhoto(null)} onReport={reportSelectedPhoto} reportStatus={reportStatus} />
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
