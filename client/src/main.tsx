import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
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

type User = { id: string; email: string };
type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
};
type EventSummary = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  eventDate: string;
  revealAt: string;
  photoLimitPerGuest: number;
  eventLink: string;
  qrCodeDataUrl?: string;
  photoCount: number;
  previewPhotos?: Photo[];
  challenge?: EventChallenge | null;
};
type Photo = {
  id: string;
  url: string;
  previewUrl?: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
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
type PublicEvent = {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  eventDate: string;
  revealAt: string;
  photoLimitPerGuest: number;
  isRevealed: boolean;
  photoCount: number | null;
  challenge?: EventChallenge | null;
};
type ChallengeParticipant = {
  id?: string;
  displayName: string;
  colorName: string;
  colorHex: string;
  colorSlug: string;
};
type ChallengeType = "COLOR_HUNT" | "PHOTO_SCAVENGER_HUNT";
type ChallengePrompt = {
  id?: string;
  text: string;
  order: number;
};
type EventChallenge = {
  id: string;
  type: ChallengeType;
  title: string;
  instructions: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  participants: ChallengeParticipant[];
  prompts?: ChallengePrompt[];
};
type ChallengeDraft = {
  type: "NONE" | ChallengeType;
  participants: ChallengeParticipant[];
  prompts: ChallengePrompt[];
};
type DemoPhoto = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const COLOR_HUNT_PALETTE: ChallengeParticipant[] = [
  { displayName: "", colorName: "Red", colorHex: "#dc2626", colorSlug: "red" },
  { displayName: "", colorName: "Orange", colorHex: "#ea580c", colorSlug: "orange" },
  { displayName: "", colorName: "Yellow", colorHex: "#facc15", colorSlug: "yellow" },
  { displayName: "", colorName: "Green", colorHex: "#16a34a", colorSlug: "green" },
  { displayName: "", colorName: "Blue", colorHex: "#2563eb", colorSlug: "blue" },
  { displayName: "", colorName: "Purple", colorHex: "#9333ea", colorSlug: "purple" },
  { displayName: "", colorName: "Pink", colorHex: "#db2777", colorSlug: "pink" },
  { displayName: "", colorName: "White", colorHex: "#f8fafc", colorSlug: "white" },
  { displayName: "", colorName: "Black", colorHex: "#111827", colorSlug: "black" },
  { displayName: "", colorName: "Brown", colorHex: "#92400e", colorSlug: "brown" },
];
const STARTER_SCAVENGER_PROMPTS = [
  "Group selfie",
  "Someone laughing",
  "Best outfit",
  "Food or drink photo",
  "Candid moment",
  "Photo with someone new",
  "Recreate this pose",
  "Best dance floor photo",
  "Decoration detail",
  "Funniest photo",
];

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Auth context is missing");
  return value;
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

async function api<T>(path: string, options: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) throw new Error(data?.error || "Request failed");
  return data as T;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

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

function createPrompt(text = "", order = 0, id?: string): ChallengePrompt {
  return { id: id || `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, order };
}

function createStarterPrompts() {
  return STARTER_SCAVENGER_PROMPTS.map((text, order) => createPrompt(text, order));
}

function promptsFromChallenge(challenge?: EventChallenge | null) {
  const prompts = Array.isArray(challenge?.prompts)
    ? challenge.prompts
    : Array.isArray(challenge?.config?.prompts)
      ? (challenge.config.prompts as ChallengePrompt[])
      : [];

  return prompts
    .map((prompt, index) => createPrompt(String(prompt.text || ""), Number.isInteger(prompt.order) ? prompt.order : index, prompt.id))
    .sort((a, b) => a.order - b.order)
    .map((prompt, order) => ({ ...prompt, order }));
}

function createEmptyChallengeDraft(): ChallengeDraft {
  return {
    type: "NONE",
    participants: [
      { ...COLOR_HUNT_PALETTE[0], displayName: "" },
      { ...COLOR_HUNT_PALETTE[1], displayName: "" },
      { ...COLOR_HUNT_PALETTE[2], displayName: "" },
    ],
    prompts: createStarterPrompts(),
  };
}

function draftFromChallenge(challenge?: EventChallenge | null): ChallengeDraft {
  if (!challenge) return createEmptyChallengeDraft();
  const emptyDraft = createEmptyChallengeDraft();
  return {
    type: Boolean(challenge.isActive ?? true) ? challenge.type : "NONE",
    participants: challenge.participants.length
      ? challenge.participants.map((participant) => ({ ...participant }))
      : emptyDraft.participants,
    prompts: challenge.type === "PHOTO_SCAVENGER_HUNT" && promptsFromChallenge(challenge).length
      ? promptsFromChallenge(challenge)
      : emptyDraft.prompts,
  };
}

function buildChallengePayload(draft: ChallengeDraft) {
  if (draft.type === "NONE") return null;

  if (draft.type === "PHOTO_SCAVENGER_HUNT") {
    const prompts = draft.prompts
      .map((prompt, order) => ({
        id: prompt.id,
        text: prompt.text.trim(),
        order,
      }));

    if (prompts.length < 3) throw new Error("Add at least 3 prompts to start Photo Scavenger Hunt.");
    if (prompts.some((prompt) => !prompt.text)) throw new Error("Prompts cannot be empty.");

    const promptTexts = prompts.map((prompt) => prompt.text.toLowerCase());
    if (new Set(promptTexts).size !== promptTexts.length) throw new Error("Remove duplicate prompts before saving.");

    return {
      type: "PHOTO_SCAVENGER_HUNT",
      title: "Photo Scavenger Hunt",
      instructions: "Pick a prompt, take a photo, and upload it to the event album.",
      config: { prompts },
      isActive: true,
      prompts,
      participants: [],
    };
  }

  const participants = draft.participants
    .map((participant) => ({
      id: participant.id,
      displayName: participant.displayName.trim(),
      colorName: participant.colorName,
      colorHex: participant.colorHex,
      colorSlug: participant.colorSlug,
    }));

  if (participants.length < 2) throw new Error("Add at least 2 participants to start Color Hunt.");
  if (participants.some((participant) => !participant.displayName)) throw new Error("Participant names cannot be empty.");
  if (participants.some((participant) => !participant.colorName || !participant.colorHex || !participant.colorSlug)) throw new Error("Each participant needs a color.");

  const participantNames = participants.map((participant) => participant.displayName.toLowerCase());
  if (new Set(participantNames).size !== participantNames.length) throw new Error("Participant names must be unique.");

  return {
    type: "COLOR_HUNT",
    title: "Color Hunt",
    instructions: "Assign each person a color. Guests will upload photos of things they find in their color.",
    config: { palette: COLOR_HUNT_PALETTE.map(({ colorName, colorHex, colorSlug }) => ({ colorName, colorHex, colorSlug })) },
    isActive: true,
    participants,
  };
}

function colorBySlug(colorSlug: string) {
  return COLOR_HUNT_PALETTE.find((color) => color.colorSlug === colorSlug) || COLOR_HUNT_PALETTE[0];
}

function hasDuplicateColors(participants: ChallengeParticipant[]) {
  const selectedColors = participants.map((participant) => participant.colorSlug).filter(Boolean);
  return new Set(selectedColors).size !== selectedColors.length;
}

function hasDuplicatePrompts(prompts: ChallengePrompt[]) {
  const promptTexts = prompts.map((prompt) => prompt.text.trim().toLowerCase()).filter(Boolean);
  return new Set(promptTexts).size !== promptTexts.length;
}

function challengeLabel(challenge?: EventChallenge | null) {
  if (!challenge) return "No challenge";
  return challenge.type === "PHOTO_SCAVENGER_HUNT" ? "Photo Scavenger Hunt" : "Color Hunt";
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-[0_16px_36px_rgba(245,158,11,0.16)] transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none",
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
        "w-full rounded-2xl border border-transparent bg-stone-100 px-4 py-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100",
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
        "w-full rounded-2xl border border-transparent bg-stone-100 px-4 py-3 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100",
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
  return <div className={cx("rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_24px_70px_rgba(28,25,23,0.07)]", className)}>{children}</div>;
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

function ChallengeSetup({ draft, onChange }: { draft: ChallengeDraft; onChange: (draft: ChallengeDraft) => void }) {
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const showDuplicateColorWarning = draft.type === "COLOR_HUNT" && hasDuplicateColors(draft.participants);
  const showDuplicatePromptWarning = draft.type === "PHOTO_SCAVENGER_HUNT" && hasDuplicatePrompts(draft.prompts);
  const validPromptCount = draft.prompts.filter((prompt) => prompt.text.trim()).length;

  function updateType(type: ChallengeDraft["type"]) {
    onChange({ ...draft, type });
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
    onChange({
      ...draft,
      prompts: draft.prompts.map((prompt, promptIndex) => (promptIndex === index ? { ...prompt, text } : prompt)),
    });
  }

  function addPrompt() {
    setIsPromptEditorOpen(true);
    onChange({ ...draft, prompts: [...draft.prompts, createPrompt("", draft.prompts.length)] });
  }

  function removePrompt(index: number) {
    onChange({ ...draft, prompts: draft.prompts.filter((_, promptIndex) => promptIndex !== index).map((prompt, order) => ({ ...prompt, order })) });
  }

  function movePrompt(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.prompts.length) return;
    const prompts = [...draft.prompts];
    const [prompt] = prompts.splice(index, 1);
    prompts.splice(nextIndex, 0, prompt);
    onChange({ ...draft, prompts: prompts.map((nextPrompt, order) => ({ ...nextPrompt, order })) });
  }

  function useStarterPrompts() {
    setIsPromptEditorOpen(false);
    onChange({ ...draft, prompts: createStarterPrompts() });
  }

  return (
    <div className="rounded-3xl bg-stone-50 p-5">
      <div className="grid gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Add a photo challenge</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#653e00]">{draft.type === "NONE" ? "Optional challenge mode" : draft.type === "PHOTO_SCAVENGER_HUNT" ? "Photo Scavenger Hunt" : "Color Hunt"}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" className={cx("rounded-2xl border p-4 text-left text-sm transition", draft.type === "NONE" ? "border-stone-950 bg-white shadow-sm" : "border-stone-200 bg-white/70 hover:border-amber-300")} onClick={() => updateType("NONE")}>
            <span className="block font-bold text-stone-950">No challenge</span>
            <span className="mt-1 block text-stone-600">A normal EventFilm album.</span>
          </button>
          <button type="button" className={cx("rounded-2xl border p-4 text-left text-sm transition", draft.type === "COLOR_HUNT" ? "border-stone-950 bg-white shadow-sm" : "border-stone-200 bg-white/70 hover:border-amber-300")} onClick={() => updateType("COLOR_HUNT")}>
            <span className="block font-bold text-stone-950">Color Hunt</span>
            <span className="mt-1 block text-stone-600">Guests find photos matching assigned colors.</span>
          </button>
          <button type="button" className={cx("rounded-2xl border p-4 text-left text-sm transition", draft.type === "PHOTO_SCAVENGER_HUNT" ? "border-stone-950 bg-white shadow-sm" : "border-stone-200 bg-white/70 hover:border-amber-300")} onClick={() => updateType("PHOTO_SCAVENGER_HUNT")}>
            <span className="block font-bold text-stone-950">Photo Scavenger Hunt</span>
            <span className="mt-1 block text-stone-600">Guests choose prompts and upload photos throughout the event.</span>
          </button>
        </div>
      </div>

      {draft.type === "COLOR_HUNT" && (
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

      {draft.type === "PHOTO_SCAVENGER_HUNT" && (
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
    </div>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-[#f9f9f9] text-stone-950">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#f9f9f9]/85 backdrop-blur-xl">
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

function Landing() {
  return (
    <Shell wide>
      <section className="grid items-center gap-8 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-20">
        <div className="text-center lg:text-left">
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-stone-950 sm:text-6xl">
            Stop chasing <span className="text-[#653e00]">event photos.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg lg:mx-0">
            Create one event link, share the QR code, and let guests upload photos from any phone. After the event, you get one clean private album.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#653e00] px-7 py-4 text-sm font-bold text-white shadow-[0_16px_36px_rgba(101,62,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#855300]" to="/signup">
              Create a free beta event
              <Icon>arrow_forward</Icon>
            </Link>
            <a className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-[#d5c4b2] bg-white px-7 py-4 text-sm font-bold text-[#653e00] transition hover:-translate-y-0.5 hover:border-[#653e00] hover:bg-amber-50" href="#demo">
              Try the demo first
            </a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[390px]">
          <div className="absolute -left-8 bottom-8 h-32 w-32 rounded-full bg-[#ffdbd1] blur-2xl" />
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

      <section className="border-t border-stone-200 px-0 py-16" id="demo">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">See it in action</h2>
          <p className="mt-3 text-stone-600">Experience the simplicity from both sides. Upload locally in this demo, then create a real event when you are ready.</p>
        </div>
        <DemoUploader />
      </section>

      <section className="py-16 text-center">
        <div className="mx-auto mb-12 max-w-2xl">
          <h2 className="font-display text-3xl font-bold">Effortless memory collection</h2>
          <p className="mt-3 text-stone-600">Three simple steps to gather every angle of your special day.</p>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
        {[
          ["Create", "Set up your event in seconds. EventFilm generates a shareable link and QR code for your celebration."],
          ["Share", "Display the QR code at the venue. Guests scan and upload instantly with no app download required."],
          ["Get", "Watch your private album grow, then download the full collection when the event is over."],
        ].map(([title, body], index) => (
          <div className="text-center" key={title}>
            <div className={cx("mx-auto grid h-20 w-20 place-items-center rounded-full font-display text-2xl font-bold shadow-sm", index === 0 ? "bg-[#ffddb8] text-[#2a1700]" : index === 1 ? "bg-[#e5e2e1] text-stone-800" : "bg-[#ffdbd1] text-[#7b2e17]")}>{index + 1}</div>
            <h3 className="mt-7 font-display text-2xl font-bold text-stone-950">{title}</h3>
            <p className="mt-3 text-stone-600">{body}</p>
          </div>
        ))}
        </div>
      </section>

      <section className="grid items-center gap-8 rounded-t-[3rem] bg-stone-200 p-8 text-center sm:p-12 lg:grid-cols-[1fr_0.8fr] lg:text-left">
        <div>
          <h2 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">Ready to collect the moments that matter?</h2>
          <p className="mt-4 max-w-2xl text-stone-600">Stop relying on messy group chats and compressed social media posts. Give your memories a beautiful home.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Link className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#653e00] px-7 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#855300]" to="/signup">Create a free beta event</Link>
          <p className="rounded-2xl bg-white/60 p-4 text-sm text-stone-600">Disposable camera mode is still available as an optional reveal-style setting for events that want the surprise.</p>
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
  const [error, setError] = useState("");
  const previewLoadIds = useRef(new Set<string>());

  useEffect(() => {
    api<{ events: EventSummary[] }>("/api/host/events", { token: auth.token })
      .then((data) => setEvents(data.events))
      .catch((err) => setError((err as Error).message));
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-stone-950 sm:text-4xl">Welcome back</h1>
          <p className="mt-2 text-stone-600">{auth.user?.email}</p>
        </div>
        <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950 shadow-sm" to="/dashboard/events/new">Create event</Link>
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
          <Card className="text-center">
            <h3 className="font-display text-2xl font-bold">No events yet</h3>
            <p className="mt-2 text-stone-600">Create your first album to get a shareable link and QR code.</p>
            <Link className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-stone-950" to="/dashboard/events/new">Create event</Link>
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
  const [copyStatus, setCopyStatus] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
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
          challenge,
        }),
      });
      setCreated(data.event);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (created) {
    return (
      <Shell>
        <Card className="mx-auto max-w-2xl">
          <StatusPill tone="green">Event ready</StatusPill>
          <h1 className="mt-4 font-display text-3xl font-bold">Share your EventFilm link</h1>
          <p className="mt-2 text-stone-600">Guests can scan the QR code or open the link to upload photos without an account.</p>
          <input className="mt-5 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700" readOnly value={created.eventLink} />
          {copyStatus && <p className="mt-2 text-sm font-semibold text-amber-700">{copyStatus}</p>}
          <div className="mt-5 grid gap-6 sm:grid-cols-[220px_1fr] sm:items-center">
            <div className="rounded-3xl bg-stone-50 p-4">
              <img className="mx-auto h-48 w-48 rounded-2xl bg-white" src={created.qrCodeDataUrl} alt="Event QR code" />
            </div>
            <div className="grid gap-3">
              <Button
                onClick={async () => {
                  try {
                    await copyText(created.eventLink);
                    setCopyStatus("Link copied");
                  } catch (err) {
                    setCopyStatus((err as Error).message);
                  }
                }}
              >
                Copy link
              </Button>
              <SecondaryButton onClick={() => downloadDataUrl(created.qrCodeDataUrl || "", `${created.name}-qr.png`)}>Download QR</SecondaryButton>
              <SecondaryButton onClick={() => navigate(`/dashboard/events/${created.id}`)}>Manage event</SecondaryButton>
            </div>
          </div>
        </Card>
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
  const [error, setError] = useState("");
  const [challengeStatus, setChallengeStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  async function load() {
    const data = await api<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${eventId}`, { token: auth.token });
    setEvent(data.event);
    setChallengeDraft(draftFromChallenge(data.event.challenge));
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [eventId]);

  useEffect(() => {
    if (galleryFilter === "all") return;
    if (!event?.challenge) {
      setGalleryFilter("all");
      return;
    }
    if (event.challenge.type === "COLOR_HUNT" && galleryFilter.startsWith("prompt:")) setGalleryFilter("all");
    if (event.challenge.type === "PHOTO_SCAVENGER_HUNT" && (galleryFilter.startsWith("color:") || galleryFilter.startsWith("participant:"))) setGalleryFilter("all");
  }, [event?.challenge, galleryFilter]);

  async function deletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    await api(`/api/host/events/${eventId}/photos/${photoId}`, { method: "DELETE", token: auth.token });
    await load();
  }

  async function downloadZip() {
    const response = await fetch(`${API_BASE_URL}/api/host/events/${eventId}/download`, {
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
  const filteredPhotos = event?.photos.filter((photo) => {
    if (galleryFilter === "all") return true;
    if (galleryFilter.startsWith("color:")) return photo.challengeColorSlug === galleryFilter.replace("color:", "");
    if (galleryFilter.startsWith("participant:")) return photo.challengeParticipantId === galleryFilter.replace("participant:", "");
    if (galleryFilter.startsWith("prompt:")) return photo.challengePromptId === galleryFilter.replace("prompt:", "");
    return true;
  }) || [];

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

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="lg:p-8">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-[#653e00]"><Icon>qr_code_2</Icon></div>
                <div>
                  <h2 className="font-display text-2xl font-bold">Share and invite</h2>
                  <p className="text-sm text-stone-600">Invite guests to upload photos by sharing this link or displaying the QR code.</p>
                </div>
              </div>
              <input className="mt-5 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700" readOnly value={event.eventLink} />
              {copyStatus && <p className="mt-2 text-sm font-semibold text-amber-700">{copyStatus}</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Button
                  onClick={async () => {
                    try {
                      await copyText(event.eventLink);
                      setCopyStatus("Event link copied");
                    } catch (err) {
                      setCopyStatus((err as Error).message);
                    }
                  }}
                >
                  Copy link
                </Button>
                <SecondaryButton onClick={() => downloadDataUrl(event.qrCodeDataUrl || "", `${event.name}-qr.png`)}>Download QR</SecondaryButton>
                <SecondaryButton onClick={downloadZip}>Download ZIP</SecondaryButton>
              </div>
            </Card>
            <Card className="grid place-items-center">
              <img className="h-56 w-56 rounded-3xl bg-white p-2" src={event.qrCodeDataUrl} alt="Event QR code" />
              <p className="mt-3 text-sm font-bold uppercase tracking-wide text-stone-500">Scan to upload photos</p>
            </Card>
          </section>

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
                <p className="text-stone-600">The latest memories from your guests.</p>
              </div>
            </div>
            {event.challenge && (
              <div className="mb-5 grid gap-3 rounded-3xl bg-white p-4 shadow-sm">
                <div className="overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
                  <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                    <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === "all" ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter("all")}>All photos</button>
                    {event.challenge.type === "COLOR_HUNT" && challengeColors.map((participant) => (
                      <button className={cx("inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `color:${participant.colorSlug}` ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter(`color:${participant.colorSlug}`)} key={participant.colorSlug}>
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: participant.colorHex }} />
                        {participant.colorName}
                      </button>
                    ))}
                    {event.challenge.type === "PHOTO_SCAVENGER_HUNT" && challengePrompts.map((prompt) => (
                      <button className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `prompt:${prompt.id}` ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700")} onClick={() => setGalleryFilter(`prompt:${prompt.id}`)} key={prompt.id}>{prompt.text}</button>
                    ))}
                  </div>
                </div>
                {event.challenge.type === "COLOR_HUNT" && (
                  <div className="flex flex-wrap gap-2">
                    {challengeParticipants.map((participant) => (
                      <button className={cx("rounded-full px-4 py-2 text-sm font-bold", galleryFilter === `participant:${participant.id}` ? "bg-amber-500 text-stone-950" : "bg-amber-50 text-[#653e00]")} onClick={() => setGalleryFilter(`participant:${participant.id}`)} key={participant.id}>{participant.displayName}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredPhotos.map((photo) => (
                <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white p-2 shadow-sm" key={photo.id}>
                  <img className="aspect-square w-full rounded-2xl object-cover" src={photo.url} alt={photo.originalFilename} />
                  <div className="p-3 text-sm">
                    <p className="truncate font-bold">{photo.challengeParticipantName || photo.guestNickname || "Guest"}</p>
                    {photo.challengeColorName && (
                      <div className="mt-2">
                        <ColorChip participant={{ colorName: photo.challengeColorName, colorHex: photo.challengeColorHex || "#f59e0b" }} />
                      </div>
                    )}
                    {photo.challengePromptText && (
                      <p className="mt-2 text-sm font-semibold text-[#653e00]">Prompt: {photo.challengePromptText}</p>
                    )}
                    <p className="mt-1 text-stone-600">{formatDateTime(photo.createdAt)}</p>
                    <button className="mt-3 inline-flex min-h-10 items-center rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white" onClick={() => deletePhoto(photo.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            {!filteredPhotos.length && <Card className="text-center"><p className="font-semibold text-stone-600">No photos match this view yet.</p></Card>}
          </section>
        </>
      )}
    </Shell>
  );
}

function GuestEvent() {
  const { slug = "" } = useParams();
  const [{ key, session }, setGuestSessionState] = useState(() => getGuestSession(slug));
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [nickname, setNickname] = useState(session.nickname);
  const [selectedParticipantId, setSelectedParticipantId] = useState(() => localStorage.getItem(getChallengeParticipantSession(slug)) || "");
  const [selectedPromptId, setSelectedPromptId] = useState(() => localStorage.getItem(getChallengePromptSession(slug)) || "");
  const participantSelectRef = useRef<HTMLSelectElement | null>(null);
  const promptSelectRef = useRef<HTMLSelectElement | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScavengerSuccessActions, setShowScavengerSuccessActions] = useState(false);

  async function load() {
    const eventData = await api<{ event: PublicEvent }>(`/api/events/${slug}`);
    setEvent(eventData.event);
    const status = await api<{ remainingUploads: number; nickname: string | null }>(`/api/events/${slug}/guest-status?clientId=${encodeURIComponent(session.clientId)}`);
    setRemaining(status.remainingUploads);
    if (eventData.event.challenge?.type !== "COLOR_HUNT" && status.nickname && !nickname) setNickname(status.nickname);
    if (eventData.event.isRevealed) {
      const photoData = await api<{ photos: Photo[] }>(`/api/events/${slug}/photos`);
      setPhotos(photoData.photos);
    } else {
      setPhotos([]);
    }
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [slug]);

  useEffect(() => {
    if (event?.challenge?.type !== "COLOR_HUNT") return;
    const isValidParticipant = event.challenge.participants.some((participant) => participant.id === selectedParticipantId);
    if (!isValidParticipant) {
      setSelectedParticipantId("");
      localStorage.removeItem(getChallengeParticipantSession(slug));
    }
  }, [event, selectedParticipantId, slug]);

  useEffect(() => {
    if (event?.challenge?.type !== "PHOTO_SCAVENGER_HUNT") return;
    const isValidPrompt = promptsFromChallenge(event.challenge).some((prompt) => prompt.id === selectedPromptId);
    if (!isValidPrompt) {
      setSelectedPromptId("");
      localStorage.removeItem(getChallengePromptSession(slug));
    }
  }, [event, selectedPromptId, slug]);

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
  }

  async function uploadPhoto(uploadEvent: React.FormEvent) {
    uploadEvent.preventDefault();
    setMessage("");
    setError("");
    setShowScavengerSuccessActions(false);

    if (!file) return setError("Choose a photo first");
    if (!file.type.startsWith("image/")) return setError("Only image files are allowed");
    if (event?.challenge?.type === "COLOR_HUNT" && !selectedParticipant) return setError("Select your Color Hunt name first");
    if (event?.challenge?.type === "PHOTO_SCAVENGER_HUNT" && !selectedPrompt) return setError("Choose a Photo Scavenger Hunt prompt first");
    if (event?.challenge?.type !== "COLOR_HUNT" && !nickname.trim()) return setError("Enter your name or nickname first");

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("nickname", selectedParticipant?.displayName || nickname.trim());
    formData.append("clientId", session.clientId);
    if (selectedParticipant?.id) formData.append("challengeParticipantId", selectedParticipant.id);
    if (selectedPrompt?.id) formData.append("challengePromptId", selectedPrompt.id);

    setLoading(true);
    try {
      const data = await api<{ remainingUploads: number }>(`/api/events/${slug}/photos`, { method: "POST", body: formData });
      setFile(null);
      setRemaining(data.remainingUploads);
      if (event?.challenge?.type === "PHOTO_SCAVENGER_HUNT") {
        setMessage("Photo uploaded. Want to complete another prompt?");
        setShowScavengerSuccessActions(true);
      } else {
        setMessage("Photo uploaded");
      }
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const selectedParticipant = event?.challenge?.participants.find((participant) => participant.id === selectedParticipantId);
  const guestPrompts = promptsFromChallenge(event?.challenge);
  const selectedPrompt = guestPrompts.find((prompt) => prompt.id === selectedPromptId);

  function uploadAnotherForPrompt() {
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

  return (
    <Shell>
      {!event && (
        <div className="mx-auto mb-5 max-w-2xl text-center">
          <StatusPill>No app download. No account needed.</StatusPill>
        </div>
      )}
      {event && (
        <div className="mx-auto max-w-2xl">
          <section className="text-center">
            <StatusPill>No app download. No account needed.</StatusPill>
            <h1 className="mt-5 font-display text-4xl font-bold text-stone-950">{event.name}</h1>
            {event.description && <p className="mt-3 text-stone-700">{event.description}</p>}
            <p className="mt-3 text-sm text-stone-600">Reveal: {formatDateTime(event.revealAt)}</p>
            {!event.isRevealed && (
              <p className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                Photos are hidden until the reveal. Keep uploading throughout the event.
              </p>
            )}
          </section>

          {event.challenge?.type === "COLOR_HUNT" && (
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

          {event.challenge?.type === "PHOTO_SCAVENGER_HUNT" && (
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

          <form className="mt-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_24px_70px_rgba(28,25,23,0.07)] sm:p-6" onSubmit={uploadPhoto}>
            <h2 className="font-display text-2xl font-bold">Upload a photo</h2>
            <p className="mt-2 text-stone-600">{event.challenge?.type === "COLOR_HUNT" ? "Pick a photo and send it to the private album." : "Add your name, pick a photo, and send it to the private album."}</p>
            {event.challenge?.type === "COLOR_HUNT" && selectedParticipant && (
              <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-800">Posting as {selectedParticipant.displayName}</p>
            )}
            {event.challenge?.type === "PHOTO_SCAVENGER_HUNT" && selectedPrompt && (
              <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-800">Uploading for: {selectedPrompt.text}</p>
            )}
            {event.challenge?.type !== "COLOR_HUNT" && (
              <label className="mt-5 grid gap-2 text-sm font-bold text-stone-700">
                Name or nickname
                <TextInput value={nickname} onChange={(event) => saveNickname(event.target.value)} placeholder="John Doe" required />
              </label>
            )}
            <p className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm font-bold text-stone-700">
              {remaining === null ? "Checking uploads..." : `${remaining} uploads left`}
            </p>
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
                  <p className="mt-1 text-sm text-stone-600">Ready to upload</p>
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
            {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button className="mt-5 w-full" disabled={loading || remaining === 0}>{loading ? "Uploading..." : "Upload photo"}</Button>
          </form>

          {!event.isRevealed && (
            <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-display text-2xl font-bold text-[#653e00]">Album</h2>
              <p className="mt-2 text-sm font-semibold text-amber-900">Photos are hidden until the reveal. Keep uploading throughout the event.</p>
            </section>
          )}

          {event.isRevealed && (
            <section className="mt-8">
              <h2 className="font-display text-2xl font-bold">Album</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <div className="overflow-hidden rounded-3xl bg-white p-2 shadow-sm" key={photo.id}>
                    <img className="aspect-square w-full rounded-2xl object-cover" src={photo.url} alt={photo.originalFilename} />
                    {photo.challengeParticipantName && (
                      <p className="mt-2 truncate px-1 text-xs font-bold text-stone-700">{photo.challengeParticipantName} - {photo.challengeColorName}</p>
                    )}
                    {photo.challengePromptText && (
                      <p className="mt-2 truncate px-1 text-xs font-bold text-stone-700">{photo.challengePromptText}</p>
                    )}
                  </div>
                ))}
              </div>
              {!photos.length && <Card className="text-center"><p className="font-semibold text-stone-600">No photos yet.</p></Card>}
            </section>
          )}
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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<AuthForm mode="signup" />} />
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/events/new" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
          <Route path="/dashboard/events/:eventId" element={<ProtectedRoute><ManageEvent /></ProtectedRoute>} />
          <Route path="/e/:slug" element={<GuestEvent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
