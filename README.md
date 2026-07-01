# EventFilm

Mobile-first private beta for QR-based disposable camera albums at parties, summer events, and campus events.

## Live Private Beta

Frontend: https://eventfilm.vercel.app

This is an MVP/private beta for testing QR-based disposable camera albums at real events. The app is functional, but still under active development. The current go-to-market focus is summer events first, then campus events again in the fall.

## June Revenue Sprint

Goal: get 10 paid events scheduled by June 30, 2026. A paid event means the host has paid the $5 beta price and has an event link or QR code created.

Do not add new product surface until the goal is reached. Only fix blockers that prevent a real event from working: QR/link issues, uploads, host download, mobile flow blockers, or production setup issues.

See `docs/june-revenue-sprint.md` for the free beta checklist, manual sales routine, pricing offer, and outreach scripts.

## What Works

- Host sign up, login, logout with JWT auth
- Host dashboard with event list and photo counts
- Host analytics summary for guest joins, uploads, Recap opens, and moderation activity
- Event creation with a hard-to-guess public slug
- Event link and QR code generation
- Host launch link verification for guest upload and Recap links
- Public guest event page at `/e/:eventSlug`
- Guest nickname stored in local storage
- Guest image upload without an account
- Per-guest upload limits
- Reveal lock for guest album viewing
- Host photo viewing before and after reveal
- Host photo deletion
- Host download of all event photos as a `.zip`
- Supabase Storage-backed photo files with a small storage helper layer

## Project Structure

```text
/client
  React + Vite + Tailwind web app

/server
  Express API
  Prisma schema
  Supabase Storage helper for image files

/apps/mobile
  Expo React Native app

/packages/shared
  Shared TypeScript API/domain types and challenge helpers

/packages/api-client
  Shared API client for web and mobile
```

The current Vercel and Railway roots are intentionally preserved. Use `/client`
as the Vercel frontend root and `/server` as the backend service root.

## Requirements

- Node.js 20+
- PostgreSQL
- Supabase project with a private Storage bucket
- npm

On Windows, PostgreSQL can be installed with:

```powershell
winget install PostgreSQL.PostgreSQL.17 --silent --accept-package-agreements --accept-source-agreements
```

The default local development connection used by this project is:

```text
postgresql://postgres:postgres@localhost:5432/eventfilm?schema=public
```

## Environment Variables

Backend: copy `server/.env.example` to `server/.env`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eventfilm?schema=public"
NODE_ENV="development"
JWT_SECRET="replace-with-a-long-random-secret"
ANALYTICS_SALT="replace-with-a-long-random-analytics-salt"
FOUNDER_EMAILS="you@example.com"
CLIENT_URL="http://localhost:5173"
SERVER_URL="http://localhost:4000"
WEB_PUBLIC_URL="http://localhost:5173"
API_PUBLIC_URL="http://localhost:4000"
CLIENT_ORIGINS=""
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="replace-with-your-service-role-key"
SUPABASE_STORAGE_BUCKET="event-photos"
MAX_FILE_SIZE_MB="10"
PORT="4000"
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. Do not expose it in the
client app or commit a real key.

`FOUNDER_EMAILS` is a comma-separated allowlist for `/dashboard/founder`. Only
signed-in hosts whose email is listed can load the founder beta ops dashboard.
If it is missing or empty, founder access is denied safely. Use example emails
in docs and env examples; do not commit private real founder emails.

In production, the API fails fast when required backend values are missing or
when `JWT_SECRET` still uses the development fallback. Use deployed HTTPS
values for `WEB_PUBLIC_URL`/`CLIENT_URL` and `API_PUBLIC_URL`/`SERVER_URL`
before sharing links with real guests. `CLIENT_ORIGIN` or comma-separated
`CLIENT_ORIGINS` can add preview web origins for CORS; do not use wildcard
origins in production.

Frontend: copy `client/.env.example` to `client/.env`.

```env
VITE_API_URL="http://localhost:4000"
VITE_BOOKING_SMS_URL="sms:+15555555555?&body=I%20want%20to%20book%20an%20EventFilm%20beta%20event"
```

`VITE_BOOKING_SMS_URL` is optional. The app defaults to the beta booking number in code; set this only if the booking number or prefilled text should change.

Mobile: generate `apps/mobile/.env.local` from the current LAN address.

```env
EXPO_PUBLIC_API_URL="http://YOUR_LAN_IP:4000"
EXPO_PUBLIC_RELEASE_CHANNEL="development"
```

Start the API before opening Expo Go. Use a LAN IP instead of `localhost` when
testing from a physical phone; `localhost` points at the phone, not this
computer. The phone and laptop must be on the same Wi-Fi, and Windows Firewall
may need to allow Node.js on port `4000`.

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run mobile:env:lan
$env:AUTH_SMOKE_API_URL="http://YOUR_LAN_IP:4000"
npm run auth:smoke
npm run mobile:start:clear
```

Open Expo Go and sign in with `neoskizzy@gmail.com` / `EventFilm123!`.
If the app shows an old IP, run `npm run mobile:env:lan` again and restart with
`npm run mobile:start:clear`. Do not run raw `npx expo start` from the repo
root; use the root mobile scripts so Expo starts from `apps/mobile`.

Never put server secrets in `EXPO_PUBLIC_` variables.
For EAS preview or production builds, set `EXPO_PUBLIC_RELEASE_CHANNEL` to
`preview` or `production` and set `EXPO_PUBLIC_API_URL` to the deployed API URL.
The mobile app refuses release-like builds that still point at localhost.
Use `https://api.your-eventfilm-domain.com` as the safe placeholder until the
real deployed API URL is ready.

## Local Setup

1. Install dependencies.

```bash
npm install

cd server
npm install

cd ../client
npm install
```

2. Create a PostgreSQL database named `eventfilm`.

```powershell
$env:PGPASSWORD="postgres"
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -h localhost -U postgres eventfilm
```

3. Create a Supabase Storage bucket for uploaded photos.

In Supabase, create a private bucket named `event-photos`, or set
`SUPABASE_STORAGE_BUCKET` to the bucket name you choose. The server uses the
service role key to upload, fetch, and remove objects while continuing to serve
photos through the existing API routes.
Confirm the Supabase project is active/unpaused before debugging upload
`fetch failed` errors as app issues.

4. From the repo root, configure environment files.

```powershell
copy server\.env.example server\.env
copy client\.env.example client\.env
```

5. Run Prisma migration.

```bash
cd server
npm run prisma:migrate
```

6. Start the backend.

```bash
cd server
npm run dev
```

7. Start the frontend in another terminal.

```bash
cd client
npm run dev
```

Open `http://localhost:5173`.

8. Start the Expo mobile app in another terminal.

```bash
copy apps\mobile\.env.example apps\mobile\.env
npm run mobile:start
```

Do not run raw `npx expo start` from the repo root. Expo will treat the
monorepo root as the app and look for a root `App` file. Use
`npm run mobile:start` from the repo root, `npm run mobile:start:clear` when
you need a clean Metro cache, or run `npx expo start` after `cd apps/mobile`.

See `docs/mobile.md` for Expo, EAS Build, EAS Update, and cross-platform feature workflow notes.

9. Optional: create dev-only beta demo events.

```bash
npm run seed:beta-demo -w server
```

This creates challenge-configured demo events without fake production photos.
Clean them up with:

```bash
npm run seed:beta-demo -w server -- --cleanup
```

To reset the local mobile sign-in host account used for Expo Go smoke tests:

```bash
npm run dev-host:reset
```

This creates or resets `neoskizzy@gmail.com` with the dev-only password
`EventFilm123!` in the current local database and refuses to run when
`NODE_ENV=production`.

## MVP Test Flow

Host:

1. Sign up.
2. Log in.
3. Create an event.
4. Copy the event link or download the QR code.
5. Open the manage event page.
6. See uploaded photos.
7. Delete a photo.
8. Download all photos as a zip.

Guest:

1. Open the event link without logging in.
2. Enter a nickname.
3. Upload photos from phone or computer.
4. See remaining uploads.
5. See the album locked before reveal time.
6. View the album after reveal time.

## Known Limitations

- Deleted photos are soft-deleted in the database and removed from Supabase Storage.
- Payment is manual for MVP testing. The landing page includes pricing, but Stripe is intentionally not implemented.
- There is no email verification or password reset yet.
- The public image file endpoint uses hard-to-guess photo IDs and proxies private Supabase objects through the API.
- Before 10 paid summer events are scheduled, do not add Stripe, password reset, pricing tiers, admin dashboards, custom branding, or advanced album features.

## Private Beta Deployment Notes

- Provision a hosted PostgreSQL database and run Prisma migrations before starting the server.
- Create the private Supabase Storage bucket named by `SUPABASE_STORAGE_BUCKET`.
- Configure backend environment variables on the deployment host: `DATABASE_URL`, `NODE_ENV=production`, `JWT_SECRET`, `ANALYTICS_SALT`, `WEB_PUBLIC_URL` or `CLIENT_URL`, `API_PUBLIC_URL` or `SERVER_URL`, `CLIENT_ORIGINS` if needed, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `MAX_FILE_SIZE_MB`, and `PORT`.
- Configure `FOUNDER_EMAILS` on the API host before using `/dashboard/founder`; leave it empty to disable founder access.
- Configure the frontend deployment with `VITE_API_URL` pointing at the deployed API.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the backend environment.
- Verify the private beta flow after deployment: API health, host signup/login, event creation, guest upload, host list, launch link verification, Recap, hide/restore moderation, direct photo view, analytics summary, and zip download.
- Verify the founder beta ops dashboard with an allowlisted host account: overview metrics, recent activity, feedback inbox, template/mode insights, and CSV export for Unlock Alabama reporting.
- See `docs/real-event-qa.md` before testing with a real host.
- See `docs/deployment-readiness.md` for the deployment, storage, CORS, migration, EAS, smoke, and rollback checklists.
- See `docs/beta-release-candidate-checklist.md` for the final deployed beta go/no-go checklist.
- See `docs/first-host-beta-handoff.md` before handing a real beta host the product.
- See `docs/demo-recording-checklist.md` before recording the release-candidate demo.

## Vercel Frontend Deployment

Use the `/client` directory as the Vercel project root.

```text
Root directory: client
Build command: npm run build
Output directory: dist
```

Required frontend environment variables:

```env
VITE_API_URL="https://api.your-eventfilm-domain.com"
VITE_BOOKING_SMS_URL="sms:+15555555555?&body=I%20want%20to%20book%20an%20EventFilm%20beta%20event"
```

`VITE_API_URL` must point at the deployed API base URL and should not include a
trailing path such as `/api`.
Use `https://api.your-eventfilm-domain.com` as the explicit placeholder while
setting up deployment. The web app itself should deploy at
`https://your-eventfilm-domain.com`.
`VITE_BOOKING_SMS_URL` is optional and only needed if changing the booking number or prefilled text.

## Railway Backend Deployment

Use the `/server` directory as the Railway service root.

```text
Root directory: server
Build command: npm run build
Start command: npm start
```

The build command runs `prisma generate`. The `prestart` script also runs
`prisma generate` before `node src/index.js`, so Prisma Client is available
when Railway starts the API.

Run production migrations against the Railway database before first use and
whenever new migrations are added:

```bash
npm run prisma:deploy
```

Required backend environment variables:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret"
ANALYTICS_SALT="long-random-analytics-salt"
FOUNDER_EMAILS="you@example.com"
WEB_PUBLIC_URL="https://your-frontend-domain"
API_PUBLIC_URL="https://your-api-domain"
CLIENT_ORIGINS="https://your-frontend-domain"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_STORAGE_BUCKET="event-photos"
MAX_FILE_SIZE_MB="10"
PORT="4000"
```

Railway normally provides `PORT` automatically. If it is not set, the server
falls back to `4000`.

## Mobile Internal Beta

The Expo app is the host command center. Guests should continue using web links
from QR codes or messages.

Before an EAS preview/internal build:

```bash
cd apps/mobile
npx eas-cli@latest build --profile preview --platform all
```

Replace the `https://api.your-eventfilm-domain.com` `EXPO_PUBLIC_API_URL`
placeholder in `apps/mobile/eas.json` with the deployed API URL or override it
in EAS environment settings. The preview and production profiles set
`EXPO_PUBLIC_RELEASE_CHANNEL` so localhost URLs fail early instead of shipping
to testers.

## Workspace Checks

From the repo root:

```bash
npm run preflight
npm run check:shared
npm run check:api-client
npm run check:web
npm run check:api
npm run check:mobile
npm run lint:mobile
npm run build:web
npm run check
```

Browser and storage smoke commands:

```bash
npm run demo:seed
npm run smoke:browser
npm run smoke:storage
npm run demo:cleanup
```

`smoke:browser` expects the web and API servers to be reachable. Override with
`EVENTFILM_WEB_URL`, `BROWSER_SMOKE_BASE_URL`, `EVENTFILM_API_URL`, and
`EVENTFILM_SMOKE_EVENT_SLUG` when testing non-default URLs. `smoke:storage` expects real Supabase-backed API
configuration and never commits or prints storage secrets. The storage smoke
uses the revealed `eventfilm-beta-demo-storage-smoke` seed event by default and
verifies upload, DB record, album, Recap, moderation, reporting,
analytics, and cleanup.

Deployed smoke commands:

```bash
npm run smoke:deployed:api
npm run smoke:deployed:browser
npm run smoke:deployed:storage
npm run smoke:deployed:all
```

Set `DEPLOYED_API_URL`, `DEPLOYED_WEB_URL`, and `DEPLOYED_SMOKE_EVENT_SLUG`
for deployed checks. Add `DEPLOYED_SMOKE_HOST_EMAIL` and
`DEPLOYED_SMOKE_HOST_PASSWORD` only for a dedicated target-environment smoke
host. Missing deployed URLs should produce clear missing-env output, not fake
success.

The guest web upload flow remains the lowest-friction path for event attendees.
Do not make a native app install required for QR/link uploads.

## Next Steps

- Run one privately offered free beta with at least 10 guests.
- Send 20 outreach messages per day until June 30, 2026.
- Personally create event links and QR codes for interested hosts.
- Fix only event-flow blockers until 10 paid events are scheduled.
