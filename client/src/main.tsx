import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error("VITE_API_URL is required. Set it to the deployed API base URL.");
}

const API_BASE_URL = API_URL.startsWith("http://") || API_URL.startsWith("https://") ? API_URL : `https://${API_URL}`;
const DEFAULT_BOOKING_TEXT = "I want to book an EventFilm beta event";
const BOOKING_SMS_URL = import.meta.env.VITE_BOOKING_SMS_URL || `sms:?&body=${encodeURIComponent(DEFAULT_BOOKING_TEXT)}`;

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
};
type Photo = {
  id: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  guestNickname?: string;
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
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Copy command failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

function getGuestSession(slug: string) {
  const key = `eventfilm_guest_${slug}`;
  const saved = localStorage.getItem(key);
  if (saved) return { key, session: JSON.parse(saved) as { clientId: string; nickname: string } };
  const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return { key, session: { clientId, nickname: "" } };
}

function Button({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-lg bg-orange-700 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-orange-700" {...props} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base outline-none focus:border-orange-700" {...props} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-bold">EventFilm</Link>
          <nav className="flex items-center gap-2 text-sm">
            {auth.token ? (
              <>
                <Link className="rounded-lg px-3 py-2 font-semibold" to="/dashboard">Dashboard</Link>
                <button className="rounded-lg px-3 py-2 font-semibold" onClick={auth.logout}>Log out</button>
              </>
            ) : (
              <>
                <Link className="rounded-lg px-3 py-2 font-semibold" to="/login">Host login</Link>
                <a className="rounded-lg bg-orange-700 px-3 py-2 font-semibold text-white" href={BOOKING_SMS_URL}>Book beta</a>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

function Landing() {
  return (
    <Shell>
      <section className="py-8">
        <p className="mb-3 text-sm font-bold uppercase text-orange-700">Summer private beta</p>
        <h1 className="max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">Disposable camera albums for parties and summer events.</h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-700">I set up your event link and QR code for you. Guests scan and upload with no app download, then you get the album and download after the event.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a className="rounded-lg bg-orange-700 px-5 py-3 text-center font-semibold text-white" href={BOOKING_SMS_URL}>Text to book beta</a>
          <Link className="rounded-lg border border-stone-300 bg-white px-5 py-3 text-center font-semibold" to="/login">Host login</Link>
        </div>
        <Link className="mt-4 inline-block text-sm font-semibold text-stone-600 underline" to="/signup">Already invited to host? Create account</Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        {["Text to book", "I set up the QR", "Guests upload photos", "Download the album"].map((step, index) => (
          <div className="rounded-lg border border-stone-200 bg-white p-4" key={step}>
            <div className="text-sm font-bold text-orange-700">Step {index + 1}</div>
            <div className="mt-2 font-semibold">{step}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-xl font-bold">Simple summer beta pricing</h2>
        <p className="mt-2 text-sm text-stone-600">Manual payment for the beta. No account needed for guests.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["$5 beta event", "Setup included", "Limited to first 10 paid summer events"].map((plan) => (
            <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700" key={plan}>{plan}</p>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-xl font-bold">Beta setup included</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["I create your event link and QR code", "Guests scan and upload without an app", "You get the album and photo download"].map((item) => (
            <p className="rounded-lg bg-stone-50 p-3 text-sm font-semibold text-stone-700" key={item}>{item}</p>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-xl font-bold">Great for</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {["Birthday parties", "Graduation parties", "Lake and beach trips", "Wedding showers", "Small receptions", "Club socials"].map((eventType) => (
            <p className="rounded-lg bg-stone-50 p-3 text-sm font-semibold text-stone-700" key={eventType}>{eventType}</p>
          ))}
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
      <form className="mx-auto max-w-md rounded-lg border border-stone-200 bg-white p-5" onSubmit={submit}>
        <h1 className="text-2xl font-bold">{mode === "signup" ? "Create host account" : "Host login"}</h1>
        <label className="mt-5 block text-sm font-semibold">Email</label>
        <TextInput autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="mt-4 block text-sm font-semibold">Password</label>
        <TextInput autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="mt-5 w-full" disabled={loading}>{loading ? "Working..." : mode === "signup" ? "Sign up" : "Log in"}</Button>
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
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ events: EventSummary[] }>("/api/host/events", { token: auth.token })
      .then((data) => setEvents(data.events))
      .catch((err) => setError((err as Error).message));
  }, [auth.token]);

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Host dashboard</h1>
          <p className="text-sm text-stone-600">{auth.user?.email}</p>
        </div>
        <Link className="rounded-lg bg-orange-700 px-4 py-3 text-sm font-semibold text-white" to="/dashboard/events/new">New event</Link>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid gap-4">
        {events.map((event) => (
          <Link className="rounded-lg border border-stone-200 bg-white p-4" to={`/dashboard/events/${event.id}`} key={event.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{event.name}</h2>
                <p className="text-sm text-stone-600">Event: {formatDateTime(event.eventDate)}</p>
                <p className="text-sm text-stone-600">Reveal: {formatDateTime(event.revealAt)}</p>
              </div>
              <div className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold">{event.photoCount} photos</div>
            </div>
          </Link>
        ))}
        {!events.length && <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-600">No events yet. Create one to get a QR code.</p>}
      </div>
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
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await api<{ event: EventSummary }>("/api/host/events", {
        method: "POST",
        token: auth.token,
        body: JSON.stringify({
          ...form,
          eventDate: new Date(form.eventDate).toISOString(),
          revealAt: new Date(form.revealAt).toISOString(),
          photoLimitPerGuest: Number(form.photoLimitPerGuest),
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
        <div className="mx-auto max-w-xl rounded-lg border border-stone-200 bg-white p-5">
          <h1 className="text-2xl font-bold">Event created</h1>
          <p className="mt-2 text-sm text-stone-600">Share this link or QR code with guests.</p>
          <input className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-3 text-sm" readOnly value={created.eventLink} />
          {copyStatus && <p className="mt-2 text-sm font-semibold text-orange-700">{copyStatus}</p>}
          <div className="mt-4 flex justify-center">
            <img className="h-64 w-64" src={created.qrCodeDataUrl} alt="Event QR code" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
            <Button onClick={() => downloadDataUrl(created.qrCodeDataUrl || "", `${created.name}-qr.png`)}>Download QR</Button>
            <Button onClick={() => navigate(`/dashboard/events/${created.id}`)}>Manage event</Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form className="mx-auto max-w-xl rounded-lg border border-stone-200 bg-white p-5" onSubmit={submit}>
        <h1 className="text-2xl font-bold">Create event</h1>
        <label className="mt-5 block text-sm font-semibold">Event name</label>
        <TextInput value={form.name} onChange={(event) => update("name", event.target.value)} required />
        <label className="mt-4 block text-sm font-semibold">Event date</label>
        <TextInput type="datetime-local" value={form.eventDate} onChange={(event) => update("eventDate", event.target.value)} required />
        <label className="mt-4 block text-sm font-semibold">Reveal date/time</label>
        <TextInput type="datetime-local" value={form.revealAt} onChange={(event) => update("revealAt", event.target.value)} required />
        <label className="mt-4 block text-sm font-semibold">Photo limit per guest</label>
        <TextInput type="number" min="1" value={form.photoLimitPerGuest} onChange={(event) => update("photoLimitPerGuest", event.target.value)} required />
        <label className="mt-4 block text-sm font-semibold">Description</label>
        <TextArea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} />
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <Button className="mt-5 w-full">Create event</Button>
      </form>
    </Shell>
  );
}

function ManageEvent() {
  const { eventId } = useParams();
  const auth = useAuth();
  const [event, setEvent] = useState<(EventSummary & { photos: Photo[] }) | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  async function load() {
    const data = await api<{ event: EventSummary & { photos: Photo[] } }>(`/api/host/events/${eventId}`, { token: auth.token });
    setEvent(data.event);
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [eventId]);

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

  return (
    <Shell>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {event && (
        <>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            <p className="mt-2 text-sm text-stone-600">Reveal: {formatDateTime(event.revealAt)}</p>
            <p className="text-sm text-stone-600">Limit: {event.photoLimitPerGuest} photos per guest</p>
            <p className="text-sm text-stone-600">Uploaded: {event.photoCount} photos</p>
            <input className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-3 text-sm" readOnly value={event.eventLink} />
            {copyStatus && <p className="mt-2 text-sm font-semibold text-orange-700">{copyStatus}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]">
              <img className="h-40 w-40" src={event.qrCodeDataUrl} alt="Event QR code" />
              <div className="grid content-start gap-3">
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
                  Copy event link
                </Button>
                <Button onClick={() => downloadDataUrl(event.qrCodeDataUrl || "", `${event.name}-qr.png`)}>Download QR</Button>
                <Button onClick={downloadZip}>Download all photos</Button>
              </div>
            </div>
          </div>

          <section className="mt-6">
            <h2 className="text-xl font-bold">Photos</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {event.photos.map((photo) => (
                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white" key={photo.id}>
                  <img className="aspect-square w-full object-cover" src={photo.url} alt={photo.originalFilename} />
                  <div className="p-3 text-sm">
                    <p className="truncate font-semibold">{photo.guestNickname || "Guest"}</p>
                    <p className="text-stone-600">{formatDateTime(photo.createdAt)}</p>
                    <button className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white" onClick={() => deletePhoto(photo.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            {!event.photos.length && <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-600">No photos uploaded yet.</p>}
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const eventData = await api<{ event: PublicEvent }>(`/api/events/${slug}`);
    setEvent(eventData.event);
    const status = await api<{ remainingUploads: number; nickname: string | null }>(`/api/events/${slug}/guest-status?clientId=${encodeURIComponent(session.clientId)}`);
    setRemaining(status.remainingUploads);
    if (status.nickname && !nickname) setNickname(status.nickname);
    if (eventData.event.isRevealed) {
      const photoData = await api<{ photos: Photo[] }>(`/api/events/${slug}/photos`);
      setPhotos(photoData.photos);
    }
  }

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [slug]);

  function saveNickname(nextNickname: string) {
    setNickname(nextNickname);
    const nextSession = { ...session, nickname: nextNickname };
    localStorage.setItem(key, JSON.stringify(nextSession));
    setGuestSessionState({ key, session: nextSession });
  }

  async function uploadPhoto(uploadEvent: React.FormEvent) {
    uploadEvent.preventDefault();
    setMessage("");
    setError("");

    if (!file) return setError("Choose a photo first");
    if (!file.type.startsWith("image/")) return setError("Only image files are allowed");
    if (!nickname.trim()) return setError("Enter your name or nickname first");

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("nickname", nickname.trim());
    formData.append("clientId", session.clientId);

    setLoading(true);
    try {
      const data = await api<{ remainingUploads: number }>(`/api/events/${slug}/photos`, { method: "POST", body: formData });
      setFile(null);
      setRemaining(data.remainingUploads);
      setMessage("Photo uploaded");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      {event && (
        <div className="mx-auto max-w-2xl">
          <section className="rounded-lg border border-stone-200 bg-white p-5">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            {event.description && <p className="mt-2 text-stone-700">{event.description}</p>}
            <p className="mt-3 text-sm text-stone-600">Reveal: {formatDateTime(event.revealAt)}</p>
            {!event.isRevealed && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Photos are locked until {formatDateTime(event.revealAt)}.</p>}
          </section>

          <form className="mt-5 rounded-lg border border-stone-200 bg-white p-5" onSubmit={uploadPhoto}>
            <h2 className="text-xl font-bold">Upload a photo</h2>
            <label className="mt-4 block text-sm font-semibold">Name or nickname</label>
            <TextInput value={nickname} onChange={(event) => saveNickname(event.target.value)} placeholder="Aubie" required />
            <p className="mt-3 text-sm text-stone-600">
              {remaining === null ? "Checking uploads..." : `${remaining} uploads left`}
            </p>
            <label className="mt-4 block text-sm font-semibold">Photo</label>
            <input className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3" type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            {message && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
            {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button className="mt-5 w-full" disabled={loading || remaining === 0}>{loading ? "Uploading..." : "Upload photo"}</Button>
          </form>

          {event.isRevealed && (
            <section className="mt-6">
              <h2 className="text-xl font-bold">Album</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => <img className="aspect-square w-full rounded-lg object-cover" src={photo.url} alt={photo.originalFilename} key={photo.id} />)}
              </div>
              {!photos.length && <p className="mt-4 rounded-lg border border-dashed border-stone-300 p-6 text-center text-stone-600">No photos yet.</p>}
            </section>
          )}
        </div>
      )}
      {!event && !error && <p>Loading event...</p>}
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
