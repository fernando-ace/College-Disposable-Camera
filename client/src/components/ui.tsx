import React from "react";
import { Link, NavLink } from "react-router-dom";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  const common = {
    className: cx("h-5 w-5 shrink-0", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
  const paths: Record<string, React.ReactNode> = {
    album: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="m7 15 3-3 2 2 3-4 2 3" /></>,
    arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3.5 10h17" /></>,
    camera: <><path d="M14.5 5 13 3.5H8L6.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" /><circle cx="12" cy="12.5" r="3.4" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    heart: <path d="M20.8 8.6c0 5.5-8.8 10.4-8.8 10.4S3.2 14.1 3.2 8.6A4.6 4.6 0 0 1 12 6.5a4.6 4.6 0 0 1 8.8 2.1z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></>,
    image: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 15 3-3 2 2 3-4 3 5" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.2-1.2" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    message: <><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H6l-3 2 .8-4A8.5 8.5 0 1 1 21 12z" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    paperPlane: <><path d="m22 2-7 20-4-9-9-4 20-7z" /><path d="M22 2 11 13" /></>,
    photoWall: <><rect x="3" y="5" width="18" height="13" rx="2" /><path d="M8 21h8" /><path d="M12 18v3" /><path d="m10 9 5 3-5 3z" /></>,
    qr: <><path d="M4 4h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6H4z" /><path d="M14 14h2v2h-2z" /><path d="M18 14h2v6h-6v-2h4z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8.3 1.7 1.7 0 0 0-.8 1.5V22h-4v-.1a1.7 1.7 0 0 0-.8-1.5 1.7 1.7 0 0 0-1.8-.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 6.6 15 1.7 1.7 0 0 0 5 14H4v-4h1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.8-.3A1.7 1.7 0 0 0 11 2h4a1.7 1.7 0 0 0 .8 1.5 1.7 1.7 0 0 0 1.8.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.8A1.7 1.7 0 0 0 21 10h1v4h-1a1.7 1.7 0 0 0-1.6 1z" /></>,
    upload: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
  };

  return <svg {...common}>{paths[name] || paths.album}</svg>;
}

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link className={cx("inline-flex items-center gap-2 font-bold text-coral", className)} to="/">
      <span className="grid h-7 w-7 place-items-center rounded-md border border-coral text-coral">
        <Icon name="camera" className="h-4 w-4" />
      </span>
      <span>EventFilm</span>
    </Link>
  );
}

export function PrimaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-coral px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-coral-strong disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none", className)} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-5 py-3 text-sm font-semibold text-ink shadow-none transition hover:border-coral/40 hover:bg-coral-soft disabled:cursor-not-allowed disabled:text-stone-400", className)} {...props}>
      {children}
    </button>
  );
}

export function TextButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx("inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-muted transition hover:bg-stone-100 hover:text-ink disabled:cursor-not-allowed disabled:text-stone-400", className)} {...props}>
      {children}
    </button>
  );
}

export function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cx("py-14 sm:py-18", className)}>{children}</section>;
}

export function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cx("rounded-xl border border-line bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-coral-soft text-coral">
        <Icon name="image" />
      </div>
      <h3 className="mt-4 font-serif-display text-2xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif-display text-4xl font-bold leading-tight text-ink">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AppShell({ children, userEmail, canViewFounder = false }: { children: React.ReactNode; userEmail?: string; canViewFounder?: boolean }) {
  const navItems = [
    { to: "/dashboard", label: "Home", icon: "home" },
    { to: "/dashboard/events/new", label: "Create", icon: "calendar" },
  ];
  return (
    <div className="min-h-screen bg-app">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-white/95 px-5 py-5 lg:flex lg:flex-col">
        <BrandMark />
        <nav className="mt-8 grid gap-1">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) => cx("flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition", isActive ? "bg-coral-soft text-coral" : "text-muted hover:bg-stone-100 hover:text-ink")}
              to={item.to}
              key={item.to}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto grid gap-1">
          {canViewFounder ? (
            <details className="rounded-lg border border-line bg-white p-2 text-sm">
              <summary className="cursor-pointer list-none px-2 py-1 font-semibold text-muted">More</summary>
              <div className="mt-2 grid gap-1">
                <Link className="rounded-md px-2 py-2 text-muted hover:bg-stone-100" to="/dashboard/founder">Founder view</Link>
                <Link className="rounded-md px-2 py-2 text-muted hover:bg-stone-100" to="/dashboard/beta-readiness">Beta readiness</Link>
              </div>
            </details>
          ) : null}
          <div className="rounded-xl border border-line bg-stone-50 p-3">
            <p className="text-xs font-semibold text-muted">Signed in</p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">{userEmail || "Host"}</p>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <BrandMark />
          <Link className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink" to="/dashboard/events/new">Create</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

export function Stepper({ steps, activeStep, onStepClick }: { steps: string[]; activeStep: number; onStepClick?: (index: number) => void }) {
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-white p-3 sm:grid-cols-3">
      {steps.map((step, index) => {
        const active = activeStep === index;
        return (
          <button
            type="button"
            className={cx("flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition", active ? "bg-coral-soft text-ink" : "text-muted hover:bg-stone-50")}
            onClick={() => onStepClick?.(index)}
            key={step}
          >
            <span className={cx("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", active ? "bg-coral text-white" : "bg-stone-100 text-muted")}>{index + 1}</span>
            <span className="font-semibold">{step}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ tabs, activeTab, onChange }: { tabs: Array<{ key: string; label: string }>; activeTab: string; onChange: (key: string) => void }) {
  return (
    <div className="overflow-x-auto border-b border-line">
      <div className="flex min-w-max gap-6">
        {tabs.map((tab) => (
          <button
            type="button"
            className={cx("border-b-2 px-1 py-4 text-sm font-semibold transition", activeTab === tab.key ? "border-coral text-coral" : "border-transparent text-muted hover:text-ink")}
            onClick={() => onChange(tab.key)}
            key={tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LinkCopyCard({ title, description, value, actionLabel, onAction }: { title: string; description?: string; value: string; actionLabel: string; onAction: () => void }) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          <input className="mt-4 w-full rounded-lg border border-line bg-stone-50 px-3 py-3 text-sm font-semibold text-muted" readOnly value={value} aria-label={title} />
        </div>
        <PrimaryButton type="button" onClick={onAction}>
          <Icon name="copy" />
          {actionLabel}
        </PrimaryButton>
      </div>
    </Card>
  );
}

export function PhotoGrid({ photos, onPhotoClick, emptyTitle = "No photos yet" }: { photos: Array<{ id: string; url?: string; previewUrl?: string; challengeParticipantName?: string | null; guestNickname?: string | null }>; onPhotoClick?: (photo: any) => void; emptyTitle?: string }) {
  if (!photos.length) {
    return <EmptyState title={emptyTitle} body="Share the guest link so people can add theirs." />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo) => (
        <button type="button" className="group overflow-hidden rounded-xl bg-stone-100 text-left" onClick={() => onPhotoClick?.(photo)} key={photo.id}>
          <img className="aspect-square w-full object-cover transition group-hover:scale-[1.02]" src={photo.previewUrl || photo.url} alt={photo.challengeParticipantName || photo.guestNickname || "Event photo"} />
        </button>
      ))}
    </div>
  );
}

export function MobileStickyAction({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 p-3 backdrop-blur sm:hidden">{children}</div>;
}
