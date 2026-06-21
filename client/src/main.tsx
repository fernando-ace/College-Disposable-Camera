import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { createEventFilmApiClient } from "@eventfilm/api-client";
import type { AnalyticsSummary, EventAnalyticsSummary, EventRecapResponse, LiveWallResponse } from "@eventfilm/api-client";
import {
  CHALLENGE_PACKS,
  CHALLENGE_TYPES,
  COLOR_HUNT_PALETTE,
  EVENT_TEMPLATES,
  PROMPT_PACKS,
  applyEventTemplateToDraft,
  buildHostLaunchKit,
  buildChallengeProgressSummary,
  buildEventRecapMetadata,
  buildChallengePayload,
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
  isPhotoVisible,
  memoryCapsuleFromChallenge,
  photoChallengeLabel,
  promptsFromChallenge,
  validateUploadFile,
  validateChallengeDraft,
} from "@eventfilm/shared";
import type { AnalyticsEventInput, AnalyticsEventName, ChallengeDraft, ChallengeParticipant, EventChallenge, EventSummary, EventTemplateSlug, HostLaunchKit, HostLaunchKitLink, Photo, PhotoReportReason, PhotoVisibilityStatus, PromptPackSlug, PublicEvent, User } from "@eventfilm/shared";
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
        "inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-[0_18px_42px_rgba(101,62,0,0.16)] transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none",
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
        "inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-900 transition hover:-translate-y-0.5 hover:border-amber-500 hover:bg-amber-50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:text-stone-400",
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
        "w-full rounded-2xl border border-stone-200 bg-[#fffaf3] px-4 py-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100",
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
        "w-full rounded-2xl border border-stone-200 bg-[#fffaf3] px-4 py-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100",
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
  };

  return <svg {...common}>{paths[icon] || <circle cx="12" cy="12" r="8" />}</svg>;
}

function StatusPill({ children, tone = "amber" }: { children: React.ReactNode; tone?: "amber" | "green" | "stone" | "red" }) {
  const tones = {
    amber: "bg-amber-100 text-amber-900",
    green: "bg-emerald-100 text-emerald-800",
    stone: "bg-stone-100 text-stone-700",
    red: "bg-red-100 text-red-800",
  };
  return <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide", tones[tone])}>{children}</span>;
}

function LiveDemoPill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
      <span className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-[live-pulse_1.4s_ease-in-out_infinite]" aria-hidden="true" />
      Live demo
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl border border-[#eadfce] bg-white p-5 shadow-[0_24px_70px_rgba(101,62,0,0.08)]", className)}>{children}</div>;
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
    <div className="flex flex-wrap gap-2">
      {photo.isFeatured && <StatusPill tone="amber">Featured</StatusPill>}
      {host && photo.visibilityStatus === "HIDDEN" && <StatusPill tone="red">Hidden</StatusPill>}
      {host && Boolean(photo.reportCount) && <StatusPill tone="red">{photo.reportCount} reported</StatusPill>}
      {photoChallengeLabel(photo) && <StatusPill tone="stone">{photoChallengeLabel(photo)}</StatusPill>}
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
    <section className="rounded-3xl bg-stone-950 p-5 text-white sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Event templates</p>
          <h2 className="mt-1 font-display text-2xl font-bold">Start with the setup guests expect.</h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-300">Templates choose a mode, prompt pack, upload limit, and launch copy. Everything stays editable before create.</p>
        </div>
        <button type="button" className="min-h-10 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15" onClick={onSkip}>Open custom event</button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {EVENT_TEMPLATES.map((template) => {
          const pack = getPromptPack(template.promptPackSlug);
          const mode = getChallengePack(template.recommendedMode);
          const selected = draft.eventTemplateSlug === template.slug;
          return (
            <article className={cx("rounded-2xl border p-4", selected ? "border-amber-300 bg-amber-300 text-stone-950" : "border-white/10 bg-white/5")} key={template.slug}>
              <div className="flex items-start justify-between gap-3">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full", selected ? "bg-stone-950 text-amber-200" : "bg-white/10 text-amber-200")}><Icon>{template.icon}</Icon></span>
                <span className={cx("rounded-full px-3 py-1 text-xs font-bold", selected ? "bg-stone-950 text-white" : "bg-white/10 text-amber-100")}>{template.badge}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">{template.name}</h3>
              <p className={cx("mt-2 text-sm", selected ? "text-stone-800" : "text-stone-300")}>{template.shortDescription}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <span className={cx("rounded-full px-3 py-1", selected ? "bg-white/70 text-stone-800" : "bg-white/10 text-white")}>{mode.name}</span>
                <span className={cx("rounded-full px-3 py-1", selected ? "bg-white/70 text-stone-800" : "bg-white/10 text-white")}>{pack.name}</span>
              </div>
              <p className={cx("mt-3 text-xs font-semibold", selected ? "text-stone-800" : "text-stone-300")}>Best for: {template.bestFor}</p>
              <ul className={cx("mt-3 grid gap-1 text-xs", selected ? "text-stone-800" : "text-stone-300")}>
                {pack.items.slice(0, 3).map((item) => <li key={item}>- {item}</li>)}
              </ul>
              <button type="button" className={cx("mt-4 min-h-10 w-full rounded-full px-4 py-2 text-sm font-bold", selected ? "bg-stone-950 text-white" : "bg-amber-400 text-stone-950 hover:bg-amber-300")} onClick={() => onSelect(template.slug)}>
                {selected ? "Selected" : "Start with this"}
              </button>
              <p className={cx("mt-2 text-center text-xs font-semibold", selected ? "text-stone-800" : "text-stone-400")}>Customize prompts, mode, and copy later.</p>
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
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-sm font-bold text-stone-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{value}</p>
      <SecondaryButton type="button" className="mt-3 min-h-10 px-4 py-2" onClick={onCopy}>Copy</SecondaryButton>
    </div>
  );
}

function LaunchKitLinkCard({ link, event }: { link: HostLaunchKitLink; event: EventSummary }) {
  const [status, setStatus] = useState("");

  async function copyLink() {
    try {
      await copyText(link.url);
      setStatus(`${link.label} copied`);
      if (link.key === "guest") trackAnalytics("guest_link_copied", { eventId: event.id, eventSlug: event.slug });
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  function openLink() {
    if (link.key === "live-wall") trackAnalytics("live_wall_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "launch_kit" } });
    if (link.key === "recap") trackAnalytics("recap_opened", { eventId: event.id, eventSlug: event.slug, metadata: { surface: "launch_kit" } });
  }

  return (
    <div className="rounded-3xl bg-stone-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-stone-950">{link.label}</p>
          <p className="mt-1 text-sm text-stone-600">{link.purpose}</p>
        </div>
        <StatusPill tone={link.key === "guest" ? "amber" : link.key === "live-wall" ? "green" : "stone"}>{link.key === "guest" ? "Guests" : link.key === "live-wall" ? "During" : "After"}</StatusPill>
      </div>
      <input className="mt-4 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700" readOnly value={link.url} />
      <p className="mt-3 text-sm font-semibold text-stone-700">{link.instruction}</p>
      {status && <p className="mt-2 text-sm font-semibold text-amber-700">{status}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {link.key === "guest" ? (
          <Button type="button" className="min-h-10 px-4 py-2" onClick={copyLink}>Copy link</Button>
        ) : (
          <a className="inline-flex min-h-10 items-center justify-center rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white" href={link.url} target="_blank" rel="noreferrer" onClick={openLink}>Open</a>
        )}
        <SecondaryButton type="button" className="min-h-10 px-4 py-2" onClick={copyLink}>Copy</SecondaryButton>
      </div>
    </div>
  );
}

function HostLaunchKitPanel({ event, qrCodeDataUrl, compact = false }: { event: EventSummary; qrCodeDataUrl?: string; compact?: boolean }) {
  const kit: HostLaunchKit = buildHostLaunchKit(event);
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
          <p className="mt-2 max-w-2xl text-stone-600">Guest upload, Live Wall, and Recap links each have a different job. Keep them separate and hosting stays simple.</p>
        </div>
        <StatusPill tone="stone">{kit.modeLabel}</StatusPill>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-5">
        {kit.checklist.map((item, index) => (
          <div className={cx("rounded-2xl p-3 text-sm font-bold", item.complete ? "bg-emerald-50 text-emerald-800" : "bg-stone-50 text-stone-700")} key={item.key}>
            <span className="block text-xs uppercase tracking-wide opacity-70">Step {index + 1}</span>
            {item.label}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {kit.links.map((link) => <LaunchKitLinkCard key={link.key} link={link} event={event} />)}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <LaunchKitCopyBlock title="Guest invite text" value={kit.inviteText} onCopy={() => copyLaunchText("Guest invite", kit.inviteText)} />
        <LaunchKitCopyBlock title="Host instructions" value={kit.hostInstructions} onCopy={() => copyLaunchText("Host instructions", kit.hostInstructions)} />
        <LaunchKitCopyBlock title="Instagram or group chat caption" value={kit.socialCaption} onCopy={() => copyLaunchText("Caption", kit.socialCaption)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[220px_1fr]">
        {qrCodeDataUrl && (
          <div className="rounded-3xl bg-stone-50 p-4">
            <img className="mx-auto h-48 w-48 rounded-2xl bg-white" src={qrCodeDataUrl} alt="Event QR code" />
            <SecondaryButton type="button" className="mt-4 w-full" onClick={() => downloadDataUrl(qrCodeDataUrl, `${event.name}-qr.png`)}>Download QR</SecondaryButton>
          </div>
        )}
        <div className="rounded-3xl bg-amber-50 p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-900">Mode instructions</p>
          <p className="mt-2 font-display text-xl font-bold text-[#653e00]">{kit.modeLabel}</p>
          <p className="mt-2 text-sm font-semibold text-amber-950">{kit.modeInstructions}</p>
          {copyStatus && <p className="mt-3 text-sm font-bold text-amber-800">{copyStatus}</p>}
        </div>
      </div>
    </Card>
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
      <section className="grid items-center gap-8 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-16">
        <div className="text-center lg:text-left">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-stone-950 sm:text-6xl">
            Stop chasing <span className="text-[#653e00]">event photos.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg lg:mx-0">
            Create an event, share one QR code, collect guest uploads, run photo challenges, show a Live Wall, and share a recap after.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#653e00] px-7 py-4 text-sm font-bold text-white shadow-[0_16px_36px_rgba(101,62,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#855300]" to="/signup" onClick={() => trackCta("Create your first event")}>
              Create your first event
              <Icon>arrow_forward</Icon>
            </Link>
            <a className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-[#d5c4b2] bg-white px-7 py-4 text-sm font-bold text-[#653e00] transition hover:-translate-y-0.5 hover:border-[#653e00] hover:bg-amber-50" href="#demo" onClick={() => trackCta("View demo")}>
              View demo
            </a>
          </div>
          <div className="mt-7 grid gap-3 text-sm font-semibold text-stone-600 sm:grid-cols-3">
            <p className="rounded-2xl bg-white/70 p-3">No guest app required</p>
            <p className="rounded-2xl bg-white/70 p-3">QR-first sharing</p>
            <p className="rounded-2xl bg-white/70 p-3">Live Wall and recap included</p>
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

      <section className="border-t border-stone-200 py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">How it works</h2>
          <p className="mt-3 text-stone-600">A host-ready flow from first setup to final album share.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {[
            ["Create an event", "Name it, set timing, and choose how guests should participate."],
            ["Share the QR code", "Put one code where guests already are: invite, table, screen, or group chat."],
            ["Guests upload photos", "Guests open the link in a browser and upload without making an account."],
            ["Show the Live Wall", "Open it on a laptop, TV, projector, or iPad during the event."],
            ["Share the recap", "Send the polished album story after the reveal time."],
          ].map(([title, body], index) => (
            <div className="rounded-3xl bg-white p-5 shadow-sm" key={title}>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 font-display text-lg font-bold text-[#653e00]">{index + 1}</div>
              <h3 className="mt-5 font-display text-lg font-bold text-stone-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-stone-200 px-0 py-16" id="demo">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">See it in action</h2>
          <p className="mt-3 text-stone-600">Experience the simplicity from both sides. Upload locally in this demo, then create a real event when you are ready.</p>
        </div>
        <DemoUploader />
      </section>

      <section className="py-16">
        <div className="mx-auto mb-12 max-w-2xl">
          <h2 className="text-center font-display text-3xl font-bold">Event modes for the room you are hosting</h2>
          <p className="mt-3 text-center text-stone-600">Start with a classic album or add a lightweight game that makes guests want to join in.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {CHALLENGE_PACKS.map((pack) => (
            <div className="rounded-3xl border border-[#eadfce] bg-white p-5 shadow-sm" key={pack.slug}>
              <StatusPill>{pack.badge}</StatusPill>
              <h3 className="mt-4 font-display text-xl font-bold text-stone-950">{pack.name}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{pack.shortDescription}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">{pack.bestFor}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 py-16 lg:grid-cols-2">
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

      <section className="py-16">
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

      <section className="grid gap-6 rounded-[2rem] bg-[#fff1ec] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <StatusPill>Beta credibility</StatusPill>
          <h2 className="mt-4 font-display text-3xl font-bold text-stone-950">Built for real event hosts.</h2>
          <p className="mt-3 text-stone-700">This beta section is ready for future event stats, testimonials, and real examples once Fernando has permission to share them.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {["Future stat", "Future testimonial", "Future event example"].map((label) => (
            <div className="rounded-3xl bg-white/80 p-5" key={label}>
              <p className="text-sm font-bold uppercase tracking-wide text-stone-500">{label}</p>
              <p className="mt-3 text-sm text-stone-600">Placeholder reserved for verified beta proof. No fake quote here.</p>
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

  const liveEvents = events.filter((event) => new Date(event.revealAt).getTime() > Date.now()).length;
  const totalPhotos = events.reduce((sum, event) => sum + event.photoCount, 0);

  return (
    <Shell wide>
      <div className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white shadow-[0_28px_80px_rgba(101,62,0,0.18)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <StatusPill>Host command center</StatusPill>
            <h1 className="mt-4 font-display text-3xl font-bold sm:text-5xl">Plan it. Share it. Watch the album fill up.</h1>
            <p className="mt-3 max-w-2xl text-stone-200">{auth.user?.email}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15" to="/dashboard/beta-readiness">Beta readiness</Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm transition hover:bg-amber-400" to="/dashboard/events/new">Create event</Link>
          </div>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-8 grid gap-5 sm:grid-cols-3">
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Live events</p>
          <p className="mt-3 font-display text-4xl font-bold text-[#653e00]">{liveEvents}</p>
        </Card>
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Total events</p>
          <p className="mt-3 font-display text-4xl font-bold text-[#653e00]">{events.length}</p>
        </Card>
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Total photos</p>
          <p className="mt-3 font-display text-4xl font-bold text-[#653e00]">{totalPhotos}</p>
        </Card>
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
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="text-sm font-bold uppercase tracking-wide text-stone-500">{label}</p>
                <p className="mt-3 font-display text-3xl font-bold text-[#653e00]">{value}</p>
              </Card>
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
            <Link className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_24px_70px_rgba(28,25,23,0.07)] transition hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(245,158,11,0.14)]" to={`/dashboard/events/${event.id}`} key={event.id}>
              <EventPhotoBanner photos={event.previewPhotos || []} eventName={event.name} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StatusPill tone={new Date(event.revealAt).getTime() > Date.now() ? "green" : "stone"}>{new Date(event.revealAt).getTime() > Date.now() ? "Live" : "Revealed"}</StatusPill>
                    <h3 className="mt-3 font-display text-xl font-bold text-stone-950">{event.name}</h3>
                    <p className="mt-1 text-sm text-stone-600">Event: {formatDateTime(event.eventDate)}</p>
                    <p className="text-sm text-stone-600">Reveal: {formatDateTime(event.revealAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 px-4 py-3 text-center">
                    <p className="font-display text-2xl font-bold text-[#653e00]">{event.photoCount}</p>
                    <p className="text-xs font-bold uppercase text-stone-500">Photos</p>
                  </div>
                </div>
              </div>
            </Link>
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
          <div className="mt-5 flex justify-center">
            <SecondaryButton onClick={() => navigate(`/dashboard/events/${created.id}`)}>Manage event</SecondaryButton>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold text-[#653e00]">Start your story</h1>
        <p className="mt-3 text-lg text-stone-600">Create a space where your guests can share their favorite moments instantly.</p>
      </div>
      <form className="mx-auto mt-8 grid max-w-3xl gap-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_24px_70px_rgba(28,25,23,0.07)] sm:p-8" onSubmit={submit}>
        <TemplateLibrary draft={challengeDraft} onSelect={selectTemplate} onSkip={skipTemplate} />
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
            Reveal date/time
            <TextInput type="datetime-local" value={form.revealAt} onChange={(event) => update("revealAt", event.target.value)} required />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-bold text-stone-700">
          Photo limit per guest
          <TextInput type="number" min="1" value={form.photoLimitPerGuest} onChange={(event) => update("photoLimitPerGuest", event.target.value)} required />
        </label>
        <label className="grid gap-2 text-sm font-bold text-stone-700">
          Description
          <TextArea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Tell guests what this album is for." />
        </label>
        <ChallengeSetup draft={challengeDraft} onChange={setChallengeDraft} />
        <div className="rounded-3xl bg-stone-50 p-5">
          <h2 className="font-display text-xl font-bold text-[#653e00]">Event settings</h2>
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
  const hiddenCount = event?.photos.filter((photo) => photo.visibilityStatus === "HIDDEN").length || 0;
  const reportedCount = event?.photos.filter((photo) => Boolean(photo.reportCount)).length || 0;
  const featuredCount = event?.photos.filter((photo) => Boolean(photo.isFeatured)).length || 0;

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
              <h1 className="mt-3 font-display text-4xl font-bold text-stone-950">{event.name}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-600">
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">calendar_today</Icon>{formatDateTime(event.eventDate)}</span>
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">photo_library</Icon>{event.photoCount} photos</span>
                <span className="inline-flex items-center gap-1"><Icon className="text-[#653e00]">lock</Icon>Reveal: {formatDateTime(event.revealAt)}</span>
              </div>
            </div>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm" to="/dashboard/events/new">Create event</Link>
          </section>

          <section className="mt-8">
            <HostLaunchKitPanel event={event} qrCodeDataUrl={event.qrCodeDataUrl} />
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
                <h2 className="font-display text-2xl font-bold">Beta event metrics</h2>
                <p className="text-sm text-stone-600">Host-owned signal for this event. Counts use real uploads plus internal analytics events.</p>
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
                ].map(([label, value]) => (
                  <Card key={label}>
                    <p className="text-sm font-bold uppercase tracking-wide text-stone-500">{label}</p>
                    <p className="mt-3 font-display text-3xl font-bold text-[#653e00]">{value}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

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
                <p className="text-stone-600">Review, feature, hide, restore, or delete guest uploads.</p>
              </div>
            </div>
            <div className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-sm">
              <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                  {[
                    ["all", `All photos (${event.photos.length})`],
                    ["visible", `Visible (${visiblePhotos.length})`],
                    ["hidden", `Hidden (${hiddenCount})`],
                    ["featured", `Featured (${featuredCount})`],
                    ["reported", `Reported (${reportedCount})`],
                  ].map(([key, label]) => (
                    <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === key ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter(key)} key={key}>{label}</button>
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
                <div className={cx("overflow-hidden rounded-3xl border bg-white p-2 shadow-sm", photo.visibilityStatus === "HIDDEN" ? "border-red-200 opacity-80" : "border-stone-200")} key={photo.id}>
                  <button className="block w-full text-left" onClick={() => {
                    setSelectedPhoto(photo);
                    trackAnalytics("photo_lightbox_opened", { eventId, eventSlug: event.slug, metadata: { surface: "host", photoId: photo.id } });
                  }}>
                    <img className="aspect-square w-full rounded-2xl object-cover" src={photo.previewUrl || photo.url} alt={photo.originalFilename} />
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
                        <SecondaryButton className="min-h-10 px-4 py-2" onClick={() => updatePhotoVisibility(photo, "VISIBLE")}>Restore</SecondaryButton>
                      ) : (
                        <SecondaryButton className="min-h-10 px-4 py-2" onClick={() => updatePhotoVisibility(photo, "HIDDEN")}>Hide</SecondaryButton>
                      )}
                      <button className={cx("min-h-10 rounded-full px-4 py-2 text-sm font-bold", photo.isFeatured ? "bg-stone-950 text-white" : "bg-amber-500 text-stone-950")} onClick={() => updatePhotoFeatured(photo, !photo.isFeatured)} disabled={photo.visibilityStatus === "HIDDEN"}>
                        {photo.isFeatured ? "Unfeature" : "Feature"}
                      </button>
                      <button className="min-h-10 rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white" onClick={() => deletePhoto(photo.id)}>Delete</button>
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
        <figure className={cx("group overflow-hidden rounded-[1.5rem]", index === 0 ? "col-span-2 row-span-2" : "", dark ? "bg-white/10" : "bg-white shadow-sm")} key={photo.id}>
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

function LiveWall() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<LiveWallResponse | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    const nextData = await api<LiveWallResponse>(`/api/events/${slug}/live-wall`);
    setData(nextData);
    setError("");
    setLastUpdated(new Date());
  }

  useEffect(() => {
    trackAnalytics("live_wall_opened", { eventSlug: slug, path: `/wall/${slug}` });
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

  const event = data?.event;
  const summary = event ? buildChallengeProgressSummary(event.challenge, data.photos) : null;
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;

  return (
    <main className="min-h-screen bg-stone-950 text-white">
      {!event && (
        <div className="grid min-h-screen place-items-center p-8">
          <div className="max-w-xl text-center">
            <LiveDemoPill />
            <h1 className="mt-5 font-display text-5xl font-bold">Preparing Live Wall</h1>
            <p className="mt-3 text-stone-300">{error || "Loading the latest event photos..."}</p>
          </div>
        </div>
      )}
      {event && (
        <div className="grid min-h-screen gap-6 p-5 lg:grid-cols-[1fr_360px] lg:p-8">
          <section className="flex min-h-0 flex-col gap-6">
            <div className="rounded-[2rem] bg-white/10 p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <LiveDemoPill />
                  <h1 className="mt-5 font-display text-5xl font-bold lg:text-7xl">{event.name}</h1>
                  <p className="mt-4 max-w-3xl text-xl text-stone-200">{event.description || "Guests can scan, upload, and watch the event story grow in real time."}</p>
                </div>
                <div className="grid gap-2 text-sm font-bold uppercase tracking-wide text-stone-300">
                  <span>Event: {formatDateTime(event.eventDate)}</span>
                  <span>Reveal: {formatDateTime(event.revealAt)}</span>
                  {lastUpdated && <span>Updated: {lastUpdated.toLocaleTimeString()}</span>}
                </div>
              </div>
            </div>

            {data.isLocked ? (
              <section className="grid flex-1 place-items-center rounded-[2rem] bg-amber-100 p-8 text-center text-amber-950">
                <div className="max-w-2xl">
                  <Icon className="mx-auto h-14 w-14">lock</Icon>
                  <h2 className="mt-5 font-display text-5xl font-bold">{capsuleCopy?.revealTitle || "The album is locked"}</h2>
                  <p className="mt-4 text-xl font-semibold">{capsuleCopy?.revealNote || "Photos are hidden until the reveal time."}</p>
                </div>
              </section>
            ) : (
              <PhotoMosaic photos={data.photos.slice(0, 13)} dark />
            )}
          </section>

          <aside className="grid content-start gap-5">
            <section className="rounded-[2rem] bg-white p-5 text-stone-950">
              <p className="text-sm font-bold uppercase tracking-wide text-[#653e00]">Scan to upload</p>
              {data.qrCodeDataUrl && <img className="mt-4 aspect-square w-full rounded-3xl bg-white p-2" src={data.qrCodeDataUrl} alt="Guest upload QR code" />}
              <p className="mt-4 break-all rounded-2xl bg-stone-50 p-3 text-sm font-semibold text-stone-700">{data.eventLink}</p>
            </section>
            <section className="rounded-[2rem] bg-amber-400 p-5 text-stone-950">
              <p className="text-sm font-bold uppercase tracking-wide">Live count</p>
              <p className="mt-2 font-display text-6xl font-bold">{data.photos.length}</p>
              <p className="text-sm font-bold">photos uploaded</p>
              {error && <p className="mt-4 rounded-2xl bg-red-100 p-3 text-sm font-bold text-red-800">{error}</p>}
              <button className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white" onClick={() => load().catch((err) => setError(publicRouteErrorMessage(err, "Live Wall is not available right now. Check the event link or refresh in a moment.")))}>Refresh now</button>
            </section>
            {summary && <ProgressSummaryPanel summary={summary} dark />}
          </aside>
        </div>
      )}
    </main>
  );
}

function EventRecap() {
  const { slug = "" } = useParams();
  const [data, setData] = useState<EventRecapResponse | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [reportStatus, setReportStatus] = useState("");

  useEffect(() => {
    trackAnalytics("recap_opened", { eventSlug: slug, path: `/recap/${slug}` });
    api<EventRecapResponse>(`/api/events/${slug}/recap`)
      .then((nextData) => {
        setData(nextData);
        setError("");
      })
      .catch((err) => setError(publicRouteErrorMessage(err, "Recap is not available right now. Check the event link or try again after reveal.")));
  }, [slug]);

  const event = data?.event;
  const summary = event ? buildChallengeProgressSummary(event.challenge, data.photos) : null;
  const recap = event ? buildEventRecapMetadata(event, data.photos) : null;
  const capsuleCopy = event?.challenge?.type === CHALLENGE_TYPES.MEMORY_CAPSULE ? memoryCapsuleFromChallenge(event.challenge) : null;

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
            <section className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
                <div>
                  <StatusPill>{recap?.templateName || recap?.modeLabel || "EventFilm"}</StatusPill>
                  <h1 className="mt-5 font-display text-5xl font-bold lg:text-7xl">{event.name}</h1>
                  <p className="mt-4 max-w-2xl text-lg text-stone-200">{event.description || recap?.recapSubtitle || "A shared album from the people who were there."}</p>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-stone-200">
                    <span className="rounded-full bg-white/10 px-4 py-2">Event: {formatDateTime(event.eventDate)}</span>
                    <span className="rounded-full bg-white/10 px-4 py-2">Reveal: {formatDateTime(event.revealAt)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-white/10 p-5">
                    <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Photos</p>
                    <p className="mt-2 font-display text-5xl font-bold">{recap?.totalPhotos || 0}</p>
                  </div>
                  <div className="rounded-3xl bg-white/10 p-5">
                    <p className="text-sm font-bold uppercase tracking-wide text-amber-200">Contributors</p>
                    <p className="mt-2 font-display text-5xl font-bold">{recap?.contributorCount || 0}</p>
                  </div>
                  <button
                    className="col-span-2 min-h-12 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-stone-950"
                    onClick={async () => {
                      try {
                        await copyText(data.recapLink);
                        setCopyStatus("Recap link copied");
                      } catch (err) {
                        setCopyStatus((err as Error).message);
                      }
                    }}
                  >
                    Share recap
                  </button>
                  {copyStatus && <p className="col-span-2 text-sm font-bold text-amber-200">{copyStatus}</p>}
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
                    <p className="text-stone-600">{recap?.recapSubtitle || "A first look at the moments guests added most recently."}</p>
                  </div>
                  <PhotoMosaic photos={recap?.highlightPhotos || []} onPhotoClick={openPublicPhoto} />
                </section>

                {summary && (
                  <section className="mt-8">
                    <ProgressSummaryPanel summary={summary} />
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScavengerSuccessActions, setShowScavengerSuccessActions] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [reportStatus, setReportStatus] = useState("");

  async function load() {
    const eventData = await api<{ event: PublicEvent }>(`/api/events/${slug}`);
    setEvent(eventData.event);
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
    if (eventData.event.isRevealed) {
      const photoData = await api<{ photos: Photo[] }>(`/api/events/${slug}/photos`);
      setPhotos(photoData.photos);
    } else {
      setPhotos([]);
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
    if (event?.challenge?.type !== CHALLENGE_TYPES.COLOR_HUNT && !nickname.trim()) return setError("Enter your name or nickname first");

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("nickname", selectedParticipant?.displayName || nickname.trim());
    formData.append("clientId", session.clientId);
    if (selectedParticipant?.id) formData.append("challengeParticipantId", selectedParticipant.id);
    if (selectedPrompt?.id) formData.append("challengePromptId", selectedPrompt.id);
    if (selectedAward?.id) formData.append("challengeItemId", selectedAward.id);

    setLoading(true);
    trackAnalytics("photo_upload_started", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE" } });
    try {
      const data = await api<{ remainingUploads: number }>(`/api/events/${slug}/photos`, { method: "POST", body: formData });
      trackAnalytics("photo_upload_succeeded", { eventId: event?.id, eventSlug: event?.slug, metadata: { mode: event?.challenge?.type || "NONE" } });
      setFile(null);
      setRemaining(data.remainingUploads);
      if (event?.challenge?.type === CHALLENGE_TYPES.PHOTO_SCAVENGER_HUNT) {
        setMessage("Photo uploaded. Want to complete another prompt?");
        setShowScavengerSuccessActions(true);
      } else if (event?.challenge?.type === CHALLENGE_TYPES.EVENT_AWARDS) {
        setMessage("Photo submitted for the award category.");
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
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Your group is playing Color Hunt.</h2>
              <p className="mt-2 text-stone-700">Find things that match your color and upload them here.</p>
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
              <h2 className="mt-3 font-display text-2xl font-bold text-[#653e00]">Photo Scavenger Hunt</h2>
              <p className="mt-2 text-stone-700">Pick a prompt, take a photo, and upload it to the event album.</p>
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

          <form className="mt-6 rounded-3xl border border-[#eadfce] bg-white p-5 shadow-[0_24px_70px_rgba(101,62,0,0.08)] sm:p-6" onSubmit={uploadPhoto}>
            <h2 className="font-display text-2xl font-bold">Upload a photo</h2>
            <p className="mt-2 text-stone-600">{event.challenge?.type === CHALLENGE_TYPES.COLOR_HUNT ? "Pick a photo and send it to the private album." : "Add your name, pick a photo, and send it to the private album."}</p>
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
                Name or nickname
                <TextInput value={nickname} onChange={(event) => saveNickname(event.target.value)} placeholder="John Doe" required />
              </label>
            )}
            <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-700">
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
            {message && <p className="mt-4 rounded-2xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
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

          {!event.isRevealed && (
            <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-display text-2xl font-bold text-[#653e00]">{capsuleCopy?.revealTitle || "Album"}</h2>
              <p className="mt-2 text-sm font-semibold text-amber-900">{capsuleCopy?.revealNote || "Photos are hidden until the reveal. Keep uploading throughout the event."}</p>
            </section>
          )}

          {event.isRevealed && (
            <section className="mt-8">
              <h2 className="font-display text-2xl font-bold">Album</h2>
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
            <Route path="/dashboard/beta-readiness" element={<ProtectedRoute><BetaReadiness /></ProtectedRoute>} />
            <Route path="/dashboard/events/new" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
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
